const DB_NAME = "runecodex-device";
const STORE = "vault";
const RECORD_KEY = "current";

type VaultRecord = {
  installationId: string;
  publicKeySpki: string;
  privateKey: CryptoKey;
};

export type DeviceProofInput = {
  installationId: string;
  challengeId: string;
  signature: string;
  label?: string;
  deviceType?: "desktop" | "mobile" | "tablet";
  osName?: string;
  clientName?: string;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o armazenamento do equipamento."));
  });
}

async function readRecord() {
  const db = await openDb();
  try {
    return await new Promise<VaultRecord | null>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(RECORD_KEY);
      request.onsuccess = () => resolve((request.result as VaultRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Não foi possível ler o equipamento."));
    });
  } finally {
    db.close();
  }
}

async function writeRecord(record: VaultRecord) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(record, RECORD_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Não foi possível guardar o equipamento."));
    });
  } finally {
    db.close();
  }
}

export async function resetDeviceRecord() {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(RECORD_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Não foi possível limpar o equipamento."));
    });
  } finally {
    db.close();
  }
}

async function createRecord(): Promise<VaultRecord> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Este navegador não consegue guardar uma chave de equipamento.");
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const exported = await crypto.subtle.exportKey("spki", pair.publicKey);
  const bytes = new Uint8Array(exported);
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return {
    installationId: crypto.randomUUID(),
    publicKeySpki: btoa(binary),
    privateKey: pair.privateKey,
  };
}

export async function ensureDeviceKey() {
  const existing = await readRecord();
  const record = existing?.privateKey ? existing : await createRecord().then(async (created) => {
    await writeRecord(created);
    return created;
  });
  return {
    installationId: record.installationId,
    publicKeySpki: record.publicKeySpki,
    async sign(nonce: string) {
      const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        record.privateKey,
        new TextEncoder().encode(nonce),
      );
      const bytes = new Uint8Array(signature);
      let binary = "";
      bytes.forEach((value) => {
        binary += String.fromCharCode(value);
      });
      return btoa(binary);
    },
  };
}

export function deviceHints(): Pick<DeviceProofInput, "label" | "deviceType" | "osName" | "clientName"> {
  const agent = navigator.userAgent;
  const osName = /Windows/.test(agent)
    ? "Windows"
    : /Mac OS/.test(agent)
      ? "macOS"
      : /Android/.test(agent)
        ? "Android"
        : /iPhone|iPad/.test(agent)
          ? "iOS"
          : /Linux/.test(agent)
            ? "Linux"
            : undefined;
  const clientName = /Edg\//.test(agent)
    ? "Edge"
    : /Chrome\//.test(agent)
      ? "Chrome"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Safari\//.test(agent)
          ? "Safari"
          : undefined;
  const deviceType = /iPad|Tablet/.test(agent) ? "tablet" : /Mobi|Android|iPhone/.test(agent) ? "mobile" : "desktop";
  const label = [clientName, osName].filter(Boolean).join(" · ") || "Este navegador";
  return { label, deviceType, osName, clientName };
}
