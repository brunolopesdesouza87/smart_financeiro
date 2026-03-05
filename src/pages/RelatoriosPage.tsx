import React, { useCallback, useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Clock, TrendingDown, TrendingUp, Users } from 'lucide-react'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number) => (isNaN(n) || !isFinite(n) ? '0,0' : n.toFixed(1).replace('.', ',')) + '%'

type Period = 'month' | 'quarter' | 'year' | 'custom'

function getPeriodDates(period: Period, customFrom: string, customTo: string) {
  const today = dayjs()
  if (period === 'month')   return { from: today.startOf('month').format('YYYY-MM-DD'),   to: today.endOf('month').format('YYYY-MM-DD') }
  if (period === 'quarter') return { from: today.startOf('quarter').format('YYYY-MM-DD'), to: today.endOf('quarter').format('YYYY-MM-DD') }
  if (period === 'year')    return { from: today.startOf('year').format('YYYY-MM-DD'),    to: today.endOf('year').format('YYYY-MM-DD') }
  return { from: customFrom, to: customTo }
}

interface RecRow { id: string; description: string; customer_name: string | null; amount_received: number; received_date: string }
interface PayRow { id: string; description: string; supplier_name: string | null; category_name: string | null; amount_paid: number; paid_date: string }
interface OverdueRec { id: string; description: string; customer_name: string | null; amount: number; amount_received: number; due_date: string; days_overdue: number }
interface OverduePay { id: string; description: string; supplier_name: string | null; amount: number; amount_paid: number; due_date: string; days_overdue: number }

