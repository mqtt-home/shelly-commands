import { useEffect, useState } from 'react'
import { Blinds, ChevronDown, ChevronUp } from 'lucide-react'
import { ActorStatus } from '@/types/actor'
import { setActorPosition, tiltActor, setSlatPosition } from '@/lib/api'
import { Slider } from '@/components/ui/slider'
import { ButtonRow, PositionReadout, SafeButton } from '@/components/Controls'
import { useSafeAction } from '@/hooks/useSafeAction'
import { useI18n } from '@/lib/i18n'

export function ActorCard({ actor, globalSafeMode }: { actor: ActorStatus; globalSafeMode: boolean }) {
  const { t, num } = useI18n()
  const [position, setPosition] = useState(actor.position)
  const [isLoading, setIsLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const { pending, run, clear } = useSafeAction(globalSafeMode)

  // Follow the device unless a command of ours is in flight.
  useEffect(() => {
    if (!isLoading) {
      setPosition(actor.position)
      setIsDragging(false)
    }
  }, [actor.position, isLoading])

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

  const setPos = (p: number) =>
    exec(async () => {
      await setActorPosition(actor.name, p)
      setPosition(p)
    })

  const commands: Record<string, () => Promise<void>> = {
    close: () => setPos(0),
    open: () => setPos(100),
    tilt: () => exec(() => tiltActor(actor.name, 0)),
  }
  const shutter = actor.deviceType === 'rollershutter'
  const steps = shutter ? [20, 40, 60, 80] : [20, 30, 40, 50]
  for (const s of steps) {
    commands[`step-${s}`] = shutter ? () => setPos(s) : () => exec(() => setSlatPosition(actor.name, s))
  }
  const onRun = (id: string) => run(id, commands[id])
  const common = { pending, onRun, disabled: isLoading }

  return (
    <article className="card touch-manipulation">
      <div className="card-h">
        <span className="ico sm" style={{ '--c': 'var(--idle)' } as React.CSSProperties}>
          <Blinds />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate">{actor.displayName}</h3>
          <div className="mono truncate text-[11px]" style={{ color: 'var(--ink-4)' }}>
            {actor.ip}
            {actor.serial && ` · ${actor.serial}`}
          </div>
        </div>
        <span className="state">{shutter ? t('type.rollershutter') : t('type.blinds')}</span>
      </div>
      <div className="card-b space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <PositionReadout value={position} preview={isDragging} />
          {actor.tilted && <span className="state info num">{t('tilted', { n: num(actor.tiltPosition) })}</span>}
        </div>
        <Slider
          label={t('position')}
          value={[position]}
          onValueChange={(v) => {
            setPosition(v[0])
            setIsDragging(true)
          }}
          onValueCommit={(v) => {
            clear()
            setIsDragging(false)
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
          <div className="sub-label">{shutter ? t('quick') : t('slats')}</div>
          <ButtonRow n={4}>
            {steps.map((s) => (
              <SafeButton key={s} id={`step-${s}`} {...common} className="sm">
                {num(s)} %
              </SafeButton>
            ))}
          </ButtonRow>
        </div>
        <SafeButton id="tilt" {...common} className="sm w-full">
          {shutter ? t('tilt.shutter') : t('tilt.blinds')}
        </SafeButton>
      </div>
    </article>
  )
}
