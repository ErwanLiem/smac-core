const BASE = '/api'

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

function handleResponse(res: Response): void {
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
}

async function parseErreur(res: Response): Promise<string> {
  try {
    const json = await res.json()
    return json.error || json.message || `Erreur ${res.status}`
  } catch {
    return `Erreur ${res.status}`
  }
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders() })
  if (!res.ok) { handleResponse(res); throw new Error(await parseErreur(res)) }
  return res.json()
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) { handleResponse(res); throw new Error(await parseErreur(res)) }
  return res.json()
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) { handleResponse(res); throw new Error(await parseErreur(res)) }
  return res.json()
}

export async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: getHeaders() })
  if (!res.ok) { handleResponse(res); throw new Error(await parseErreur(res)) }
}
