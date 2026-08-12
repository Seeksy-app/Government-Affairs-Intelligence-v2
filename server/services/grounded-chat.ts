// Grounded AI chat: Claude with tool access to the platform's own data.
//
// The old chat answered every question from the model's (stale) general
// knowledge and then told users to "check LegiStorm" — a directory this
// platform already syncs (~17,900 staffers). This service gives Claude a
// search_staffer_directory tool so people/staff/office questions are answered
// from the real database, with real names and sync dates.
//
// Requires Anthropic (tool-use loop). Callers should fall back to
// completeChat() when Anthropic is not configured.

import { db } from "../db";
import { legistormStaffers } from "@shared/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { AI_MODELS, providerConfig, type ChatMsg } from "./ai-providers";

export interface DirectoryStaffer {
  id: string;
  fullName: string;
  title: string | null;
  office: string | null;
  memberName: string | null;
  chamber: string | null;
  state: string | null;
  email: string | null;
  isCurrentStaff: boolean | null;
  lastUpdatedFromApi: string | null;
}

export interface GroundedChatResult {
  text: string;
  staffers: DirectoryStaffer[];
  provider: string;
}

// ─── The tool implementation ─────────────────────────────────────────────────

async function searchStafferDirectory(input: {
  query?: string;
  member_name?: string;
  staffer_name?: string;
  title_contains?: string;
  current_only?: boolean;
  limit?: number;
}): Promise<DirectoryStaffer[]> {
  const limit = Math.min(Math.max(input.limit ?? 15, 1), 40);
  const conditions = [];

  const like = (v: string) => `%${v.trim()}%`;

  if (input.member_name) {
    conditions.push(ilike(legistormStaffers.currentMemberName, like(input.member_name)));
  }
  if (input.staffer_name) {
    conditions.push(ilike(legistormStaffers.fullName, like(input.staffer_name)));
  }
  if (input.title_contains) {
    conditions.push(ilike(legistormStaffers.currentTitle, like(input.title_contains)));
  }
  if (input.query && !input.member_name && !input.staffer_name) {
    conditions.push(
      or(
        ilike(legistormStaffers.fullName, like(input.query)),
        ilike(legistormStaffers.currentMemberName, like(input.query)),
        ilike(legistormStaffers.currentOffice, like(input.query)),
        ilike(legistormStaffers.currentTitle, like(input.query)),
      )!,
    );
  }
  if (input.current_only !== false) {
    conditions.push(eq(legistormStaffers.isCurrentStaff, true));
  }

  if (conditions.length === 0) return [];

  const rows = await db
    .select({
      id: legistormStaffers.id,
      fullName: legistormStaffers.fullName,
      title: legistormStaffers.currentTitle,
      office: legistormStaffers.currentOffice,
      memberName: legistormStaffers.currentMemberName,
      chamber: legistormStaffers.chamber,
      state: legistormStaffers.state,
      email: legistormStaffers.email,
      isCurrentStaff: legistormStaffers.isCurrentStaff,
      lastUpdatedFromApi: legistormStaffers.lastUpdatedFromApi,
    })
    .from(legistormStaffers)
    .where(and(...conditions))
    .orderBy(sql`${legistormStaffers.currentTitle} NULLS LAST`)
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    lastUpdatedFromApi: r.lastUpdatedFromApi ? new Date(r.lastUpdatedFromApi).toISOString() : null,
  }));
}

const STAFFER_TOOL = {
  name: "search_staffer_directory",
  description:
    "Search the platform's LegiStorm congressional staff directory (~17,900 staffers, synced from LegiStorm). " +
    "Use this whenever the user asks about congressional staffers, who works for a member of Congress, " +
    "chiefs of staff, schedulers, legislative directors, committee staff, or how to reach an office. " +
    "Prefer member_name when the user names a member of Congress (e.g. 'Mike Johnson'). " +
    "Returns current staff with titles, offices, and the date each record was last synced.",
  input_schema: {
    type: "object" as const,
    properties: {
      member_name: {
        type: "string",
        description: "Member of Congress the staffers work for, e.g. 'Mike Johnson'",
      },
      staffer_name: { type: "string", description: "Name of a specific staffer to look up" },
      title_contains: {
        type: "string",
        description: "Filter by words in the job title, e.g. 'chief of staff', 'scheduler', 'legislative director'",
      },
      query: {
        type: "string",
        description: "Free-text search across names, members, offices, and titles (used when the above don't fit)",
      },
      current_only: { type: "boolean", description: "Only current staff (default true)" },
      limit: { type: "number", description: "Max results (default 15, max 40)" },
    },
  },
};

// ─── The tool-use loop ───────────────────────────────────────────────────────

export async function groundedChat(
  messages: ChatMsg[],
  opts: { maxTokens?: number } = {},
): Promise<GroundedChatResult> {
  const cfg = providerConfig("anthropic");
  if (!cfg) {
    throw new Error("groundedChat requires Anthropic to be configured");
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const convo: any[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const collected: DirectoryStaffer[] = [];
  const seen = new Set<string>();
  let text = "";

  // Bounded loop: Claude may call the tool a few times, then must answer.
  for (let turn = 0; turn < 5; turn++) {
    const response = await client.messages.create({
      model: AI_MODELS.anthropic,
      max_tokens: opts.maxTokens ?? 2000,
      system: system || undefined,
      tools: [STAFFER_TOOL],
      messages: convo,
    });

    const toolUses = response.content.filter((b: any) => b.type === "tool_use");
    text = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

    convo.push({ role: "assistant", content: response.content });

    const results = [];
    for (const tu of toolUses as any[]) {
      let resultPayload: string;
      try {
        const rows = await searchStafferDirectory(tu.input ?? {});
        for (const row of rows) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            collected.push(row);
          }
        }
        resultPayload = JSON.stringify({ count: rows.length, staffers: rows });
      } catch (err: any) {
        resultPayload = JSON.stringify({ error: err?.message || "directory search failed" });
      }
      results.push({
        type: "tool_result" as const,
        tool_use_id: tu.id,
        content: resultPayload,
      });
    }
    convo.push({ role: "user", content: results });
  }

  return {
    text,
    staffers: collected.slice(0, 12),
    provider: `anthropic (${AI_MODELS.anthropic})`,
  };
}
