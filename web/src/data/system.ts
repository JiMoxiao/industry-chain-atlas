import type { BackendHealth, BackendJobState } from "@/types/backend";

export async function loadBackendHealth() {
  const response = await fetch("/api/health");
  if (!response.ok) {
    throw new Error(`API /api/health returned ${response.status}`);
  }
  return (await response.json()) as BackendHealth;
}

export async function loadJobStatus() {
  const response = await fetch("/api/jobs/status");
  if (!response.ok) {
    throw new Error(`API /api/jobs/status returned ${response.status}`);
  }
  return (await response.json()) as BackendJobState;
}

export async function triggerFullRefresh() {
  const response = await fetch("/api/jobs/refresh", { method: "POST" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? `API /api/jobs/refresh returned ${response.status}`);
  }
  return response.json() as Promise<{ accepted: boolean; message: string; state: BackendJobState }>;
}

export async function triggerHeatRefresh() {
  const response = await fetch("/api/jobs/refresh-heat", { method: "POST" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? `API /api/jobs/refresh-heat returned ${response.status}`);
  }
  return response.json() as Promise<{ accepted: boolean; message: string; state: BackendJobState }>;
}
