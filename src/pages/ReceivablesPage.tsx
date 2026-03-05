import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Check, CircleDollarSign, Clock3, Pencil, PlusCircle, Search, TriangleAlert, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import type { ReceivableSummary } from '../types/finance'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type SortField = 'description' | 'customer_name' | 'amount' | 'due_date' | 'status_display' | 'payment_method'
type SortDirection = 'asc' | 'desc'

const PAGE_SIZE = 20
const todayIso = new Date().toISOString().slice(0, 10)

const receivablePaymentOptions = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'transfer', label: 'Transferência' },
  { value: 'check', label: 'Cheque' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'crediario', label: 'Crediário' },
]

const receivableFormSchema = z
  .object({
    mode: z.enum(['create', 'edit']),
    description: z.string().trim().min(1, 'Descrição é obrigatória.'),
    customerName: z.string().optional(),
    totalAmount: z.string().min(1, 'Valor total é obrigatório.'),
    paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória.'),
    dueDate: z.string().min(1, 'Data de vencimento é obrigatória.'),
    isInstallment: z.boolean(),
    installments: z.number().int().min(1).max(24),
    categoryId: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const parsed = parseCurrencyInput(value.totalAmount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalAmount'],
        message: 'Informe um valor maior que zero.',
      })
    }

    if (value.mode === 'create' && value.dueDate < todayIso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: 'A data de vencimento não pode ser no passado para novos registros.',
      })
    }
  })

const settleFormSchema = z.object({
  receivedAmount: z.string().min(1, 'Valor recebido é obrigatório.'),
  receivedDate: z.string().min(1, 'Data do recebimento é obrigatória.'),
  accountId: z.string().min(1, 'Conta bancária é obrigatória.'),
  paymentMethod: z.string().min(1, 'Forma de pagamento é obrigatória.'),
  notes: z.string().optional(),
})

type ReceivableFormValues = z.infer<typeof receivableFormSchema>
type SettleFormValues = z.infer<typeof settleFormSchema>

type ReceivableCategory = {
  id: string
  name: string
  code: string
}

type FinancialAccount = {
  id: string
  name: string
  balance: number
}

type CustomerOption = {
  id: string
  name: string
}

const addMonthsToIsoDate = (baseDate: string, monthsToAdd: number) => {
  const [year, month, day] = baseDate.split('-').map(Number)
  const utcDate = new Date(Date.UTC(year, month - 1 + monthsToAdd, day))
  return utcDate.toISOString().slice(0, 10)
}

