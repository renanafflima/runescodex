import type { DeviceProofInput } from "../../auth/device-vault";
import { apiRequest } from "./client";
import type { AuthResponse, AuthUser } from "./types";

export function registerUser(email: string, password: string, device: DeviceProofInput, referralCode?: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    json: { email, password, device, ...(referralCode ? { referralCode } : {}) },
    auth: false,
  });
}

export function loginUser(email: string, password: string, device: DeviceProofInput) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    json: { email, password, device },
    auth: false,
  });
}

export function loginWithGoogle(credential: string, device: DeviceProofInput, referralCode?: string) {
  return apiRequest<AuthResponse>("/auth/google", {
    method: "POST",
    json: { credential, device, ...(referralCode ? { referralCode } : {}) },
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
