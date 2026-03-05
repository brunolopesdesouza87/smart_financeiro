-- ============================================================
-- Trigger: sincronização automática de ordens de compra → payables
-- Executa no Supabase SQL Editor
-- ============================================================

-- Função chamada pelo trigger
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_purchase_order_to_payable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total numeric;
BEGIN
  -- Só cria payable se tiver valor e ainda não tiver sido importado
  v_total := COALESCE(NEW.total_amount, NEW.total, 0);

  IF v_total > 0 THEN
    INSERT INTO public.payables (
      description,
      supplier_name,
      amount,
      amount_paid,
      due_date,
      status,
      purchase_order_id,
      notes
    )
    SELECT
      'Compra Estoque #' || substr(NEW.id::text, 1, 8),
      NEW.supplier_name,
      v_total,
      0,
      (CURRENT_DATE + INTERVAL '30 days')::date,
      'pending',
      NEW.id,
      'Sincronizado automaticamente do Estoque'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.payables WHERE purchase_order_id = NEW.id
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro ao sincronizar order % para payables: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS trg_auto_sync_purchase_order_to_payable ON public.purchase_orders;

-- Cria trigger: dispara AFTER INSERT em public.purchase_orders
CREATE TRIGGER trg_auto_sync_purchase_order_to_payable
  AFTER INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_purchase_order_to_payable();

-- ============================================================
-- Sincronização das ordens já existentes (executar uma única vez)
-- ============================================================
DO $$
DECLARE
  v_order RECORD;
  v_total numeric;
BEGIN
  FOR v_order IN SELECT * FROM public.purchase_orders ORDER BY created_at ASC LOOP
    v_total := COALESCE(v_order.total_amount, v_order.total, 0);
    IF v_total > 0 THEN
      INSERT INTO public.payables (
        description, supplier_name, amount, amount_paid,
        due_date, status, purchase_order_id, notes
      )
      SELECT
        'Compra Estoque #' || substr(v_order.id::text, 1, 8),
        v_order.supplier_name,
        v_total,
        0,
        (CURRENT_DATE + INTERVAL '30 days')::date,
        'pending',
        v_order.id,
        'Sincronizado automaticamente do Estoque'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.payables WHERE purchase_order_id = v_order.id
      );
    END IF;
  END LOOP;
END;
$$;
