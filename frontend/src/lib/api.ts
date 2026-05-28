const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, init)
}
