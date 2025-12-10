
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get the request body
    const { userId, refreshToken } = await req.json()
    
    if (!refreshToken || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get the Spotify client ID and secret from environment variables
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID') || ''
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') || ''
    
    console.log('Attempting to refresh Spotify token')
    
    // Request new access token from Spotify
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Spotify token refresh error:', errorData)
      
      // If the refresh token is invalid, remove the service from the database
      if (errorData.error === 'invalid_grant') {
        await supabase
          .from('connected_services')
          .delete()
          .match({ user_id: userId, service_name: 'spotify' })
        
        return new Response(JSON.stringify({ 
          error: 'Invalid refresh token. Spotify has been disconnected.', 
          disconnected: true 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ 
        error: errorData.error_description || 'Failed to refresh token' 
      }), {
        status: tokenResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const tokenData = await tokenResponse.json()
    console.log('Successfully refreshed Spotify token')
    
    // Update the token in the database
    const { error: updateError } = await supabase
      .from('connected_services')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Some tokens don't return a new refresh token
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .match({ user_id: userId, service_name: 'spotify' })
    
    if (updateError) {
      console.error('Database update error:', updateError)
      return new Response(JSON.stringify({ error: 'Failed to update token in database' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      expires_in: tokenData.expires_in
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', errorMessage)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
