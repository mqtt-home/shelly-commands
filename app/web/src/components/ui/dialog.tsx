import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  closeLabel: string
  className?: string
  children: ReactNode
}

export function Dialog({ open, onClose, title, closeLabel, className, children }: DialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="backdrop" onClick={onClose} />
      <div className={cn('sheet', className)}>
        <div className="sheet-h">
          <h2 className="flex items-center gap-2">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <X className="size-5" />
          </button>
        </div>
        <div className="p-3 sm:p-4">{children}</div>
      </div>
    </div>
  )
}
