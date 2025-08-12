import { useCallback, useRef, useState } from 'react'

export function useSoftRefresh(onRefreshAsync) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const inFlightRef = useRef(false)

  const refresh = useCallback(async () => {
    if (inFlightRef.current || !onRefreshAsync) return
    try {
      inFlightRef.current = true
      setIsRefreshing(true)
      await onRefreshAsync()
    } finally {
      setIsRefreshing(false)
      inFlightRef.current = false
    }
  }, [onRefreshAsync])

  return { isRefreshing, refresh }
}