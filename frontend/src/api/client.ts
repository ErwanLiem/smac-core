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

/** Erreur API enrichie : `message` est le texte d'erreur, `data` contient le corps JSON complet de la réponse */
export class ApiError extends Error {
  data: any
  constructor(message: string, data: any) {
    super(message)
    this.data = data
  }
}

async function parseErreur(res: Response): Promise<ApiError> {
  try {
    const json = await res.json()
    return new ApiError(json.error || json.message || `Erreur ${res.status}`, json)
  } catch {
    return new ApiError(`Erreur ${res.status}`, null)
  }
}

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders() })
  if (!res.ok) { handleResponse(res); throw await parseErreur(res) }
  return res.json()
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) { handleResponse(res); throw await parseErreur(res) }
  return res.json()
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) { handleResponse(res); throw await parseErreur(res) }
  return res.json()
}

export async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: getHeaders() })
  if (!res.ok) { handleResponse(res); throw await parseErreur(res) }
}
