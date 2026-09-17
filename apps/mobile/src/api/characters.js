import { apiRequest } from "./client";

export function listCharacters(token) {
  return apiRequest("/characters", { token });
}

export function createCharacter(token, payload) {
  return apiRequest("/characters", {
    method: "POST",
    token,
    body: payload,
  });
}

export function getCharacter(token, id) {
  return apiRequest(`/characters/${id}`, { token });
}

export function updateCharacter(token, id, payload) {
  return apiRequest(`/characters/${id}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function deleteCharacter(token, id) {
  return apiRequest(`/characters/${id}`, {
    method: "DELETE",
    token,
  });
}

export function setActiveCharacter(token, id) {
  return apiRequest(`/characters/${id}/active`, {
    method: "PATCH",
    token,
  });
}

export async function getActiveCharacter(token) {
  try {
    return await apiRequest("/characters/active", { token });
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
