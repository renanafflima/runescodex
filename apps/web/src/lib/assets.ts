export function assetUrl(path: string) {
  const normalized = path.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}
