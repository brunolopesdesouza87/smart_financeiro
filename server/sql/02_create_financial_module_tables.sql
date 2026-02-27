-- SmartFinanceiro - Módulo financeiro completo
-- Execute no Supabase SQL Editor

-- =========================================================
-- 1) TABELA: financial_accounts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('bank', 'cash', 'credit_card', 'digital')),
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  bank_name TEXT,
  account_number TEXT,
  agency TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.financial_accounts IS 'Contas financeiras (bancos, caixa, cartão, carteiras digitais).';
COMMENT ON COLUMN public.financial_accounts.name IS 'Nome da conta, ex: Conta Bradesco, Caixa Loja.';
COMMENT ON COLUMN public.financial_accounts.type IS 'Tipo da conta: bank, cash, credit_card, digital.';
COMMENT ON COLUMN public.financial_accounts.balance IS 'Saldo atual da conta.';

CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON public.financial_accounts(active);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON public.financial_accounts(type);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_name ON public.financial_accounts(name);

-- =========================================================
-- 2) TABELA: chart_of_accounts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'asset', 'liability')),
  parent_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chart_of_accounts IS 'Plano de contas contábil/gerencial.';
COMMENT ON COLUMN public.chart_of_accounts.code IS 'Código hierárquico da conta, ex: 1.1.01.';
COMMENT ON COLUMN public.chart_of_accounts.parent_id IS 'Referência para conta pai no plano de contas.';

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON public.chart_of_accounts(type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id ON public.chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_active ON public.chart_of_accounts(active);

-- =========================================================
-- 3) TABELA: cost_centers
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cost_centers IS 'Centros de custo para rateio e análise financeira.';

CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON public.cost_centers(active);
CREATE INDEX IF NOT EXISTS idx_cost_centers_name ON public.cost_centers(name);

-- =========================================================
-- 4) TABELA: payables (contas a pagar)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  supplier_name TEXT,
  supplier_id UUID,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'partial')),
  category_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  recurrent BOOLEAN NOT NULL DEFAULT false,
  recurrence_period TEXT CHECK (recurrence_period IN ('weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly')),
  purchase_order_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_payables_amount_paid_lte_amount CHECK (amount_paid <= amount)
);

COMMENT ON TABLE public.payables IS 'Contas a pagar do financeiro.';
COMMENT ON COLUMN public.payables.purchase_order_id IS 'Referência opcional à compra do módulo de estoque.';

CREATE INDEX IF NOT EXISTS idx_payables_due_date ON public.payables(due_date);
CREATE INDEX IF NOT EXISTS idx_payables_status ON public.payables(status);
CREATE INDEX IF NOT EXISTS idx_payables_supplier_id ON public.payables(supplier_id);
CREATE INDEX IF NOT EXISTS idx_payables_category_id ON public.payables(category_id);
CREATE INDEX IF NOT EXISTS idx_payables_cost_center_id ON public.payables(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_payables_account_id ON public.payables(account_id);
CREATE INDEX IF NOT EXISTS idx_payables_recurrent ON public.payables(recurrent);

-- FK opcional para suppliers (somente se tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'suppliers'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'payables_supplier_id_fkey'
    ) THEN
      ALTER TABLE public.payables
      ADD CONSTRAINT payables_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- =========================================================
-- 5) TABELA: receivables (contas a receber)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  customer_name TEXT,
  customer_id UUID,
  sale_id UUID,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_received NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
  due_date DATE NOT NULL,
  received_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'overdue', 'cancelled', 'partial')),
  category_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'credit_card', 'debit_card', 'pix', 'transfer', 'check', 'other')),
  installment_number INT NOT NULL DEFAULT 1 CHECK (installment_number >= 1),
  total_installments INT NOT NULL DEFAULT 1 CHECK (total_installments >= 1 AND total_installments >= installment_number),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_receivables_amount_received_lte_amount CHECK (amount_received <= amount)
);

COMMENT ON TABLE public.receivables IS 'Contas a receber do financeiro.';
COMMENT ON COLUMN public.receivables.sale_id IS 'Referência opcional à venda do PDV.';

CREATE INDEX IF NOT EXISTS idx_receivables_due_date ON public.receivables(due_date);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON public.receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_customer_id ON public.receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_receivables_category_id ON public.receivables(category_id);
CREATE INDEX IF NOT EXISTS idx_receivables_account_id ON public.receivables(account_id);
CREATE INDEX IF NOT EXISTS idx_receivables_sale_id ON public.receivables(sale_id);

-- FK opcional para customers (somente se tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customers'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'receivables_customer_id_fkey'
    ) THEN
      ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- FK opcional para sales (somente se tabela existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'sales'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'receivables_sale_id_fkey'
    ) THEN
      ALTER TABLE public.receivables
      ADD CONSTRAINT receivables_sale_id_fkey
      FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- =========================================================
