export function track(event: string, data?: Record<string, string>) {
  try {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(event, data)
    }
  } catch {
    // Silent fail — never break UI for analytics
  }
}
