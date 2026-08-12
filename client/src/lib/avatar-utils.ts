export function getAvatarUrl(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  const encoded = encodeURIComponent(name.trim());
  // Capitol Navy background — matches the GA mark treatment.
  return `https://ui-avatars.com/api/?name=${encoded}&background=14253D&color=fff&size=96&font-size=0.4&bold=true`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
