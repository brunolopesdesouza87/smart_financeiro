

-- SmartFinanceiro - Views, Functions e Policies avançadas
-- Execute no Supabase SQL Editor (após 02_create_financial_module_tables.sql)

-- =========================================================
-- Helpers de tenant (organization_id)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

-- Adiciona organization_id nas tabelas financeiras (se ainda não existir)
ALTER TABLE public.financial_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cash_flow_entries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Atualiza constraint de recorrência de payables para novas frequências (se existir)
ALTER TABLE public.payables DROP CONSTRAINT IF EXISTS payables_recurrence_period_check;
ALTER TABLE public.payables
  ADD CONSTRAINT payables_recurrence_period_check
  CHECK (
    recurrence_period IS NULL
    OR recurrence_period IN ('weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly')
  );

-- Índices de tenant
CREATE INDEX IF NOT EXISTS idx_financial_accounts_org ON public.financial_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_org ON public.chart_of_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_org ON public.cost_centers(organization_id);
CREATE INDEX IF NOT EXISTS idx_payables_org ON public.payables(organization_id);
CREATE INDEX IF NOT EXISTS idx_receivables_org ON public.receivables(organization_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_org ON public.cash_flow_entries(organization_id);

-- Trigger para preencher organization_id automaticamente
CREATE OR REPLACE FUNCTION public.fn_set_finance_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_org_id := public.fn_current_organization_id();

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id não encontrado para o usuário autenticado';
  END IF;

  NEW.organization_id := v_org_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_financial_accounts_org ON public.financial_accounts;
CREATE TRIGGER trg_set_financial_accounts_org
BEFORE INSERT ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_set_finance_org_id();

DROP TRIGGER IF EXISTS trg_set_chart_of_accounts_org ON public.chart_of_accounts;
CREATE TRIGGER trg_set_chart_of_accounts_org
BEFORE INSERT ON public.chart_of_accounts
FOR EACH ROW EXECUTE FUNCTION public.fn_set_finance_org_id();

DROP TRIGGER IF EXISTS trg_set_cost_centers_org ON public.cost_centers;
CREATE TRIGGER trg_set_cost_centers_org
BEFORE INSERT ON public.cost_centers
FOR EACH ROW EXECUTE FUNCTION public.fn_set_finance_org_id();

DROP TRIGGER IF EXISTS trg_set_payables_org ON public.payables;
CREATE TRIGGER trg_set_payables_org
BEFORE INSERT ON public.payables
FOR EACH ROW EXECUTE FUNCTION public.fn_set_finance_org_id();

DROP TRIGGER IF EXISTS trg_set_receivables_org ON public.receivables;
CREATE TRIGGER trg_set_receivables_org
BEFORE INSERT ON public.receivables
FOR EACH ROW EXECUTE FUNCTION public.fn_set_finance_org_id();

DROP TRIGGER IF EXISTS trg_set_cash_flow_entries_org ON public.cash_flow_entries;
CREATE TRIGGER trg_set_cash_flow_entries_org
BEFORE INSERT ON public.cash_flow_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_set_finance_org_id();

-- =========================================================
-- POLICIES (RLS) por organization_id
-- =========================================================
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_accounts_authenticated_all" ON public.financial_accounts;
DROP POLICY IF EXISTS "chart_of_accounts_authenticated_all" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "cost_centers_authenticated_all" ON public.cost_centers;
DROP POLICY IF EXISTS "payables_authenticated_all" ON public.payables;
DROP POLICY IF EXISTS "receivables_authenticated_all" ON public.receivables;
DROP POLICY IF EXISTS "cash_flow_entries_authenticated_all" ON public.cash_flow_entries;

DROP POLICY IF EXISTS "financial_accounts_org_policy" ON public.financial_accounts;
CREATE POLICY "financial_accounts_org_policy"
ON public.financial_accounts
FOR ALL
USING (organization_id = public.fn_current_organization_id())
WITH CHECK (organization_id = public.fn_current_organization_id());

DROP POLICY IF EXISTS "chart_of_accounts_org_policy" ON public.chart_of_accounts;
CREATE POLICY "chart_of_accounts_org_policy"
ON public.chart_of_accounts
FOR ALL
USING (organization_id = public.fn_current_organization_id())
WITH CHECK (organization_id = public.fn_current_organization_id());

DROP POLICY IF EXISTS "cost_centers_org_policy" ON public.cost_centers;
CREATE POLICY "cost_centers_org_policy"
ON public.cost_centers
FOR ALL
USING (organization_id = public.fn_current_organization_id())
WITH CHECK (organization_id = public.fn_current_organization_id());

DROP POLICY IF EXISTS "payables_org_policy" ON public.payables;
CREATE POLICY "payables_org_policy"
ON public.payables
FOR ALL
USING (organization_id = public.fn_current_organization_id())
WITH CHECK (organization_id = public.fn_current_organization_id());

DROP POLICY IF EXISTS "receivables_org_policy" ON public.receivables;
CREATE POLICY "receivables_org_policy"
ON public.receivables
FOR ALL
USING (organization_id = public.fn_current_organization_id())
WITH CHECK (organization_id = public.fn_current_organization_id());

DROP POLICY IF EXISTS "cash_flow_entries_org_policy" ON public.cash_flow_entries;
CREATE POLICY "cash_flow_entries_org_policy"
ON public.cash_flow_entries
FOR ALL
USING (organization_id = public.fn_current_organization_id())
WITH CHECK (organization_id = public.fn_current_organization_id());

-- =========================================================
-- VIEW 1: vw_cash_flow_summary
-- =========================================================
DROP VIEW IF EXISTS public.vw_cash_flow_summary;

CREATE OR REPLACE VIEW public.vw_cash_flow_summary
WITH (security_invoker = true)
AS
WITH daily AS (
  SELECT
    cfe.date,
    cfe.organization_id,
    SUM(CASE WHEN cfe.type = 'in' THEN cfe.amount ELSE 0 END) AS total_in,
    SUM(CASE WHEN cfe.type = 'out' THEN cfe.amount ELSE 0 END) AS total_out
  FROM public.cash_flow_entries cfe
  GROUP BY cfe.date, cfe.organization_id
)
SELECT
  d.date,
  d.total_in,
  d.total_out,
  (d.total_in - d.total_out) AS net,
  SUM(d.total_in - d.total_out) OVER (
    PARTITION BY d.organization_id
    ORDER BY d.date
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance
FROM daily d
ORDER BY d.date;

COMMENT ON VIEW public.vw_cash_flow_summary IS 'Resumo diário de fluxo de caixa com saldo acumulado.';

-- =========================================================
-- VIEW 2: vw_payables_summary
-- =========================================================
DROP VIEW IF EXISTS public.vw_payables_summary;

CREATE OR REPLACE VIEW public.vw_payables_summary
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.description,
  p.supplier_name,
  p.amount,
  p.amount_paid,
  p.due_date,
  CASE
    WHEN p.status = 'pending' AND p.due_date < CURRENT_DATE THEN 'overdue'
    ELSE p.status
  END AS status_display,
  coa.name AS category_name,
  cc.name AS cost_center_name,
  CASE
    WHEN p.due_date < CURRENT_DATE
      AND (CASE WHEN p.status = 'pending' THEN 'overdue' ELSE p.status END) = 'overdue'
    THEN (CURRENT_DATE - p.due_date)
    ELSE 0
  END AS days_overdue
FROM public.payables p
LEFT JOIN public.chart_of_accounts coa ON coa.id = p.category_id
LEFT JOIN public.cost_centers cc ON cc.id = p.cost_center_id;

COMMENT ON VIEW public.vw_payables_summary IS 'Resumo de contas a pagar com status de vencimento calculado.';

-- =========================================================
-- VIEW 3: vw_receivables_summary
-- =========================================================
DROP VIEW IF EXISTS public.vw_receivables_summary;

CREATE OR REPLACE VIEW public.vw_receivables_summary
WITH (security_invoker = true)
AS
SELECT
  r.id,
  r.description,
  r.customer_name,
  r.sale_id,
  r.amount,
  r.amount_received,
  r.due_date,
  CASE
    WHEN r.status = 'pending' AND r.due_date < CURRENT_DATE THEN 'overdue'
    ELSE r.status
  END AS status_display,
  r.payment_method,
  r.installment_number,
  r.total_installments,
  CASE
    WHEN r.due_date < CURRENT_DATE
      AND (CASE WHEN r.status = 'pending' THEN 'overdue' ELSE r.status END) = 'overdue'
    THEN (CURRENT_DATE - r.due_date)
    ELSE 0
  END AS days_overdue
FROM public.receivables r;

COMMENT ON VIEW public.vw_receivables_summary IS 'Resumo de contas a receber com status de vencimento calculado.';

-- =========================================================
-- FUNCTION 4: fn_get_dre(start_date, end_date)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_get_dre(start_date DATE, end_date DATE)
RETURNS TABLE (
  line_item TEXT,
  amount NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_org UUID;
  v_receita_bruta NUMERIC := 0;
  v_deducoes NUMERIC := 0;
  v_receita_liquida NUMERIC := 0;
  v_cmv NUMERIC := 0;
  v_lucro_bruto NUMERIC := 0;
  v_despesas_operacionais NUMERIC := 0;
  v_ebitda NUMERIC := 0;
  v_resultado_liquido NUMERIC := 0;
BEGIN
  v_org := public.fn_current_organization_id();

  SELECT COALESCE(SUM(cfe.amount), 0)
    INTO v_receita_bruta
  FROM public.cash_flow_entries cfe
  LEFT JOIN public.chart_of_accounts coa ON coa.id = cfe.category_id
  WHERE cfe.organization_id = v_org
    AND cfe.date BETWEEN start_date AND end_date
    AND cfe.type = 'in'
    AND COALESCE(coa.type, 'revenue') = 'revenue';

  SELECT COALESCE(SUM(cfe.amount), 0)
    INTO v_deducoes
  FROM public.cash_flow_entries cfe
  LEFT JOIN public.chart_of_accounts coa ON coa.id = cfe.category_id
  WHERE cfe.organization_id = v_org
    AND cfe.date BETWEEN start_date AND end_date
    AND (
      (cfe.type = 'out' AND coa.type = 'liability')
      OR LOWER(COALESCE(coa.name, '')) LIKE '%imposto%'
      OR LOWER(COALESCE(coa.name, '')) LIKE '%taxa%'
      OR LOWER(COALESCE(coa.name, '')) LIKE '%devolu%'
      OR LOWER(COALESCE(cfe.description, '')) LIKE '%desconto%'
    );

  v_receita_liquida := v_receita_bruta - v_deducoes;

  SELECT COALESCE(SUM(cfe.amount), 0)
    INTO v_cmv
  FROM public.cash_flow_entries cfe
  LEFT JOIN public.chart_of_accounts coa ON coa.id = cfe.category_id
  WHERE cfe.organization_id = v_org
    AND cfe.date BETWEEN start_date AND end_date
    AND cfe.type = 'out'
    AND (
      LOWER(COALESCE(coa.name, '')) LIKE '%cmv%'
      OR LOWER(COALESCE(coa.name, '')) LIKE '%compra%'
      OR LOWER(COALESCE(coa.name, '')) LIKE '%mercadoria%'
    );

  v_lucro_bruto := v_receita_liquida - v_cmv;

  SELECT COALESCE(SUM(cfe.amount), 0)
    INTO v_despesas_operacionais
  FROM public.cash_flow_entries cfe
  LEFT JOIN public.chart_of_accounts coa ON coa.id = cfe.category_id
  WHERE cfe.organization_id = v_org
    AND cfe.date BETWEEN start_date AND end_date
    AND cfe.type = 'out'
    AND COALESCE(coa.type, 'expense') = 'expense'
    AND NOT (
      LOWER(COALESCE(coa.name, '')) LIKE '%cmv%'
      OR LOWER(COALESCE(coa.name, '')) LIKE '%compra%'
      OR LOWER(COALESCE(coa.name, '')) LIKE '%mercadoria%'
    );

  v_ebitda := v_lucro_bruto - v_despesas_operacionais;
  v_resultado_liquido := v_ebitda;

  RETURN QUERY
  SELECT 'Receita Bruta'::TEXT, v_receita_bruta
  UNION ALL SELECT 'Deduções', v_deducoes
  UNION ALL SELECT 'Receita Líquida', v_receita_liquida
  UNION ALL SELECT 'CMV', v_cmv
  UNION ALL SELECT 'Lucro Bruto', v_lucro_bruto
  UNION ALL SELECT 'Despesas Operacionais', v_despesas_operacionais
  UNION ALL SELECT 'EBITDA', v_ebitda
  UNION ALL SELECT 'Resultado Líquido', v_resultado_liquido;
END;
$$;

COMMENT ON FUNCTION public.fn_get_dre(DATE, DATE) IS 'Retorna DRE sintética por período.';

-- =========================================================
-- FUNCTION 5: fn_update_overdue_status()
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_update_overdue_status()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payables
     SET status = 'overdue'
   WHERE status = 'pending'
     AND due_date < CURRENT_DATE;

  UPDATE public.receivables
     SET status = 'overdue'
   WHERE status = 'pending'
     AND due_date < CURRENT_DATE;
END;
$$;

COMMENT ON FUNCTION public.fn_update_overdue_status() IS 'Atualiza pendências vencidas para overdue; ideal para cron diário.';

-- Exemplo de cron (opcional, se extensão pg_cron estiver ativa)
-- SELECT cron.schedule(
--   'finance-overdue-daily',
--   '5 0 * * *',
--   $$SELECT public.fn_update_overdue_status();$$
-- );

-- =========================================================
-- FUNCTION 6: fn_sync_sale_to_receivable(sale_id uuid)
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_sync_sale_to_receivable(p_sale_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_org UUID;
  v_notes JSONB := '{}'::JSONB;
  v_installments INT := 1;
  v_base_date DATE := CURRENT_DATE;
  v_payment_method TEXT := 'other';
  v_created_count INT := 0;
  v_amount_per_installment NUMERIC(14,2);
  v_total NUMERIC(14,2);
  v_amount_last NUMERIC(14,2);
  v_i INT;
  v_due DATE;
  v_status TEXT;
  v_amount_received NUMERIC(14,2);
BEGIN
  SELECT s.*
    INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda % não encontrada em public.sales', p_sale_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.receivables r WHERE r.sale_id = p_sale_id
  ) THEN
    RETURN 0;
  END IF;

  v_org := COALESCE(v_sale.organization_id, public.fn_current_organization_id());

  BEGIN
    v_notes := COALESCE(v_sale.notes::JSONB, '{}'::JSONB);
  EXCEPTION WHEN others THEN
    v_notes := '{}'::JSONB;
  END;

  v_installments := GREATEST(
    1,
    COALESCE(
      NULLIF((v_notes ->> 'total_installments')::INT, 0),
      NULLIF((v_notes ->> 'installments')::INT, 0),
      NULLIF((v_notes ->> 'parcelas')::INT, 0),
      1
    )
  );

  v_total := COALESCE(v_sale.total_amount, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Venda % sem valor total válido', p_sale_id;
  END IF;

  v_base_date := COALESCE(v_sale.created_at::DATE, CURRENT_DATE);

  v_payment_method := CASE LOWER(COALESCE(v_sale.payment_method, 'other'))
    WHEN 'dinheiro' THEN 'cash'
    WHEN 'pix' THEN 'pix'
    WHEN 'cartao' THEN 'credit_card'
    WHEN 'cartão' THEN 'credit_card'
    WHEN 'debito' THEN 'debit_card'
    WHEN 'débito' THEN 'debit_card'
    WHEN 'boleto' THEN 'check'
    WHEN 'transferencia' THEN 'transfer'
    WHEN 'transferência' THEN 'transfer'
    ELSE 'other'
  END;

  v_amount_per_installment := ROUND(v_total / v_installments, 2);
  v_amount_last := v_total - (v_amount_per_installment * (v_installments - 1));

  FOR v_i IN 1..v_installments LOOP
    v_due := (v_base_date + ((v_i - 1) || ' month')::INTERVAL)::DATE;

    IF v_installments = 1 AND v_payment_method IN ('cash', 'pix', 'debit_card', 'transfer') THEN
      v_status := 'received';
      v_amount_received := CASE WHEN v_i = v_installments THEN v_amount_last ELSE v_amount_per_installment END;
    ELSE
      v_status := 'pending';
      v_amount_received := 0;
    END IF;

    INSERT INTO public.receivables (
      organization_id,
      description,
      customer_name,
      customer_id,
      sale_id,
      amount,
      amount_received,
      due_date,
      received_date,
      status,
      payment_method,
      installment_number,
      total_installments,
      notes
    )
    VALUES (
      v_org,
      CONCAT('Venda PDV #', LEFT(v_sale.id::TEXT, 8), ' - Parcela ', v_i, '/', v_installments),
      NULL,
      NULL,
      v_sale.id,
      CASE WHEN v_i = v_installments THEN v_amount_last ELSE v_amount_per_installment END,
      v_amount_received,
      v_due,
      CASE WHEN v_status = 'received' THEN v_due ELSE NULL END,
      v_status,
      v_payment_method,
      v_i,
      v_installments,
      'Gerado automaticamente via fn_sync_sale_to_receivable'
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN v_created_count;
END;
$$;

COMMENT ON FUNCTION public.fn_sync_sale_to_receivable(UUID) IS 'Sincroniza uma venda do PDV para contas a receber, incluindo parcelamento.';
