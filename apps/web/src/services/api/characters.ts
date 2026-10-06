import { ApiError } from "./errors";
import { apiRequest } from "./client";
import type { Character } from "./types";

export type CharacterPayload = {
  name: string;
  vocation: string;
  level: number;
  world: string;
};

export function listCharacters() {
  return apiRequest<Character[]>("/characters");
}

export function getCharacter(id: string) {
  return apiRequest<Character>(`/characters/${id}`);
}

export function createCharacter(payload: CharacterPayload) {
  return apiRequest<Character>("/characters", {
    method: "POST",
    json: payload,
  });
}

export function updateCharacter(id: string, payload: Partial<CharacterPayload>) {
  return apiRequest<Character>(`/characters/${id}`, {
    method: "PATCH",
    json: payload,
  });
}

export function deleteCharacter(id: string) {
  return apiRequest<null>(`/characters/${id}`, { method: "DELETE" });
}

export function setActiveCharacter(id: string) {
  return apiRequest<Character>(`/characters/${id}/active`, { method: "PATCH" });
}

export async function getActiveCharacter() {
  try {
    return await apiRequest<Character>("/characters/active");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