-- 6) TABELA: cash_flow_entries
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  payable_id UUID REFERENCES public.payables(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES public.receivables(id) ON DELETE SET NULL,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cash_flow_entries IS 'Lançamentos de fluxo de caixa (entradas e saídas).';

CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_date ON public.cash_flow_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_type ON public.cash_flow_entries(type);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_account_id ON public.cash_flow_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_category_id ON public.cash_flow_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_payable_id ON public.cash_flow_entries(payable_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_receivable_id ON public.cash_flow_entries(receivable_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_entries_reconciled ON public.cash_flow_entries(reconciled);

-- =========================================================
-- TRIGGERS: atualizar status automaticamente (overdue / paid / partial)
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_payable_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_paid >= NEW.amount THEN
    NEW.status := 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date := CURRENT_DATE;
    END IF;
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payable_status ON public.payables;
CREATE TRIGGER trg_set_payable_status
BEFORE INSERT OR UPDATE OF amount, amount_paid, due_date, status, paid_date
ON public.payables
FOR EACH ROW
EXECUTE FUNCTION public.set_payable_status();

CREATE OR REPLACE FUNCTION public.set_receivable_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount_received >= NEW.amount THEN
    NEW.status := 'received';
    IF NEW.received_date IS NULL THEN
      NEW.received_date := CURRENT_DATE;
    END IF;
  ELSIF NEW.amount_received > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSE
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_receivable_status ON public.receivables;
CREATE TRIGGER trg_set_receivable_status
BEFORE INSERT OR UPDATE OF amount, amount_received, due_date, status, received_date
ON public.receivables
FOR EACH ROW
EXECUTE FUNCTION public.set_receivable_status();

-- Função utilitária para atualização em lote de vencidos (pode ser agendada via pg_cron)
CREATE OR REPLACE FUNCTION public.refresh_financial_overdue_statuses()
RETURNS VOID
LANGUAGE plpgsql
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

SELECT public.refresh_financial_overdue_statuses();

-- =========================================================
-- RLS: políticas básicas para usuários autenticados
-- =========================================================
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financial_accounts_authenticated_all" ON public.financial_accounts;
CREATE POLICY "financial_accounts_authenticated_all"
ON public.financial_accounts
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "chart_of_accounts_authenticated_all" ON public.chart_of_accounts;
CREATE POLICY "chart_of_accounts_authenticated_all"
ON public.chart_of_accounts
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cost_centers_authenticated_all" ON public.cost_centers;
CREATE POLICY "cost_centers_authenticated_all"
ON public.cost_centers
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "payables_authenticated_all" ON public.payables;
CREATE POLICY "payables_authenticated_all"
ON public.payables
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "receivables_authenticated_all" ON public.receivables;
CREATE POLICY "receivables_authenticated_all"
ON public.receivables
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cash_flow_entries_authenticated_all" ON public.cash_flow_entries;
CREATE POLICY "cash_flow_entries_authenticated_all"
ON public.cash_flow_entries
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- =========================================================
-- INSERTS iniciais: plano de contas (chart_of_accounts)
-- =========================================================
INSERT INTO public.chart_of_accounts (code, name, type, active)
VALUES
  ('1', 'Receitas', 'revenue', true),
  ('1.1', 'Receitas Operacionais', 'revenue', true),
  ('1.1.01', 'Vendas', 'revenue', true),
  ('1.1.02', 'Serviços', 'revenue', true),

  ('2', 'Despesas', 'expense', true),
  ('2.1', 'Despesas Operacionais', 'expense', true),
  ('2.1.01', 'Compras', 'expense', true),
  ('2.1.02', 'Despesas Fixas', 'expense', true),
  ('2.1.03', 'Despesas Variáveis', 'expense', true),
  ('2.1.04', 'Salários', 'expense', true),
  ('2.1.05', 'Aluguel', 'expense', true),
  ('2.1.06', 'Energia', 'expense', true),
  ('2.1.07', 'Água', 'expense', true),
  ('2.1.08', 'Internet', 'expense', true),
  ('2.1.09', 'Impostos e Taxas', 'expense', true),

  ('3', 'Ativos', 'asset', true),
  ('3.1', 'Caixa e Bancos', 'asset', true),
  ('3.1.01', 'Caixa', 'asset', true),
  ('3.1.02', 'Bancos Conta Movimento', 'asset', true),

  ('4', 'Passivos', 'liability', true),
  ('4.1', 'Obrigações', 'liability', true),
  ('4.1.01', 'Fornecedores', 'liability', true),
  ('4.1.02', 'Empréstimos', 'liability', true),
  ('4.1.03', 'Impostos a Pagar', 'liability', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  active = EXCLUDED.active;

-- Ajustar hierarquia parent_id pelo prefixo do código
UPDATE public.chart_of_accounts child
SET parent_id = parent.id
FROM public.chart_of_accounts parent
WHERE child.code LIKE parent.code || '.%'
  AND child.code <> parent.code
  AND parent.code = regexp_replace(child.code, '\\.[^.]+$', '');
