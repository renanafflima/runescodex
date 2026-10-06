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

export function describeApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "NETWORK") {
      return "Não foi possível conectar à API. Verifique sua conexão e tente novamente.";
    }
    if (error.status === 401) return "Sessão expirada ou credenciais inválidas.";
    if (error.status === 404) return "Conteúdo não encontrado.";
    if (error.status === 409) return "Este email já está em uso.";
    if (error.status === 400) return error.message || "Dados inválidos.";
    return error.message || "Não foi possível concluir esta ação.";
  }

  return "Não foi possível concluir esta ação.";
}
