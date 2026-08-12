// Central AI provider configuration.
//
// One place for: which providers are actually usable, which model each one
// runs, and shared chat helpers with provider fallback. Before this existed,
// model IDs were string literals scattered across the codebase and the OpenAI/
// Gemini clients silently pointed at Replit's dead `localhost:1106/modelfarm`
// sidecar with `_DUMMY_` keys — every call failed with a user-facing 500.
//
// Env vars (AI_INTEGRATIONS_* is the project-wide prefix; bare names accepted
// as fallback):
//   AI_INTEGRATIONS_ANTHROPIC_API_KEY / ANTHROPIC_API_KEY
//   AI_INTEGRATIONS_OPENAI_API_KEY    / OPENAI_API_KEY
//   AI_INTEGRATIONS_GEMINI_API_KEY    / GEMINI_API_KEY
// Optional matching *_BASE_URL overrides. Keys that are missing, `_DUMMY_`
// placeholders, or base URLs pointing at localhost are treated as NOT
// configured (that combination is always the dead Replit sidecar).

export const AI_MODELS = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.1",
  gemini: "gemini-2.5-flash",
} as const;

export type ProviderName = keyof typeof AI_MODELS;

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
}

function resolve(name: ProviderName): { apiKey?: string; baseURL?: string } {
  switch (name) {
    case "anthropic":
      return {
        apiKey:
          process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ||
          process.env.ANTHROPIC_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      };
    case "openai":
      return {
        apiKey:
          process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
          process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      };
    case "gemini":
      return {
        apiKey:
          process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
          process.env.GEMINI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      };
  }
}

function unusableReason(cfg: { apiKey?: string; baseURL?: string }): string | null {
  if (!cfg.apiKey) return "no API key";
  if (cfg.apiKey.startsWith("_DUMMY_")) return "placeholder _DUMMY_ key";
  if (cfg.baseURL && /localhost|127\.0\.0\.1/.test(cfg.baseURL)) {
    return `base URL points at dead local sidecar (${cfg.baseURL})`;
  }
  return null;
}

/** Returns usable credentials for a provider, or null if it is not configured. */
export function providerConfig(name: ProviderName): ProviderConfig | null {
  const cfg = resolve(name);
  if (unusableReason(cfg)) return null;
  return { apiKey: cfg.apiKey!, baseURL: cfg.baseURL || undefined };
}

/** Providers that are actually usable, in preferred fallback order. */
export function availableProviders(): ProviderName[] {
  return (["anthropic", "openai", "gemini"] as ProviderName[]).filter(
    (p) => providerConfig(p) !== null,
  );
}

/** Startup preflight: log which AI providers are reachable so misconfiguration
 * is visible in the deploy log instead of surfacing as user-facing 500s. */
export function logAiProviderStatus(): void {
  for (const name of ["anthropic", "openai", "gemini"] as ProviderName[]) {
    const cfg = resolve(name);
    const reason = unusableReason(cfg);
    if (reason) {
      console.log(`[ai-providers] ${name}: NOT CONFIGURED — ${reason}`);
    } else {
      console.log(`[ai-providers] ${name}: configured (model ${AI_MODELS[name]})`);
    }
  }
  const perplexity = process.env.PERPLEXITY_API_KEY ? "configured (model sonar)" : "NOT CONFIGURED — no API key";
  console.log(`[ai-providers] perplexity: ${perplexity}`);
  const parallel = process.env.PARALLEL_API_KEY ? "configured" : "NOT CONFIGURED — no API key (Decision Briefs disabled)";
  console.log(`[ai-providers] parallel: ${parallel}`);
}

// ─── Shared chat helpers ─────────────────────────────────────────────────────

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

function splitSystem(messages: ChatMsg[]): { system: string; rest: { role: "user" | "assistant"; content: string }[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system, rest };
}

/**
 * Non-streaming chat completion with provider fallback (anthropic → openai →
 * gemini, skipping unconfigured ones). Returns the text plus which provider
 * produced it. Throws only if every configured provider fails or none are
 * configured.
 */
export async function completeChat(
  messages: ChatMsg[],
  opts: { maxTokens?: number } = {},
): Promise<{ text: string; provider: ProviderName }> {
  const maxTokens = opts.maxTokens ?? 1024;
  const errors: string[] = [];

  for (const name of availableProviders()) {
    const cfg = providerConfig(name)!;
    try {
      if (name === "anthropic") {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
        const { system, rest } = splitSystem(messages);
        const response = await client.messages.create({
          model: AI_MODELS.anthropic,
          max_tokens: maxTokens,
          system: system || undefined,
          messages: rest.length ? rest : [{ role: "user", content: "" }],
        });
        const text = response.content.find((b) => b.type === "text")?.text ?? "";
        if (text) return { text, provider: name };
        errors.push("anthropic: empty response");
      } else if (name === "openai") {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
        const completion = await client.chat.completions.create({
          model: AI_MODELS.openai,
          messages,
          max_completion_tokens: maxTokens,
        });
        const text = completion.choices?.[0]?.message?.content || "";
        if (text) return { text, provider: name };
        errors.push("openai: empty response");
      } else if (name === "gemini") {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: cfg.apiKey,
          ...(cfg.baseURL ? { httpOptions: { apiVersion: "", baseUrl: cfg.baseURL } } : {}),
        });
        const { system, rest } = splitSystem(messages);
        const contents = [
          ...(system ? [{ role: "user", parts: [{ text: system }] }] : []),
          ...rest.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        ];
        const response = await ai.models.generateContent({ model: AI_MODELS.gemini, contents });
        const text = response.text || "";
        if (text) return { text, provider: name };
        errors.push("gemini: empty response");
      }
    } catch (err: any) {
      errors.push(`${name}: ${err?.message || err}`);
    }
  }

  throw new Error(
    errors.length
      ? `All configured AI providers failed — ${errors.join("; ")}`
      : "No AI provider is configured (set AI_INTEGRATIONS_ANTHROPIC_API_KEY)",
  );
}

/**
 * Streaming chat with provider fallback (anthropic → openai). Yields text
 * chunks. Fallback happens only if a provider fails before emitting anything.
 */
export async function* streamChat(
  messages: ChatMsg[],
  opts: { maxTokens?: number } = {},
): AsyncGenerator<string> {
  const maxTokens = opts.maxTokens ?? 2048;
  const errors: string[] = [];

  for (const name of availableProviders()) {
    if (name === "gemini") continue; // no streaming path implemented for gemini
    const cfg = providerConfig(name)!;
    let emitted = false;
    try {
      if (name === "anthropic") {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
        const { system, rest } = splitSystem(messages);
        const stream = client.messages.stream({
          model: AI_MODELS.anthropic,
          max_tokens: maxTokens,
          system: system || undefined,
          messages: rest.length ? rest : [{ role: "user", content: "" }],
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            emitted = true;
            yield event.delta.text;
          }
        }
        return;
      } else if (name === "openai") {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });
        const stream = await client.chat.completions.create({
          model: AI_MODELS.openai,
          messages,
          stream: true,
          max_completion_tokens: maxTokens,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            emitted = true;
            yield content;
          }
        }
        return;
      }
    } catch (err: any) {
      if (emitted) throw err; // mid-stream failure: don't restart with another provider
      errors.push(`${name}: ${err?.message || err}`);
    }
  }

  throw new Error(
    errors.length
      ? `All configured AI providers failed — ${errors.join("; ")}`
      : "No AI provider is configured (set AI_INTEGRATIONS_ANTHROPIC_API_KEY)",
  );
}
