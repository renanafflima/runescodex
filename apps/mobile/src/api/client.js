import { API_BASE_URL } from "./config";

function messageFromBody(data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data.message)) return data.message.join("\n");
  if (typeof data.message === "string") return data.message;
  return "";
}

export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch {
    const error = new Error("NETWORK");
    error.code = "NETWORK";
    error.status = 0;
    throw error;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const error = new Error(messageFromBody(data) || "HTTP_ERROR");
    error.code = response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR";
    error.status = response.status;
    throw error;
  }

  return data;
}
