import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const AdminEmailNotifications = () => {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [offerDetails, setOfferDetails] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject || !title || !message) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-special-offer', {
        body: {
          subject,
          title,
          message,
          offerDetails: offerDetails || undefined,
        },
      });

      if (error) throw error;

      toast.success(`Special offer sent to ${data.recipientCount} users!`);
      setSubject('');
      setTitle('');
      setMessage('');
      setOfferDetails('');
    } catch (error: any) {
      console.error('Error sending special offer:', error);
      toast.error(error.message || 'Failed to send special offer');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Send Special Offer Email</h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Send promotional emails to all registered users
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Email Subject *</Label>
          <Input
            id="subject"
            placeholder="🎉 Special Offer Just for You!"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-title">Email Title *</Label>
          <Input
            id="email-title"
            placeholder="Exclusive Rewards Awaiting"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-message">Main Message *</Label>
          <Textarea
            id="email-message"
            placeholder="We're excited to share this exclusive offer with our loyal customers..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="offer-details">Offer Details (Optional)</Label>
          <Textarea
            id="offer-details"
            placeholder="Double points on all purchases this weekend! Use code: DOUBLE2X"
            value={offerDetails}
            onChange={(e) => setOfferDetails(e.target.value)}
            rows={3}
          />
        </div>

        <Button 
          onClick={handleSend} 
          disabled={sending || !subject || !title || !message}
          className="w-full"
        >
          {sending ? 'Sending to all users...' : 'Send to All Users'}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          This will send an email to all registered users in the system
        </p>
      </div>
    </Card>
  );
};