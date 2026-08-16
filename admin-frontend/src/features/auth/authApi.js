import { api } from '../../services/api'

export async function login(credentials) {
  const response = await api.post('/api/auth/login', credentials)
  const payload = response.data
  if (!payload?.success || !payload?.data?.token || !payload?.data?.user) {
    throw new Error('Unexpected login response')
  }
  return payload.data
}

export async function getCurrentUser() {
  const response = await api.get('/api/auth/me')
  if (!response.data?.success || !response.data?.data?.user) throw new Error('Session invalide')
  return response.data.data
}
