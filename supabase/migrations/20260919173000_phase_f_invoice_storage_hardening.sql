-- Phase F: bind private invoice files to their authoritative invoice record.
-- Paths are deterministic: <auth-user-id>/<invoice-id>.pdf.

DROP POLICY IF EXISTS "Customers read own invoice files" ON storage.objects;
CREATE POLICY "Customers read own invoice files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = regexp_replace(storage.filename(name), '\.pdf$', '')
        AND i.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Admins read all invoice files" ON storage.objects;
CREATE POLICY "Admins read all invoice files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND public.get_user_role(auth.uid()) IN ('shop_owner', 'developer')
  );

DROP POLICY IF EXISTS "Customers upload own invoice files" ON storage.objects;
CREATE POLICY "Customers upload own invoice files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND storage.extension(name) = 'pdf'
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = regexp_replace(storage.filename(name), '\.pdf$', '')
        AND i.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Admins write invoice files" ON storage.objects;
CREATE POLICY "Admins write invoice files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'invoices'
    AND public.get_user_role(auth.uid()) IN ('shop_owner', 'developer')
  )
  WITH CHECK (
    bucket_id = 'invoices'
    AND public.get_user_role(auth.uid()) IN ('shop_owner', 'developer')
  );
