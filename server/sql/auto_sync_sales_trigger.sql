-- ============================================================
-- Trigger: sincronização automática de vendas do PDV → receivables
-- Executa no Supabase SQL Editor
-- ============================================================

-- Função chamada pelo trigger
CREATE OR REPLACE FUNCTION public.trigger_auto_sync_sale_to_receivable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Chama a função já existente de sincronização para a nova venda
  PERFORM public.fn_sync_sale_to_receivable(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não bloqueia a venda se a sincronização falhar
  RAISE WARNING 'Erro ao sincronizar venda % para receivables: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS trg_auto_sync_sale_to_receivable ON public.sales;

-- Cria trigger: dispara AFTER INSERT em public.sales
CREATE TRIGGER trg_auto_sync_sale_to_receivable
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_sync_sale_to_receivable();

-- ============================================================
-- Sincronização das vendas passadas (executar uma única vez)
-- ============================================================
DO $$
DECLARE
  v_sale RECORD;
BEGIN
  FOR v_sale IN SELECT id FROM public.sales ORDER BY created_at ASC LOOP
    PERFORM public.fn_sync_sale_to_receivable(v_sale.id);
  END LOOP;
END;
$$;
