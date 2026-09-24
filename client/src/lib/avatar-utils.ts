export function getAvatarUrl(name: string, imageUrl?: string | null): string {
  // No stored photo → no URL: <AvatarFallback> draws the initials locally.
  // (Generated-avatar services would receive every contact's name — a
  // confidentiality problem for lobbying firms.)
  void name;
  return imageUrl || "";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
