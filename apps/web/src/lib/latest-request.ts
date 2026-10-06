export function createLatestRequest() {
  let requestId = 0;

  return {
    start() {
      const current = ++requestId;
      return () => current === requestId;
    },
    cancel() {
      requestId += 1;
    },
  };
}
