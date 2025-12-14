
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserProfile } from '@/lib/api/users';
import { applyPendingReferralCode, checkAndApplyReferralFromUrl } from '@/lib/api/referrals';
import { UserProfile } from '@/types';
import { toast } from '@/lib/toast';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (email: string, password: string, metadata?: { username?: string }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  isAdmin: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  updateUserProfile: async () => {},
  refetchProfile: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return { success: false, message: error.message };
      }

      toast.success('Logged in successfully!');
      return { success: true };
    } catch (error: any) {
      toast.error('An unexpected error occurred');
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const register = async (email: string, password: string, metadata?: { username?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: metadata,
        },
      });

      if (error) {
        toast.error(error.message);
        return { success: false, message: error.message };
      }

      return { success: true };
    } catch (error: any) {
      toast.error('An unexpected error occurred');
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Logged out successfully!');
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred');
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      
      await refetchProfile();
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    }
  };

  const refetchProfile = async () => {
    if (user?.id) {
      try {
        const profileData = await fetchUserProfile(user.id);
        // Ensure the profile data matches UserProfile type
        const typedProfile: UserProfile = {
          ...profileData,
          tier: (profileData.tier === 'Premium' ? 'Premium' : 'Free') as "Free" | "Premium",
          status: (profileData.status === 'Influencer' ? 'Influencer' : 'Normal') as "Normal" | "Influencer",
          role: (profileData.role || 'user') as "user" | "admin"
        };
        setProfile(typedProfile);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST (synchronous callback only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        // Only synchronous state updates here
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          setProfile(null);
          setIsLoading(false);
          return;
        }

        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(async () => {
          if (!mounted) return;
          
          try {
            const profileData = await fetchUserProfile(session.user.id);
            if (!mounted) return;
            
            const typedProfile: UserProfile = {
              ...profileData,
              tier: (profileData.tier === 'Premium' ? 'Premium' : 'Free') as "Free" | "Premium",
              status: (profileData.status === 'Influencer' ? 'Influencer' : 'Normal') as "Normal" | "Influencer",
              role: (profileData.role || 'user') as "user" | "admin"
            };
            setProfile(typedProfile);
            
            // Apply pending referral code after login
            if (event === 'SIGNED_IN') {
              const referralResult = await applyPendingReferralCode();
              if (referralResult?.success && mounted) {
                toast.success(referralResult.message);
                // Refresh profile to show updated points
                const updatedProfileData = await fetchUserProfile(session.user.id);
                if (mounted) {
                  const updatedTypedProfile: UserProfile = {
                    ...updatedProfileData,
                    tier: (updatedProfileData.tier === 'Premium' ? 'Premium' : 'Free') as "Free" | "Premium",
                    status: (updatedProfileData.status === 'Influencer' ? 'Influencer' : 'Normal') as "Normal" | "Influencer",
                    role: (updatedProfileData.role || 'user') as "user" | "admin"
                  };
                  setProfile(updatedTypedProfile);
                }
              }
            }
          } catch (error) {
            console.error('Error fetching profile:', error);
          } finally {
            if (mounted) setIsLoading(false);
          }
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id)
          .then((profileData) => {
            if (!mounted) return;
            const typedProfile: UserProfile = {
              ...profileData,
              tier: (profileData.tier === 'Premium' ? 'Premium' : 'Free') as "Free" | "Premium",
              status: (profileData.status === 'Influencer' ? 'Influencer' : 'Normal') as "Normal" | "Influencer",
              role: (profileData.role || 'user') as "user" | "admin"
            };
            setProfile(typedProfile);
          })
          .catch(console.error)
          .finally(() => {
            if (mounted) setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    });

    // Check for referral code in URL (non-blocking)
    checkAndApplyReferralFromUrl().then((result) => {
      if (result?.success && mounted) {
        toast.success(result.message);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    profile,
    session,
    isAuthenticated: !!user,
    isLoading,
    isAdmin: profile?.role === 'admin',
    login,
    register,
    logout,
    updateUserProfile,
    refetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
