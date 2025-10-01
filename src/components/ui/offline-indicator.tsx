import { WifiOff, Cloud } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';

export const OfflineIndicator = () => {
  const { isOnline, pendingSync } = useOffline();

  if (isOnline && !pendingSync) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2 shadow-lg">
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-foreground">Offline Mode</span>
        </>
      ) : pendingSync ? (
        <>
          <Cloud className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-sm font-medium text-foreground">Syncing...</span>
        </>
      ) : null}
    </div>
  );
};
