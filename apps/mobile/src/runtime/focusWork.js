export function createLatestRequest() {
  let generation = 0;
  return {
    start() {
      generation += 1;
      const id = generation;
      return () => id === generation;
    },
    cancel() {
      generation += 1;
    },
  };
}

export function scheduleDebounced(wait, run, schedule = setTimeout, cancel = clearTimeout) {
  const timer = schedule(run, wait);
  return () => cancel(timer);
}

export function intervalWhileFocused(focused, delay, tick, schedule = setInterval, cancel = clearInterval) {
  if (!focused) return () => {};
  tick();
  const timer = schedule(tick, delay);
  return () => cancel(timer);
}

export function startWhileFocused(focused, start) {
  if (!focused) return () => {};
  const stop = start();
  return typeof stop === "function" ? stop : () => {};
}
