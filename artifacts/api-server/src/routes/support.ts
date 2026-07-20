import { Router } from "express";
import { db } from "@workspace/db";
import {
  supportConversationsTable,
  supportMessagesTable,
  academyUserBasicDetailsTable,
} from "@workspace/db";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { resolveAcademyUserId } from "../lib/auth";
import { checkApiKey } from "../lib/apiKey";

const router = Router();

const AUTO_ACK =
  "Thanks for reaching out! Our support team has received your message and will get back to you as soon as possible.";

const VALID_STATUSES = new Set([
  "open",
  "resolved",
  "closed",
  "waiting_for_student",
  "waiting_for_support",
]);

// GET /api/support/conversation — student's conversation + messages
router.get("/support/conversation", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [conv] = await db
      .select()
      .from(supportConversationsTable)
      .where(eq(supportConversationsTable.academyUserId, userId))
      .orderBy(desc(supportConversationsTable.createdAt))
      .limit(1);

    if (!conv) {
      res.json({ conversation: null, messages: [] });
      return;
    }

    const messages = await db
      .select()
      .from(supportMessagesTable)
      .where(eq(supportMessagesTable.conversationId, conv.id))
      .orderBy(asc(supportMessagesTable.createdAt));

    res.json({
      conversation: { id: conv.id, status: conv.status, createdAt: conv.createdAt },
      messages: messages.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        message: m.message,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get support conversation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/support/message — student sends a message
router.post("/support/message", async (req, res) => {
  try {
    const userId = await resolveAcademyUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!raw || raw.length > 5000) {
      res.status(400).json({ error: "Message must be 1–5000 characters" });
      return;
    }

    let [conv] = await db
      .select()
      .from(supportConversationsTable)
      .where(eq(supportConversationsTable.academyUserId, userId))
      .orderBy(desc(supportConversationsTable.createdAt))
      .limit(1);

    const isNewConversation = !conv;

    if (!conv) {
      const [basic] = await db
        .select({ userName: academyUserBasicDetailsTable.userName })
        .from(academyUserBasicDetailsTable)
        .where(eq(academyUserBasicDetailsTable.userId, userId))
        .limit(1);

      [conv] = await db
        .insert(supportConversationsTable)
        .values({
          academyUserId: userId,
          userName: basic?.userName ?? null,
          status: "open",
        })
        .returning();
    }

    const [studentMsg] = await db
      .insert(supportMessagesTable)
      .values({
        conversationId: conv.id,
        senderType: "student",
        message: raw,
      })
      .returning();

    let ackMsg = null;
    if (isNewConversation) {
      [ackMsg] = await db
        .insert(supportMessagesTable)
        .values({
          conversationId: conv.id,
          senderType: "bot",
          message: AUTO_ACK,
        })
        .returning();
    }

    await db
      .update(supportConversationsTable)
      .set({ updatedAt: new Date(), status: "open" })
      .where(eq(supportConversationsTable.id, conv.id));

    res.status(201).json({
      conversationId: conv.id,
      message: {
        id: studentMsg.id,
        senderType: studentMsg.senderType,
        message: studentMsg.message,
        createdAt: studentMsg.createdAt,
      },
      ack: ackMsg
        ? {
            id: ackMsg.id,
            senderType: ackMsg.senderType,
            message: ackMsg.message,
            createdAt: ackMsg.createdAt,
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send support message");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/support/conversations — all conversations (admin API key)
router.get("/admin/support/conversations", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const conversations = await db
      .select()
      .from(supportConversationsTable)
      .orderBy(desc(supportConversationsTable.updatedAt));

    const convIds = conversations.map((c) => c.id);
    const messages =
      convIds.length > 0
        ? await db
            .select()
            .from(supportMessagesTable)
            .where(inArray(supportMessagesTable.conversationId, convIds))
            .orderBy(asc(supportMessagesTable.createdAt))
        : [];

    const messagesByConv = new Map<number, typeof messages>();
    for (const m of messages) {
      if (!messagesByConv.has(m.conversationId)) messagesByConv.set(m.conversationId, []);
      messagesByConv.get(m.conversationId)!.push(m);
    }

    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        academyUserId: c.academyUserId,
        userName: c.userName,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messages: (messagesByConv.get(c.id) ?? []).map((m) => ({
          id: m.id,
          senderType: m.senderType,
          message: m.message,
          createdAt: m.createdAt,
        })),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list support conversations");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/support/reply/:conversationId — admin sends reply (admin API key)
router.post("/admin/support/reply/:conversationId", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const convId = Number(req.params.conversationId);
    if (!Number.isInteger(convId) || convId <= 0) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const raw = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!raw || raw.length > 5000) {
      res.status(400).json({ error: "Message must be 1–5000 characters" });
      return;
    }

    const [conv] = await db
      .select({ id: supportConversationsTable.id })
      .from(supportConversationsTable)
      .where(eq(supportConversationsTable.id, convId))
      .limit(1);

    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const [msg] = await db
      .insert(supportMessagesTable)
      .values({
        conversationId: convId,
        senderType: "admin",
        message: raw,
      })
      .returning();

    await db
      .update(supportConversationsTable)
      .set({ updatedAt: new Date(), status: "waiting_for_student" })
      .where(eq(supportConversationsTable.id, convId));

    res.status(201).json({
      message: {
        id: msg.id,
        senderType: msg.senderType,
        message: msg.message,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send admin reply");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/support/status/:conversationId — update conversation status (admin API key)
router.put("/admin/support/status/:conversationId", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const convId = Number(req.params.conversationId);
    if (!Number.isInteger(convId) || convId <= 0) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    const status = typeof req.body?.status === "string" ? req.body.status.trim() : "";
    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    await db
      .update(supportConversationsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportConversationsTable.id, convId));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update conversation status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
