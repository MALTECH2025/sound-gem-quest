
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Reward redemption function started');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Processing reward redemption request');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    console.log('User authentication check:', { user: user?.id, error: userError });

    if (userError || !user) {
      console.error('Authentication failed:', userError);
      return new Response(
        JSON.stringify({ success: false, message: 'Not authenticated' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the request data
    const requestData = await req.json();
    const { reward_id } = requestData;

    console.log('Request data:', { reward_id, user_id: user.id });

    if (!reward_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Reward ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use the database function to handle the redemption
    const { data: result, error: redeemError } = await supabaseClient.rpc('redeem_reward', {
      reward_id: reward_id
    });

    console.log('Redeem reward result:', { result, error: redeemError });

    if (redeemError) {
      console.error('Redemption error:', redeemError);
      return new Response(
        JSON.stringify({ success: false, message: redeemError.message || 'Failed to redeem reward' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // The RPC function returns a JSON object with success/failure info
    if (result && result.success) {
      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      return new Response(
        JSON.stringify(result || { success: false, message: 'Failed to redeem reward' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error: unknown) {
    console.error('Error in reward redemption:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: `Server error: ${errorMessage}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
