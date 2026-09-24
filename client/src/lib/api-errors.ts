// apiRequest errors read like `503: {"message":"..."}`; show just the message.
export function friendlyError(error: Error): string {
  const json = error.message.match(/\{[\s\S]*\}\s*$/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {
      // fall through to the raw text
    }
  }
  return error.message.replace(/^\d{3}:\s*/, "");
}
