
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    });
  }

  try {
    // Create a Supabase client with the service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // SQL to create admin functions and policies
    const adminFunctionSQL = `
      -- Create a function to check if a user is an admin
      CREATE OR REPLACE FUNCTION public.is_admin()
      RETURNS BOOLEAN AS $$
        SELECT EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        );
      $$ LANGUAGE sql SECURITY DEFINER;
    `;
    
    const tasksRlsSQL = `
      -- Drop existing policies on tasks table if they exist
      DROP POLICY IF EXISTS "Admins can manage tasks" ON public.tasks;
      
      -- Create a new policy that allows admins to perform all operations on tasks
      CREATE POLICY "Admins can manage tasks" 
      ON public.tasks
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
      
      -- Policy to allow all users to read active tasks
      DROP POLICY IF EXISTS "Anyone can view active tasks" ON public.tasks;
      CREATE POLICY "Anyone can view active tasks"
      ON public.tasks
      FOR SELECT
      USING (active = true OR public.is_admin());
    `;
    
    const profilesRlsSQL = `
      -- Ensure profiles table has RLS enabled
      ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
      
      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
      DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
      DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
      DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
      
      -- Create policies for regular users
      CREATE POLICY "Users can view their own profile"
      ON public.profiles
      FOR SELECT
      USING (auth.uid() = id);
      
      CREATE POLICY "Users can update own profile"
      ON public.profiles
      FOR UPDATE
      USING (auth.uid() = id);
      
      -- Create policies for admins
      CREATE POLICY "Admins can view all profiles"
      ON public.profiles
      FOR SELECT
      USING (EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      ));
      
      CREATE POLICY "Admins can update all profiles"
      ON public.profiles
      FOR UPDATE
      USING (EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      ));
    `;
    
    // Execute SQL statements
    await supabase.rpc('pgadmin_query', { query: adminFunctionSQL });
    await supabase.rpc('pgadmin_query', { query: tasksRlsSQL });
    await supabase.rpc('pgadmin_query', { query: profilesRlsSQL });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Admin RLS policies created successfully" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
