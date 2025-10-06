import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useGiftPoints = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const giftPoints = async (recipientEmail: string, points: number, message?: string) => {
    if (!user) {
      toast.error('You must be logged in to gift points');
      return { error: 'Not authenticated' };
    }

    setSending(true);

    try {
      // Get sender's current points
      const { data: senderPoints, error: pointsError } = await supabase
        .from('user_points')
        .select('current_points')
        .eq('user_id', user.id)
        .single();

      if (pointsError) throw pointsError;

      if (!senderPoints || senderPoints.current_points < points) {
        toast.error('Insufficient points to gift');
        return { error: 'Insufficient points' };
      }

      // Find recipient by email
      const { data: recipient, error: recipientError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', recipientEmail)
        .single();

      if (recipientError || !recipient) {
        toast.error('Recipient not found');
        return { error: 'Recipient not found' };
      }

      if (recipient.id === user.id) {
        toast.error("You can't gift points to yourself");
        return { error: 'Cannot gift to self' };
      }

      // Deduct points from sender
      const { error: deductError } = await supabase
        .from('user_points')
        .update({
          current_points: senderPoints.current_points - points,
          total_redeemed: (await supabase
            .from('user_points')
            .select('total_redeemed')
            .eq('user_id', user.id)
            .single()).data?.total_redeemed || 0 + points
        })
        .eq('user_id', user.id);

      if (deductError) throw deductError;

      // Add points to recipient
      const { data: recipientPoints } = await supabase
        .from('user_points')
        .select('current_points, total_earned, total_redeemed')
        .eq('user_id', recipient.id)
        .single();

      const { error: addError } = await supabase
        .from('user_points')
        .upsert({
          user_id: recipient.id,
          current_points: (recipientPoints?.current_points || 0) + points,
          total_earned: (recipientPoints?.total_earned || 0) + points,
          total_redeemed: recipientPoints?.total_redeemed || 0
        });

      if (addError) throw addError;

      // Record the gift
      const { error: giftError } = await supabase
        .from('point_gifts')
        .insert({
          sender_id: user.id,
          recipient_id: recipient.id,
          points,
          message: message || null,
          status: 'completed'
        });

      if (giftError) throw giftError;

      // Create transaction records
      await supabase.from('transactions').insert([
        {
          user_id: user.id,
          transaction_type: 'redemption',
          points_redeemed: points,
          items: [`Gift to ${recipientEmail}`]
        },
        {
          user_id: recipient.id,
          transaction_type: 'purchase',
          points_earned: points,
          items: ['Gift received']
        }
      ]);

      toast.success(`${points} points gifted to ${recipientEmail}!`);
      return { error: null };
    } catch (error) {
      console.error('Error gifting points:', error);
      toast.error('Failed to gift points');
      return { error: 'Failed to gift points' };
    } finally {
      setSending(false);
    }
  };

  return { giftPoints, sending };
};