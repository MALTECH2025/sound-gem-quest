
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

    console.log('Starting cleanup of expired tasks...');

    // Get all expired tasks
    const { data: expiredTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, image_url')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired tasks:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredTasks?.length || 0} expired tasks`);

    let cleanedCount = 0;
    let filesDeleted = 0;

    for (const task of expiredTasks || []) {
      try {
        // Delete task image from storage if exists
        if (task.image_url) {
          const { error: imageDeleteError } = await supabase.storage
            .from('task-images')
            .remove([task.image_url]);
          
          if (!imageDeleteError) {
            filesDeleted++;
          } else {
            console.error(`Error deleting task image ${task.image_url}:`, imageDeleteError);
          }
        }

        // Get task screenshots from user submissions
        const { data: submissions, error: submissionsError } = await supabase
          .from('task_submissions')
          .select('screenshot_url')
          .eq('user_task_id', task.id)
          .not('screenshot_url', 'is', null);

        if (!submissionsError && submissions) {
          const screenshotPaths = submissions
            .map(s => s.screenshot_url)
            .filter(Boolean);

          if (screenshotPaths.length > 0) {
            const { error: screenshotsDeleteError } = await supabase.storage
              .from('task-screenshots')
              .remove(screenshotPaths);
            
            if (!screenshotsDeleteError) {
              filesDeleted += screenshotPaths.length;
            } else {
              console.error('Error deleting screenshots:', screenshotsDeleteError);
            }
          }
        }

        // Delete the task (cascade will handle user_tasks and submissions)
        const { error: taskDeleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('id', task.id);

        if (!taskDeleteError) {
          cleanedCount++;
          console.log(`Cleaned up task: ${task.id}`);
        } else {
          console.error(`Error deleting task ${task.id}:`, taskDeleteError);
        }
      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
      }
    }

    console.log(`Cleanup completed: ${cleanedCount} tasks removed, ${filesDeleted} files deleted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleanup completed: ${cleanedCount} expired tasks removed, ${filesDeleted} files deleted`,
        tasksRemoved: cleanedCount,
        filesDeleted: filesDeleted
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Error in cleanup function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Failed to cleanup expired tasks'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
