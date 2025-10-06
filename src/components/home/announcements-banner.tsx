import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Megaphone, Info, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';

export const AnnouncementsBanner = () => {
  const { announcements } = useAnnouncements();

  if (!announcements || announcements.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'promotion':
        return <Sparkles className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getVariant = (type: string): 'default' | 'destructive' => {
    return type === 'warning' ? 'destructive' : 'default';
  };

  return (
    <div className="space-y-3">
      {announcements.slice(0, 3).map((announcement) => (
        <Alert key={announcement.id} variant={getVariant(announcement.type)}>
          {getIcon(announcement.type)}
          <AlertTitle>{announcement.title}</AlertTitle>
          <AlertDescription>{announcement.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
};