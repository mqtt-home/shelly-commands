import { useState, useRef } from 'react';
import { GroupInfo } from '@/types/actor';
import { setGroupPosition, tiltGroup, setSlatPositionGroup } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ChevronUp, ChevronDown, RotateCcw, Users, Settings } from 'lucide-react';

interface GroupCardProps {
  group: GroupInfo;
  globalSafeMode: boolean;
  onShowDetails?: (group: GroupInfo) => void;
}

export function GroupCard({ group, globalSafeMode, onShowDetails }: GroupCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingTimeout, setPendingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const executingActionRef = useRef(false);

  // Calculate average position from all actors in the group
  const averagePosition = Math.round(
    group.actors.reduce((sum, actor) => sum + actor.position, 0) / group.actors.length
  );

  // Check if any actor in the group is tilted
  const hasActorsToTilt = group.actors.some(actor => actor.deviceType === 'blinds');
  const anyTilted = group.actors.some(actor => actor.tilted);

  const handleButtonAction = (action: () => Promise<void>, actionId: string) => {
    if (globalSafeMode) {
      if (pendingAction === actionId) {
        // Second tap - execute the action
        setPendingAction(null);
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          setPendingTimeout(null);
        }
        action();
      } else {
        // First tap - show pending state
        setPendingAction(actionId);
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
        }
        const timeout = setTimeout(() => {
          setPendingAction(null);
          setPendingTimeout(null);
        }, 3000);
        setPendingTimeout(timeout);
      }
    } else {
      action();
    }
  };

  const handlePositionChange = async (newPosition: number) => {
    setIsLoading(true);
    executingActionRef.current = true;
    try {
      await setGroupPosition(group.groupId, newPosition);
    } catch (error) {
      console.error('Failed to set group position:', error);
      alert('Failed to set group position. Please try again.');
    } finally {
      setIsLoading(false);
      executingActionRef.current = false;
    }
  };

  const handleTilt = async (tiltPosition: number) => {
    setIsLoading(true);
    executingActionRef.current = true;
    try {
      await tiltGroup(group.groupId, tiltPosition);
    } catch (error) {
      console.error('Failed to tilt group:', error);
      alert('Failed to tilt group. Please try again.');
    } finally {
      setIsLoading(false);
      executingActionRef.current = false;
    }
  };

  const handleSlatPosition = async (slatPosition: number) => {
    setIsLoading(true);
    executingActionRef.current = true;
    try {
      await setSlatPositionGroup(group.groupId, slatPosition);
    } catch (error) {
      console.error('Failed to set group slat position:', error);
      alert('Failed to set group slat position. Please try again.');
    } finally {
      setIsLoading(false);
      executingActionRef.current = false;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-blue-600" />
          {group.name}
        </CardTitle>
        <CardDescription className="text-sm">
          Group • {group.actorCount} actors
          {globalSafeMode && (
            <div className="text-xs text-blue-600 mt-1">
              Safe Mode: Double tap buttons to execute
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Average Position: {averagePosition}%</span>
            {onShowDetails && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowDetails(group)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Slider
            value={[averagePosition]}
            onValueChange={([value]) => handlePositionChange(value)}
            max={100}
            step={1}
            className="w-full"
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={pendingAction === 'pos-0' ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleButtonAction(() => handlePositionChange(0), 'pos-0')}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation text-xs"
          >
            <ChevronDown className="mr-1 h-3 w-3" />
            {pendingAction === 'pos-0' ? 'Tap again' : 'Close'}
          </Button>
          <Button
            variant={pendingAction === 'pos-100' ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleButtonAction(() => handlePositionChange(100), 'pos-100')}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation text-xs"
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            {pendingAction === 'pos-100' ? 'Tap again' : 'Open'}
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <Button
            variant={pendingAction === 'pos-20' ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleButtonAction(() => handlePositionChange(20), 'pos-20')}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation text-xs px-1"
          >
            {pendingAction === 'pos-20' ? 'Tap again' : '20%'}
          </Button>
          <Button
            variant={pendingAction === 'pos-40' ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleButtonAction(() => handlePositionChange(40), 'pos-40')}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation text-xs px-1"
          >
            {pendingAction === 'pos-40' ? 'Tap again' : '40%'}
          </Button>
          <Button
            variant={pendingAction === 'pos-60' ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleButtonAction(() => handlePositionChange(60), 'pos-60')}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation text-xs px-1"
          >
            {pendingAction === 'pos-60' ? 'Tap again' : '60%'}
          </Button>
          <Button
            variant={pendingAction === 'pos-80' ? "destructive" : "outline"}
            size="sm"
            onClick={() => handleButtonAction(() => handlePositionChange(80), 'pos-80')}
            disabled={isLoading}
            className="min-h-[44px] touch-manipulation text-xs px-1"
          >
            {pendingAction === 'pos-80' ? 'Tap again' : '80%'}
          </Button>
        </div>

        {hasActorsToTilt && (
          <>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Tilt Controls</span>
                {anyTilted && (
                  <span className="text-xs text-green-600">Some tilted</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant={pendingAction === 'tilt-on' ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => handleButtonAction(() => handleTilt(0), 'tilt-on')}
                  disabled={isLoading}
                  className="min-h-[44px] touch-manipulation text-xs"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  {pendingAction === 'tilt-on' ? 'Tap again' : 'Tilt (Close & Tilt)'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <Button
                variant={pendingAction === 'slat-30' ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleButtonAction(() => handleSlatPosition(30), 'slat-30')}
                disabled={isLoading}
                className="min-h-[44px] touch-manipulation text-xs px-1"
              >
                {pendingAction === 'slat-30' ? 'Tap again' : '30%'}
              </Button>
              <Button
                variant={pendingAction === 'slat-50' ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleButtonAction(() => handleSlatPosition(50), 'slat-50')}
                disabled={isLoading}
                className="min-h-[44px] touch-manipulation text-xs px-1"
              >
                {pendingAction === 'slat-50' ? 'Tap again' : '50%'}
              </Button>
              <Button
                variant={pendingAction === 'slat-70' ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleButtonAction(() => handleSlatPosition(70), 'slat-70')}
                disabled={isLoading}
                className="min-h-[44px] touch-manipulation text-xs px-1"
              >
                {pendingAction === 'slat-70' ? 'Tap again' : '70%'}
              </Button>
            </div>
          </>
        )}

        {isLoading && (
          <div className="text-center text-sm text-muted-foreground">
            Updating group...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
