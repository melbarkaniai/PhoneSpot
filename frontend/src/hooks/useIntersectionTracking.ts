import { useEffect, useRef } from 'react'
import { track } from '../utils/analytics'

export function useIntersectionTracking(
  eventName: string,
  data?: Record<string, string>,
  options = { threshold: 0.5 }
) {
  const ref = useRef<HTMLDivElement>(null)
  const tracked = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !tracked.current) {
        tracked.current = true
        track(eventName, data)
      }
    }, options)

    observer.observe(el)
    return () => observer.disconnect()
  }, [eventName])

  return ref
}
