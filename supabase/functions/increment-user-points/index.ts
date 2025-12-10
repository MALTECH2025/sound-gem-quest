
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, points_to_add } = await req.json()

    if (!user_id || !points_to_add) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or points_to_add' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // First get the current points
    const { data: currentProfile, error: getError } = await supabaseClient
      .from('profiles')
      .select('points')
      .eq('id', user_id)
      .single()

    if (getError) {
      console.error('Error getting user profile:', getError)
      return new Response(
        JSON.stringify({ error: getError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const newPoints = (currentProfile?.points || 0) + points_to_add

    // Update user points
    const { data, error } = await supabaseClient
      .from('profiles')
      .update({ points: newPoints })
      .eq('id', user_id)
      .select('points')
      .single()

    if (error) {
      console.error('Error updating user points:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        new_points_total: data.points,
        points_added: points_to_add 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
