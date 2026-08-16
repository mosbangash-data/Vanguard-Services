import axios from 'axios'
import { getToken, clearSession } from '../features/auth/session'

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim()
const API_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, '').replace(/\/api$/, '') : ''

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) clearSession()
    return Promise.reject(error)
  },
)
