-- Create the redeem_reward function
CREATE OR REPLACE FUNCTION public.redeem_reward(reward_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_reward RECORD;
  v_user_points INTEGER;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  
  -- Get reward details
  SELECT * INTO v_reward FROM public.rewards WHERE id = redeem_reward.reward_id AND active = true;
  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reward not found or inactive');
  END IF;
  
  -- Check quantity if applicable
  IF v_reward.quantity IS NOT NULL AND v_reward.quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reward is out of stock');
  END IF;
  
  -- Get user's current points
  SELECT points INTO v_user_points FROM public.profiles WHERE id = v_user_id;
  IF v_user_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
  END IF;
  
  -- Check if user has enough points
  IF v_user_points < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not enough points');
  END IF;
  
  -- Deduct points from user
  UPDATE public.profiles
  SET points = points - v_reward.points_cost
  WHERE id = v_user_id;
  
  -- Decrease quantity if applicable
  IF v_reward.quantity IS NOT NULL THEN
    UPDATE public.rewards
    SET quantity = quantity - 1
    WHERE id = redeem_reward.reward_id;
  END IF;
  
  -- Create user_reward record
  INSERT INTO public.user_rewards (user_id, reward_id, status, points_spent)
  VALUES (v_user_id, redeem_reward.reward_id, 'Pending', v_reward.points_cost);
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Reward redeemed successfully!',
    'points_spent', v_reward.points_cost,
    'remaining_points', v_user_points - v_reward.points_cost
  );
END;
$$;