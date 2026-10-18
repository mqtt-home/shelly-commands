import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Safe mode: the first tap only arms a command, a second tap on the same
 * button within 3 s runs it. Without safe mode a tap runs it right away.
 */
export function useSafeAction(safe: boolean) {
  const [pending, setPending] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const clear = useCallback(() => {
    clearTimeout(timer.current)
    setPending(null)
  }, [])

  const run = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      if (safe && pending !== id) {
        clearTimeout(timer.current)
        setPending(id)
        timer.current = setTimeout(() => setPending(null), 3000)
        return
      }
      clear()
      await fn()
    },
    [safe, pending, clear],
  )

  // Leaving safe mode drops an armed command.
  useEffect(() => {
    if (!safe) clear()
  }, [safe, clear])

  return { pending, run, clear }
}
