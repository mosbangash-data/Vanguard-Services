import { useCallback, useEffect, useRef } from 'react'

/**
 * Hook pour animer l'apparition des éléments au scroll.
 * S'appuie sur IntersectionObserver + MutationObserver pour couvrir les éléments
 * créés après un chargement API ou après un rerender / filtre.
 */
export function useReveal() {
  const containerRef = useRef(null)
  const observerRef = useRef(null)
  const mutationObserverRef = useRef(null)

  const observeRevealElements = useCallback((container) => {
    if (!container || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return
    }

    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    observerRef.current = observer

    const syncObserved = () => {
      const elements = Array.from(container.querySelectorAll('.reveal:not(.visible)'))
      elements.forEach((element) => {
        if (element instanceof HTMLElement) {
          observer.observe(element)
        }
      })
    }

    syncObserved()

    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect()
    }

    const mutationObserver = new MutationObserver(() => {
      syncObserved()
    })

    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    mutationObserverRef.current = mutationObserver
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    observeRevealElements(container)

    return () => {
      observerRef.current?.disconnect()
      mutationObserverRef.current?.disconnect()
      observerRef.current = null
      mutationObserverRef.current = null
    }
  }, [observeRevealElements])

  return containerRef
}