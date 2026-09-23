import { getDestination as resolveDestination } from './routeRules.mjs'

const SESSION_KEY = 'vanguard.admin.session'

export const saveSession = ({ token, user }) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
}

export const getSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return session?.token && session?.user ? session : null
  } catch {
    return null
  }
}

export const getToken = () => getSession()?.token || null
export const clearSession = () => localStorage.removeItem(SESSION_KEY)

export const getDestination = (user) => resolveDestination(user) || '/admin/login'
