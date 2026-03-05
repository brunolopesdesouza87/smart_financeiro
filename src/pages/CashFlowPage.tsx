import React, { useCallback, useEffect, useState } from 'react'
import { Form, Input, Modal, Select } from 'antd'
import { ArrowDownCircle, ArrowUpCircle, Landmark, PlusCircle, TrendingDown, TrendingUp } from 'lucide-react'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Period = 'week' | 'month' | '30days' | 'custom'

interface CashEntry {
  id: string
  date: string
  description: string
  amount: number
  type: 'in' | 'out'
  account_name: string | null
  category_name: string | null
}

interface FinancialAccount {
  id: string
  name: string
  type: string
  balance: number
}

function getPeriodDates(period: Period, customFrom: string, customTo: string) {
  const today = dayjs()
  if (period === 'week') return { from: today.startOf('week').format('YYYY-MM-DD'), to: today.endOf('week').format('YYYY-MM-DD') }
  if (period === 'month') return { from: today.startOf('month').format('YYYY-MM-DD'), to: today.endOf('month').format('YYYY-MM-DD') }
  if (period === '30days') return { from: today.format('YYYY-MM-DD'), to: today.add(30, 'day').format('YYYY-MM-DD') }
  return { from: customFrom, to: customTo }
}

const accountTypeLabel: Record<string, string> = {
  bank: 'Banco',
  cash: 'Caixa',
  credit_card: 'Cartão de Crédito',
  digital: 'Carteira Digital',
}

