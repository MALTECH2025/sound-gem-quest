-- Create storage buckets for task images and screenshots
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('task-images', 'task-images', true),
  ('task-screenshots', 'task-screenshots', false);

-- Storage policies for task-images (public bucket)
CREATE POLICY "Task images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-images');

CREATE POLICY "Admins can upload task images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-images' 
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can update task images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'task-images' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete task images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'task-images' AND public.is_admin(auth.uid()));

-- Storage policies for task-screenshots (private bucket)
CREATE POLICY "Users can view their own screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-screenshots' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload their own screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-screenshots' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-screenshots' 
    AND public.is_admin(auth.uid())
  );