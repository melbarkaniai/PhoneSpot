interface Window {
  umami?: {
    track: (event: string, data?: Record<string, string>) => void
    identify: (data: Record<string, string>) => void
  }
}