const CashFlowPage: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'))
  const [customTo, setCustomTo] = useState(dayjs().endOf('month').format('YYYY-MM-DD'))

  const [entries, setEntries] = useState<CashEntry[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [form] = Form.useForm()

  const dates = getPeriodDates(period, customFrom, customTo)

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const [entriesRes, accountsRes] = await Promise.all([
        supabase
          .from('cash_flow_entries')
          .select('id, date, description, amount, type, financial_accounts(name), chart_of_accounts(name)')
          .gte('date', dates.from)
          .lte('date', dates.to)
          .order('date', { ascending: false }),
        supabase
          .from('financial_accounts')
          .select('id, name, type, balance')
          .eq('active', true)
          .order('name'),
      ])

      if (entriesRes.data) {
        setEntries(
          entriesRes.data.map((e: any) => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: Number(e.amount),
            type: e.type,
            account_name: e.financial_accounts?.name ?? null,
            category_name: e.chart_of_accounts?.name ?? null,
          }))
        )
      }
      if (accountsRes.data) {
        setAccounts(accountsRes.data.map((a: any) => ({ ...a, balance: Number(a.balance) })))
      }
    } finally {
      setLoading(false)
    }
  }, [dates.from, dates.to])

  useEffect(() => { load() }, [load])

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const totalIn = entries.filter(e => e.type === 'in').reduce((s, e) => s + e.amount, 0)
  const totalOut = entries.filter(e => e.type === 'out').reduce((s, e) => s + e.amount, 0)
  const resultado = totalIn - totalOut

  const filtered = entries.filter(e => typeFilter === 'all' || e.type === typeFilter)

  const openModal = () => {
    form.resetFields()
    form.setFieldsValue({ type: 'in', date: dayjs().format('YYYY-MM-DD') })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    if (!supabase) return
    setModalLoading(true)
    try {
      const amount = Math.abs(parseFloat(String(values.amount).replace(',', '.')))
      if (!amount || isNaN(amount)) throw new Error('Valor inválido')

      const { error } = await supabase.from('cash_flow_entries').insert({
        date: values.date,
        description: values.description,
        amount,
        type: values.type,
        account_id: values.account_id ?? null,
        notes: values.notes ?? null,
      })
      if (error) throw error

      if (values.account_id) {
        const acc = accounts.find(a => a.id === values.account_id)
        if (acc) {
          const newBalance = values.type === 'in' ? acc.balance + amount : acc.balance - amount
          await supabase.from('financial_accounts').update({ balance: newBalance }).eq('id', values.account_id)
        }
      }

      setModalOpen(false)
      load()
    } catch (e: any) {
      form.setFields([{ name: 'description', errors: [e.message || 'Erro ao salvar'] }])
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div className="page-header-row" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>Fluxo de Caixa</h3>
          <p style={{ margin: 0, color: '#6b7fa3', fontSize: 13 }}>Entradas, saídas e saldo por período</p>
        </div>
        <div className="header-actions">
          <button type="button" className="accent-btn" onClick={openModal}>
            <PlusCircle size={16} /> Novo Lançamento
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['week', 'month', '30days', 'custom'] as Period[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={period === p ? 'accent-btn' : 'ghost-btn'}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            {p === 'week' ? 'Esta Semana' : p === 'month' ? 'Este Mês' : p === '30days' ? 'Próximos 30 dias' : 'Personalizado'}
          </button>
        ))}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }} />
            <span style={{ color: '#6b7fa3' }}>até</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }} />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
          <div className="summary-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}>
            <Landmark size={16} /> Saldo Total
          </div>
          <strong style={{ fontSize: 22, color: totalBalance >= 0 ? '#27ae60' : '#e74c3c' }}>{loading ? '...' : money.format(totalBalance)}</strong>
          <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{accounts.length} conta(s)</div>
        </article>
        <article className="summary-card received" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
          <div className="summary-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}>
            <ArrowUpCircle size={16} /> Entradas no Período
          </div>
          <strong style={{ fontSize: 22, color: '#27ae60' }}>{loading ? '...' : money.format(totalIn)}</strong>
          <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{entries.filter(e => e.type === 'in').length} lançamento(s)</div>
        </article>
        <article className="summary-card overdue" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
          <div className="summary-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}>
            <ArrowDownCircle size={16} /> Saídas no Período
          </div>
          <strong style={{ fontSize: 22, color: '#e74c3c' }}>{loading ? '...' : money.format(totalOut)}</strong>
          <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{entries.filter(e => e.type === 'out').length} lançamento(s)</div>
        </article>
        <article className="summary-card" style={{ background: '#fff', borderRadius: 10, padding: 18, border: '1px solid #e2e8f0' }}>
          <div className="summary-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b7fa3', fontSize: 13, marginBottom: 8 }}>
            {resultado >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} Resultado
          </div>
          <strong style={{ fontSize: 22, color: resultado >= 0 ? '#27ae60' : '#e74c3c' }}>{loading ? '...' : money.format(resultado)}</strong>
          <div style={{ fontSize: 12, color: '#6b7fa3', marginTop: 4 }}>{resultado >= 0 ? 'Superávit' : 'Déficit'}</div>
        </article>
      </div>

      <section className="page-card">
        <div className="page-header-row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Lançamentos</h3>
          <div className="header-actions">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }}>
              <option value="all">Todos</option>
              <option value="in">Entradas</option>
              <option value="out">Saídas</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 32 }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 32 }}>Nenhum lançamento encontrado neste período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600 }}>Data</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600 }}>Descrição</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600 }}>Conta</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600 }}>Categoria</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600 }}>Tipo</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600 }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{e.description}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7fa3' }}>{e.account_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7fa3' }}>{e.category_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                        borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: e.type === 'in' ? '#e8f5e9' : '#fdecea',
                        color: e.type === 'in' ? '#27ae60' : '#e74c3c',
                      }}>
                        {e.type === 'in' ? <ArrowUpCircle size={12} /> : <ArrowDownCircle size={12} />}
                        {e.type === 'in' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: e.type === 'in' ? '#27ae60' : '#e74c3c', whiteSpace: 'nowrap' }}>
                      {e.type === 'out' ? '- ' : '+ '}{money.format(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="page-card">
        <h3 style={{ margin: '0 0 14px 0' }}>Saldo por Conta</h3>
        {accounts.length === 0 ? (
          <p style={{ color: '#6b7fa3' }}>Nenhuma conta cadastrada.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#6b7fa3', fontSize: 12 }}>
                  <Landmark size={14} /> {accountTypeLabel[acc.type] ?? acc.type}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{acc.name}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: acc.balance >= 0 ? '#27ae60' : '#e74c3c' }}>
                  {money.format(acc.balance)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title="Novo Lançamento Manual"
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={modalLoading}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ type: 'in', date: dayjs().format('YYYY-MM-DD') }}
        >
          <Form.Item label="Tipo" name="type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="in">Entrada</Select.Option>
              <Select.Option value="out">Saída</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Descrição" name="description" rules={[{ required: true, message: 'Informe a descrição.' }]}>
            <Input maxLength={80} autoFocus />
          </Form.Item>
          <Form.Item label="Valor (R$)" name="amount" rules={[{ required: true, message: 'Informe o valor.' }]}>
            <Input type="number" min={0.01} step={0.01} />
          </Form.Item>
          <Form.Item label="Data" name="date" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Conta Bancária" name="account_id">
            <Select placeholder="Selecione a conta" allowClear>
              {accounts.map(acc => (
                <Select.Option key={acc.id} value={acc.id}>{acc.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Observações" name="notes">
            <Input.TextArea rows={2} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CashFlowPage
