
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('Apply referral code function called');

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, message: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, message: "Authentication required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ success: false, message: "Authentication required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    console.log('User authenticated:', user.id);

    // Get the request data
    const requestBody = await req.json();
    const { referral_code } = requestBody;

    if (!referral_code || typeof referral_code !== 'string') {
      console.log('Invalid referral code provided:', referral_code);
      return new Response(
        JSON.stringify({ success: false, message: "Valid referral code is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const cleanReferralCode = referral_code.trim().toUpperCase();
    console.log('Processing referral code:', cleanReferralCode);

    // Get referral info
    const { data: referralData, error: referralError } = await supabase
      .from("referrals")
      .select("referrer_id, referral_code")
      .eq("referral_code", cleanReferralCode)
      .single();

    if (referralError || !referralData) {
      console.log('Referral code not found:', cleanReferralCode, referralError);
      return new Response(
        JSON.stringify({ success: false, message: "Invalid referral code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log('Found referral data:', referralData);

    // Check if the user is trying to refer themselves
    if (referralData.referrer_id === user.id) {
      console.log('User trying to use own referral code:', user.id);
      return new Response(
        JSON.stringify({ success: false, message: "You cannot use your own referral code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if the user has already been referred
    const { data: existingReferral } = await supabase
      .from("referred_users")
      .select("*")
      .eq("referred_user_id", user.id)
      .maybeSingle();

    if (existingReferral) {
      console.log('User already has been referred:', user.id);
      return new Response(
        JSON.stringify({ success: false, message: "You have already used a referral code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Define the referral points to award
    const referralPoints = 10;

    // Start transaction-like operations
    console.log('Creating referral record for user:', user.id, 'referrer:', referralData.referrer_id);

    // Create referral record
    const { data: insertedReferral, error: referredError } = await supabase
      .from("referred_users")
      .insert({
        referrer_id: referralData.referrer_id,
        referred_user_id: user.id,
        referral_code: cleanReferralCode,
        points_awarded: true,
      })
      .select()
      .single();

    if (referredError) {
      console.error('Error creating referral record:', referredError);
      // Check for duplicate entry
      if (referredError.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, message: "You have already used a referral code" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      return new Response(
        JSON.stringify({ success: false, message: "Failed to process referral: " + referredError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log('Referral record created successfully:', insertedReferral);

    // Get and update referrer's points
    const { data: referrerProfile, error: referrerGetError } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", referralData.referrer_id)
      .single();

    if (referrerGetError) {
      console.error("Error getting referrer profile:", referrerGetError);
    } else {
      console.log('Updating referrer points...');
      const { error: referrerPointsError } = await supabase
        .from("profiles")
        .update({ points: (referrerProfile.points || 0) + referralPoints })
        .eq("id", referralData.referrer_id);

      if (referrerPointsError) {
        console.error("Error updating referrer points:", referrerPointsError);
      } else {
        console.log('Referrer points updated successfully');
      }
    }

    // Get and update referred user's points
    const { data: userProfile, error: userGetError } = await supabase
      .from("profiles")
      .select("points")
      .eq("id", user.id)
      .single();

    let newUserPoints = referralPoints;
    if (!userGetError && userProfile) {
      newUserPoints = (userProfile.points || 0) + referralPoints;
    }

    console.log('Updating user points to:', newUserPoints);

    // Update user points
    const { data: updatedUserProfile, error: userPointsError } = await supabase
      .from("profiles")
      .update({ points: newUserPoints })
      .eq("id", user.id)
      .select("points")
      .single();

    if (userPointsError) {
      console.error("Error updating user points:", userPointsError);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to award points" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log('User points updated successfully');

    const successResponse = {
      success: true,
      message: `Referral code applied successfully! You've earned ${referralPoints} ST Coins.`,
      points_earned: referralPoints,
      total_points: updatedUserProfile?.points || newUserPoints,
    };

    console.log('Returning success response:', successResponse);

    return new Response(
      JSON.stringify(successResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "An unexpected error occurred. Please try again." 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
