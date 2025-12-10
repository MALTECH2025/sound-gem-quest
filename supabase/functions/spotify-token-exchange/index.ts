
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
    const { code, redirect_uri } = await req.json()
    
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Get the Spotify client ID and secret from environment variables
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID') || ''
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') || ''
    
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'Spotify credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('Attempting to exchange Spotify code for token')
    
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri
      })
    })
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Spotify token exchange error:', errorData)
      return new Response(JSON.stringify({ 
        error: errorData.error_description || 'Failed to exchange token' 
      }), {
        status: tokenResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const tokenData = await tokenResponse.json()
    console.log('Successfully exchanged Spotify code for token')
    
    return new Response(JSON.stringify(tokenData), {
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
