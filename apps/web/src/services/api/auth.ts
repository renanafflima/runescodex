import { apiRequest } from "./client";
import type { AuthResponse, AuthUser } from "./types";

export function registerUser(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    json: { email, password },
    auth: false,
  });
}

export function loginUser(email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    json: { email, password },
    auth: false,
  });
}

export function loginWithGoogle(credential: string) {
  return apiRequest<AuthResponse>("/auth/google", {
    method: "POST",
    json: { credential },
    auth: false,
  });
}

export function linkGoogleAccount(credential: string) {
  return apiRequest<{ user: AuthUser }>("/auth/google/link", {
    method: "POST",
    json: { credential },
  });
}

export function fetchMe() {
  return apiRequest<AuthUser>("/auth/me");
}

export function logoutUser() {
  return apiRequest<unknown>("/auth/logout", { method: "POST" });
}
