const MAX_URL_LENGTH = 2000;

export function isSafeHttpsUrl(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function openHttpsUrl(Linking, url) {
  if (!isSafeHttpsUrl(url)) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else await Linking.openURL(url);
  } catch {
    // ignore
  }
}
