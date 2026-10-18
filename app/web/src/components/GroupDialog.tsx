import { Layers } from 'lucide-react'
import { GroupInfo } from '@/types/actor'
import { ActorCard } from '@/components/ActorCard'
import { Dialog } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n'
import { byRank } from '@/lib/sort'

interface GroupDialogProps {
  group: GroupInfo | null
  isOpen: boolean
  onClose: () => void
  globalSafeMode: boolean
}

export function GroupDialog({ group, isOpen, onClose, globalSafeMode }: GroupDialogProps) {
  const { t } = useI18n()
  if (!group) return null
  const actors = [...(group.actors ?? [])].sort(byRank)
  const n = actors.length
  const width = n <= 1 ? 'max-w-md' : n === 2 ? 'max-w-4xl' : 'max-w-6xl'
  const cols = n <= 1 ? '' : n === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      closeLabel={t('dialog.close')}
      className={width}
      title={
        <>
          <Layers className="size-[18px]" style={{ color: 'var(--ink-3)' }} />
          <span className="truncate">{group.name}</span>
        </>
      }
    >
      <p className="mb-3 text-[13px]" style={{ color: 'var(--ink-3)' }}>
        {t('group.dialogHint')}
      </p>
      {n === 0 ? (
        <p className="py-8 text-center" style={{ color: 'var(--ink-3)' }}>
          {t('group.empty')}
        </p>
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${cols}`}>
          {actors.map((actor) => (
            <ActorCard key={actor.name} actor={actor} globalSafeMode={globalSafeMode} />
          ))}
        </div>
      )}
    </Dialog>
  )
}
