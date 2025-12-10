
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { p_user_task_id, p_screenshot_url, p_submission_notes } = await req.json()

    // Create submission record
    const { data: submission, error: submissionError } = await supabase
      .from('task_submissions')
      .insert({
        user_task_id: p_user_task_id,
        screenshot_url: p_screenshot_url,
        submission_notes: p_submission_notes
      })
      .select()
      .single()

    if (submissionError) throw submissionError

    // Update user task status
    const { error: updateError } = await supabase
      .from('user_tasks')
      .update({
        status: 'Submitted',
        submission_id: submission.id
      })
      .eq('id', p_user_task_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true, data: submission }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Error creating task submission:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
