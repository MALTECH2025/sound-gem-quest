
import { supabase } from "@/integrations/supabase/client";
import { Task, TaskCategory, Reward, LeaderboardUser } from "@/types";

// Users and Profiles
// ===========================================

export const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) throw error;
  return data;
};

export const updateUserProfile = async (updates: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

// Tasks
// ===========================================

export const fetchTasks = async () => {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      category:task_categories(*)
    `)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
};

export const fetchUserTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_tasks')
    .select(`
      *,
      task:tasks(
        *,
        category:task_categories(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
};

export const completeTask = async (taskId: string) => {
  try {
    // Call the complete_task database function
    const { data, error } = await supabase.rpc('complete_task', {
      task_id: taskId
    });
    
    if (error) throw error;
    
    return data;
  } catch (error: any) {
    console.error('Error completing task:', error);
    return { 
      success: false, 
      message: error.message || 'An error occurred while completing the task'
    };
  }
};

export const fetchTaskCategories = async () => {
  const { data, error } = await supabase
    .from('task_categories')
    .select('*')
    .order('name', { ascending: true });
    
  if (error) throw error;
  return data;
};

export const createTask = async (task: Partial<Task> & { expires_at: string }) => {
  // For admin operations, we need to use auth.admin for RLS bypass
  // Log the task being created for debugging
  console.log('Creating task:', task);

  try {
    // First check if user has admin role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profile?.role !== 'admin') {
      console.error('Permission denied: User is not an admin');
      throw new Error('Permission denied: Only admins can create tasks');
    }
    
    // Remove category from the task data and get the insert-ready object
    const { category, id, created_at, updated_at, ...insertData } = task as Task;
    
    // Admin users can create tasks - cast to any to avoid type issues with partial data
    const { data, error } = await supabase
      .from('tasks')
      .insert(insertData as any)
      .select(`
        *,
        category:task_categories(*)
      `)
      .single();
      
    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }
    
    return data;
  } catch (error: any) {
    console.error('Create task error:', error);
    throw error;
  }
};

export const updateTask = async ({ taskId, updates }: { taskId: string, updates: Partial<Task> }) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select(`
      *,
      category:task_categories(*)
    `)
    .single();
    
  if (error) throw error;
  return data;
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
    
  if (error) throw error;
};

// Rewards
// ===========================================

export const fetchRewards = async () => {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('active', true)
    .order('points_cost', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const fetchUserRewards = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_rewards')
    .select(`
      *,
      reward:rewards(*)
    `)
    .eq('user_id', userId)
    .order('redeemed_at', { ascending: false });
    
  if (error) throw error;
  return data || [];
};

export const redeemReward = async (rewardId: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('redeem-reward', {
      body: { reward_id: rewardId }
    });
    
    if (error) throw error;
    
    return data || { success: false, message: 'Failed to redeem reward' };
  } catch (error: any) {
    console.error('Error redeeming reward:', error);
    return { 
      success: false, 
      message: error.message || 'An error occurred while redeeming the reward'
    };
  }
};

// Leaderboard
// ===========================================

export const fetchLeaderboard = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, initials, points, tier, status')
    .order('points', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  
  // Add position to each user and ensure type safety
  const leaderboard: LeaderboardUser[] = (data || []).map((user, index) => ({
    ...user,
    position: index + 1,
    tier: user.tier as "Free" | "Premium", // Explicit type casting
    status: user.status as "Normal" | "Influencer" // Explicit type casting
  }));
  
  return leaderboard;
};

// Referrals
// ===========================================

export const generateReferralCode = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  // Check if user already has a referral code
  const { data: existingReferral } = await supabase
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', user.id)
    .single();
    
  if (existingReferral?.referral_code) {
    return existingReferral.referral_code;
  }
  
  // Generate a new referral code
  const referralCode = generateRandomCode(8);
  
  const { error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: user.id,
      referral_code: referralCode
    });
    
  if (error) throw error;
  
  return referralCode;
};

export const fetchReferralCode = async (userId: string) => {
  // Get the user's referral code
  const { data, error } = await supabase
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', userId)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  
  // If no referral code exists, generate one
  if (!data?.referral_code) {
    const code = await generateReferralCode();
    return code;
  }
  
  return data?.referral_code || null;
};

