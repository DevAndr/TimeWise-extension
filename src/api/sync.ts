import { api } from "./axiosInstance";

// POST /activities — CreateActivityDto
// required: domain, duration (seconds), startedAt (ISO)
// optional: url, title, endedAt (ISO)
export interface CreateActivityPayload {
  domain: string;
  duration: number;
  startedAt: string;
  url?: string;
  title?: string;
  endedAt?: string;
}

// Отправить одну активность на сервер
export async function sendActivity(payload: CreateActivityPayload) {
  return api.post("/activities", payload);
}

// GET /activities/summary — сводка по доменам
export async function getSummary(params?: { domain?: string; from?: string; to?: string }) {
  const res = await api.get("/activities/summary", { params });
  return res.data;
}

// GET /activities — список активностей с фильтрами
export async function getActivities(params?: { domain?: string; from?: string; to?: string }) {
  const res = await api.get("/activities", { params });
  return res.data;
}
