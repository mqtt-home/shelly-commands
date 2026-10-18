import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Layers, SlidersHorizontal } from 'lucide-react'
import { GroupInfo } from '@/types/actor'
import { setGroupPosition, tiltGroup, setSlatPositionGroup } from '@/lib/api'
import { Slider } from '@/components/ui/slider'
import { ButtonRow, PositionReadout, SafeButton } from '@/components/Controls'
import { useSafeAction } from '@/hooks/useSafeAction'
import { useI18n } from '@/lib/i18n'

export function GroupCard({
  group,
  globalSafeMode,
  onShowDetails,
}: {
  group: GroupInfo
  globalSafeMode: boolean
  onShowDetails?: (group: GroupInfo) => void
}) {
  const { t, num } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const { pending, run, clear } = useSafeAction(globalSafeMode)
  const actors = group.actors ?? []

  const average = actors.length ? Math.round(actors.reduce((sum, a) => sum + a.position, 0) / actors.length) : 0
  const [preview, setPreview] = useState<number | null>(null)
  useEffect(() => setPreview(null), [average])
  const anyTilted = actors.some((a) => a.tilted)

  const exec = async (fn: () => Promise<void>) => {
    setIsLoading(true)
    try {
      await fn()
    } catch (error) {
      console.error(error)
      alert(t('failed', { error: error instanceof Error ? error.message : String(error) }))
    } finally {
      setIsLoading(false)
    }
  }
  const setPos = (p: number) => exec(() => setGroupPosition(group.groupId, p))

  const commands: Record<string, () => Promise<void>> = {
    close: () => setPos(0),
    open: () => setPos(100),
    tilt: () => exec(() => tiltGroup(group.groupId, 0)),
  }
  for (const s of [20, 40, 60, 80]) commands[`pos-${s}`] = () => setPos(s)
  for (const s of [30, 50, 70]) commands[`slat-${s}`] = () => exec(() => setSlatPositionGroup(group.groupId, s))
  const onRun = (id: string) => run(id, commands[id])
  const common = { pending, onRun, disabled: isLoading }

  return (
    <article className="card touch-manipulation">
      <div className="card-h">
        <span className="ico sm" style={{ '--c': 'var(--idle)' } as React.CSSProperties}>
          <Layers />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate">{group.name}</h3>
          <div className="text-xs" style={{ color: 'var(--ink-3)' }}>
            {group.actorCount === 1 ? t('group.one') : t('group.count', { n: group.actorCount })}
          </div>
        </div>
        {onShowDetails && (
          <button
            className="icon-btn -my-2 -mr-2"
            onClick={() => onShowDetails(group)}
            aria-label={t('group.details', { name: group.name })}
            title={t('group.details', { name: group.name })}
          >
            <SlidersHorizontal className="size-[18px]" />
          </button>
        )}
      </div>
      <div className="card-b space-y-3">
        <PositionReadout value={preview ?? average} label={t('group.avg')} preview={preview !== null} />
        <Slider
          label={t('position')}
          value={[preview ?? average]}
          onValueChange={(v) => setPreview(v[0])}
          onValueCommit={(v) => {
            clear()
            setPos(v[0])
          }}
          max={100}
          step={1}
          disabled={isLoading}
        />
        <ButtonRow>
          <SafeButton id="close" {...common} icon={<ChevronDown className="size-4" />}>
            {t('close')}
          </SafeButton>
          <SafeButton id="open" {...common} icon={<ChevronUp className="size-4" />}>
            {t('open')}
          </SafeButton>
        </ButtonRow>
        <div>
          <div className="sub-label">{t('quick')}</div>
          <ButtonRow n={4}>
            {[20, 40, 60, 80].map((s) => (
              <SafeButton key={s} id={`pos-${s}`} {...common} className="sm">
                {num(s)} %
              </SafeButton>
            ))}
          </ButtonRow>
        </div>
        <div className="border-t pt-3">
          <div className="sub-label">
            {t('slats')}
            {anyTilted && <span className="state info ml-auto">{t('group.someTilted')}</span>}
          </div>
          <div className="space-y-2">
            <SafeButton id="tilt" {...common} className="sm w-full">
              {t('tilt.blinds')}
            </SafeButton>
            <ButtonRow n={3}>
              {[30, 50, 70].map((s) => (
                <SafeButton key={s} id={`slat-${s}`} {...common} className="sm">
                  {num(s)} %
                </SafeButton>
              ))}
            </ButtonRow>
          </div>
        </div>
        {isLoading && (
          <div className="text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
            {t('group.updating')}
          </div>
        )}
      </div>
    </article>
  )
}