export const fetchReferralStats = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');
  
  // Get the user's referral code
  const { data: referralData } = await supabase
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', user.id)
    .single();
    
  // Count the total number of users who used the referral code
  const { data: countData, error } = await supabase
    .from('referred_users')
    .select('id', { count: 'exact' })
    .eq('referrer_id', user.id);
    
  if (error) throw error;
  
  return {
    code: referralData?.referral_code || null,
    referralCount: countData?.length || 0
  };
};

export const fetchReferrals = async (userId: string) => {
  if (!userId) throw new Error('User ID is required');
  
  // Users I referred
  const { data, error } = await supabase
    .from('referred_users')
    .select(`
      id,
      created_at,
      referred_user_id,
      profiles:referred_user_id(id, full_name, username, avatar_url, initials)
    `)
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data;
};

export const fetchUserReferrals = fetchReferrals; // Alias for backward compatibility

export const applyReferralCode = async (referralCode: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('apply-referral-code', {
      body: { referral_code: referralCode }
    });
    
    if (error) throw error;
    
    return data || { success: false, message: 'Failed to apply referral code' };
  } catch (error: any) {
    console.error('Error applying referral code:', error);
    return { 
      success: false, 
      message: error.message || 'An error occurred while applying the referral code'
    };
  }
};

// Admin
// ===========================================

export const getSystemStats = async () => {
  // Count total users
  const { count: usersCount, error: usersError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
    
  if (usersError) throw usersError;
  
  // Count total tasks
  const { count: tasksCount, error: tasksError } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true });
    
  if (tasksError) throw tasksError;
  
  // Count total rewards claimed
  const { count: rewardsCount, error: rewardsError } = await supabase
    .from('user_rewards')
    .select('*', { count: 'exact', head: true });
    
  if (rewardsError) throw rewardsError;
  
  // Calculate total points from user profiles
  const { data: pointsData, error: pointsError } = await supabase
    .from('profiles')
    .select('points');
    
  if (pointsError) throw pointsError;
  
  const totalPoints = pointsData.reduce((sum, entry) => sum + (entry.points || 0), 0);
  
  return {
    totalUsers: usersCount || 0,
    totalTasks: tasksCount || 0,
    totalRewards: rewardsCount || 0,
    totalPoints: totalPoints
  };
};

// Services (Spotify, etc.)
// ===========================================

export const connectService = async (
  serviceName: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
  serviceUserId: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check if service already exists for user
    const { data: existingService } = await supabase
      .from('connected_services')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', serviceName)
      .single();

    if (existingService) {
      // Update the existing service
      const { error } = await supabase
        .from('connected_services')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingService.id);

      if (error) throw error;
    } else {
      // Create a new service connection
      const { error } = await supabase
        .from('connected_services')
        .insert({
          user_id: user.id,
          service_name: serviceName,
          service_user_id: serviceUserId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error(`Error connecting ${serviceName}:`, error);
    return { success: false, error: error.message };
  }
};

export const getServiceConnection = async (serviceName: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { connected: false };
    }

    const { data, error } = await supabase
      .from('connected_services')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_name', serviceName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No match found (Supabase error code for no results from .single())
        return { connected: false };
      }
      throw error;
    }

    return {
      connected: true,
      serviceUserId: data.service_user_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_at
    };
  } catch (error: any) {
    console.error(`Error checking ${serviceName} connection:`, error);
    return { connected: false, error: error.message };
  }
};

export const disconnectService = async (serviceName: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('connected_services')
      .delete()
      .eq('user_id', user.id)
      .eq('service_name', serviceName);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error(`Error disconnecting ${serviceName}:`, error);
    return { success: false, error: error.message };
  }
};

// User role and status management (admin)
// ===========================================

export const updateUserRole = async (userId: string, role: string) => {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
    
  if (error) throw error;
  
  return { success: true };
};

export const updateUserStatus = async (userId: string, status: string) => {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId);
    
  if (error) throw error;
  
  return { success: true };
};

export const updateUserTier = async (userId: string, tier: string) => {
  const { error } = await supabase
    .from('profiles')
    .update({ tier })
    .eq('id', userId);
    
  if (error) throw error;
  
  return { success: true };
};

// Realtime
// ===========================================

export const enableRealtimeForTable = async (tableName: string) => {
  const { error } = await supabase.functions.invoke('enable-realtime', {
    body: { table: tableName }
  });
  
  if (error) {
    console.error(`Failed to enable realtime for ${tableName}:`, error);
  }
  
  return !error;
};

// Utilities
// ===========================================

function generateRandomCode(length: number) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  
  return result;
}