function parseCurrencyInput(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

function formatCurrencyInput(raw: string): string {
  const numeric = parseCurrencyInput(raw)
  return numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalizePaymentMethodToDb(value: string) {
  if (value === 'boleto' || value === 'crediario') return 'other'
  return value
}

export function ReceivablesPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ReceivableSummary | null>(null)
  const [settleItem, setSettleItem] = useState<ReceivableSummary | null>(null)
  const [isSavingForm, setIsSavingForm] = useState(false)
  const [isSettling, setIsSettling] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'received' | 'overdue' | 'cancelled'>('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortField, setSortField] = useState<SortField>('due_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)

  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey: ['receivables-summary'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('vw_receivables_summary')
        .select('*')
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data || []) as ReceivableSummary[]
    },
    staleTime: 1000 * 30,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['receivable-categories'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, name, code')
        .eq('type', 'revenue')
        .eq('active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return (data || []) as ReceivableCategory[]
    },
    staleTime: 1000 * 60,
  })

  const { data: financialAccounts = [] } = useQuery({
    queryKey: ['financial-accounts-active'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('id, name, balance')
        .eq('active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return (data || []) as FinancialAccount[]
    },
    staleTime: 1000 * 60,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-autocomplete'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(300)

      if (error) {
        if ((error.message || '').toLowerCase().includes('does not exist')) {
          return []
        }
        throw error
      }

      return (data || []) as CustomerOption[]
    },
    staleTime: 1000 * 60,
  })

  const createForm = useForm<ReceivableFormValues>({
    resolver: zodResolver(receivableFormSchema),
    defaultValues: {
      mode: 'create',
      description: '',
      customerName: '',
      totalAmount: '0,00',
      paymentMethod: 'pix',
      dueDate: todayIso,
      isInstallment: false,
      installments: 1,
      categoryId: '',
      notes: '',
    },
  })

  const settleForm = useForm<SettleFormValues>({
    resolver: zodResolver(settleFormSchema),
    defaultValues: {
      receivedAmount: '0,00',
      receivedDate: todayIso,
      accountId: '',
      paymentMethod: 'pix',
      notes: '',
    },
  })

  const watchedDueDate = createForm.watch('dueDate')
  const watchedInstallments = createForm.watch('installments')
  const watchedInstallmentToggle = createForm.watch('isInstallment')

  const installmentPreview = useMemo(() => {
    if (!watchedInstallmentToggle) return []
    const total = Math.min(Math.max(watchedInstallments || 1, 1), 24)
    if (!watchedDueDate) return []
    return Array.from({ length: total }, (_, index) => addMonthsToIsoDate(watchedDueDate, index))
  }, [watchedDueDate, watchedInstallments, watchedInstallmentToggle])

  const customerSuggestions = useMemo(() => {
    const fromItems = items
      .map((item) => item.customer_name)
      .filter((name): name is string => Boolean(name && name.trim()))

    const merged = new Set<string>([...customers.map((item) => item.name), ...fromItems])
    return Array.from(merged).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [customers, items])

  const paymentMethods = useMemo(() => {
    const unique = new Set<string>()
    for (const item of items) {
      if (item.payment_method) unique.add(item.payment_method)
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [items])

  const filteredAndSorted = useMemo(() => {
    const filtered = items.filter((item) => {
      const normalizedStatus = item.status_display === 'partial' ? 'pending' : item.status_display
      const statusMatch = statusFilter === 'all' || normalizedStatus === statusFilter
      const paymentMatch = paymentFilter === 'all' || (item.payment_method || 'other') === paymentFilter
      const searchMatch =
        !search.trim() ||
        item.description.toLowerCase().includes(search.toLowerCase()) ||
        (item.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.sale_id || '').toLowerCase().includes(search.toLowerCase())

      const dateMatchFrom = !fromDate || item.due_date >= fromDate
      const dateMatchTo = !toDate || item.due_date <= toDate

      return statusMatch && paymentMatch && searchMatch && dateMatchFrom && dateMatchTo
    })

    filtered.sort((a, b) => {
      const aValue = a[sortField] ?? ''
      const bValue = b[sortField] ?? ''

      let comparison = 0
      if (sortField === 'amount' || sortField === 'due_date') {
        const aNum = sortField === 'amount' ? Number(aValue) : new Date(String(aValue)).getTime()
        const bNum = sortField === 'amount' ? Number(bValue) : new Date(String(bValue)).getTime()
        comparison = aNum - bNum
      } else {
        comparison = String(aValue).localeCompare(String(bValue), 'pt-BR')
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [items, search, statusFilter, paymentFilter, fromDate, toDate, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))

  const paginatedItems = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    return filteredAndSorted.slice(start, start + PAGE_SIZE)
  }, [filteredAndSorted, page, totalPages])

  const toggleSort = (field: SortField) => {
    setPage(1)
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setPaymentFilter('all')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const openCreateModal = () => {
    setEditingItem(null)
    createForm.reset({
      mode: 'create',
      description: '',
      customerName: '',
      totalAmount: '0,00',
      paymentMethod: 'pix',
      dueDate: todayIso,
      isInstallment: false,
      installments: 1,
      categoryId: '',
      notes: '',
    })
    setShowCreateModal(true)
  }

  const openEditModal = (item: ReceivableSummary) => {
    setEditingItem(item)
    createForm.reset({
      mode: 'edit',
      description: item.description,
      customerName: item.customer_name || '',
      totalAmount: money.format(item.amount).replace('R$', '').trim(),
      paymentMethod: item.payment_method || 'pix',
      dueDate: item.due_date,
      isInstallment: Boolean((item.total_installments || 1) > 1),
      installments: Math.min(Math.max(item.total_installments || 1, 1), 24),
      categoryId: '',
      notes: '',
    })
    setShowCreateModal(true)
  }

  const openSettleModal = (item: ReceivableSummary) => {
    setSettleItem(item)
    const remaining = Math.max(Number(item.amount) - Number(item.amount_received), 0)
    settleForm.reset({
      receivedAmount: remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      receivedDate: todayIso,
      accountId: '',
      paymentMethod: item.payment_method || 'pix',
      notes: '',
    })
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!window.confirm('Deseja excluir esta conta a receber?')) return

    const { error } = await supabase
      .from('receivables')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] })
    toast.success('Conta a receber excluída com sucesso.')
  }

  // Sincronização automática silenciosa ao carregar a página
  useEffect(() => {
    const autoSync = async () => {
      if (!supabase) return
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(200)
      for (const sale of sales || []) {
        await supabase.rpc('fn_sync_sale_to_receivable', { p_sale_id: sale.id })
      }
      queryClient.invalidateQueries({ queryKey: ['receivables-summary'] })
    }
    autoSync()
  }, [])

  const handleCreateOrEdit = createForm.handleSubmit(async (values) => {
    if (!supabase) return

    const parsedAmount = parseCurrencyInput(values.totalAmount)
    const totalInstallments = values.isInstallment ? Math.min(Math.max(values.installments || 1, 1), 24) : 1
    const customerMatch = customers.find((item) => item.name.toLowerCase() === (values.customerName || '').trim().toLowerCase())
    const normalizedPaymentMethod = normalizePaymentMethodToDb(values.paymentMethod)

    setIsSavingForm(true)
    try {
      if (values.mode === 'edit' && editingItem) {
        const safeReceived = Math.min(Number(editingItem.amount_received || 0), parsedAmount)
        const { error } = await supabase
          .from('receivables')
          .update({
            description: values.description.trim(),
            customer_name: values.customerName?.trim() || null,
            customer_id: customerMatch?.id || null,
            amount: parsedAmount,
            amount_received: safeReceived,
            due_date: values.dueDate,
            payment_method: normalizedPaymentMethod,
            installment_number: Math.min(editingItem.installment_number || 1, totalInstallments),
            total_installments: totalInstallments,
            category_id: values.categoryId || null,
            notes: values.notes?.trim() || null,
          })
          .eq('id', editingItem.id)

        if (error) throw error
        toast.success('Conta a receber atualizada com sucesso.')
      } else {
        const basePayload = {
          description: values.description.trim(),
          customer_name: values.customerName?.trim() || null,
          customer_id: customerMatch?.id || null,
          payment_method: normalizedPaymentMethod,
          category_id: values.categoryId || null,
          notes: values.notes?.trim() || null,
          status: 'pending',
        }

        if (totalInstallments === 1) {
          const { error } = await supabase
            .from('receivables')
            .insert({
              ...basePayload,
              amount: parsedAmount,
              amount_received: 0,
              due_date: values.dueDate,
              installment_number: 1,
              total_installments: 1,
            })
          if (error) throw error
        } else {
          const amountPerInstallment = Number((parsedAmount / totalInstallments).toFixed(2))
          const amountLast = Number((parsedAmount - amountPerInstallment * (totalInstallments - 1)).toFixed(2))

          const installmentRows = Array.from({ length: totalInstallments }, (_, index) => {
            const installment = index + 1
            return {
              ...basePayload,
              description: `${values.description.trim()} - Parcela ${installment}/${totalInstallments}`,
              amount: installment === totalInstallments ? amountLast : amountPerInstallment,
              amount_received: 0,
              due_date: addMonthsToIsoDate(values.dueDate, index),
              installment_number: installment,
              total_installments: totalInstallments,
            }
          })

          const { error } = await supabase.from('receivables').insert(installmentRows)
          if (error) throw error
        }

        toast.success('Conta a receber criada com sucesso.')
      }

      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] })
      setShowCreateModal(false)
      setEditingItem(null)
    } catch (error: any) {
      toast.error(`Erro ao salvar conta a receber: ${error.message || 'tente novamente.'}`)
    } finally {
      setIsSavingForm(false)
    }
  })

  const handleSettle = settleForm.handleSubmit(async (values) => {
    if (!supabase || !settleItem) return

    const parsedReceived = parseCurrencyInput(values.receivedAmount)
    const remaining = Math.max(Number(settleItem.amount) - Number(settleItem.amount_received), 0)
    if (!Number.isFinite(parsedReceived) || parsedReceived <= 0) {
      settleForm.setError('receivedAmount', { message: 'Informe um valor maior que zero.' })
      return
    }

    if (parsedReceived > remaining) {
      settleForm.setError('receivedAmount', { message: 'O valor não pode ser maior que o saldo restante.' })
      return
    }

    setIsSettling(true)
    try {
      const { data: receivableRaw, error: receivableError } = await supabase
        .from('receivables')
        .select('id, amount, amount_received, category_id, notes')
        .eq('id', settleItem.id)
        .single()

      if (receivableError) throw receivableError

      const { data: accountRaw, error: accountError } = await supabase
        .from('financial_accounts')
        .select('id, balance')
        .eq('id', values.accountId)
        .single()

      if (accountError) throw accountError

      const currentReceived = Number(receivableRaw.amount_received || 0)
      const currentAmount = Number(receivableRaw.amount || 0)
      const nextReceived = Number((currentReceived + parsedReceived).toFixed(2))
      const paymentMethod = normalizePaymentMethodToDb(values.paymentMethod)

      const mergedNotes = [
        receivableRaw.notes || '',
        values.notes?.trim() || '',
      ]
        .filter(Boolean)
        .join('\n')

      const { error: receivableUpdateError } = await supabase
        .from('receivables')
        .update({
          amount_received: nextReceived,
          received_date: values.receivedDate,
          payment_method: paymentMethod,
          account_id: values.accountId,
          notes: mergedNotes || null,
          status: nextReceived >= currentAmount ? 'received' : 'partial',
        })
        .eq('id', settleItem.id)

      if (receivableUpdateError) throw receivableUpdateError

      const { error: cashFlowError } = await supabase.from('cash_flow_entries').insert({
        date: values.receivedDate,
        description: `Recebimento - ${settleItem.description}`,
        amount: parsedReceived,
        type: 'in',
        account_id: values.accountId,
        category_id: receivableRaw.category_id || null,
        receivable_id: settleItem.id,
      })

      if (cashFlowError) throw cashFlowError

      const nextBalance = Number((Number(accountRaw.balance || 0) + parsedReceived).toFixed(2))
      const { error: balanceError } = await supabase
        .from('financial_accounts')
        .update({ balance: nextBalance })
        .eq('id', values.accountId)

      if (balanceError) throw balanceError

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['receivables-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['financial-accounts-active'] }),
      ])

      setSettleItem(null)
      toast.success('Baixa registrada com sucesso.')
    } catch (error: any) {
      toast.error(`Erro ao registrar baixa: ${error.message || 'tente novamente.'}`)
    } finally {
      setIsSettling(false)
    }
  })

  const summary = useMemo(() => {
    const totalPending = filteredAndSorted
      .filter((item) => item.status_display === 'pending' || item.status_display === 'partial')
      .reduce((acc, item) => acc + Number(item.amount - item.amount_received), 0)

    const currentMonth = new Date().toISOString().slice(0, 7)
    const totalReceivedInMonth = filteredAndSorted
      .filter((item) => item.status_display === 'received' && item.due_date.slice(0, 7) === currentMonth)
      .reduce((acc, item) => acc + Number(item.amount_received || item.amount), 0)

    const overdue = filteredAndSorted
      .filter((item) => item.status_display === 'overdue')
      .reduce((acc, item) => acc + Number(item.amount - item.amount_received), 0)

    const dueToday = filteredAndSorted
      .filter((item) => item.due_date === todayIso && (item.status_display === 'pending' || item.status_display === 'partial'))
      .reduce((acc, item) => acc + Number(item.amount - item.amount_received), 0)

    return { totalPending, totalReceivedInMonth, overdue, dueToday }
  }, [filteredAndSorted, todayIso])

  return (
    <div className="receivables-page">
      <section className="summary-grid">
        <article className="summary-card open">
          <div className="summary-label"><Clock3 size={16} /> Total a Receber</div>
          <strong>{money.format(summary.totalPending)}</strong>
        </article>

        <article className="summary-card received">
          <div className="summary-label"><CircleDollarSign size={16} /> Recebido no Mês</div>
          <strong>{money.format(summary.totalReceivedInMonth)}</strong>
        </article>

        <article className="summary-card overdue">
          <div className="summary-label"><TriangleAlert size={16} /> Vencido</div>
          <strong>{money.format(summary.overdue)}</strong>
        </article>

        <article className="summary-card due-today">
          <div className="summary-label"><Clock3 size={16} /> A vencer hoje</div>
          <strong>{money.format(summary.dueToday)}</strong>
        </article>
      </section>

      <section className="page-card">
        <div className="page-header-row">
          <div>
            <h3>Contas a Receber</h3>
            <p>Gestão de títulos e parcelas de clientes</p>
          </div>
          <div className="header-actions">
            <button className="accent-btn" type="button" onClick={openCreateModal}>
            <PlusCircle size={16} /> Novo Recebível
            </button>

          </div>
        </div>

        <div className="receivable-filters">
          <label className="search-box">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por descrição, cliente ou venda"
            />
          </label>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="partial">Parcial</option>
            <option value="received">Recebido</option>
            <option value="overdue">Vencido</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="all">Forma de Pagamento</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>

          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />

          <button type="button" className="ghost-btn" onClick={resetFilters}>Limpar filtros</button>
        </div>

        {isLoading ? (
          <div className="skeleton-wrap">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="skeleton-row" />
            ))}
          </div>
        ) : isError ? (
          <p className="feedback error">Erro ao carregar: {(error as Error).message}</p>
        ) : filteredAndSorted.length === 0 ? (
          <p className="muted">Nenhum registro encontrado para os filtros informados.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><button className="sort-btn" onClick={() => toggleSort('description')}>Descrição</button></th>
                  <th><button className="sort-btn" onClick={() => toggleSort('customer_name')}>Cliente</button></th>
                  <th><button className="sort-btn" onClick={() => toggleSort('amount')}>Valor</button></th>
                  <th><button className="sort-btn" onClick={() => toggleSort('due_date')}>Vencimento</button></th>
                  <th><button className="sort-btn" onClick={() => toggleSort('status_display')}>Status</button></th>
                  <th><button className="sort-btn" onClick={() => toggleSort('payment_method')}>Forma Pagto</button></th>
                  <th>Parcela</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const remaining = Number(item.amount) - Number(item.amount_received)
                  const statusClass = item.status_display === 'overdue' ? 'status-overdue' : item.status_display === 'received' ? 'status-received' : 'status-pending'

                  return (
                    <tr key={item.id}>
                      <td data-label="Descrição">
                        <div className="cell-title">{item.description}</div>
                        {item.sale_id && <small className="muted">Venda: {item.sale_id.slice(0, 8)}</small>}
                      </td>
                      <td data-label="Cliente">{item.customer_name || '-'}</td>
                      <td data-label="Valor">{money.format(item.amount)}</td>
                      <td data-label="Vencimento">{new Date(`${item.due_date}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                      <td data-label="Status">
                        <span className={`status-pill ${statusClass}`}>
                          {item.status_display}
                        </span>
                      </td>
                      <td data-label="Forma Pagto">{item.payment_method || '-'}</td>
                      <td data-label="Parcela">
                        {(item.installment_number && item.total_installments)
                          ? `${item.installment_number}/${item.total_installments}`
                          : '-'}
                      </td>
                      <td data-label="Ações" className="actions-cell">
                        <div className="row-actions">
                          <button className="icon-btn success" title="Baixar" onClick={() => openSettleModal(item)}>
                            <Check size={15} />
                          </button>
                          <button className="icon-btn edit" title="Editar" onClick={() => openEditModal(item)}>
                            <Pencil size={15} />
                          </button>
                          <button className="icon-btn danger" title="Excluir" onClick={() => handleDelete(item.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <small className="muted">Saldo: {money.format(Math.max(remaining, 0))}</small>
                        <div className="mobile-actions-row">
                          <button className="icon-btn success" title="Baixar" onClick={() => openSettleModal(item)}>
                            <Check size={18} />
                          </button>
                          <button className="icon-btn edit" title="Editar" onClick={() => openEditModal(item)}>
                            <Pencil size={18} />
                          </button>
                          <button className="icon-btn danger" title="Excluir" onClick={() => handleDelete(item.id)}>
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredAndSorted.length > 0 && (
          <div className="pagination-row">
            <button className="ghost-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
              Anterior
            </button>
            <span>Página {Math.min(page, totalPages)} de {totalPages}</span>
            <button className="ghost-btn" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
              Próxima
            </button>
          </div>
        )}
      </section>

      {showCreateModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={handleCreateOrEdit}>
            <h3>{editingItem ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</h3>

            <label>
              Descrição*
              <input {...createForm.register('description')} />
              {createForm.formState.errors.description && <small className="feedback error">{createForm.formState.errors.description.message}</small>}
            </label>

            <label>
              Cliente
              <input list="receivables-customers" {...createForm.register('customerName')} placeholder="Digite para buscar cliente" />
              <datalist id="receivables-customers">
                {customerSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>

            <div className="modal-grid two-columns">
              <label>
                Valor Total*
                <input
                  {...createForm.register('totalAmount')}
                  inputMode="numeric"
                  onChange={(event) => createForm.setValue('totalAmount', formatCurrencyInput(event.target.value), { shouldValidate: true })}
                />
                {createForm.formState.errors.totalAmount && <small className="feedback error">{createForm.formState.errors.totalAmount.message}</small>}
              </label>

              <label>
                Forma de Pagamento*
                <select {...createForm.register('paymentMethod')}>
                  {receivablePaymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {createForm.formState.errors.paymentMethod && <small className="feedback error">{createForm.formState.errors.paymentMethod.message}</small>}
              </label>
            </div>

            <div className="modal-grid two-columns">
              <label>
                Data de Vencimento*
                <input type="date" {...createForm.register('dueDate')} />
                {createForm.formState.errors.dueDate && <small className="feedback error">{createForm.formState.errors.dueDate.message}</small>}
              </label>

              <label>
                Categoria
                <select {...createForm.register('categoryId')}>
                  <option value="">Selecione...</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.code} - {category.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="modal-toggle-row">
              <label className="toggle-check">
                <input type="checkbox" {...createForm.register('isInstallment')} />
                É parcelado?
              </label>

              {watchedInstallmentToggle && (
                <label>
                  Número de parcelas
                  <input type="number" min={1} max={24} {...createForm.register('installments', { valueAsNumber: true })} />
                </label>
              )}
            </div>

            {watchedInstallmentToggle && installmentPreview.length > 0 && (
              <div className="installment-preview">
                <strong>Preview de vencimentos</strong>
                <ul>
                  {installmentPreview.map((date, index) => (
                    <li key={`${date}-${index}`}>Parcela {index + 1}: {new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')}</li>
                  ))}
                </ul>
              </div>
            )}

            <label>
              Observações
              <textarea rows={3} {...createForm.register('notes')} />
            </label>

            <input type="hidden" {...createForm.register('mode')} />

            <div className="modal-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingItem(null)
                }}
                disabled={isSavingForm}
              >
                Cancelar
              </button>
              <button type="submit" className="accent-btn" disabled={isSavingForm}>
                {isSavingForm ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Salvar Recebível'}
              </button>
            </div>
          </form>
        </div>
      )}

      {settleItem && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={handleSettle}>
            <h3>Dar Baixa</h3>
            <p className="muted">{settleItem.description}</p>

            <div className="modal-grid two-columns">
              <label>
                Valor Recebido*
                <input
                  {...settleForm.register('receivedAmount')}
                  inputMode="numeric"
                  onChange={(event) => settleForm.setValue('receivedAmount', formatCurrencyInput(event.target.value), { shouldValidate: true })}
                />
                {settleForm.formState.errors.receivedAmount && <small className="feedback error">{settleForm.formState.errors.receivedAmount.message}</small>}
              </label>

              <label>
                Data do Recebimento*
                <input type="date" {...settleForm.register('receivedDate')} />
                {settleForm.formState.errors.receivedDate && <small className="feedback error">{settleForm.formState.errors.receivedDate.message}</small>}
              </label>
            </div>

            <div className="modal-grid two-columns">
              <label>
                Conta Bancária*
                <select {...settleForm.register('accountId')}>
                  <option value="">Selecione...</option>
                  {financialAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
                {settleForm.formState.errors.accountId && <small className="feedback error">{settleForm.formState.errors.accountId.message}</small>}
              </label>

              <label>
                Forma de Pagamento confirmada*
                <select {...settleForm.register('paymentMethod')}>
                  {receivablePaymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {settleForm.formState.errors.paymentMethod && <small className="feedback error">{settleForm.formState.errors.paymentMethod.message}</small>}
              </label>
            </div>

            <label>
              Observações
              <textarea rows={3} {...settleForm.register('notes')} />
            </label>

            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setSettleItem(null)} disabled={isSettling}>Cancelar</button>
              <button type="submit" className="accent-btn" disabled={isSettling}>{isSettling ? 'Processando...' : 'Confirmar Baixa'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
