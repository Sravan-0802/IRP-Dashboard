import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import express from "express";
import { build } from "esbuild";
import ts from "typescript";

const dbRequire = createRequire(new URL("../../../../lib/db/src/index.ts", import.meta.url));
const pg = dbRequire("pg");
const { drizzle } = dbRequire("drizzle-orm/node-postgres");
const { eq, sql } = dbRequire("drizzle-orm");
const { integer, pgTable, text, timestamp } = dbRequire("drizzle-orm/pg-core");
const testDatabaseUrl = process.env.PROGRAM_BOARD_TEST_DATABASE_URL;

test("program board persists safely in an isolated PostgreSQL schema", {
  skip: !testDatabaseUrl && "Set PROGRAM_BOARD_TEST_DATABASE_URL to a dedicated *_test database to run this suite.",
}, async (t) => {
  const dbUrl = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(dbUrl.pathname.slice(1));
  if (!/(?:^|[_-])test$/i.test(databaseName)) {
    throw new Error("The dedicated program-board test database name must end in _test or -test.");
  }

  const applicationUrl = process.env.DATABASE_URL;
  if (applicationUrl) {
    const appDb = new URL(applicationUrl);
    const sameDatabase = dbUrl.hostname === appDb.hostname
      && dbUrl.port === appDb.port
      && databaseName === decodeURIComponent(appDb.pathname.slice(1));
    if (sameDatabase) {
      throw new Error("Refusing to run against the application's configured database.");
    }
  }

  const schemaName = `program_board_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new pg.Pool({ connectionString: testDatabaseUrl, max: 1 });
  let boardPool;
  let server;

  try {
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    const isolatedUrl = new URL(testDatabaseUrl);
    isolatedUrl.searchParams.set("options", `-c search_path=${schemaName}`);
    boardPool = new pg.Pool({ connectionString: isolatedUrl.toString(), max: 1 });

    const programBoardTable = pgTable("program_board", {
      id: integer("id").primaryKey().default(1),
      payload: text("payload").notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    });
    const db = drizzle(boardPool);
    const source = await readFile(new URL("./programBoard.ts", import.meta.url), "utf8");
    const context = {
      exports: {},
      require(name) {
        if (name === "@workspace/db") return { db, pool: boardPool, programBoardTable };
        if (name === "drizzle-orm") return { eq, sql };
        throw new Error(`Unexpected program-board dependency: ${name}`);
      },
      URL,
      Date,
    };
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, context);
    const boardModule = context.exports;
    globalThis.__programBoardIntegration = boardModule;

    const routerModule = await buildAdminRouter();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.log = { error() {} };
      next();
    });
    app.use("/api", routerModule);
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/program-board`;
    const adminHeaders = { "x-api-key": "program-board-integration-test" };

    const getBoard = async () => {
      const response = await fetch(baseUrl, { headers: adminHeaders });
      assert.equal(response.status, 200);
      return response.json();
    };
    const saveBoard = async (board, expectedUpdatedAt) => fetch(baseUrl, {
      method: "PUT",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ ...board, expectedUpdatedAt }),
    });

    await t.test("initial save is readable from the isolated database", async () => {
      const empty = await getBoard();
      assert.equal(empty.updatedAt, null);

      const initial = {
        genai: boardModule.PROGRAM_BOARD_DEFAULTS.genai,
        calendar: {
          upcoming: [],
          events: [
            calendarEvent("may-old", "2034-05-12", "May assessment"),
            calendarEvent("june-keep", "2034-06-09", "June assessment"),
          ],
        },
      };
      const response = await saveBoard(initial, null);
      assert.equal(response.status, 200);
      const saved = await response.json();
      assert.ok(saved.updatedAt);
      assert.deepEqual(saved.calendar.events, initial.calendar.events);

      const readBack = await getBoard();
      assert.deepEqual(readBack, saved);
    });

    await t.test("replacing one month preserves schedules in other months", async () => {
      const before = await getBoard();
      const replacement = {
        ...before,
        calendar: {
          ...before.calendar,
          events: [
            ...before.calendar.events.filter((event) => !event.date.startsWith("2034-05")),
            calendarEvent("may-new", "2034-05-18", "Replacement May assessment"),
          ],
        },
      };
      const response = await saveBoard(replacement, before.updatedAt);
      assert.equal(response.status, 200);
      const saved = await response.json();
      assert.deepEqual(saved.calendar.events.map(({ id }) => id), ["june-keep", "may-new"]);
      assert.equal(saved.calendar.events.find(({ id }) => id === "june-keep").label, "June assessment");
    });

    await t.test("a second admin's stale save returns HTTP 409", async () => {
      const [adminOneView, adminTwoView] = await Promise.all([getBoard(), getBoard()]);
      assert.equal(adminOneView.updatedAt, adminTwoView.updatedAt);

      const adminOneDraft = {
        ...adminOneView,
        calendar: {
          ...adminOneView.calendar,
          events: adminOneView.calendar.events.map((event) =>
            event.id === "june-keep" ? { ...event, label: "Saved by admin one" } : event),
        },
      };
      const firstResponse = await saveBoard(adminOneDraft, adminOneView.updatedAt);
      assert.equal(firstResponse.status, 200);
      const firstSaved = await firstResponse.json();
      assert.notEqual(firstSaved.updatedAt, adminOneView.updatedAt);

      const adminTwoDraft = {
        ...adminTwoView,
        calendar: {
          ...adminTwoView.calendar,
          events: adminTwoView.calendar.events.map((event) =>
            event.id === "june-keep" ? { ...event, label: "Stale admin two edit" } : event),
        },
      };
      const staleResponse = await saveBoard(adminTwoDraft, adminTwoView.updatedAt);
      assert.equal(staleResponse.status, 409);
      assert.match((await staleResponse.json()).error, /newer schedule/);

      const persisted = await getBoard();
      assert.deepEqual(persisted, firstSaved);
    });

    await t.test("rejected input leaves the stored schedule and version unchanged", async () => {
      const before = await getBoard();
      const invalidDraft = {
        ...before,
        calendar: {
          ...before.calendar,
          events: [calendarEvent("invalid-date", "2034-02-31", "Invalid assessment")],
        },
      };
      const response = await saveBoard(invalidDraft, before.updatedAt);
      assert.equal(response.status, 400);

      const after = await getBoard();
      assert.deepEqual(after, before);
    });
  } finally {
    delete globalThis.__programBoardIntegration;
    if (server) await new Promise((resolve) => server.close(resolve));
    if (boardPool) await boardPool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await adminPool.end();
  }
});

