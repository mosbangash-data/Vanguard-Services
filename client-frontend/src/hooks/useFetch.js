import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook générique pour les appels API avec gestion des états :
 * loading, error, data.
 */
export function useFetch(fetcher, { immediate = true, deps = [] } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(
    async (...args) => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher(...args)
        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
        return { data: result, error: null }
      } catch (err) {
        if (mountedRef.current) {
          setError(err)
          setLoading(false)
        }
        return { data: null, error: err }
      }
    },
    [fetcher]
  )

  useEffect(() => {
    if (immediate) {
      execute()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, execute, setData }
}