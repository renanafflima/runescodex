import { ApiError, describeApiError } from "../services/api/errors";

export function describeGoogleError(error: unknown) {
  if (error instanceof Error && error.message === "cancelled") return "";
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof Error && error.message === "unavailable") {
    return "O login com Google não carregou. Tente novamente.";
  }
  if (!(error instanceof ApiError)) return describeApiError(error);

  if (error.message === "Google sign-in is not linked to this account") {
    return "Este email já tem uma conta. Entre com a senha e vincule o Google no perfil.";
  }
  if (error.message === "Google account email does not match this account") {
    return "O email do Google precisa ser o mesmo desta conta.";
  }
  if (
    error.message === "Google account is already linked to another user" ||
    error.message === "Google sign-in is already linked to this account" ||
    error.message === "Google account cannot be used for this email"
  ) {
    return "Esta conta Google não pode ser vinculada a este usuário.";
  }
  if (error.message === "Google email is not verified") {
    return "O Google não confirmou este email.";
  }
  if (error.message === "Invalid Google credential") {
    return "Não foi possível validar o login do Google.";
  }
  if (error.status === 503) return "O login com Google não está disponível agora.";
  return describeApiError(error);
}
