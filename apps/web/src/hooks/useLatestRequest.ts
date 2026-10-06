import { useEffect, useState } from "react";
import { createLatestRequest } from "../lib/latest-request";

export function useLatestRequest() {
  const [request] = useState(() => createLatestRequest());

  useEffect(() => {
    return () => request.cancel();
  }, [request]);

  return request;
}
