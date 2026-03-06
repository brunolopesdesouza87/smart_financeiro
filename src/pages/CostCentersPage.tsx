import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

interface CostCenter {
  id: string
  name: string
  description: string | null
  active: boolean
  created_at: string
}

const EMPTY = { name: '', description: '', active: true }

const CostCentersPage: React.FC = () => {
  const [data, setData] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [search, setSearch] = useState('')

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('cost_centers')
      .select('id, name, description, active, created_at')
      .order('name')
    if (error) console.warn('cost_centers error:', error.message)
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  const openEdit = (cc: CostCenter) => {
    setEditingId(cc.id)
    setForm({ name: cc.name, description: cc.description || '', active: cc.active })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!supabase) return
    if (!form.name.trim()) { toast.error('Informe o nome.'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        active: form.active,
      }
      if (editingId) {
        const { error } = await supabase.from('cost_centers').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Centro de custo atualizado!')
      } else {
        const { error } = await supabase.from('cost_centers').insert(payload)
        if (error) throw error
        toast.success('Centro de custo criado!')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cc: CostCenter) => {
    if (!supabase) return
    if (!confirm(`Excluir "${cc.name}"?`)) return
    const { error } = await supabase.from('cost_centers').delete().eq('id', cc.id)
    if (error) { toast.error(error.message); return }
    toast.success('Exclu�do!')
    load()
  }

  const filtered = data.filter(cc =>
    !search || cc.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#18314f' }}>Centros de Custo</h2>
        <button onClick={openCreate} style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          + Novo Centro de Custo
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', width: 300, fontSize: 14 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf4', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f4f7fb' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#18314f', fontSize: 13 }}>Nome</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#18314f', fontSize: 13 }}>Descri��o</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#18314f', fontSize: 13 }}>Status</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: '#18314f', fontSize: 13 }}>A��es</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#888' }}>Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#888' }}>Nenhum centro de custo encontrado.</td></tr>
            ) : filtered.map((cc, i) => (
              <tr key={cc.id} style={{ borderTop: '1px solid #f0f3f8', background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#18314f' }}>{cc.name}</td>
                <td style={{ padding: '12px 16px', color: '#6b7fa3', fontSize: 13 }}>{cc.description || '�'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: cc.active ? '#d4f5e2' : '#fde8e8', color: cc.active ? '#1a6e3a' : '#c0392b' }}>
                    {cc.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button onClick={() => openEdit(cc)} style={{ marginRight: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid #1e3a5f', background: '#fff', color: '#1e3a5f', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Editar</button>
                  <button onClick={() => handleDelete(cc)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e74c3c', background: '#fff', color: '#e74c3c', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: 480, maxWidth: '95vw', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: '#18314f' }}>
              {editingId ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
            </h3>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Nome *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Administrativo, Vendas, TI..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#18314f', fontSize: 13 }}>Descri��o</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descri��o opcional..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d6deea', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="cc-active"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor="cc-active" style={{ fontSize: 14, color: '#18314f', cursor: 'pointer' }}>Ativo</label>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d6deea', background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#6b7fa3' }}>
                Cancelar
              </button>
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

export default CostCentersPage
