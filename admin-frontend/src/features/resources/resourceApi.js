import { api } from '../../services/api'

const unwrap = (response) => response.data?.data ?? response.data
export async function listResource(endpoint, params) { return unwrap(await api.get(endpoint, { params })) }
export async function createResource(endpoint, data) { return unwrap(await api.post(endpoint, data)) }
export async function updateResource(endpoint, id, data) { return unwrap(await api.put(`${endpoint}/${id}`, data)) }
export async function deleteResource(endpoint, id) { return unwrap(await api.delete(`${endpoint}/${id}`)) }
export async function patchResource(endpoint, id, suffix, data = {}) { return unwrap(await api.patch(`${endpoint}/${id}${suffix}`, data)) }
