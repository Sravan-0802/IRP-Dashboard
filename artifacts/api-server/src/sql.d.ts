// SQL files are bundled as plain text by esbuild (build.mjs: loader ".sql": "text").
declare module "*.sql" {
  const sql: string;
  export default sql;
}
