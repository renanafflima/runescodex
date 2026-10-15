import assert from "node:assert/strict";
import test from "node:test";
import { mobileGate } from "./premium-access.js";

test("mobile gate keeps product screens behind an active license", () => {
  assert.equal(mobileGate({ isReady: false, isAuthenticated: false, premiumAccess: false }), "loading");
  assert.equal(mobileGate({ isReady: true, isAuthenticated: false, premiumAccess: false }), "public");
  assert.equal(mobileGate({ isReady: true, isAuthenticated: true, premiumAccess: false }), "checkout");
  assert.equal(mobileGate({ isReady: true, isAuthenticated: true, premiumAccess: true }), "app");
});