function calendarEvent(id, date, label) {
  return {
    id,
    date,
    program: "irp",
    label,
    mode: "online",
    link: "https://example.com/assessment",
  };
}

async function buildAdminRouter() {
  const adminPath = fileURLToPath(new URL("../routes/admin.ts", import.meta.url));
  const adminSource = await readFile(adminPath, "utf8");
  const imports = new Map();
  for (const match of adminSource.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];/g)) {
    const names = match[1]
      .split(",")
      .map((item) => item.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);
    imports.set(match[2], [...new Set([...(imports.get(match[2]) ?? []), ...names])]);
  }

  const compiled = await build({
    entryPoints: [adminPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    external: ["express"],
    plugins: [{
      name: "program-board-integration-dependencies",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@workspace\/(api-zod|db)$/ }, ({ path }) => ({
          path,
          namespace: "program-board-test",
        }));
        buildContext.onResolve({ filter: /^drizzle-orm$/ }, ({ path }) => ({
          path,
          namespace: "program-board-test",
        }));
        buildContext.onResolve({ filter: /^\.\.\/lib\// }, ({ path }) => ({
          path: path.slice("../lib/".length),
          namespace: "program-board-test",
        }));
        buildContext.onLoad({ filter: /.*/, namespace: "program-board-test" }, ({ path }) => {
          if (path === "@workspace/api-zod") {
            const exports = [...new Set(imports.get(path) ?? [])];
            return {
              loader: "js",
              contents: `${exports.map((name) => `export const ${name} = { parse: value => value, safeParse: value => ({ success: true, data: value }) };`).join("\n")}`,
            };
          }
          if (path === "@workspace/db") {
            const exports = [...new Set(imports.get(path) ?? [])];
            return {
              loader: "js",
              contents: `
                const unusedDatabaseDependency = new Proxy({}, { get: () => new Proxy({}, { get: () => undefined }) });
                ${exports.map((name) => `export const ${name} = ${name === "db" ? "unusedDatabaseDependency" : "unusedDatabaseDependency"};`).join("\n")}
              `,
            };
          }
          if (path === "drizzle-orm") {
            const exports = [...new Set(imports.get(path) ?? [])];
            return {
              loader: "js",
              contents: exports.map((name) => `export const ${name} = () => undefined;`).join("\n"),
            };
          }
          const specifier = `../lib/${path}`;
          const exports = [...new Set(imports.get(specifier) ?? [])];
          if (path === "apiKey") {
            return {
              loader: "js",
              contents: `export const checkApiKey = req => req.headers["x-api-key"] === "program-board-integration-test";`,
            };
          }
          if (path === "programBoard") {
            return {
              loader: "js",
              contents: `
                const board = globalThis.__programBoardIntegration;
                export const getProgramBoard = (...args) => board.getProgramBoard(...args);
                export const parseProgramBoardBody = (...args) => board.parseProgramBoardBody(...args);
                export const ProgramBoardConflictError = board.ProgramBoardConflictError;
                export const updateProgramBoard = (...args) => board.updateProgramBoard(...args);
              `,
            };
          }
          return {
            loader: "js",
            contents: exports.map((name) => `export const ${name} = async () => undefined;`).join("\n"),
          };
        });
      },
    }],
  });
  const routeModule = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(
    createRequire(import.meta.url),
    routeModule,
    routeModule.exports,
  );
  return routeModule.exports.default;
}
