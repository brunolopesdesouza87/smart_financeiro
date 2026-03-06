import React, { useEffect, useState } from 'react'
import { PlusCircle, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabase'

interface Account {
  id: string
  code: string
  name: string
  type: 'revenue' | 'expense' | 'asset' | 'liability'
  parent_id: string | null
  active: boolean
}

const typeLabel: Record<string, string> = {
  revenue: 'Receita',
  expense: 'Despesa',
  asset: 'Ativo',
  liability: 'Passivo',
}

const typeColor: Record<string, string> = {
  revenue: '#27ae60',
  expense: '#e74c3c',
  asset: '#2980b9',
  liability: '#8e44ad',
}

const EMPTY_FORM = { code: '', name: '', type: 'expense' as Account['type'], parent_id: '' }

const PlanoDeContasPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const load = async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, type, parent_id, active')
      .order('code')
    if (error) console.warn('chart_of_accounts error:', error.message)
    setAccounts((data ?? []) as Account[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const openCreate = (parentId?: string) => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, parent_id: parentId ?? '' })
    setModalOpen(true)
  }

  const openEdit = (acc: Account) => {
    setEditingId(acc.id)
    setForm({ code: acc.code, name: acc.name, type: acc.type, parent_id: acc.parent_id ?? '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!supabase) return
    if (!form.name.trim()) { toast.error('Informe o nome.'); return }
    if (!form.code.trim()) { toast.error('Informe o código.'); return }
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type,
        parent_id: form.parent_id || null,
        active: true,
      }
      if (editingId) {
        const { error } = await supabase.from('chart_of_accounts').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Categoria atualizada!')
      } else {
        const { error } = await supabase.from('chart_of_accounts').insert(payload)
        if (error) throw error
        toast.success('Categoria criada!')
      }
      setModalOpen(false)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (acc: Account) => {
    if (!supabase) return
    const hasChildren = accounts.some(a => a.parent_id === acc.id)
    if (hasChildren) { toast.error('Remova as subcategorias antes de excluir.'); return }
    if (!window.confirm(`Excluir "${acc.name}"?`)) return
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', acc.id)
    if (error) { toast.error(error.message); return }
    toast.success('Excluído!')
    load()
  }

  // Filter + build tree
  const filtered = accounts.filter(a => {
    const matchType = typeFilter === 'all' || a.type === typeFilter
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)
    return matchType && matchSearch
  })

  // Build hierarchical rows for display
  const renderRows = (parentId: string | null, depth: number): React.ReactNode[] => {
    const children = filtered.filter(a => a.parent_id === (parentId ?? null))
    if (children.length === 0) return []
    return children.flatMap(acc => {
      const hasChildren = filtered.some(a => a.parent_id === acc.id)
      const isExpanded = expanded.has(acc.id)
      const rows: React.ReactNode[] = [
        <tr key={acc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td style={{ padding: '10px 12px', paddingLeft: 12 + depth * 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {hasChildren
                ? <button type="button" onClick={() => toggleExpand(acc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7fa3', display: 'flex' }}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                : <span style={{ width: 14, display: 'inline-block' }} />
              }
              <span style={{ fontWeight: depth === 0 ? 700 : 400 }}>{acc.name}</span>
            </div>
          </td>
          <td style={{ padding: '10px 12px', color: '#6b7fa3', fontSize: 13 }}>{acc.code}</td>
          <td style={{ padding: '10px 12px' }}>
            <span style={{ background: typeColor[acc.type] + '22', color: typeColor[acc.type], borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
              {typeLabel[acc.type] ?? acc.type}
            </span>
          </td>
          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button type="button" title="Adicionar subcategoria" onClick={() => { setExpanded(prev => new Set([...prev, acc.id])); openCreate(acc.id) }}
                style={{ background: 'none', border: '1px solid #d6deea', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6b7fa3', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <PlusCircle size={12} /> Sub
              </button>
              <button type="button" onClick={() => openEdit(acc)}
                style={{ background: 'none', border: '1px solid #d6deea', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6b7fa3', display: 'flex', alignItems: 'center' }}>
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => handleDelete(acc)}
                style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#e74c3c', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </td>
        </tr>
      ]
      if (hasChildren && isExpanded) {
        rows.push(...renderRows(acc.id, depth + 1))
      }
      return rows
    })
  }

  const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', color: '#6b7fa3', fontWeight: 600, background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div className="page-header-row" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>Plano de Contas</h3>
          <p style={{ margin: 0, color: '#6b7fa3', fontSize: 13 }}>Categorias de receitas e despesas</p>
        </div>
        <div className="header-actions">
          <button type="button" className="accent-btn" onClick={() => openCreate()}>
            <PlusCircle size={16} /> Nova Categoria
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Buscar por nome ou código..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13, minWidth: 240 }}
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }}>
          <option value="all">Todos os tipos</option>
          <option value="revenue">Receita</option>
          <option value="expense">Despesa</option>
          <option value="asset">Ativo</option>
          <option value="liability">Passivo</option>
        </select>
        <button type="button" className="ghost-btn" onClick={() => setExpanded(new Set(accounts.map(a => a.id)))}>Expandir tudo</button>
        <button type="button" className="ghost-btn" onClick={() => setExpanded(new Set())}>Recolher tudo</button>
      </div>

      {/* Tabela */}
      <section className="page-card">
        {loading ? (
          <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 32 }}>Carregando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#6b7fa3', textAlign: 'center', padding: 32 }}>Nenhuma categoria encontrada. Crie a primeira clicando em "Nova Categoria".</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nome</th>
                  <th style={thStyle}>Código</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {renderRows(null, 0)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 440, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 17, fontWeight: 700 }}>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Código *
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                  placeholder="ex: 1.1.01" style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13, boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Nome *
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Vendas de Produtos" autoFocus
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13, boxSizing: 'border-box' }} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Tipo *
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Account['type'] }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }}>
                  <option value="revenue">Receita</option>
                  <option value="expense">Despesa</option>
                  <option value="asset">Ativo</option>
                  <option value="liability">Passivo</option>
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Categoria pai (opcional)
                <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid #d6deea', fontSize: 13 }}>
                  <option value="">— Nenhuma (categoria raiz) —</option>
                  {accounts.filter(a => a.id !== editingId).map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button type="button" className="ghost-btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="button" className="accent-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanoDeContasPage
