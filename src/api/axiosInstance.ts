import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3031");

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Получить токен и установить его в заголовок перед запросом
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get("apiToken");
  const token = result.apiToken as string | undefined;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
