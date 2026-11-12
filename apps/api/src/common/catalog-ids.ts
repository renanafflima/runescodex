/** RFC 4122 UUID (any version) used across most catalog rows. */
const RFC_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Legacy seed ids with a 9-char first segment (4 creatures in production). */
const LEGACY_CREATURE_ID_RE =
  /^c30000001-0001-4000-8000-[0-9a-f]{12}$/i;

/** Legacy hunt ids from the initial catalog seed (`hunt-001`, `hunt-012`, …). */
const LEGACY_HUNT_ID_RE = /^hunt-\d{3}$/i;

const SLUG_LIKE_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function isCatalogCreatureId(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (RFC_UUID_RE.test(value) || LEGACY_CREATURE_ID_RE.test(value)) return true;
  return false;
}

export function isCatalogHuntId(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (RFC_UUID_RE.test(value) || LEGACY_HUNT_ID_RE.test(value)) return true;
  return false;
}

/** Charm guide rows are always server-generated RFC UUIDs; reject slug-like tokens. */
export function isCharmGuideRecordId(value: string | null | undefined): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (SLUG_LIKE_RE.test(value)) return false;
  return RFC_UUID_RE.test(value);
}
