export const REWARD_READ_FRESH_MS = 15_000;

export function createRewardReadCache(now = () => Date.now()) {
  const reads = new Map();
  const pending = new Map();

  function takeFresh(key) {
    const hit = reads.get(key);
    if (!hit) return undefined;
    if (now() - hit.at > REWARD_READ_FRESH_MS) {
      reads.delete(key);
      return undefined;
    }
    return hit.value;
  }

  return {
    read(key, loader) {
      const fresh = takeFresh(key);
      if (fresh !== undefined) return Promise.resolve(fresh);

      const existing = pending.get(key);
      if (existing) return existing;

      const request = Promise.resolve()
        .then(loader)
        .then(
          (value) => {
            if (pending.get(key) === request) {
              reads.set(key, { value, at: now() });
              pending.delete(key);
            }
            return value;
          },
          (error) => {
            if (pending.get(key) === request) pending.delete(key);
            throw error;
          },
        );

      pending.set(key, request);
      return request;
    },

    invalidate(prefix = "") {
      for (const key of reads.keys()) {
        if (!prefix || String(key).startsWith(prefix)) reads.delete(key);
      }
      for (const key of pending.keys()) {
        if (!prefix || String(key).startsWith(prefix)) pending.delete(key);
      }
    },
  };
}

export const rewardReads = createRewardReadCache();

export function rewardReadKey(token, path) {
  return `${token}\n${path}`;
}

export function invalidateRewardReads(token) {
  rewardReads.invalidate(token ? `${token}\n` : "");
}
