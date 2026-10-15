/**
 * Public screens are Home, login, register and checkout.
 * Every other screen lives under (tabs) and is reached only when premium is active.
 */
export function mobileGate({ isReady, isAuthenticated, premiumAccess }) {
  if (!isReady) return "loading";
  if (!isAuthenticated) return "public";
  if (!premiumAccess) return "checkout";
  return "app";
}
