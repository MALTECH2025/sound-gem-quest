
import { supabase } from "@/integrations/supabase/client";

// Constants for Spotify API
const SPOTIFY_CLIENT_ID = "9590f00f4f6b4fc080b08c85dc699e9f";
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/spotify/callback`;
const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "user-top-read",
  "user-library-read",
  "user-read-recently-played",
  "user-follow-read"
];

// Generate authorization URL for Spotify OAuth
export const getSpotifyAuthUrl = () => {
  const state = generateRandomString(16);
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  
  const params = {
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state
  };
  
  authUrl.search = new URLSearchParams(params).toString();
  
  // Store state in local storage to verify callback
  localStorage.setItem("spotify_auth_state", state);
  
  return authUrl.toString();
};

// Initiate Spotify authentication
export const initiateSpotifyAuth = () => {
  const authUrl = getSpotifyAuthUrl();
  window.location.href = authUrl;
};

// Handle Spotify callback
export const handleSpotifyCallback = async (code: string, state: string) => {
  // Verify state matches what we stored
  const storedState = localStorage.getItem("spotify_auth_state");
  if (state !== storedState) {
    return {
      success: false,
      message: "State verification failed"
    };
  }
  
  // Remove state from localStorage
  localStorage.removeItem("spotify_auth_state");
  
  // Exchange code for token
  return await exchangeSpotifyCode(code);
};

// Exchange code for access token and save user profile with premium status
export const exchangeSpotifyCode = async (code: string) => {
  try {
    // Code exchange should be done server-side to protect client secret
    const { data, error } = await supabase.functions.invoke('spotify-token-exchange', {
      body: { code, redirect_uri: SPOTIFY_REDIRECT_URI }
    });
    
    if (error) throw error;
    
    if (data?.access_token) {
      // Connect the Spotify service to the user's account
      const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
      
      // Get user profile to store Spotify ID and premium status
      const userProfile = await getSpotifyUserProfile(data.access_token);
      
      // Determine if user is premium
      const isPremium = userProfile.product === 'premium';
      
      // Save to connected_services with premium status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if service already exists for user
      const { data: existingService } = await supabase
        .from('connected_services')
        .select('*')
        .eq('user_id', user.id)
        .eq('service_name', 'spotify')
        .single();

      const serviceData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        display_name: userProfile.display_name,
        email: userProfile.email,
        product: userProfile.product || 'free',
        is_premium: isPremium,
        updated_at: new Date().toISOString()
      };

      if (existingService) {
        // Update the existing service
        const { error: updateError } = await supabase
          .from('connected_services')
          .update(serviceData)
          .eq('id', existingService.id);

        if (updateError) throw updateError;
      } else {
        // Create a new service connection
        const { error: insertError } = await supabase
          .from('connected_services')
          .insert({
            user_id: user.id,
            service_name: 'spotify',
            service_user_id: userProfile.id,
            ...serviceData
          });

        if (insertError) throw insertError;
      }
      
      return {
        success: true,
        message: "Successfully connected Spotify account",
        isPremium,
        product: userProfile.product
      };
    }
    
    return {
      success: false,
      message: "Failed to exchange code for access token"
    };
  } catch (error: any) {
    console.error("Error exchanging Spotify code:", error);
    return {
      success: false,
      message: error.message || "An error occurred while connecting Spotify"
    };
  }
};

// Refresh Spotify token
export const refreshSpotifyToken = async (userId: string, refreshToken: string) => {
  try {
    // Call edge function to refresh token
    const { data, error } = await supabase.functions.invoke('spotify-refresh-token', {
      body: { userId, refreshToken }
    });
    
    if (error) throw error;
    
    return data;
  } catch (error: any) {
    console.error("Error refreshing Spotify token:", error);
    throw error;
  }
};

// Get Spotify user profile
export const getSpotifyUserProfile = async (accessToken: string) => {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch Spotify profile: ${response.status}`);
  }
  
  return await response.json();
};

// Helper function to generate random string for state parameter
function generateRandomString(length: number) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  
  return text;
}

// Get user's top tracks
export const getTopTracks = async (accessToken: string, timeRange = 'medium_term', limit = 10) => {
  const response = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch top tracks: ${response.status}`);
  }
  
  return await response.json();
};

// Function for SpotifyWidget.tsx
export const getSpotifyTopTracks = async (accessToken: string, timeRange = 'medium_term', limit = 10) => {
  return getTopTracks(accessToken, timeRange, limit);
};

// Get user's recently played tracks
export const getRecentlyPlayed = async (accessToken: string, limit = 10) => {
  const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch recently played: ${response.status}`);
  }
  
  return await response.json();
};

// Function for SpotifyWidget.tsx
export const getSpotifyRecentlyPlayed = async (accessToken: string, limit = 10) => {
  return getRecentlyPlayed(accessToken, limit);
};

// Check if a user has saved a specific track
export const checkSavedTracks = async (accessToken: string, trackIds: string[]) => {
  const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackIds.join(',')}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to check saved tracks: ${response.status}`);
  }
  
  return await response.json();
};
