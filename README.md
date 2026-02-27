# SmartFinanceiro

Aplicação de controle financeiro da tríade (`smart_stock`, `smart_pdv`, `smart_financeiro`).

## Stack

- React + TypeScript + Vite
- Supabase (Auth + Postgres + RLS)
- Lucide React

## Funcionalidades iniciais

- Login/cadastro/recuperação de senha
- Dashboard com resumo de receitas, despesas e saldo
- Lançamento de receitas e despesas
- Filtro por tipo e por mês
- Exclusão de lançamento

## Configuração

1. Copie `.env.example` para `.env`
2. Preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

3. Execute o script SQL em `server/sql/01_create_finance_tables.sql`

Detalhes adicionais em `server/SUPABASE_SETUP.md`.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
```
