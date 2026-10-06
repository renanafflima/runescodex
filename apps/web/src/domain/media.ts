import { isSafeHttpsUrl } from "../lib/https-url";

export function publicImageUrl(value: unknown) {
  return isSafeHttpsUrl(value) ? value.trim() : null;
}

export function publicLinkUrl(value: unknown) {
  return isSafeHttpsUrl(value) ? value.trim() : null;
}
