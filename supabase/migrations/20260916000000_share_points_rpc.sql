-- Migration: Share points between users securely
-- We need SECURITY DEFINER so that this function can lookup users by email in auth.users
-- and bypass normal RLS constraints for the atomic transfer.

CREATE OR REPLACE FUNCTION public.share_user_points(
    sender_id UUID,
    receiver_email TEXT,
    points_to_transfer INTEGER
)
RETURNS JSON AS $$
DECLARE
    receiver_id UUID;
    sender_current_points INTEGER;
    sender_total_earned INTEGER;
    sender_total_redeemed INTEGER;
    receiver_current_points INTEGER;
    receiver_total_earned INTEGER;
    receiver_total_redeemed INTEGER;
BEGIN
    -- 1. Validate inputs
    IF points_to_transfer <= 0 THEN
        RETURN json_build_object('error', 'Points to transfer must be greater than 0');
    END IF;

    -- 2. Find receiver by email
    -- Note: auth.users is accessible here because the function is SECURITY DEFINER (if created as such, or postgres superuser)
    SELECT id INTO receiver_id FROM auth.users WHERE email = receiver_email;
    
    IF receiver_id IS NULL THEN
        RETURN json_build_object('error', 'Recipient not found with that email address');
    END IF;

    IF receiver_id = sender_id THEN
        RETURN json_build_object('error', 'You cannot send points to yourself');
    END IF;

    -- 3. Lock sender's points row to prevent race conditions
    SELECT current_points, total_earned, total_redeemed 
    INTO sender_current_points, sender_total_earned, sender_total_redeemed
    FROM public.user_points 
    WHERE user_id = sender_id 
    FOR UPDATE;

    IF sender_current_points IS NULL THEN
        RETURN json_build_object('error', 'Sender points account not found');
    END IF;

    IF sender_current_points < points_to_transfer THEN
        RETURN json_build_object('error', 'Insufficient points for this transfer');
    END IF;

    -- 4. Get or create receiver's points row
    SELECT current_points, total_earned, total_redeemed 
    INTO receiver_current_points, receiver_total_earned, receiver_total_redeemed
    FROM public.user_points 
    WHERE user_id = receiver_id 
    FOR UPDATE;

    IF receiver_current_points IS NULL THEN
        -- Receiver doesn't have an entry yet
        INSERT INTO public.user_points (user_id, current_points, total_earned, total_redeemed)
        VALUES (receiver_id, 0, 0, 0);
        
        receiver_current_points := 0;
        receiver_total_earned := 0;
        receiver_total_redeemed := 0;
    END IF;

    -- 5. Perform the transfer
    -- Deduct from sender
    UPDATE public.user_points 
    SET current_points = current_points - points_to_transfer,
        updated_at = NOW()
    WHERE user_id = sender_id;

    -- Add to receiver
    UPDATE public.user_points 
    SET current_points = current_points + points_to_transfer,
        total_earned = total_earned + points_to_transfer, -- Treat received points as earned? Or separate? Let's treat as earned for tier progression.
        updated_at = NOW()
    WHERE user_id = receiver_id;

    -- 6. Log transactions
    -- Sender transaction
    INSERT INTO public.transactions (user_id, amount, points_earned, points_redeemed, transaction_type, items)
    VALUES (sender_id, 0, 0, points_to_transfer, 'redemption', ARRAY['Transferred points to ' || receiver_email]);

    -- Receiver transaction
    INSERT INTO public.transactions (user_id, amount, points_earned, points_redeemed, transaction_type, items)
    VALUES (receiver_id, 0, points_to_transfer, 0, 'purchase', ARRAY['Received points']);

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