const RelatoriosPage: React.FC = () => {
  const [tab, setTab] = useState<'receitas' | 'despesas' | 'inadimplencia'>('receitas')
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customTo, setCustomTo]   = useState(dayjs().endOf('month').format('YYYY-MM-DD'))
  const [loading, setLoading] = useState(true)

  const [recRows,      setRecRows]      = useState<RecRow[]>([])
  const [payRows,      setPayRows]      = useState<PayRow[]>([])
  const [overdueRec,   setOverdueRec]   = useState<OverdueRec[]>([])
  const [overduePay,   setOverduePay]   = useState<OverduePay[]>([])

  const dates = getPeriodDates(period, customFrom, customTo)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const [recRes, payRes, overdueRecRes, overduePayRes] = await Promise.all([
        supabase
          .from('receivables')
          .select('id, description, customer_name, amount_received, received_date')
          .in('status', ['received', 'partial'])
          .gte('received_date', dates.from)
          .lte('received_date', dates.to)
          .order('amount_received', { ascending: false }),
        supabase
          .from('vw_payables_summary')
          .select('id, description, supplier_name, category_name, amount_paid, paid_date')
          .in('status_display', ['paid', 'partial'])
          .gte('paid_date', dates.from)
          .lte('paid_date', dates.to)
          .order('amount_paid', { ascending: false }),
        supabase
          .from('receivables')
          .select('id, description, customer_name, amount, amount_received, due_date')
          .in('status', ['overdue', 'partial', 'pending'])
          .lt('due_date', today)
          .order('due_date', { ascending: true }),
        supabase
          .from('payables')
          .select('id, description, supplier_name, amount, amount_paid, due_date')
          .in('status', ['overdue', 'partial', 'pending'])
          .lt('due_date', today)
          .order('due_date', { ascending: true }),
      ])

      if (recRes.error)        console.warn('receitas error:', recRes.error.message)
      if (payRes.error)        console.warn('despesas error:', payRes.error.message)
      if (overdueRecRes.error) console.warn('overdue rec error:', overdueRecRes.error.message)
      if (overduePayRes.error) console.warn('overdue pay error:', overduePayRes.error.message)

      setRecRows((recRes.data ?? []).map((r: any) => ({ ...r, amount_received: Number(r.amount_received) })))
      setPayRows((payRes.data ?? []).map((p: any) => ({ ...p, amount_paid: Number(p.amount_paid) })))
      setOverdueRec((overdueRecRes.data ?? []).map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        amount_received: Number(r.amount_received),
        days_overdue: dayjs(today).diff(dayjs(r.due_date), 'day'),
      })))
      setOverduePay((overduePayRes.data ?? []).map((p: any) => ({
        ...p,
        amount: Number(p.amount),
        amount_paid: Number(p.amount_paid ?? 0),
        days_overdue: dayjs(today).diff(dayjs(p.due_date), 'day'),
      })))
    } finally {
      setLoading(false)
    }
  }, [dates.from, dates.to])

  useEffect(() => { load() }, [load])

  // ─── Receitas KPIs ───────────────────────────────────────────
  const totalReceitas = recRows.reduce((s, r) => s + r.amount_received, 0)
  const ticketMedio   = recRows.length ? totalReceitas / recRows.length : 0
  const topClientes   = Object.values(
    recRows.reduce((acc: Record<string, { name: string; total: number }>, r) => {
      const k = r.customer_name ?? '(sem cliente)'
      if (!acc[k]) acc[k] = { name: k, total: 0 }
      acc[k].total += r.amount_received
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total).slice(0, 10)

  // ─── Despesas KPIs ───────────────────────────────────────────
  const totalDespesas  = payRows.reduce((s, p) => s + p.amount_paid, 0)
  const topFornecedores = Object.values(
    payRows.reduce((acc: Record<string, { name: string; total: number }>, p) => {
      const k = p.supplier_name ?? '(sem fornecedor)'
      if (!acc[k]) acc[k] = { name: k, total: 0 }
      acc[k].total += p.amount_paid
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total).slice(0, 10)

  const topCategorias = Object.values(
    payRows.reduce((acc: Record<string, { name: string; total: number }>, p) => {
      const k = p.category_name ?? '(sem categoria)'
      if (!acc[k]) acc[k] = { name: k, total: 0 }
      acc[k].total += p.amount_paid
      return acc
    }, {})
  ).sort((a, b) => b.total - a.total)

  const resultado = totalReceitas - totalDespesas
  const margem    = totalReceitas > 0 ? (resultado / totalReceitas) * 100 : 0

  // ─── Inadimplência KPIs ──────────────────────────────────────
  const totalVencidoRec = overdueRec.reduce((s, r) => s + (r.amount - r.amount_received), 0)
  const totalVencidoPay = overduePay.reduce((s, p) => s + (p.amount - p.amount_paid), 0)

  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600, background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }
  const tdStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="page-header-row" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>DRE / Relatórios</h3>
          <p style={{ margin: 0, color: '#6b7fa3', fontSize: 13 }}>Análise financeira por período</p>
        </div>
      </div>

      {/* Seletor de período */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['month', 'quarter', 'year', 'custom'] as Period[]).map(p => (
          <button key={p} type="button" onClick={() => setPeriod(p)}
            className={period === p ? 'accent-btn' : 'ghost-btn'}
            style={{ padding: '6px 14px', fontSize: 13 }}>
            {p === 'month' ? 'Este Mês' : p === 'quarter' ? 'Este Trimestre' : p === 'year' ? 'Este Ano' : 'Personalizado'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }} />
            <span style={{ color: '#6b7fa3' }}>até</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }} />
          </>
        )}
        {loading && <span style={{ color: '#6b7fa3', fontSize: 13 }}>Carregando...</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0' }}>
        {([
          { key: 'receitas', label: 'Receitas' },
          { key: 'despesas', label: 'Despesas' },
          { key: 'inadimplencia', label: 'Inadimplência' },
        ] as { key: typeof tab; label: string }[]).map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '3px solid #18314f' : '3px solid transparent',
              color: tab === t.key ? '#18314f' : '#6b7fa3',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ───── RECEITAS ───── */}
      {tab === 'receitas' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <article className="summary-card received" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><ArrowUpCircle size={16} /> Total Recebido</div>
              <strong style={{ fontSize: 22, color: '#27ae60' }}>{money.format(totalReceitas)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{recRows.length} recebimento(s)</div>
            </article>
            <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><TrendingUp size={16} /> Ticket Médio</div>
              <strong style={{ fontSize: 22, color: '#18314f' }}>{money.format(ticketMedio)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>por recebimento</div>
            </article>
            <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><TrendingDown size={16} /> Total Despesas</div>
              <strong style={{ fontSize: 22, color: '#e74c3c' }}>{money.format(totalDespesas)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>no período</div>
            </article>
            <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}>{resultado >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} Resultado</div>
              <strong style={{ fontSize: 22, color: resultado >= 0 ? '#27ae60' : '#e74c3c' }}>{money.format(resultado)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>Margem: {pct(margem)}</div>
            </article>
          </div>

          <section className="page-card">
            <h3 style={{ margin: '0 0 14px 0' }}>Top clientes por valor recebido</h3>
            {topClientes.length === 0
              ? <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 24 }}>Nenhum recebimento no período.</p>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Cliente</th><th style={{ ...thStyle, textAlign: 'right' }}>Valor recebido</th><th style={{ ...thStyle, textAlign: 'right' }}>% do total</th></tr></thead>
                  <tbody>{topClientes.map((c, i) => (
                    <tr key={c.name}>
                      <td style={{ ...tdStyle, color: '#6b7fa3', width: 36 }}>{i + 1}</td>
                      <td style={tdStyle}>{c.name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#27ae60', fontWeight: 600 }}>{money.format(c.total)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7fa3' }}>{pct(totalReceitas > 0 ? (c.total / totalReceitas) * 100 : 0)}</td>
                    </tr>
                  ))}</tbody>
                </table>
            }
          </section>

          <section className="page-card">
            <h3 style={{ margin: '0 0 14px 0' }}>Todos os recebimentos do período</h3>
            {recRows.length === 0
              ? <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 24 }}>Nenhum recebimento no período.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={thStyle}>Data</th>
                      <th style={thStyle}>Descrição</th>
                      <th style={thStyle}>Cliente</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Valor</th>
                    </tr></thead>
                    <tbody>{recRows.map(r => (
                      <tr key={r.id}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(r.received_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={tdStyle}>{r.description}</td>
                        <td style={{ ...tdStyle, color: '#6b7fa3' }}>{r.customer_name ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#27ae60', fontWeight: 600 }}>{money.format(r.amount_received)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </section>
        </>
      )}

      {/* ───── DESPESAS ───── */}
      {tab === 'despesas' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <article className="summary-card overdue" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><ArrowDownCircle size={16} /> Total Pago</div>
              <strong style={{ fontSize: 22, color: '#e74c3c' }}>{money.format(totalDespesas)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{payRows.length} pagamento(s)</div>
            </article>
            <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><TrendingUp size={16} /> Total Receitas</div>
              <strong style={{ fontSize: 22, color: '#27ae60' }}>{money.format(totalReceitas)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>no período</div>
            </article>
            <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}>{resultado >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} Resultado</div>
              <strong style={{ fontSize: 22, color: resultado >= 0 ? '#27ae60' : '#e74c3c' }}>{money.format(resultado)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>Margem: {pct(margem)}</div>
            </article>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <section className="page-card">
              <h3 style={{ margin: '0 0 14px 0' }}>Por fornecedor</h3>
              {topFornecedores.length === 0
                ? <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 24 }}>Nenhuma despesa no período.</p>
                : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr><th style={thStyle}>Fornecedor</th><th style={{ ...thStyle, textAlign: 'right' }}>Total pago</th><th style={{ ...thStyle, textAlign: 'right' }}>%</th></tr></thead>
                    <tbody>{topFornecedores.map(f => (
                      <tr key={f.name}>
                        <td style={tdStyle}>{f.name}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>{money.format(f.total)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7fa3' }}>{pct(totalDespesas > 0 ? (f.total / totalDespesas) * 100 : 0)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
              }
            </section>
            <section className="page-card">
              <h3 style={{ margin: '0 0 14px 0' }}>Por categoria</h3>
              {topCategorias.length === 0
                ? <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 24 }}>Nenhuma despesa no período.</p>
                : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr><th style={thStyle}>Categoria</th><th style={{ ...thStyle, textAlign: 'right' }}>Total</th><th style={{ ...thStyle, textAlign: 'right' }}>%</th></tr></thead>
                    <tbody>{topCategorias.map(c => (
                      <tr key={c.name}>
                        <td style={tdStyle}>{c.name}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>{money.format(c.total)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7fa3' }}>{pct(totalDespesas > 0 ? (c.total / totalDespesas) * 100 : 0)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
              }
            </section>
          </div>

          <section className="page-card">
            <h3 style={{ margin: '0 0 14px 0' }}>Todos os pagamentos do período</h3>
            {payRows.length === 0
              ? <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 24 }}>Nenhum pagamento no período.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={thStyle}>Data</th>
                      <th style={thStyle}>Descrição</th>
                      <th style={thStyle}>Fornecedor</th>
                      <th style={thStyle}>Categoria</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Valor</th>
                    </tr></thead>
                    <tbody>{payRows.map(p => (
                      <tr key={p.id}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(p.paid_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={tdStyle}>{p.description}</td>
                        <td style={{ ...tdStyle, color: '#6b7fa3' }}>{p.supplier_name ?? '—'}</td>
                        <td style={{ ...tdStyle, color: '#6b7fa3' }}>{p.category_name ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>{money.format(p.amount_paid)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </section>
        </>
      )}

      {/* ───── INADIMPLÊNCIA ───── */}
      {tab === 'inadimplencia' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <article className="summary-card overdue" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><Users size={16} /> A receber vencido</div>
              <strong style={{ fontSize: 22, color: '#e74c3c' }}>{money.format(totalVencidoRec)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{overdueRec.length} conta(s)</div>
            </article>
            <article className="summary-card overdue" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}><Clock size={16} /> A pagar vencido</div>
              <strong style={{ fontSize: 22, color: '#e74c3c' }}>{money.format(totalVencidoPay)}</strong>
              <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{overduePay.length} conta(s)</div>
            </article>
          </div>

          <section className="page-card">
            <h3 style={{ margin: '0 0 14px 0' }}>Contas a Receber vencidas</h3>
            {overdueRec.length === 0
              ? <p style={{ color: '#27ae60', textAlign: 'center', padding: 24 }}>Nenhuma conta a receber vencida.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={thStyle}>Vencimento</th>
                      <th style={thStyle}>Descrição</th>
                      <th style={thStyle}>Cliente</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Saldo devedor</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Dias vencido</th>
                    </tr></thead>
                    <tbody>{overdueRec.map(r => (
                      <tr key={r.id}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(r.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={tdStyle}>{r.description}</td>
                        <td style={{ ...tdStyle, color: '#6b7fa3' }}>{r.customer_name ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>{money.format(r.amount - r.amount_received)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ background: r.days_overdue > 30 ? '#fdecea' : '#fff3e0', color: r.days_overdue > 30 ? '#e74c3c' : '#e65100', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                            {r.days_overdue}d
                          </span>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </section>

          <section className="page-card">
            <h3 style={{ margin: '0 0 14px 0' }}>Contas a Pagar vencidas</h3>
            {overduePay.length === 0
              ? <p style={{ color: '#27ae60', textAlign: 'center', padding: 24 }}>Nenhuma conta a pagar vencida.</p>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr>
                      <th style={thStyle}>Vencimento</th>
                      <th style={thStyle}>Descrição</th>
                      <th style={thStyle}>Fornecedor</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Saldo devedor</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Dias vencido</th>
                    </tr></thead>
                    <tbody>{overduePay.map(p => (
                      <tr key={p.id}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(p.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td style={tdStyle}>{p.description}</td>
                        <td style={{ ...tdStyle, color: '#6b7fa3' }}>{p.supplier_name ?? '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>{money.format(p.amount - p.amount_paid)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ background: p.days_overdue > 30 ? '#fdecea' : '#fff3e0', color: p.days_overdue > 30 ? '#e74c3c' : '#e65100', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                            {p.days_overdue}d
                          </span>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
            }
          </section>
        </>
      )}
    </div>
  )
}

export default RelatoriosPage
