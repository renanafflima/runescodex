export function creatureImageKey(value) {
  const file = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .pop();
  return String(file || "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}
