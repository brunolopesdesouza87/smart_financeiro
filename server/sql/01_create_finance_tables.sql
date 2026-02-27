-- SmartFinanceiro - Estrutura inicial
-- Execute no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('dinheiro', 'pix', 'cartao', 'boleto', 'transferencia', 'outro')),
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_user_id ON public.finance_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_date ON public.finance_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_type ON public.finance_transactions(type);

CREATE OR REPLACE FUNCTION public.set_finance_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_transactions_updated_at ON public.finance_transactions;
CREATE TRIGGER trg_finance_transactions_updated_at
BEFORE UPDATE ON public.finance_transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_finance_transactions_updated_at();

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance transactions select own" ON public.finance_transactions;
CREATE POLICY "Finance transactions select own"
ON public.finance_transactions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Finance transactions insert own" ON public.finance_transactions;
CREATE POLICY "Finance transactions insert own"
ON public.finance_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Finance transactions update own" ON public.finance_transactions;
CREATE POLICY "Finance transactions update own"
ON public.finance_transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Finance transactions delete own" ON public.finance_transactions;
CREATE POLICY "Finance transactions delete own"
ON public.finance_transactions
FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON TABLE public.finance_transactions IS 'Lancamentos financeiros de cada usuario no SmartFinanceiro';
