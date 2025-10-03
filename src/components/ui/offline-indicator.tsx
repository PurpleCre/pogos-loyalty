import { WifiOff, Cloud, Database } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';
import { Badge } from './badge';

export const OfflineIndicator = () => {
  const { isOnline, pendingSync } = useOffline();

  if (isOnline && !pendingSync) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      {!isOnline ? (
        <Badge variant="destructive" className="flex items-center gap-2 px-4 py-2 shadow-lg">
          <WifiOff className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Offline Mode</span>
            <span className="text-xs opacity-90">Viewing cached data</span>
          </div>
        </Badge>
      ) : pendingSync ? (
        <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2 shadow-lg animate-pulse">
          <Cloud className="h-4 w-4" />
          <span className="text-sm font-medium">Syncing...</span>
        </Badge>
      ) : null}
    </div>
  );
};
