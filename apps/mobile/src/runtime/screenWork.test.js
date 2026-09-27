import assert from "node:assert/strict";
import test from "node:test";
import { createRewardReadCache, REWARD_READ_FRESH_MS } from "../api/rewardReads.js";
import {
  createLatestRequest,
  intervalWhileFocused,
  scheduleDebounced,
  startWhileFocused,
} from "./focusWork.js";

test("Home and Rewards share one fresh wallet read", async () => {
  let calls = 0;
  const cache = createRewardReadCache(() => 1_000);
  const key = "token\n/rewards/me";
  const load = async () => {
    calls += 1;
    return { wallet: { points: 12 } };
  };

  const home = await cache.read(key, load);
  const rewards = await cache.read(key, load);

  assert.equal(calls, 1);
  assert.deepEqual(rewards, home);
});

test("missions for the same period are not fetched twice while fresh", async () => {
  let calls = 0;
  const cache = createRewardReadCache(() => 5_000);
  const key = "token\n/rewards/missions?period=DAILY";

  await cache.read(key, async () => {
    calls += 1;
    return [{ id: "daily" }];
  });
  await cache.read(key, async () => {
    calls += 1;
    return [{ id: "again" }];
  });

  assert.equal(calls, 1);
});

test("parallel reads of the same key share the in-flight request", async () => {
  let calls = 0;
  const cache = createRewardReadCache(() => 1);
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const key = "token\n/rewards/me";
  const first = cache.read(key, () => {
    calls += 1;
    return pending;
  });
  const second = cache.read(key, () => {
    calls += 1;
    return Promise.resolve({ wallet: { points: 99 } });
  });
  release({ wallet: { points: 4 } });
  assert.deepEqual(await first, { wallet: { points: 4 } });
  assert.deepEqual(await second, { wallet: { points: 4 } });
  assert.equal(calls, 1);
});

test("convert and redeem invalidate the shared read", async () => {
  let calls = 0;
  const cache = createRewardReadCache(() => 2_000);
  const key = "token\n/rewards/me";
  await cache.read(key, async () => {
    calls += 1;
    return { wallet: { points: 10 } };
  });
  cache.invalidate("token\n");
  const next = await cache.read(key, async () => {
    calls += 1;
    return { wallet: { points: 0 } };
  });
  assert.equal(calls, 2);
  assert.equal(next.wallet.points, 0);
});

test("a stale in-flight read does not refill the cache after invalidation", async () => {
  let release;
  const cache = createRewardReadCache(() => 3_000);
  const key = "token\n/rewards/missions?period=DAILY";
  const stale = cache.read(
    key,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  cache.invalidate("token\n");
  const fresh = cache.read(key, async () => [{ id: "new" }]);
  release([{ id: "old" }]);
  assert.deepEqual(await stale, [{ id: "old" }]);
  assert.deepEqual(await fresh, [{ id: "new" }]);
  const again = await cache.read(key, async () => [{ id: "should-not-run" }]);
  assert.deepEqual(again, [{ id: "new" }]);
});

test("an expired read is fetched again", async () => {
  let time = 10;
  let calls = 0;
  const cache = createRewardReadCache(() => time);
  const key = "token\n/rewards/me";
  await cache.read(key, async () => {
    calls += 1;
    return 1;
  });
  time += REWARD_READ_FRESH_MS + 1;
  await cache.read(key, async () => {
    calls += 1;
    return 2;
  });
  assert.equal(calls, 2);
});

test("an older response cannot replace a newer one", async () => {
  const requests = createLatestRequest();
  const first = requests.start();
  const second = requests.start();
  const applied = [];
  if (first()) applied.push("old");
  if (second()) applied.push("new");
  requests.cancel();
  if (second()) applied.push("after-blur");
  assert.deepEqual(applied, ["new"]);
});

test("level typing keeps only the latest debounced request", () => {
  const timers = [];
  const schedule = (fn, wait) => {
    const id = timers.length;
    timers.push({ fn, wait, cancelled: false });
    return id;
  };
  const cancel = (id) => {
    timers[id].cancelled = true;
  };
  const ran = [];
  const first = scheduleDebounced(400, () => ran.push("1"), schedule, cancel);
  first();
  const second = scheduleDebounced(400, () => ran.push("80"), schedule, cancel);
  assert.equal(timers[0].cancelled, true);
  assert.equal(timers[1].wait, 400);
  timers[1].fn();
  second();
  assert.deepEqual(ran, ["80"]);
});

test("banner and quest work stay stopped while the screen is blurred", () => {
  let ticks = 0;
  let loops = 0;
  const stopBanner = intervalWhileFocused(false, 5000, () => {
    ticks += 1;
  });
  const stopQuest = startWhileFocused(false, () => {
    loops += 1;
    return () => {};
  });
  stopBanner();
  stopQuest();
  assert.equal(ticks, 0);
  assert.equal(loops, 0);

  let cleared = false;
  let scheduled = 0;
  const stop = intervalWhileFocused(
    true,
    500,
    () => {
      ticks += 1;
    },
    () => {
      scheduled += 1;
      return 7;
    },
    (id) => {
      cleared = id === 7;
    },
  );
  assert.equal(ticks, 1);
  assert.equal(scheduled, 1);
  stop();
  assert.equal(cleared, true);

  let stopped = false;
  const stopLoop = startWhileFocused(true, () => {
    loops += 1;
    return () => {
      stopped = true;
    };
  });
  stopLoop();
  assert.equal(loops, 1);
  assert.equal(stopped, true);
});
