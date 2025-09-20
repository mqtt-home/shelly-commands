import { useEffect, useState, useRef } from 'react';
import { ActorStatus, GroupInfo } from '@/types/actor';
import { API_BASE, fetchActors, fetchGroups, tiltAllActors, setAllActorsPosition } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';
import { ActorCard } from '@/components/ActorCard';
import { GroupCard } from '@/components/GroupCard';
import { GroupDialog } from '@/components/GroupDialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Home, Shield, Users, User } from 'lucide-react';

// Function to detect mobile devices
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
};

export function App() {
  const [actors, setActors] = useState<ActorStatus[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSafeMode, setGlobalSafeMode] = useState(isMobileDevice());
  const [pendingGlobalAction, setPendingGlobalAction] = useState<string | null>(null);
  const [globalPendingTimeout, setGlobalPendingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const executingGlobalActionRef = useRef(false);
  
  // Use SSE for real-time updates
  const { data: sseData, isConnected, error: sseError, reconnect } = useSSE(API_BASE + '/events');

  // Update actors when SSE data changes
  useEffect(() => {
    if (sseData !== undefined && !executingGlobalActionRef.current) {
      console.log('SSE data received:', sseData);
      setActors(sseData);
      setIsLoading(false);
      setError(null);
    }
  }, [sseData]);

  // Handle SSE connection success - set loading to false after a short delay if connected but no data
  useEffect(() => {
    if (isConnected && isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
        }
      }, 2000); // Wait 2 seconds for initial data
      return () => clearTimeout(timeout);
    }
  }, [isConnected, isLoading]);

  // Handle SSE connection errors
  useEffect(() => {
    if (sseError) {
      setError(sseError);
    }
  }, [sseError]);

  const loadActors = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchActors();
      setActors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actors');
      console.error('Error loading actors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await fetchGroups();
      setGroups(data || []); // Ensure we always set an array
    } catch (err) {
      console.error('Error loading groups:', err);
      setGroups([]); // Set empty array on error
    }
  };

  const handleShowGroupDetails = (group: GroupInfo) => {
    setSelectedGroup(group);
    setIsGroupDialogOpen(true);
  };

  const handleCloseGroupDialog = () => {
    setIsGroupDialogOpen(false);
    setSelectedGroup(null);
  };

  // Fallback: load actors initially if SSE is not connected or hasn't received data yet
  useEffect(() => {
    if (!isConnected && isLoading) {
      loadActors();
    }
  }, [isConnected, isLoading]);

  // Load groups data
  useEffect(() => {
    loadGroups();
  }, [actors]); // Reload groups when actors change

  // Cleanup global timeout on unmount
  useEffect(() => {
    return () => {
      if (globalPendingTimeout) {
        clearTimeout(globalPendingTimeout);
      }
    };
  }, [globalPendingTimeout]);

  // Auto-enable global safe mode on mobile device detection changes
  useEffect(() => {
    const handleResize = () => {
      const isMobile = isMobileDevice();
      if (isMobile && !globalSafeMode) {
        setGlobalSafeMode(true);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [globalSafeMode]);

  const handleTiltAll = async (position: number) => {
    try {
      await tiltAllActors(position);
      // SSE will automatically update the UI, no need to manually refresh
    } catch (error) {
      console.error('Failed to tilt all actors:', error);
      alert('Failed to tilt all actors. Please try again.');
    }
  };

  const handleSetAllPosition = async (position: number) => {
    try {
      await setAllActorsPosition(position);
      // SSE will automatically update the UI, no need to manually refresh
    } catch (error) {
      console.error('Failed to set position for all actors:', error);
      alert('Failed to set position for all actors. Please try again.');
    }
  };

  const handleGlobalAction = async (action: () => Promise<void>, actionName: string) => {
    if (globalSafeMode) {
      if (pendingGlobalAction === actionName) {
        // Execute the action if it's the second tap
        clearGlobalPendingAction();
        executingGlobalActionRef.current = true;
        await action();
        executingGlobalActionRef.current = false;
      } else {
        // First tap - set pending action
        setPendingGlobalAction(actionName);
        // Clear any existing timeout
        if (globalPendingTimeout) {
          clearTimeout(globalPendingTimeout);
        }
        // Set new timeout to clear pending action after 3 seconds
        const timeoutId = setTimeout(() => {
          setPendingGlobalAction(null);
          setGlobalPendingTimeout(null);
        }, 3000);
        setGlobalPendingTimeout(timeoutId);
      }
    } else {
      // Direct execution when safe mode is disabled
      executingGlobalActionRef.current = true;
      await action();
      executingGlobalActionRef.current = false;
    }
  };

  const clearGlobalPendingAction = () => {
    setPendingGlobalAction(null);
    if (globalPendingTimeout) {
      clearTimeout(globalPendingTimeout);
      setGlobalPendingTimeout(null);
    }
  };

  const toggleGlobalSafeMode = () => {
    setGlobalSafeMode(!globalSafeMode);
    clearGlobalPendingAction();
  };

  if (isLoading && actors.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading actors...</p>
        </div>
      </div>
    );
  }

  if (error && actors.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadActors} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto p-4 sm:p-6">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary rounded-lg shrink-0">
                <Home className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">Shelly Control Panel</h1>
                <p className="text-muted-foreground text-sm sm:text-base hidden sm:block">
                  Manage your smart blinds and shutters
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant={globalSafeMode ? "default" : "ghost"}
                size="icon"
                onClick={toggleGlobalSafeMode}
                className="h-9 w-9"
                title={globalSafeMode ? "Global Safe Mode ON" : "Global Safe Mode OFF"}
              >
                <Shield className="h-4 w-4" />
              </Button>
              <ThemeToggle />
              {!isConnected && (
                <Button
                  variant="outline"
                  onClick={reconnect}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Reconnect</span>
                </Button>
              )}
            </div>
          </div>

          {actors.length > 1 && (
            <Card className="mb-4 sm:mb-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Global Controls</span>
                  {globalSafeMode && (
                    <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                      Safe Mode ON
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Control all blinds and shutters at once
                  {globalSafeMode && (
                    <span className="block text-xs text-blue-600 mt-1">
                      Double tap buttons to execute
                      {isMobileDevice() && (
                        <span className="text-xs text-muted-foreground block">
                          (Auto-enabled on mobile)
                        </span>
                      )}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Position Controls */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Position</h4>
                    <div className="flex gap-3 flex-wrap">
                      <Button
                        variant={pendingGlobalAction === 'close-all' ? "destructive" : "secondary"}
                        onClick={() => handleGlobalAction(() => handleSetAllPosition(0), 'close-all')}
                        className="flex-1 min-w-0 min-h-[44px] touch-manipulation"
                      >
                        {pendingGlobalAction === 'close-all' ? 'Tap again' : 'Close All'}
                      </Button>
                      <Button
                        variant={pendingGlobalAction === 'open-all' ? "destructive" : "secondary"}
                        onClick={() => handleGlobalAction(() => handleSetAllPosition(100), 'open-all')}
                        className="flex-1 min-w-0 min-h-[44px] touch-manipulation"
                      >
                        {pendingGlobalAction === 'open-all' ? 'Tap again' : 'Open All'}
                      </Button>
                    </div>
                  </div>

                  {/* Tilt Controls for Blinds */}
                  {actors.some(actor => actor.deviceType === 'blinds') && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Tilt (Blinds only)</h4>
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          variant={pendingGlobalAction === 'tilt-all-closed' ? "destructive" : "secondary"}
                          onClick={() => handleGlobalAction(() => handleTiltAll(0), 'tilt-all-closed')}
                          className="flex-1 min-w-0 min-h-[44px] touch-manipulation"
                        >
                          {pendingGlobalAction === 'tilt-all-closed' ? 'Tap again' : 'Tilt All (Closed)'}
                        </Button>
                        <Button
                          variant={pendingGlobalAction === 'tilt-all-half' ? "destructive" : "secondary"}
                          onClick={() => handleGlobalAction(() => handleTiltAll(50), 'tilt-all-half')}
                          className="flex-1 min-w-0 min-h-[44px] touch-manipulation"
                        >
                          {pendingGlobalAction === 'tilt-all-half' ? 'Tap again' : 'Tilt All (Half)'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {actors.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No actors found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure your Shelly devices are configured and connected.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Groups Section */}
            {groups && groups.length > 0 && (
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
                  <Users className="h-5 w-5 text-blue-600" />
                  Groups ({groups.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {groups.map((group) => (
                    <GroupCard
                      key={group.groupId}
                      group={group}
                      globalSafeMode={globalSafeMode}
                      onShowDetails={handleShowGroupDetails}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Individual Actors Section */}
            {(() => {
              const individualActors = actors.filter(actor => !actor.groupId || actor.groupId === '');
              return individualActors.length > 0 && (
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold mb-4">
                    <User className="h-5 w-5 text-green-600" />
                    Individual Actors ({individualActors.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {individualActors.sort((a, b) => {
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
                </div>
              );
            })()}

            {/* Show message if all actors are grouped */}
            {groups && groups.length > 0 && actors.filter(actor => !actor.groupId || actor.groupId === '').length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">All actors are organized in groups above.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Group Dialog */}
        <GroupDialog
          group={selectedGroup}
          isOpen={isGroupDialogOpen}
          onClose={handleCloseGroupDialog}
          globalSafeMode={globalSafeMode}
        />
      </div>
    </div>
  );
}
