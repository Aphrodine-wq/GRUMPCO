/**
 * API client for G-Rump web API.
 * Base URL is configurable for dev/staging/prod.
 */

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
}

export const apiBaseUrl = getBaseUrl()

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${apiBaseUrl}${path}`
  const token = typeof window !== 'undefined' ? localStorage.getItem('supabase.auth.token') : null
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  }
  if (token) {
    try {
      const parsed = JSON.parse(token)
      const accessToken = parsed?.currentSession?.access_token ?? parsed?.access_token
      if (accessToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`
      }
    } catch {
      // ignore
    }
  }
  return fetch(url, { ...options, headers })
}
