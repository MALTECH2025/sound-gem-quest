import { supabase } from "@/integrations/supabase/client";
import { Referral, ReferredUser } from "@/types";

export const fetchUserReferrals = async (userId: string) => {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .single();
    
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
  return data;
};

export const fetchReferredUsers = async (userId: string) => {
  const { data, error } = await supabase
    .from('referred_users')
    .select(`
      *,
      referred_user:profiles!referred_users_referred_user_id_fkey(*)
    `)
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data || [];
};

export const createReferralCode = async (userId: string) => {
  // Check if user already has a referral code
  const { data: existingReferral } = await supabase
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', userId)
    .single();
    
  if (existingReferral?.referral_code) {
    return existingReferral;
  }
  
  // Generate a unique referral code
  const referralCode = 'ST' + Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_id: userId,
      referral_code: referralCode
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const applyReferralCode = async (referralCode: string) => {
  try {
    console.log('Applying referral code:', referralCode);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('You must be logged in to apply a referral code');
    }

    console.log('User session found, calling edge function...');

    const { data, error } = await supabase.functions.invoke('apply-referral-code', {
      body: { referral_code: referralCode.trim().toUpperCase() },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Edge function response:', { data, error });

    if (error) {
      console.error('Edge function invocation error:', error);
      throw new Error(error.message || 'Failed to apply referral code');
    }

    // The data should already be the parsed response from the edge function
    if (!data) {
      throw new Error('No response received from server');
    }

    if (!data.success) {
      throw new Error(data.message || 'Failed to apply referral code');
    }

    console.log('Referral code applied successfully:', data);
    return data;
  } catch (error) {
    console.error('Apply referral code error:', error);
    throw error;
  }
};

export const getReferralStats = async (userId: string) => {
  const { data, error } = await supabase
    .from('referred_users')
    .select('id, points_awarded')
    .eq('referrer_id', userId);
    
  if (error) throw error;
  
  const referralData = data || [];
  
  return {
    totalReferrals: referralData.length,
    pointsEarned: referralData.filter(r => r.points_awarded).length * 10, // 10 points per referral
    pendingReferrals: referralData.filter(r => !r.points_awarded).length
  };
};

// Check if referral code is in URL and apply it
export const checkAndApplyReferralFromUrl = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const referralCode = urlParams.get('ref');
  
  if (referralCode) {
    console.log('Referral code found in URL:', referralCode);
    
    // Always store in localStorage for application after signup/login
    localStorage.setItem('pendingReferralCode', referralCode.toUpperCase());
    
    // If user is already logged in, apply immediately
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      console.log('User is logged in, applying referral code now...');
      try {
        const result = await applyReferralCode(referralCode);
        if (result.success) {
          localStorage.removeItem('pendingReferralCode');
          // Clean URL without full page reload
          const url = new URL(window.location.href);
          url.searchParams.delete('ref');
          window.history.replaceState({}, '', url.toString());
        }
        return result;
      } catch (error: any) {
        console.error('Error applying referral code from URL:', error);
        // Keep the code in localStorage for retry after login if it's not a permanent failure
        if (error.message?.includes('Invalid referral code') || 
            error.message?.includes('already used') ||
            error.message?.includes('your own')) {
          localStorage.removeItem('pendingReferralCode');
        }
        return { success: false, message: error.message };
      }
    }
  }
  
  return null;
};

// Apply pending referral code after login
export const applyPendingReferralCode = async () => {
  const pendingCode = localStorage.getItem('pendingReferralCode');
  
  if (!pendingCode) {
    console.log('No pending referral code found');
    return null;
  }
  
  console.log('Applying pending referral code:', pendingCode);
  
  // Small delay to ensure user profile is created first
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const result = await applyReferralCode(pendingCode);
    if (result.success) {
      localStorage.removeItem('pendingReferralCode');
      console.log('Pending referral code applied successfully');
    }
    return result;
  } catch (error: any) {
    console.error('Error applying pending referral code:', error);
    // Remove invalid codes but keep valid ones for retry
    if (error.message?.includes('Invalid referral code') || 
        error.message?.includes('already used') ||
        error.message?.includes('your own')) {
      localStorage.removeItem('pendingReferralCode');
    }
    return { success: false, message: error.message };
  }
};
