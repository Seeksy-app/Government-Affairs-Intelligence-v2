// Live-format a US phone number as the user types: (555) 123-4567.
// Non-digits are stripped; input is capped at 10 digits. Partial input
// formats progressively so deleting characters behaves naturally.
export function formatUsPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
