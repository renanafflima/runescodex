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

export function encodeCreatureAssetUri(uri) {
  if (typeof uri !== "string" || !/[\s()'"]/.test(uri)) return uri;
  return uri.replace(/([^/?#&=]+)(?=[?#&=]|$)/g, (segment) => {
    try {
      return encodeURIComponent(decodeURIComponent(segment));
    } catch {
      return encodeURIComponent(segment);
    }
  });
}
