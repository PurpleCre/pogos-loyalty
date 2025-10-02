-- Create achievements table
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  criteria_type TEXT NOT NULL, -- 'first_purchase', 'visit_count', 'points_earned', 'rewards_redeemed'
  criteria_value INTEGER NOT NULL,
  points_reward INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_achievements table
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Create referral_codes table
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referred_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for achievements
CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage achievements"
  ON public.achievements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for user_achievements
CREATE POLICY "Users can view their own achievements"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements"
  ON public.user_achievements FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (true);

-- RLS Policies for referral_codes
CREATE POLICY "Users can view their own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral code"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all referral codes"
  ON public.referral_codes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for referrals
CREATE POLICY "Users can view referrals they made"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view referrals they received"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referred_id);

CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all referrals"
  ON public.referrals FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default achievements
INSERT INTO public.achievements (name, description, icon, criteria_type, criteria_value, points_reward) VALUES
('First Purchase', 'Make your first purchase', '🎉', 'first_purchase', 1, 50),
('Frequent Visitor', 'Visit 10 times', '⭐', 'visit_count', 10, 100),
('Points Master', 'Earn 1000 points', '💎', 'points_earned', 1000, 150),
('Reward Hunter', 'Redeem 5 rewards', '🏆', 'rewards_redeemed', 5, 200),
('VIP Member', 'Visit 50 times', '👑', 'visit_count', 50, 500);

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION public.check_and_award_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  achievement_record RECORD;
  user_stats RECORD;
BEGIN
  -- Get user stats
  SELECT 
    COUNT(DISTINCT CASE WHEN transaction_type = 'purchase' THEN id END) as purchase_count,
    COUNT(DISTINCT CASE WHEN transaction_type = 'visit' THEN id END) as visit_count,
    COALESCE(SUM(points_earned), 0) as total_points,
    COUNT(DISTINCT CASE WHEN transaction_type = 'reward_redemption' THEN id END) as rewards_count
  INTO user_stats
  FROM public.transactions
  WHERE user_id = NEW.user_id;

  -- Check achievements
  FOR achievement_record IN 
    SELECT * FROM public.achievements
  LOOP
    -- Check if user already has this achievement
    IF NOT EXISTS (
      SELECT 1 FROM public.user_achievements 
      WHERE user_id = NEW.user_id AND achievement_id = achievement_record.id
    ) THEN
      -- Check criteria
      IF (achievement_record.criteria_type = 'first_purchase' AND user_stats.purchase_count >= achievement_record.criteria_value) OR
         (achievement_record.criteria_type = 'visit_count' AND user_stats.visit_count >= achievement_record.criteria_value) OR
         (achievement_record.criteria_type = 'points_earned' AND user_stats.total_points >= achievement_record.criteria_value) OR
         (achievement_record.criteria_type = 'rewards_redeemed' AND user_stats.rewards_count >= achievement_record.criteria_value)
      THEN
        -- Award achievement
        INSERT INTO public.user_achievements (user_id, achievement_id)
        VALUES (NEW.user_id, achievement_record.id);
        
        -- Award bonus points
        IF achievement_record.points_reward > 0 THEN
          UPDATE public.user_points
          SET 
            current_points = current_points + achievement_record.points_reward,
            total_earned = total_earned + achievement_record.points_reward
          WHERE user_id = NEW.user_id;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger to check achievements after transactions
CREATE TRIGGER check_achievements_after_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.check_and_award_achievements();

-- Function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character alphanumeric code
    code := upper(substr(md5(random()::text), 1, 8));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM public.referral_codes WHERE referral_codes.code = code) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Function to handle new user referral
CREATE OR REPLACE FUNCTION public.handle_referral_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_code_input TEXT;
  referrer_user_id UUID;
  referral_points INTEGER := 100;
BEGIN
  -- Check if user signed up with a referral code
  referral_code_input := NEW.raw_user_meta_data->>'referral_code';
  
  IF referral_code_input IS NOT NULL THEN
    -- Find the referrer
    SELECT user_id INTO referrer_user_id
    FROM public.referral_codes
    WHERE code = referral_code_input;
    
    IF referrer_user_id IS NOT NULL THEN
      -- Create referral record
      INSERT INTO public.referrals (referrer_id, referred_id, referral_code, points_awarded)
      VALUES (referrer_user_id, NEW.id, referral_code_input, referral_points);
      
      -- Award points to referrer
      UPDATE public.user_points
      SET 
        current_points = current_points + referral_points,
        total_earned = total_earned + referral_points
      WHERE user_id = referrer_user_id;
      
      -- Award points to new user
      UPDATE public.user_points
      SET 
        current_points = current_points + (referral_points / 2),
        total_earned = total_earned + (referral_points / 2)
      WHERE user_id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for referral signup
CREATE TRIGGER on_referral_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_referral_signup();