export type ApiErrorCode = "NETWORK" | "UNAUTHORIZED" | "HTTP_ERROR";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly body: unknown;

  constructor(code: ApiErrorCode, status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

export function messageFromBody(data: unknown) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data !== "object") return "";

  if ("message" in data) {
    const message = data.message;
    if (Array.isArray(message)) return message.filter(Boolean).join("\n");
    if (typeof message === "string") return message;
  }

  return "";
}

export function apiErrorCode(error: unknown) {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object" || !("code" in error.body)) {
    return "";
  }
  const code = error.body.code;
  return typeof code === "string" ? code : "";
}

export const DEVICE_LIMIT_MESSAGE =
  "Sua conta RuneCodex já está vinculada a dois equipamentos. Para entrar neste dispositivo, remova um equipamento existente em Meus equipamentos.";

export function describeApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") {
      return "Não foi possível conectar à API. Verifique sua conexão e tente novamente.";
    }
    if (error.status === 401) return "Sessão expirada ou credenciais inválidas.";
    if (error.status === 403) {
      if (/premium/i.test(error.message)) {
        return "Este conteúdo exige acesso Premium.";
      }
      return "Você não tem permissão para esta ação.";
    }
    if (error.status === 500 || error.status === 503) {
      return "Erro temporário no servidor. Tente novamente.";
    }
    if (error.status === 404) return "Conteúdo não encontrado.";
    if (error.status === 409) return "Este email já está em uso.";
    if (error.status === 400) return error.message || "Dados inválidos.";
    return error.message || "Não foi possível concluir esta ação.";
  }

  return "Não foi possível concluir esta ação.";
}
