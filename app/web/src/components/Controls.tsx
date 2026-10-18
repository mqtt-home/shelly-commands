import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

/** A command button that shows "tap again" while armed in safe mode. */
export function SafeButton({
  id,
  pending,
  onRun,
  disabled,
  icon,
  className,
  children,
}: {
  id: string
  pending: string | null
  onRun: (id: string) => void
  disabled?: boolean
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  const { t } = useI18n()
  const armed = pending === id
  return (
    <button
      className={cn('btn touch-manipulation', armed && 'pending', className)}
      onClick={() => onRun(id)}
      disabled={disabled}
    >
      {!armed && icon}
      <span className="truncate num">{armed ? t('tapAgain') : children}</span>
    </button>
  )
}

export function ButtonRow({ n = 2, children }: { n?: number; children: ReactNode }) {
  return (
    <div className="btn-row" style={{ '--n': n } as CSSProperties}>
      {children}
    </div>
  )
}

/** 100 = fully open, 0 = closed. */
export function PositionReadout({ value, label, preview }: { value: number; label?: string; preview?: boolean }) {
  const { t, num } = useI18n()
  return (
    <div className="min-w-0">
      {label && <div className="kicker mb-1">{label}</div>}
      <div className="flex items-baseline gap-1.5" style={preview ? { color: 'var(--accent-ink)' } : undefined}>
        {value >= 100 ? (
          <span className="big">{t('pos.open')}</span>
        ) : value <= 0 ? (
          <span className="big">{t('pos.closed')}</span>
        ) : (
          <>
            <span className="big">{num(value)} %</span>
            <span className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
              {t('pos.openPct')}
            </span>
          </>
        )}
        {preview && (
          <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
            · {t('pos.preview')}
          </span>
        )}
      </div>
    </div>
  )
}
