import { useEffect, useState, useRef } from 'react'
import { Blinds, ChevronDown, ChevronUp, RefreshCw, Shield, ShieldCheck } from 'lucide-react'
import { ActorStatus, GroupInfo } from '@/types/actor'
import { API_BASE, fetchActors, fetchGroups, tiltAllActors, setAllActorsPosition } from '@/lib/api'
import { useSSE } from '@/hooks/useSSE'
import { useSafeAction } from '@/hooks/useSafeAction'
import { ActorCard } from '@/components/ActorCard'
import { GroupCard } from '@/components/GroupCard'
import { GroupDialog } from '@/components/GroupDialog'
import { ButtonRow, SafeButton } from '@/components/Controls'
import { LANGS, useI18n } from '@/lib/i18n'
import { byRank } from '@/lib/sort'

// Phones start in safe mode: a pocket tap must not move the blinds.
const isMobileDevice = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768

export function App() {
  const { t } = useI18n()
  const [actors, setActors] = useState<ActorStatus[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globalSafeMode, setGlobalSafeMode] = useState(isMobileDevice())
  const executingGlobalActionRef = useRef(false)

  const { data: sseData, isConnected, error: sseError, reconnect } = useSSE(API_BASE + '/events')

  useEffect(() => {
    if (sseData !== undefined && !executingGlobalActionRef.current) {
      setActors(sseData ?? [])
      setIsLoading(false)
      setError(null)
    }
  }, [sseData])

  // Connected but no data yet: stop showing the spinner after 2 s.
  useEffect(() => {
    if (isConnected && isLoading) {
      const timeout = setTimeout(() => setIsLoading(false), 2000)
      return () => clearTimeout(timeout)
    }
  }, [isConnected, isLoading])

  useEffect(() => {
    if (sseError) setError(sseError)
  }, [sseError])

  const loadActors = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setActors((await fetchActors()) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Fallback while the event stream is not up yet.
  useEffect(() => {
    if (!isConnected && isLoading) loadActors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, isLoading])

  useEffect(() => {
    fetchGroups()
      .then((g) => setGroups(g ?? []))
      .catch(() => setGroups([]))
  }, [actors])

  // Keep the open group dialog on fresh data.
  const openGroup = selectedGroup ? (groups.find((g) => g.groupId === selectedGroup.groupId) ?? selectedGroup) : null

  useEffect(() => {
    const onResize = () => {
      if (isMobileDevice()) setGlobalSafeMode(true)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  const header = (
    <header className="top-bar">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-safe py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="ico">
            <Blinds />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[17px] leading-tight font-semibold tracking-tight">{t('title')}</div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-3)' }}>
              {isConnected ? (
                <>
                  <span className="dot live" /> shelly
                </>
              ) : (
                <>
                  <span className="dot bad" /> {t('disconnected')}
                </>
              )}
            </div>
          </div>
        </div>
        {!isConnected && (
          <button className="icon-btn" onClick={reconnect} aria-label={t('reconnect')} title={t('reconnect')}>
            <RefreshCw className="size-[18px]" />
          </button>
        )}
        <button
          className="icon-btn"
          aria-pressed={globalSafeMode}
          onClick={() => setGlobalSafeMode((s) => !s)}
          aria-label={globalSafeMode ? t('safe.on') : t('safe.off')}
          title={globalSafeMode ? t('safe.on') : t('safe.off')}
        >
          {globalSafeMode ? <ShieldCheck className="size-[18px]" /> : <Shield className="size-[18px]" />}
        </button>
        <LangSwitch />
      </div>
    </header>
  )

  if (isLoading && actors.length === 0) {
    return (
      <div className="min-h-screen">
        {header}
        <div className="flex flex-col items-center gap-3 pt-24" style={{ color: 'var(--ink-3)' }}>
          <RefreshCw className="size-6 animate-spin" />
          <p>{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (error && actors.length === 0) {
    return (
      <div className="min-h-screen">
        {header}
        <div className="mx-auto max-w-md px-safe pt-10">
          <div className="card">
            <div className="card-h">
              <span className="dot bad" />
              <h3>{t('error.title')}</h3>
            </div>
            <div className="card-b space-y-3">
              <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                {error}
              </p>
              <button className="btn w-full" onClick={loadActors}>
                {t('retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const individual = actors.filter((a) => !a.groupId).sort(byRank)

  return (
    <div className="min-h-screen overflow-x-hidden">
      {header}
      <main className="mx-auto max-w-6xl space-y-6 px-safe pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {globalSafeMode && (
          <p className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-3)' }}>
            <ShieldCheck className="size-4 shrink-0" style={{ color: 'var(--accent-ink)' }} />
            <span>
              {t('safe.hint')}
              {isMobileDevice() && <> · {t('safe.auto')}</>}
            </span>
          </p>
        )}

        {actors.length > 1 && (
          <AllControls
            actors={actors}
            safe={globalSafeMode}
            busy={(b) => {
              executingGlobalActionRef.current = b
            }}
          />
        )}

        {actors.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-medium">{t('empty')}</p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-3)' }}>
              {t('empty.hint')}
            </p>
          </div>
        ) : (
          <>
            {groups.length > 0 && (
              <section>
                <div className="sec-title">
                  <h2>{t('groups')}</h2>
                  <span className="r num">{groups.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groups.map((group) => (
                    <GroupCard
                      key={group.groupId}
                      group={group}
                      globalSafeMode={globalSafeMode}
                      onShowDetails={setSelectedGroup}
                    />
                  ))}
                </div>
              </section>
            )}

            {individual.length > 0 && (
              <section>
                <div className="sec-title">
                  <h2>{t('devices')}</h2>
                  <span className="r num">{individual.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {individual.map((actor) => (
                    <ActorCard key={actor.name} actor={actor} globalSafeMode={globalSafeMode} />
                  ))}
                </div>
              </section>
            )}

            {groups.length > 0 && individual.length === 0 && (
              <p className="text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
                {t('allGrouped')}
              </p>
            )}
          </>
        )}
      </main>

      <GroupDialog
        group={openGroup}
        isOpen={openGroup !== null}
        onClose={() => setSelectedGroup(null)}
        globalSafeMode={globalSafeMode}
      />
    </div>
  )
}

function AllControls({ actors, safe, busy }: { actors: ActorStatus[]; safe: boolean; busy: (b: boolean) => void }) {
  const { t } = useI18n()
  const { pending, run } = useSafeAction(safe)
  const hasBlinds = actors.some((a) => a.deviceType === 'blinds')

  const exec = async (fn: () => Promise<void>) => {
    busy(true)
    try {
      await fn()
    } catch (error) {
      console.error(error)
      alert(t('failed', { error: error instanceof Error ? error.message : String(error) }))
    } finally {
      busy(false)
    }
  }
  const commands: Record<string, () => Promise<void>> = {
    'close-all': () => exec(() => setAllActorsPosition(0)),
    'open-all': () => exec(() => setAllActorsPosition(100)),
    'tilt-all-closed': () => exec(() => tiltAllActors(0)),
    'tilt-all-half': () => exec(() => tiltAllActors(50)),
  }
  const common = { pending, onRun: (id: string) => run(id, commands[id]) }

  return (
    <section className="card">
      <div className="card-h">
        <h3>{t('all')}</h3>
        <span className="meta num">{t('all.devices', { n: actors.length })}</span>
      </div>
      <div className="card-b grid gap-4 sm:grid-cols-2">
        <div>
          <div className="sub-label">{t('position')}</div>
          <ButtonRow>
            <SafeButton id="close-all" {...common} icon={<ChevronDown className="size-4" />}>
              {t('all.close')}
            </SafeButton>
            <SafeButton id="open-all" {...common} icon={<ChevronUp className="size-4" />}>
              {t('all.open')}
            </SafeButton>
          </ButtonRow>
        </div>
        {hasBlinds && (
          <div>
            <div className="sub-label">{t('all.slats')}</div>
            <ButtonRow>
              <SafeButton id="tilt-all-closed" {...common}>
                {t('all.tiltClosed')}
              </SafeButton>
              <SafeButton id="tilt-all-half" {...common}>
                {t('all.tiltHalf')}
              </SafeButton>
            </ButtonRow>
          </div>
        )}
      </div>
    </section>
  )
}

function LangSwitch() {
  const i = useI18n()
  return (
    <div className="seg" role="group" aria-label={i.t('language')}>
      {LANGS.map((l) => (
        <button key={l} aria-pressed={i.lang === l} onClick={() => i.setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
