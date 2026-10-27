import { apiRequest } from "./client";
import type { DeviceProofInput } from "../../auth/device-vault";
import { deviceHints, ensureDeviceKey, resetDeviceRecord } from "../../auth/device-vault";
import { apiErrorCode } from "./errors";

export type AccountDevice = {
  id: string;
  label: string;
  deviceType: string | null;
  osName: string | null;
  clientName: string | null;
  status: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

export type AccountDeviceList = {
  limit: number;
  active: number;
  hasPassword: boolean;
  currentDeviceId: string | null;
  items: AccountDevice[];
};

export async function prepareDeviceProof(rotate = false): Promise<DeviceProofInput> {
  if (rotate) await resetDeviceRecord();
  const device = await ensureDeviceKey();
  const challenge = await apiRequest<{ challengeId: string; nonce: string }>("/auth/devices/challenge", {
    method: "POST",
    auth: false,
    json: { installationId: device.installationId, publicKeySpki: device.publicKeySpki },
  });
  const signature = await device.sign(challenge.nonce);
  return {
    installationId: device.installationId,
    challengeId: challenge.challengeId,
    signature,
    ...deviceHints(),
  };
}

export async function withDeviceProof<T>(run: (proof: DeviceProofInput) => Promise<T>) {
  try {
    return await run(await prepareDeviceProof(false));
  } catch (error) {
    if (apiErrorCode(error) !== "DEVICE_KEY_MISMATCH") throw error;
    return run(await prepareDeviceProof(true));
  }
}

export function listAccountDevices() {
  return apiRequest<AccountDeviceList>("/auth/devices");
}

export function removeAccountDevice(id: string, body: { password?: string; challengeId?: string; signature?: string }) {
  return apiRequest<{ removed: boolean; sessionsRevoked: number; current: boolean }>(`/auth/devices/${id}/remove`, {
    method: "POST",
    json: body,
  });
}

export async function confirmCurrentDevice() {
  const device = await ensureDeviceKey();
  const challenge = await apiRequest<{ challengeId: string; nonce: string }>("/auth/devices/challenge", {
    method: "POST",
    auth: false,
    json: { installationId: device.installationId, publicKeySpki: device.publicKeySpki },
  });
  return {
    challengeId: challenge.challengeId,
    signature: await device.sign(challenge.nonce),
  };
}
