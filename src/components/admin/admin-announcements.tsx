import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Megaphone, X, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export const AdminAnnouncements = () => {
  const { announcements, createAnnouncement, deleteAnnouncement, isCreating } = useAnnouncements();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'success' | 'warning' | 'promotion'>('info');
  const [expiresAt, setExpiresAt] = useState('');

  const handleCreate = () => {
    if (!title || !message) return;

    createAnnouncement({
      title,
      message,
      type,
      expires_at: expiresAt || undefined,
    });

    setTitle('');
    setMessage('');
    setType('info');
    setExpiresAt('');
  };

  const getTypeBadgeVariant = (announcementType: string) => {
    switch (announcementType) {
      case 'success': return 'default';
      case 'warning': return 'destructive';
      case 'promotion': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Create Announcement</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Exciting news..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Share important updates with your customers..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="promotion">Promotion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Expires (Optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleCreate} disabled={isCreating || !title || !message} className="w-full">
            {isCreating ? 'Creating...' : 'Create Announcement'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Announcements</h3>
        <div className="space-y-3">
          {announcements && announcements.length > 0 ? (
            announcements.map((announcement) => (
              <div key={announcement.id} className="border rounded-lg p-4 relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => deleteAnnouncement(announcement.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
                
                <div className="pr-8">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{announcement.title}</h4>
                    <Badge variant={getTypeBadgeVariant(announcement.type)}>
                      {announcement.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{announcement.message}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Created {format(new Date(announcement.created_at), 'PPp')}</span>
                    {announcement.expires_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Expires {format(new Date(announcement.expires_at), 'PPp')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">No active announcements</p>
          )}
        </div>
      </Card>
    </div>
  );
};