-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  initials TEXT NOT NULL DEFAULT 'U',
  points INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free', 'Premium')),
  status TEXT NOT NULL DEFAULT 'Normal' CHECK (status IN ('Normal', 'Influencer')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for secure role management (prevents privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create task_categories table
CREATE TABLE public.task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  category_id UUID REFERENCES public.task_categories(id) ON DELETE SET NULL,
  difficulty TEXT NOT NULL DEFAULT 'Easy' CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  estimated_time TEXT,
  instructions TEXT,
  verification_type TEXT NOT NULL DEFAULT 'Automatic' CHECK (verification_type IN ('Automatic', 'Manual')),
  required_media BOOLEAN DEFAULT false,
  redirect_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_tasks table
CREATE TABLE public.user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Submitted', 'Completed', 'Rejected')),
  completed_at TIMESTAMPTZ,
  points_earned INTEGER DEFAULT 0,
  submission_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);

-- Create task_submissions table
CREATE TABLE public.task_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_task_id UUID NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  screenshot_url TEXT,
  submission_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rewards table
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  points_cost INTEGER NOT NULL,
  quantity INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_rewards table
CREATE TABLE public.user_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Fulfilled', 'Cancelled')),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  points_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create referred_users table
CREATE TABLE public.referred_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  points_awarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

-- Create connected_services table
CREATE TABLE public.connected_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_name)
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin (also checks profiles.role for backward compatibility)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND role = 'admin'
  )
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_initials TEXT;
  user_name TEXT;
BEGIN
  -- Extract name from metadata or email
  user_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Generate initials
  user_initials := UPPER(LEFT(user_name, 2));
  
  -- Insert profile
  INSERT INTO public.profiles (id, username, full_name, initials, points, tier, status, role)
  VALUES (
    NEW.id,
    LOWER(REPLACE(split_part(NEW.email, '@', 1), '.', '_')),
    user_name,
    user_initials,
    0,
    'Free',
    'Normal',
    'user'
  );
  
  -- Also insert into user_roles for secure role management
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Function to complete a task
CREATE OR REPLACE FUNCTION public.complete_task(task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_task RECORD;
  v_task RECORD;
  v_points INTEGER;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;
  
  -- Get user task
  SELECT * INTO v_user_task 
  FROM public.user_tasks 
  WHERE user_tasks.user_id = v_user_id AND user_tasks.task_id = complete_task.task_id;
  
  IF v_user_task IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Task not started');
  END IF;
  
  IF v_user_task.status = 'Completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Task already completed');
  END IF;
  
  -- Get task details
  SELECT * INTO v_task FROM public.tasks WHERE id = complete_task.task_id;
  IF v_task IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Task not found');
  END IF;
  
  -- Check if task requires manual verification
  IF v_task.verification_type = 'Manual' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This task requires manual verification. Please submit proof.');
  END IF;
  
  v_points := v_task.points;
  
  -- Update user task
  UPDATE public.user_tasks
  SET status = 'Completed',
      completed_at = now(),
      points_earned = v_points
  WHERE id = v_user_task.id;
  
  -- Award points to user
  UPDATE public.profiles
  SET points = points + v_points
  WHERE id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Task completed!', 'points_earned', v_points);
END;
$$;

-- Function to cleanup expired tasks
CREATE OR REPLACE FUNCTION public.cleanup_expired_tasks()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tasks
  SET active = false
  WHERE expires_at < now() AND active = true;
END;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rewards_updated_at
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_connected_services_updated_at
  BEFORE UPDATE ON public.connected_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referred_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- USER_ROLES POLICIES (very restrictive)
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- TASK_CATEGORIES POLICIES
CREATE POLICY "Task categories are viewable by everyone"
  ON public.task_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage task categories"
  ON public.task_categories FOR ALL
  USING (public.is_admin(auth.uid()));

-- TASKS POLICIES
CREATE POLICY "Active tasks are viewable by authenticated users"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage tasks"
  ON public.tasks FOR ALL
  USING (public.is_admin(auth.uid()));

-- USER_TASKS POLICIES
CREATE POLICY "Users can view their own tasks"
  ON public.user_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.user_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.user_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user tasks"
  ON public.user_tasks FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any user task"
  ON public.user_tasks FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- TASK_SUBMISSIONS POLICIES
CREATE POLICY "Users can view their own submissions"
  ON public.task_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_tasks
      WHERE user_tasks.id = task_submissions.user_task_id
        AND user_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert submissions for their tasks"
  ON public.task_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_tasks
      WHERE user_tasks.id = task_submissions.user_task_id
        AND user_tasks.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all submissions"
  ON public.task_submissions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update submissions"
  ON public.task_submissions FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- REWARDS POLICIES
CREATE POLICY "Active rewards are viewable by authenticated users"
  ON public.rewards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rewards"
  ON public.rewards FOR ALL
  USING (public.is_admin(auth.uid()));

-- USER_REWARDS POLICIES
CREATE POLICY "Users can view their own rewards"
  ON public.user_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rewards"
  ON public.user_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all user rewards"
  ON public.user_rewards FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update user rewards"
  ON public.user_rewards FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- REFERRALS POLICIES
CREATE POLICY "Users can view their own referral code"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can create their own referral code"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Anyone can view referral codes for validation"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (true);

-- REFERRED_USERS POLICIES
CREATE POLICY "Users can view their referred users"
  ON public.referred_users FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Authenticated users can be added as referred"
  ON public.referred_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referred_user_id);

CREATE POLICY "Admins can view all referrals"
  ON public.referred_users FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update referrals"
  ON public.referred_users FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- CONNECTED_SERVICES POLICIES
CREATE POLICY "Users can view their own connected services"
  ON public.connected_services FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own connected services"
  ON public.connected_services FOR ALL
  USING (auth.uid() = user_id);

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_profiles_points ON public.profiles(points DESC);
CREATE INDEX idx_tasks_active_expires ON public.tasks(active, expires_at);
CREATE INDEX idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_task_id ON public.user_tasks(task_id);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Insert default task categories
INSERT INTO public.task_categories (name, description) VALUES
  ('Social', 'Social media related tasks'),
  ('Referral', 'Invite friends and earn rewards'),
  ('Daily', 'Daily check-in and engagement tasks'),
  ('Music', 'Music streaming and listening tasks'),
  ('Spotify', 'Spotify specific tasks'),
  ('Other', 'Miscellaneous tasks');

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;