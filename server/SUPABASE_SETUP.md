# SmartFinanceiro - Setup Supabase

## 1) Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

## 2) Criar tabelas e políticas

No Supabase SQL Editor, execute o script:

- `server/sql/01_create_finance_tables.sql`
- `server/sql/02_create_financial_module_tables.sql`
- `server/sql/03_create_financial_views_functions_policies.sql`

O script `01` cria a tabela inicial usada no app básico:
- `finance_transactions`
- índices de performance
- trigger de `updated_at`
- políticas RLS por usuário (`auth.uid() = user_id`)

O script `02` cria o módulo financeiro completo:
- `financial_accounts`
- `chart_of_accounts`
- `cost_centers`
- `payables`
- `receivables`
- `cash_flow_entries`
- índices de performance
- triggers automáticas para status de vencimento (`overdue`)
- políticas RLS básicas para usuários autenticados
- carga inicial de plano de contas

O script `03` cria:
- views analíticas (`vw_cash_flow_summary`, `vw_payables_summary`, `vw_receivables_summary`)
- functions (`fn_get_dre`, `fn_update_overdue_status`, `fn_sync_sale_to_receivable`)
- helper de tenant (`fn_current_organization_id`)
- políticas RLS por `organization_id` para as tabelas financeiras

## 3) Testar autenticação

- Cadastre um usuário na tela inicial do app
- Faça login
- Cadastre um lançamento
- Verifique se o registro aparece em `finance_transactions`

## 4) Rodar localmente

```bash
npm install
npm run dev
```
