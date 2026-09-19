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
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
    delete config.headers['content-type']
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) clearSession()
    return Promise.reject(error)
  },
)

export async function uploadMedia(file, { department, entityType, entityId }) {
  if (!file) throw new Error('A file is required.')
  const formData = new FormData()
  formData.append('file', file)
  if (department) formData.append('department', department)
  if (entityType) formData.append('entityType', entityType)
  if (entityId) formData.append('entityId', String(entityId))

  const response = await api.post('/api/upload', formData)
  const media = response.data?.data?.media
  if (!media || Array.isArray(media) || !media.id) {
    throw new Error('The upload response did not contain one valid media object.')
  }
  return media
}
