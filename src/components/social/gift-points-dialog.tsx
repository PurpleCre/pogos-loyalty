import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Gift } from 'lucide-react';
import { useGiftPoints } from '@/hooks/useGiftPoints';
import { useRewards } from '@/hooks/useRewards';

export const GiftPointsDialog = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const { giftPoints, sending } = useGiftPoints();
  const { userPoints } = useRewards();

  const handleGift = async () => {
    const pointsNum = parseInt(points);
    
    if (!email || !pointsNum) {
      return;
    }

    const result = await giftPoints(email, pointsNum, message);
    
    if (!result.error) {
      setOpen(false);
      setEmail('');
      setPoints('');
      setMessage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Gift className="h-4 w-4" />
          Gift Points
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gift Points to a Friend</DialogTitle>
          <DialogDescription>
            Share your points with friends and family. You have {userPoints?.current_points || 0} points available.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="points">Points to Gift</Label>
            <Input
              id="points"
              type="number"
              min="1"
              max={userPoints?.current_points || 0}
              placeholder="100"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <Button 
            onClick={handleGift} 
            disabled={sending || !email || !points || parseInt(points) > (userPoints?.current_points || 0)}
            className="w-full"
          >
            {sending ? 'Sending...' : 'Send Gift'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};