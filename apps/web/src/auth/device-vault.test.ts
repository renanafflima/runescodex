import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { ensureDeviceKey, resetDeviceRecord } from "./device-vault";

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  }
  const records = new Map<string, unknown>();
  const indexedDB = {
    open() {
      const request = {
        result: undefined as unknown,
        onsuccess: null as null | (() => void),
        onupgradeneeded: null as null | (() => void),
        onerror: null as null | (() => void),
      };
      const db = {
        objectStoreNames: { contains: () => records.has("__store") },
        createObjectStore() {
          records.set("__store", true);
        },
        transaction() {
          return {
            objectStore() {
              return {
                get(key: string) {
                  const query = { result: undefined as unknown, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
                  queueMicrotask(() => {
                    query.result = records.get(key);
                    query.onsuccess?.();
                  });
                  return query;
                },
                put(value: unknown, key: string) {
                  const query = { onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
                  queueMicrotask(() => {
                    records.set(key, value);
                    query.onsuccess?.();
                  });
                  return query;
                },
                delete(key: string) {
                  const query = { onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
                  queueMicrotask(() => {
                    records.delete(key);
                    query.onsuccess?.();
                  });
                  return query;
                },
              };
            },
          };
        },
        close() {},
      };
      queueMicrotask(() => {
        request.result = db;
        if (!db.objectStoreNames.contains()) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", { value: indexedDB, configurable: true });
});

describe("device vault", () => {
  it("keeps the same installation until the stored key is cleared", async () => {
    const first = await ensureDeviceKey();
    const second = await ensureDeviceKey();
    expect(second.installationId).toBe(first.installationId);
    expect(second.publicKeySpki).toBe(first.publicKeySpki);

    await resetDeviceRecord();
    const replaced = await ensureDeviceKey();
    expect(replaced.installationId).not.toBe(first.installationId);

    const nonce = "nonce-do-desafio";
    const signature = await replaced.sign(nonce);
    expect(signature.length).toBeGreaterThan(20);
  });
});