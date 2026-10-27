import { beforeEach, describe, expect, it } from "vitest";
import { captureReferralCode, clearReferralCode, readReferralCode } from "./referral-code";

describe("referral code capture", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("keeps a valid code across navigation and ignores an invalid one", () => {
    captureReferralCode("?ref=rabc2345");
    expect(readReferralCode()).toBe("RABC2345");
    captureReferralCode("?other=1");
    expect(readReferralCode()).toBe("RABC2345");
    captureReferralCode("?ref=no");
    expect(readReferralCode()).toBe("RABC2345");
    clearReferralCode();
    expect(readReferralCode()).toBe("");
  });
});
