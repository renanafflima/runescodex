const KEY = "rc_referral_code";

export function captureReferralCode(search: string) {
  const value = new URLSearchParams(search).get("ref")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{6,16}$/.test(value)) return;
  sessionStorage.setItem(KEY, value);
}

export function readReferralCode() {
  const value = sessionStorage.getItem(KEY)?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9]{6,16}$/.test(value) ? value : "";
}

export function clearReferralCode() {
  sessionStorage.removeItem(KEY);
}

export function referralLink(code: string) {
  return `${window.location.origin}/runescodex/?ref=${encodeURIComponent(code)}`;
}
