GRANT UPDATE, DELETE ON public.point_transactions TO authenticated;

CREATE POLICY tx_admin_update ON public.point_transactions FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY tx_admin_delete ON public.point_transactions FOR DELETE TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.adjust_point_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.point_accounts SET balance = balance - OLD.applied_delta WHERE profile_id = OLD.profile_id;
    RETURN OLD;
  END IF;
  IF NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'Person einer Buchung kann nicht geändert werden';
  END IF;
  IF NEW.delta <> OLD.delta THEN
    UPDATE public.point_accounts SET balance = balance - OLD.applied_delta + NEW.delta WHERE profile_id = NEW.profile_id;
    NEW.applied_delta := NEW.delta;
  ELSE
    NEW.applied_delta := OLD.applied_delta;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.adjust_point_transaction() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_adjust_tx_update BEFORE UPDATE ON public.point_transactions
  FOR EACH ROW EXECUTE FUNCTION public.adjust_point_transaction();
CREATE TRIGGER trg_adjust_tx_delete AFTER DELETE ON public.point_transactions
  FOR EACH ROW EXECUTE FUNCTION public.adjust_point_transaction();