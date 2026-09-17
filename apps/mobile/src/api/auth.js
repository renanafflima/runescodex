import { apiRequest } from "./client";

export function registerUser(email, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: { email, password },
  });
}

export function loginUser(email, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function fetchMe(token) {
  return apiRequest("/auth/me", { token });
}
