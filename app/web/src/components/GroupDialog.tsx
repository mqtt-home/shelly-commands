import { GroupInfo } from '@/types/actor';
import { ActorCard } from '@/components/ActorCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogClose } from '@/components/ui/dialog';
import { Users } from 'lucide-react';

interface GroupDialogProps {
  group: GroupInfo | null;
  isOpen: boolean;
  onClose: () => void;
  globalSafeMode: boolean;
}

export function GroupDialog({ group, isOpen, onClose, globalSafeMode }: GroupDialogProps) {
  if (!group) return null;

  // Determine optimal layout based on number of actors
  const actorCount = group.actors.length;
  const getGridClasses = () => {
    if (actorCount === 1) return "grid grid-cols-1 gap-4 max-w-md mx-auto";
    if (actorCount === 2) return "grid grid-cols-1 md:grid-cols-2 gap-4";
    if (actorCount <= 4) return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
    if (actorCount <= 6) return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
    return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";
  };

  const getDialogWidth = () => {
    if (actorCount === 1) return "max-w-lg mx-auto";
    if (actorCount === 2) return "max-w-4xl mx-auto";
    if (actorCount <= 4) return "max-w-6xl mx-auto";
    return "max-w-[90vw] mx-auto"; // Use most of the viewport width for many actors
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogContent className={getDialogWidth()}>
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            {group.name} - Individual Controls
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Control each actor in the group individually. Changes will be applied immediately.
            </div>
            
            <div className={getGridClasses()}>
              {group.actors.sort((a, b) => {
                // Sort by rank first (ascending), then by name (alphabetically)
                if (a.rank !== b.rank) {
                  return a.rank - b.rank;
                }
                return a.name.localeCompare(b.name);
              }).map((actor) => (
                <ActorCard
                  key={actor.name}
                  actor={actor}
                  globalSafeMode={globalSafeMode}
                />
              ))}
            </div>
            
            {group.actors.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No actors found in this group.
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
