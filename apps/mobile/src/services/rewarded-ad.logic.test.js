const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REWARDED_AD_STATES,
  nextRewardedAdState,
} = require("./rewarded-ad.logic");

test("load transitions IDLE to LOADING", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.IDLE, "load"),
    REWARDED_AD_STATES.LOADING,
  );
});

test("loaded becomes READY", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.LOADING, "loaded"),
    REWARDED_AD_STATES.READY,
  );
});

test("show from READY becomes SHOWING", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.READY, "show"),
    REWARDED_AD_STATES.SHOWING,
  );
});

test("earned from SHOWING becomes AWAITING_CONFIRMATION", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.SHOWING, "earned"),
    REWARDED_AD_STATES.AWAITING_CONFIRMATION,
  );
});

test("confirmed becomes COMPLETED", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.AWAITING_CONFIRMATION, "confirmed"),
    REWARDED_AD_STATES.COMPLETED,
  );
});

test("closed_early from SHOWING returns to READY", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.SHOWING, "closed_early"),
    REWARDED_AD_STATES.READY,
  );
});

test("error and unavailable set terminal states", () => {
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.LOADING, "error"),
    REWARDED_AD_STATES.ERROR,
  );
  assert.equal(
    nextRewardedAdState(REWARDED_AD_STATES.IDLE, "unavailable"),
    REWARDED_AD_STATES.UNAVAILABLE,
  );
});
