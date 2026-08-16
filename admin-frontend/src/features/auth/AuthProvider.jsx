import { useEffect, useMemo, useState } from 'react'
import { getCurrentUser } from './authApi'
import { clearSession, getSession, saveSession } from './session'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession())
  const [isRestoring, setIsRestoring] = useState(Boolean(getSession()))
  useEffect(() => {
    if (!session?.token) { setIsRestoring(false); return }
    getCurrentUser().then(({ user }) => {
      const next = { token: session.token, user }
      saveSession(next); setSession(next)
    }).catch(() => { clearSession(); setSession(null) }).finally(() => setIsRestoring(false))
  }, [session?.token])
  const value = useMemo(() => ({ session, user: session?.user || null, isRestoring, signIn: (next) => { saveSession(next); setSession(next) }, signOut: () => { clearSession(); setSession(null) } }), [session, isRestoring])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
