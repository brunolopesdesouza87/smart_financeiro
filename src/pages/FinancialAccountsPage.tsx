import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface FinancialAccount {
  id: string
  name: string
  type: 'bank' | 'cash' | 'credit_card' | 'digital'
  balance: number
  bank_name: string | null
  account_number: string | null
  agency: string | null
  active: boolean
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'Banco',
  cash: 'Caixa',
  credit_card: 'Cartão de Crédito',
  digital: 'Carteira Digital',
}

const TYPE_COLORS: Record<string, string> = {
  bank: '#1e3a5f',
  cash: '#27ae60',
  credit_card: '#8e44ad',
  digital: '#2980b9',
}

const EMPTY = { name: '', type: 'bank' as FinancialAccount['type'], balance: '', bank_name: '', account_number: '', agency: '', active: true }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const FinancialAccountsPage: React.FC = () => {
  const [data, setData] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('financial_accounts')
      .select('id, name, type, balance, bank_name, account_number, agency, active, created_at')
      .order('name')
    if (error) console.warn('financial_accounts error:', error.message)
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (acc: FinancialAccount) => {
    setEditingId(acc.id)
    setForm({
      name: acc.name,
      type: acc.type,
      balance: String(acc.balance),
      bank_name: acc.bank_name || '',
      account_number: acc.account_number || '',
      agency: acc.agency || '',
      active: acc.active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!supabase) return
    if (!form.name.trim()) { toast.error('Informe o nome da conta.'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        balance: parseFloat(String(form.balance).replace(',', '.')) || 0,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        agency: form.agency.trim() || null,
        active: form.active,
      }
      if (editingId) {
        const { error } = await supabase.from('financial_accounts').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Conta atualizada!')
      } else {
        const { error } = await supabase.from('financial_accounts').insert(payload)
        if (error) throw error
        toast.success('Conta criada!')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (acc: FinancialAccount) => {
    if (!supabase) return
    if (!confirm(`Excluir a conta "${acc.name}"?`)) return
    const { error } = await supabase.from('financial_accounts').delete().eq('id', acc.id)
    if (error) { toast.error(error.message); return }
    toast.success('Conta excluída!')
    load()
  }

  const totalBalance = data.filter(a => a.active && a.type !== 'credit_card').reduce((s, a) => s + a.balance, 0)

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#18314f' }}>Contas Bancárias e Financeiras</h2>
        <button onClick={openCreate} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          + Nova Conta
        </button>
      </div>

      {/* Summary card */}
      {!loading && data.length > 0 && (
        <div style={{ background: '#1e3a5f', borderRadius: 12, padding: '16px 24px', marginBottom: 24, color: '#fff', display: 'inline-block' }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Saldo Total (contas ativas)</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{fmt(totalBalance)}</div>
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>Carregando...</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#888' }}>Nenhuma conta cadastrada. Clique em "+ Nova Conta" para começar.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {data.map(acc => (
            <div key={acc.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf4', padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', opacity: acc.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ background: TYPE_COLORS[acc.type] + '18', color: TYPE_COLORS[acc.type], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  {TYPE_LABELS[acc.type]}
                </span>
                {!acc.active && <span style={{ background: '#fde8e8', color: '#c0392b', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Inativa</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#18314f', marginBottom: 4 }}>{acc.name}</div>
              {acc.bank_name && <div style={{ fontSize: 12, color: '#6b7fa3', marginBottom: 2 }}>{acc.bank_name}</div>}
              {(acc.agency || acc.account_number) && (
                <div style={{ fontSize: 12, color: '#6b7fa3', marginBottom: 8 }}>
                  {acc.agency && `Ag: ${acc.agency}`}{acc.agency && acc.account_number && ' · '}{acc.account_number && `Cc: ${acc.account_number}`}
                </div>
              )}
              <div style={{ fontSize: 22, fontWeight: 700, color: acc.balance >= 0 ? '#27ae60' : '#e74c3c', margin: '10px 0' }}>
                {fmt(acc.balance)}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => openEdit(acc)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #1e3a5f', background: '#fff', color: '#1e3a5f', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Editar</button>
                <button onClick={() => handleDelete(acc)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #e74c3c', background: '#fff', color: '#e74c3c', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: '#18314f' }}>
              {editingId ? 'Editar Conta' : 'Nova Conta'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Nome da Conta *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Conta Bradesco, Caixa Loja..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Tipo *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }}>
                  <option value="bank">Banco</option>
                  <option value="cash">Caixa</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="digital">Carteira Digital</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Saldo Inicial (R$)</label>
                <input value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0,00" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Nome do Banco</label>
                <input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Ex: Bradesco, Itaú..." style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Agência</label>
                <input value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value }))} placeholder="0000" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Número da Conta</label>
                <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="00000-0" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="acc-active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              <label htmlFor="acc-active" style={{ fontSize: 14, color: '#18314f', cursor: 'pointer' }}>Conta ativa</label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d6deea', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6b7fa3' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1e3a5f', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FinancialAccountsPage
