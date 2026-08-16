import { api } from '../../services/api'

export async function getDashboardOverview() {
  const response = await api.get('/api/dashboard/overview')
  const data = response.data?.data
  if (!response.data?.success || !data || typeof data.trips !== 'object') {
    throw new Error('Unexpected dashboard response')
  }
  return data
}