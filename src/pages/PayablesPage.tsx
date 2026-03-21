import { useEffect, useMemo, useState } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { zodResolver } from '@hookform/resolvers/zod'

import { useForm } from 'react-hook-form'

import { CircleDollarSign, Clock3, Copy, Pencil, PlusCircle, Search, TriangleAlert, Trash2, X } from 'lucide-react'

import { toast } from 'react-hot-toast'

import { z } from 'zod'

import { supabase } from '../lib/supabase'

import type { PayableSummary } from '../types/finance'



const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })



type SortField = 'description' | 'supplier_name' | 'amount' | 'due_date' | 'status_display' | 'category_name' | 'cost_center_name'

type SortDirection = 'asc' | 'desc'



type RecurrenceFrequency = 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly'



type ExpenseCategory = {

  id: string

  name: string

  code: string

}



type CostCenter = {

  id: string

  name: string

}



type FinancialAccount = {

  id: string

  name: string

  balance: number

}



type SupplierOption = {

  name: string

}



type StockOrderImportItem = {

  id: string

  sourceTable: 'purchase_orders' | 'shopping_lists'

  date: string

  supplierName: string

  productsSummary: string

  totalAmount: number

  status: string

}



const PAGE_SIZE = 20

const MAX_RECURRENT_INSTALLMENTS = 120

const OPEN_ENDED_RECURRENT_INSTALLMENTS = 12

const todayIso = new Date().toISOString().slice(0, 10)

const DEFAULT_IMPORT_DUE_DAYS = 30



const recurrenceFrequencyOptions: Array<{ value: RecurrenceFrequency; label: string }> = [

  { value: 'weekly', label: 'Semanal' },

  { value: 'monthly', label: 'Mensal' },

  { value: 'bimonthly', label: 'Bimestral' },

  { value: 'quarterly', label: 'Trimestral' },

  { value: 'semiannual', label: 'Semestral' },

  { value: 'yearly', label: 'Anual' },

]



const payableFormSchema = z

  .object({

    mode: z.enum(['create', 'edit']),

    description: z.string().trim().min(1, 'Descrição é obrigatória.'),

    supplierName: z.string().optional(),

    amount: z.string().min(1, 'Valor é obrigatório.'),

    dueDate: z.string().min(1, 'Data de vencimento é obrigatória.'),

    categoryId: z.string().min(1, 'Categoria é obrigatória.'),

    costCenterId: z.string().optional(),

    paymentAccountId: z.string().optional(),

    notes: z.string().optional(),

    nfeNumber: z.string().optional(),

    nfeSerie: z.string().optional(),

    nfeEmissionDate: z.string().optional(),

    nfeAccessKey: z.string().optional(),

    nfeIssuerCnpj: z.string().optional(),

    nfeTotalValue: z.string().optional(),

    isRecurring: z.boolean(),

    recurrenceFrequency: z.enum(['weekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly']).optional(),

    recurrenceStartDate: z.string().optional(),

    recurrenceEndDate: z.string().optional(),

  })

  .superRefine((values, ctx) => {

    const parsedAmount = parseCurrencyInput(values.amount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {

      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Informe um valor maior que zero.' })

    }



    if (values.mode === 'create' && values.dueDate < todayIso) {

      ctx.addIssue({

        code: z.ZodIssueCode.custom,

        path: ['dueDate'],

        message: 'A data de vencimento não pode ser no passado para novos registros.',

      })

    }



    if (values.isRecurring) {

      if (!values.recurrenceFrequency) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          path: ['recurrenceFrequency'],

          message: 'Selecione a frequ�ncia da recorr�ncia.',

        })

      }



      if (!values.recurrenceStartDate) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          path: ['recurrenceStartDate'],

          message: 'Data de início é obrigatória para despesa recorrente.',

        })

      }



      if (values.recurrenceStartDate && values.mode === 'create' && values.recurrenceStartDate < todayIso) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          path: ['recurrenceStartDate'],

          message: 'A data de in�cio n�o pode ser no passado para novos registros.',

        })

      }



      if (values.recurrenceEndDate && values.recurrenceStartDate && values.recurrenceEndDate < values.recurrenceStartDate) {

        ctx.addIssue({

          code: z.ZodIssueCode.custom,

          path: ['recurrenceEndDate'],

          message: 'A data de t�rmino deve ser igual ou posterior à data de in�cio.',

        })

      }

    }

  })



const paymentFormSchema = z.object({

  paidAmount: z.string().min(1, 'Valor pago é obrigatório.'),

  paidDate: z.string().min(1, 'Data do pagamento é obrigatória.'),

  accountId: z.string().min(1, 'Conta bancária é obrigatória.'),

  receiptReference: z.string().optional(),

  notes: z.string().optional(),

})



type PayableFormValues = z.infer<typeof payableFormSchema>

type PaymentFormValues = z.infer<typeof paymentFormSchema>



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



function addFrequency(dateIso: string, frequency: RecurrenceFrequency): string {

  const baseDate = new Date(`${dateIso}T00:00:00`)



  if (frequency === 'weekly') {

    baseDate.setDate(baseDate.getDate() + 7)

  }



  if (frequency === 'monthly') {

    baseDate.setMonth(baseDate.getMonth() + 1)

  }



  if (frequency === 'bimonthly') {

    baseDate.setMonth(baseDate.getMonth() + 2)

  }



  if (frequency === 'quarterly') {

    baseDate.setMonth(baseDate.getMonth() + 3)

  }



  if (frequency === 'semiannual') {

    baseDate.setMonth(baseDate.getMonth() + 6)

  }



  if (frequency === 'yearly') {

    baseDate.setFullYear(baseDate.getFullYear() + 1)

  }



  return baseDate.toISOString().slice(0, 10)

}



function buildRecurrenceDates(startDate: string, frequency: RecurrenceFrequency, endDate?: string): string[] {

  if (!startDate || !frequency) return []



  const generated: string[] = []

  let current = startDate



  while (generated.length < MAX_RECURRENT_INSTALLMENTS) {

    if (endDate && current > endDate) {

      break

    }



    generated.push(current)



    if (!endDate && generated.length >= OPEN_ENDED_RECURRENT_INSTALLMENTS) {

      break

    }



    current = addFrequency(current, frequency)

  }



  return generated

}



function addDays(dateIso: string, days: number): string {

  const baseDate = new Date(`${dateIso}T00:00:00`)

  baseDate.setDate(baseDate.getDate() + days)

  return baseDate.toISOString().slice(0, 10)

}



function looksLikeMissingTable(error: any) {

  const message = String(error?.message || '').toLowerCase()

  return error?.code === '42P01' || message.includes('does not exist') || message.includes('not found')

}



export function PayablesPage() {

  const queryClient = useQueryClient()



  const [showFormModal, setShowFormModal] = useState(false)

  const [editingItem, setEditingItem] = useState<PayableSummary | null>(null)

  const [payingItem, setPayingItem] = useState<PayableSummary | null>(null)

  const [isSavingForm, setIsSavingForm] = useState(false)

  const [isProcessingPayment, setIsProcessingPayment] = useState(false)



  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'>('all')

  const [categoryFilter, setCategoryFilter] = useState('all')

  const [costCenterFilter, setCostCenterFilter] = useState('all')

  const [supplierFilter, setSupplierFilter] = useState('all')

  const [search, setSearch] = useState('')

  const [fromDate, setFromDate] = useState('')

  const [toDate, setToDate] = useState('')

  const [sortField, setSortField] = useState<SortField>('due_date')

  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const [groupByCategory, setGroupByCategory] = useState(false)

  const [page, setPage] = useState(1)



  const [showImportDrawer, setShowImportDrawer] = useState(false)

  const [selectedStockOrderIds, setSelectedStockOrderIds] = useState<string[]>([])

  const [stockFromDate, setStockFromDate] = useState('')

  const [stockToDate, setStockToDate] = useState('')

  const [stockSupplierFilter, setStockSupplierFilter] = useState('all')

  const [stockStatusFilter, setStockStatusFilter] = useState('all')

  const [isImportingFromStock, setIsImportingFromStock] = useState(false)

  const [importDueMode, setImportDueMode] = useState<'default' | 'custom'>('default')

  const [importDefaultDays, setImportDefaultDays] = useState(DEFAULT_IMPORT_DUE_DAYS)

  const [importCustomDueDate, setImportCustomDueDate] = useState('')



  const { data: items = [], isLoading, isError, error } = useQuery({

    queryKey: ['payables-summary'],

    queryFn: async () => {

      if (!supabase) return []



      const { data: viewRows, error: viewError } = await supabase

        .from('vw_payables_summary')

        .select('*')

        .order('due_date', { ascending: true })



      if (viewError) throw viewError



      const ids = (viewRows || []).map((row: any) => row.id)

      if (ids.length === 0) return []



      const { data: paidRows, error: paidRowsError } = await supabase

        .from('payables')

        .select('id, paid_date, purchase_order_id')

        .in('id', ids)



      if (paidRowsError) throw paidRowsError

      const paidById = new Map((paidRows || []).map((row: any) => [row.id, row]))



      return (viewRows || []).map((row: any) => ({

        ...row,

        paid_date: paidById.get(row.id)?.paid_date || null,

        purchase_order_id: paidById.get(row.id)?.purchase_order_id || null,

      })) as PayableSummary[]

    },

    staleTime: 1000 * 30,

  })



  const { data: categories = [] } = useQuery({

    queryKey: ['payables-expense-categories'],

    queryFn: async () => {

      if (!supabase) return []

      const { data, error } = await supabase

        .from('chart_of_accounts')

        .select('id, name, code')

        .eq('type', 'expense')

        .eq('active', true)

        .order('name', { ascending: true })



      if (error) throw error

      return (data || []) as ExpenseCategory[]

    },

    staleTime: 1000 * 60,

  })



  const { data: costCenters = [] } = useQuery({

    queryKey: ['payables-cost-centers'],

    queryFn: async () => {

      if (!supabase) return []

      const { data, error } = await supabase

        .from('cost_centers')

        .select('id, name')

        .eq('active', true)

        .order('name', { ascending: true })



      if (error) throw error

      return (data || []) as CostCenter[]

    },

    staleTime: 1000 * 60,

  })



  const { data: accounts = [] } = useQuery({

    queryKey: ['payables-accounts'],

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



  const { data: supplierRows = [] } = useQuery({

    queryKey: ['payables-suppliers'],

    queryFn: async () => {

      if (!supabase) return []

      const { data, error } = await supabase

        .from('suppliers')

        .select('name')

        .order('name', { ascending: true })

        .limit(300)



      if (error) {

        if ((error.message || '').toLowerCase().includes('does not exist')) {

          return []

        }

        throw error

      }



      return (data || []) as SupplierOption[]

    },

    staleTime: 1000 * 60,

  })



  const { data: stockOrders = [], isLoading: isLoadingStockOrders } = useQuery({

    queryKey: ['stock-orders-for-payables-import'],

    queryFn: async () => {

      if (!supabase) return []

      const client = supabase



      const { data: importedRows, error: importedRowsError } = await client

        .from('payables')

        .select('purchase_order_id')

        .not('purchase_order_id', 'is', null)



      if (importedRowsError) throw importedRowsError

      const importedIds = new Set((importedRows || []).map((row: any) => row.purchase_order_id).filter(Boolean))



      const tryPurchaseOrders = async (): Promise<StockOrderImportItem[]> => {

        const { data: orders, error } = await client

          .from('purchase_orders')

          .select('id, created_at, order_date, supplier_name, total_amount, total, status')

          .order('created_at', { ascending: false })

          .limit(500)



        if (error) throw error



        const ids = (orders || []).map((row: any) => row.id)

        let itemMap = new Map<string, string[]>()

        if (ids.length > 0) {

          const { data: orderItems, error: orderItemsError } = await client

            .from('purchase_order_items')

            .select('purchase_order_id, product_name')

            .in('purchase_order_id', ids)



          if (!orderItemsError) {

            for (const row of orderItems || []) {

              const list = itemMap.get((row as any).purchase_order_id) || []

              if ((row as any).product_name) list.push((row as any).product_name)

              itemMap.set((row as any).purchase_order_id, list)

            }

          }

        }



        return (orders || [])

          .filter((row: any) => !importedIds.has(row.id))

          .map((row: any) => ({

            id: row.id,

            sourceTable: 'purchase_orders' as const,

            date: row.order_date || row.created_at?.slice(0, 10) || todayIso,

            supplierName: row.supplier_name || 'Sem fornecedor',

            productsSummary: (itemMap.get(row.id) || []).slice(0, 3).join(', ') || 'Produtos n�o informados',

            totalAmount: Number(row.total_amount ?? row.total ?? 0),

            status: row.status || 'pending',

          }))

      }



      const tryShoppingLists = async (): Promise<StockOrderImportItem[]> => {

        const { data: lists, error: listsError } = await client

          .from('shopping_lists')

          .select('id, created_at, requester_name, status')

          .order('created_at', { ascending: false })

          .limit(500)



        if (listsError) throw listsError



        const ids = (lists || []).map((row: any) => row.id)

        const { data: listItems, error: listItemsError } = await client

          .from('shopping_list_items')

          .select('list_id, product_name, quantity, is_bought')

          .in('list_id', ids)



        if (listItemsError) throw listItemsError



        const itemsMap = new Map<string, Array<{ product_name: string; quantity: string | number; is_bought: boolean }>>()

        for (const row of listItems || []) {

          const key = (row as any).list_id

          const list = itemsMap.get(key) || []

          list.push({

            product_name: (row as any).product_name || '',

            quantity: (row as any).quantity || 0,

            is_bought: Boolean((row as any).is_bought),

          })

          itemsMap.set(key, list)

        }



        return (lists || [])

          .filter((row: any) => !importedIds.has(row.id))

          .map((row: any) => {

            const listItemsForOrder = itemsMap.get(row.id) || []

            const productsSummary = listItemsForOrder.slice(0, 3).map((item) => item.product_name).filter(Boolean).join(', ')

            const totalAmount = 0

            return {

              id: row.id,

              sourceTable: 'shopping_lists' as const,

              date: row.created_at?.slice(0, 10) || todayIso,

              supplierName: row.requester_name || 'Sem fornecedor',

              productsSummary: productsSummary || 'Produtos n�o informados',

              totalAmount,

              status: row.status || 'pending',

            }

          })

      }



      try {

        return await tryPurchaseOrders()

      } catch (purchaseError: any) {

        if (!looksLikeMissingTable(purchaseError)) {

          throw purchaseError

        }

      }



      try {

        return await tryShoppingLists()

      } catch (shoppingError: any) {

        if (!looksLikeMissingTable(shoppingError)) {

          throw shoppingError

        }

      }



      return []

    },

    staleTime: 1000 * 30,

  })



  const payableForm = useForm<PayableFormValues>({

    resolver: zodResolver(payableFormSchema),

    defaultValues: {

      mode: 'create',

      description: '',

      supplierName: '',

      amount: '0,00',

      dueDate: todayIso,

      categoryId: '',

      costCenterId: '',

      paymentAccountId: '',

      notes: '',

      isRecurring: false,

      recurrenceFrequency: 'monthly',

      recurrenceStartDate: todayIso,

      recurrenceEndDate: '',

    },

  })



  const paymentForm = useForm<PaymentFormValues>({

    resolver: zodResolver(paymentFormSchema),

    defaultValues: {

      paidAmount: '0,00',

      paidDate: todayIso,

      accountId: '',

      receiptReference: '',

      notes: '',

    },

  })



  const watchedRecurring = payableForm.watch('isRecurring')

  const watchedRecurrenceFrequency = payableForm.watch('recurrenceFrequency')

  const watchedRecurrenceStart = payableForm.watch('recurrenceStartDate')

  const watchedRecurrenceEnd = payableForm.watch('recurrenceEndDate')



  const recurrencePreviewDates = useMemo(() => {

    if (!watchedRecurring || !watchedRecurrenceFrequency || !watchedRecurrenceStart) return []

    return buildRecurrenceDates(watchedRecurrenceStart, watchedRecurrenceFrequency, watchedRecurrenceEnd || undefined)

  }, [watchedRecurring, watchedRecurrenceFrequency, watchedRecurrenceStart, watchedRecurrenceEnd])



  const categoryOptions = useMemo(() => {

    const unique = new Set<string>()

    for (const item of items) {

      if (item.category_name) unique.add(item.category_name)

    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  }, [items])



  const costCenterOptions = useMemo(() => {

    const unique = new Set<string>()

    for (const item of items) {

      if (item.cost_center_name) unique.add(item.cost_center_name)

    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  }, [items])



  const supplierOptions = useMemo(() => {

    const unique = new Set<string>(supplierRows.map((row) => row.name).filter(Boolean))

    for (const item of items) {

      if (item.supplier_name) unique.add(item.supplier_name)

    }

    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  }, [items, supplierRows])



  const stockSupplierOptions = useMemo(() => {

    const set = new Set(stockOrders.map((item) => item.supplierName).filter(Boolean))

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  }, [stockOrders])



  const stockStatusOptions = useMemo(() => {

    const set = new Set(stockOrders.map((item) => item.status).filter(Boolean))

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  }, [stockOrders])



  const filteredStockOrders = useMemo(() => {

    return stockOrders.filter((item) => {

      const supplierMatch = stockSupplierFilter === 'all' || item.supplierName === stockSupplierFilter

      const statusMatch = stockStatusFilter === 'all' || item.status === stockStatusFilter

      const fromMatch = !stockFromDate || item.date >= stockFromDate

      const toMatch = !stockToDate || item.date <= stockToDate

      return supplierMatch && statusMatch && fromMatch && toMatch

    })

  }, [stockOrders, stockSupplierFilter, stockStatusFilter, stockFromDate, stockToDate])



  const selectedStockOrders = useMemo(() => {

    const selectedSet = new Set(selectedStockOrderIds)

    return filteredStockOrders.filter((item) => selectedSet.has(item.id))

  }, [filteredStockOrders, selectedStockOrderIds])



  const filteredAndSorted = useMemo(() => {

    const filtered = items.filter((item) => {

      const statusMatch = statusFilter === 'all' || item.status_display === statusFilter

      const categoryMatch = categoryFilter === 'all' || (item.category_name || '') === categoryFilter

      const centerMatch = costCenterFilter === 'all' || (item.cost_center_name || '') === costCenterFilter

      const supplierMatch = supplierFilter === 'all' || (item.supplier_name || '') === supplierFilter



      const searchMatch =

        !search.trim() ||

        item.description.toLowerCase().includes(search.toLowerCase()) ||

        (item.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||

        (item.category_name || '').toLowerCase().includes(search.toLowerCase()) ||

        (item.cost_center_name || '').toLowerCase().includes(search.toLowerCase())



      const dateMatchFrom = !fromDate || item.due_date >= fromDate

      const dateMatchTo = !toDate || item.due_date <= toDate



      return statusMatch && categoryMatch && centerMatch && supplierMatch && searchMatch && dateMatchFrom && dateMatchTo

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

  }, [items, statusFilter, categoryFilter, costCenterFilter, supplierFilter, search, fromDate, toDate, sortField, sortDirection])



  const overdueItems = useMemo(() => filteredAndSorted.filter((item) => item.status_display === 'overdue'), [filteredAndSorted])

  const overdueCount = overdueItems.length

  const overdueTotal = overdueItems.reduce((acc, item) => acc + Number(item.amount - item.amount_paid), 0)



  const summary = useMemo(() => {

    const totalPending = filteredAndSorted

      .filter((item) => item.status_display === 'pending' || item.status_display === 'partial')

      .reduce((acc, item) => acc + Number(item.amount - item.amount_paid), 0)



    const currentMonth = new Date().toISOString().slice(0, 7)

    const totalPaidInMonth = filteredAndSorted

      .filter((item) => item.status_display === 'paid' && (item.paid_date || '').slice(0, 7) === currentMonth)

      .reduce((acc, item) => acc + Number(item.amount_paid || item.amount), 0)



    const overdue = filteredAndSorted

      .filter((item) => item.status_display === 'overdue')

      .reduce((acc, item) => acc + Number(item.amount - item.amount_paid), 0)



    const next7Days = filteredAndSorted

      .filter((item) => {

        if (item.status_display === 'paid' || item.status_display === 'cancelled') return false

        const due = new Date(`${item.due_date}T00:00:00`)

        const today = new Date(`${todayIso}T00:00:00`)

        const limit = new Date(`${todayIso}T00:00:00`)

        limit.setDate(limit.getDate() + 7)

        return due >= today && due <= limit

      })

      .reduce((acc, item) => acc + Number(item.amount - item.amount_paid), 0)



    return { totalPending, totalPaidInMonth, overdue, next7Days }

  }, [filteredAndSorted])



  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE))



  const paginatedItems = useMemo(() => {

    const safePage = Math.min(page, totalPages)

    const start = (safePage - 1) * PAGE_SIZE

    return filteredAndSorted.slice(start, start + PAGE_SIZE)

  }, [filteredAndSorted, page, totalPages])



  const groupedItems = useMemo(() => {

    const groups = new Map<string, PayableSummary[]>()

    for (const item of paginatedItems) {

      const key = item.category_name || 'Sem categoria'

      const list = groups.get(key) || []

      list.push(item)

      groups.set(key, list)

    }

    return Array.from(groups.entries())

  }, [paginatedItems])



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

    setCategoryFilter('all')

    setCostCenterFilter('all')

    setSupplierFilter('all')

    setFromDate('')

    setToDate('')

    setPage(1)

  }



  const resetStockFilters = () => {

    setStockFromDate('')

    setStockToDate('')

    setStockSupplierFilter('all')

    setStockStatusFilter('all')

  }



  const toggleStockSelection = (id: string) => {

    setSelectedStockOrderIds((prev) =>

      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],

    )

  }



  const toggleSelectAllFilteredStockOrders = () => {

    const allFilteredIds = filteredStockOrders.map((item) => item.id)

    const selectedSet = new Set(selectedStockOrderIds)

    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedSet.has(id))



    if (allSelected) {

      setSelectedStockOrderIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)))

    } else {

      setSelectedStockOrderIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])))

    }

  }



  const updateStockOriginAsImported = async (order: StockOrderImportItem, payableId: string) => {

    if (!supabase) return



    if (order.sourceTable === 'purchase_orders') {

      const attempts = [

        { imported_to_finance: true, finance_imported_at: new Date().toISOString(), finance_payable_id: payableId },

        { imported_to_finance: true, finance_imported_at: new Date().toISOString() },

        { imported_to_finance: true },

      ]



      for (const payload of attempts) {

        const { error } = await supabase.from('purchase_orders').update(payload).eq('id', order.id)

        if (!error) return true

      }

      return false

    }



    const attempts = [

      { imported_to_finance: true, finance_imported_at: new Date().toISOString(), finance_payable_id: payableId },

      { imported_to_finance: true, finance_imported_at: new Date().toISOString() },

      { imported_to_finance: true },

    ]



    for (const payload of attempts) {

      const { error } = await supabase.from('shopping_lists').update(payload).eq('id', order.id)

      if (!error) return true

    }



    return false

  }



  const handleImportFromStock = async () => {

    if (!supabase) return

    if (selectedStockOrders.length === 0) {

      toast.error('Selecione pelo menos uma ordem de compra para importar.')

      return

    }



    if (importDueMode === 'custom' && !importCustomDueDate) {

      toast.error('Informe a data de vencimento para importação com data fixa.')

      return

    }



    setIsImportingFromStock(true)

    let successCount = 0

    let skippedCount = 0

    let markNotUpdatedCount = 0



    try {

      for (const order of selectedStockOrders) {

        if (Number(order.totalAmount) <= 0) {

          skippedCount += 1

          continue

        }



        const dueDate = importDueMode === 'custom'

          ? importCustomDueDate

          : addDays(order.date || todayIso, Math.max(0, importDefaultDays))



        const { data: inserted, error: insertError } = await supabase

          .from('payables')

          .insert({

            description: `Compra Estoque #${order.id.slice(0, 8)}`,

            supplier_name: order.supplierName || null,

            amount: Number(order.totalAmount),

            amount_paid: 0,

            due_date: dueDate,

            status: 'pending',

            purchase_order_id: order.id,

            notes: `Vindo do Estoque (${order.sourceTable})\nProdutos: ${order.productsSummary}`,

          })

          .select('id')

          .single()



        if (insertError) {

          skippedCount += 1

          continue

        }



        const marked = await updateStockOriginAsImported(order, inserted.id)

        if (!marked) markNotUpdatedCount += 1

        successCount += 1

      }



      await Promise.all([

        queryClient.invalidateQueries({ queryKey: ['payables-summary'] }),

        queryClient.invalidateQueries({ queryKey: ['stock-orders-for-payables-import'] }),

      ])



      setSelectedStockOrderIds([])



      if (successCount > 0) {

        toast.success(`Importação concluída: ${successCount} ordem(ns) importada(s).`)

      }

      if (skippedCount > 0) {

        toast.error(`${skippedCount} ordem(ns) não foram importadas (sem valor total ou erro de gravação).`)

      }

      if (markNotUpdatedCount > 0) {

        toast.error(`${markNotUpdatedCount} ordem(ns) importada(s) sem flag de origem atualizada no estoque (ajuste de schema pode ser necessário).`)

      }

      if (successCount === 0 && skippedCount === 0) {

        toast.error('Nenhuma ordem foi importada.')

      }

    } finally {

      setIsImportingFromStock(false)

    }

  }



  // Auto-sync silencioso: ordens de compra n�o importadas �?? payables

  useEffect(() => {

    const autoSync = async () => {

      if (!supabase) return

      const { data: orders } = await supabase

        .from('purchase_orders')

        .select('id, supplier_name, total_amount, total, order_date, created_at')

        .order('created_at', { ascending: false })

        .limit(200)



      const { data: existing } = await supabase

        .from('payables')

        .select('purchase_order_id')

        .not('purchase_order_id', 'is', null)



      const importedIds = new Set((existing ?? []).map((r: any) => r.purchase_order_id))



      for (const order of orders ?? []) {

        if (importedIds.has(order.id)) continue

        const total = Number(order.total_amount ?? order.total ?? 0)

        if (total <= 0) continue

        await supabase.from('payables').insert({

          description: `Compra Estoque #${order.id.slice(0, 8)}`,

          supplier_name: order.supplier_name ?? null,

          amount: total,

          amount_paid: 0,

          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),

          status: 'pending',

          purchase_order_id: order.id,

          notes: 'Sincronizado automaticamente do Estoque',

        })

      }

      queryClient.invalidateQueries({ queryKey: ['payables-summary'] })

    }

    autoSync()

  }, [])



  const openCreateModal = () => {

    setEditingItem(null)

    payableForm.reset({

      mode: 'create',

      description: '',

      supplierName: '',

      amount: '0,00',

      dueDate: todayIso,

      categoryId: '',

      costCenterId: '',

      paymentAccountId: '',

      notes: '',

      isRecurring: false,

      recurrenceFrequency: 'monthly',

      recurrenceStartDate: todayIso,

      recurrenceEndDate: '',

    })

    setShowFormModal(true)

  }



  const openEditModal = async (item: PayableSummary) => {

    if (!supabase) return



    const { data, error } = await supabase

      .from('payables')

      .select('description, supplier_name, amount, due_date, category_id, cost_center_id, account_id, notes, nfe_number, nfe_serie, nfe_emission_date, nfe_access_key, nfe_issuer_cnpj, nfe_total_value, recurrent, recurrence_period')

      .eq('id', item.id)

      .single()



    if (error) {

      toast.error(`Erro ao carregar conta para edi��o: ${error.message}`)

      return

    }



    setEditingItem(item)

    payableForm.reset({

      mode: 'edit',

      description: data.description || '',

      supplierName: data.supplier_name || '',

      amount: Number(data.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

      dueDate: data.due_date,

      categoryId: data.category_id || '',

      costCenterId: data.cost_center_id || '',

      paymentAccountId: data.account_id || '',

      notes: data.notes || '',

      nfeNumber: data.nfe_number || '',

      nfeSerie: data.nfe_serie || '',

      nfeEmissionDate: data.nfe_emission_date || '',

      nfeAccessKey: data.nfe_access_key || '',

      nfeIssuerCnpj: data.nfe_issuer_cnpj || '',

      nfeTotalValue: data.nfe_total_value ? String(data.nfe_total_value) : '',

      isRecurring: Boolean(data.recurrent),

      recurrenceFrequency: (data.recurrence_period || 'monthly') as RecurrenceFrequency,

      recurrenceStartDate: data.due_date,

      recurrenceEndDate: '',

    })

    setShowFormModal(true)

  }



  const openPaymentModal = (item: PayableSummary) => {

    const remaining = Math.max(Number(item.amount) - Number(item.amount_paid), 0)

    setPayingItem(item)

    paymentForm.reset({

      paidAmount: remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),

      paidDate: todayIso,

      accountId: '',

      receiptReference: '',

      notes: '',

    })

  }



  const handleSubmitPayableForm = payableForm.handleSubmit(async (values) => {

    if (!supabase) return



    const parsedAmount = parseCurrencyInput(values.amount)

    const recurrenceFrequency = values.recurrenceFrequency as RecurrenceFrequency | undefined

    const recurrenceDates = values.isRecurring && recurrenceFrequency && values.recurrenceStartDate

      ? buildRecurrenceDates(values.recurrenceStartDate, recurrenceFrequency, values.recurrenceEndDate || undefined)

      : []



    if (values.isRecurring && recurrenceDates.length === 0) {

      toast.error('N�o foi poss�vel gerar as parcelas da recorr�ncia com os dados informados.')

      return

    }



    setIsSavingForm(true)

    try {

      if (values.mode === 'edit' && editingItem) {

        const { data: current, error: currentError } = await supabase

          .from('payables')

          .select('amount_paid')

          .eq('id', editingItem.id)

          .single()



        if (currentError) throw currentError

        const safePaid = Math.min(Number(current.amount_paid || 0), parsedAmount)



        const { error } = await supabase

          .from('payables')

          .update({

            description: values.description.trim(),

            supplier_name: values.supplierName?.trim() || null,

            amount: parsedAmount,

            amount_paid: safePaid,

            due_date: values.dueDate,

            category_id: values.categoryId,

            cost_center_id: values.costCenterId || null,

            account_id: values.paymentAccountId || null,

            notes: values.notes?.trim() || null,

            nfe_number: values.nfeNumber?.trim() || null,

            nfe_serie: values.nfeSerie?.trim() || null,

            nfe_emission_date: values.nfeEmissionDate || null,

            nfe_access_key: values.nfeAccessKey?.trim() || null,

            nfe_issuer_cnpj: values.nfeIssuerCnpj?.trim() || null,

            nfe_total_value: values.nfeTotalValue ? parseCurrencyInput(values.nfeTotalValue) : null,

            recurrent: Boolean(values.isRecurring),

            recurrence_period: values.isRecurring ? recurrenceFrequency : null,

          })

          .eq('id', editingItem.id)



        if (error) throw error

        toast.success('Conta a pagar atualizada com sucesso.')

      } else {

        if (values.isRecurring && recurrenceFrequency) {

          const rows = recurrenceDates.map((date, index) => ({

            description: values.description.trim(),

            supplier_name: values.supplierName?.trim() || null,

            amount: parsedAmount,

            amount_paid: 0,

            due_date: date,

            category_id: values.categoryId,

            cost_center_id: values.costCenterId || null,

            account_id: values.paymentAccountId || null,

            status: 'pending',

            recurrent: true,

            recurrence_period: recurrenceFrequency,

            notes: [

              values.notes?.trim() || '',

              `Recorr�ncia ${index + 1}/${recurrenceDates.length}`,

            ].filter(Boolean).join('\n'),

          }))



          const { error } = await supabase.from('payables').insert(rows)

          if (error) throw error

          toast.success(`Despesa recorrente criada com ${rows.length} parcela(s).`)

        } else {

          const { error } = await supabase

            .from('payables')

            .insert({

              description: values.description.trim(),

              supplier_name: values.supplierName?.trim() || null,

              amount: parsedAmount,

              amount_paid: 0,

              due_date: values.dueDate,

              category_id: values.categoryId,

              cost_center_id: values.costCenterId || null,

              account_id: values.paymentAccountId || null,

              notes: values.notes?.trim() || null,

              nfe_number: values.nfeNumber?.trim() || null,

              nfe_serie: values.nfeSerie?.trim() || null,

              nfe_emission_date: values.nfeEmissionDate || null,

              nfe_access_key: values.nfeAccessKey?.trim() || null,

              nfe_issuer_cnpj: values.nfeIssuerCnpj?.trim() || null,

              nfe_total_value: values.nfeTotalValue ? parseCurrencyInput(values.nfeTotalValue) : null,

              status: 'pending',

              recurrent: false,

              recurrence_period: null,

            })



          if (error) throw error

          toast.success('Conta a pagar criada com sucesso.')

        }

      }



      setShowFormModal(false)

      setEditingItem(null)

      await queryClient.invalidateQueries({ queryKey: ['payables-summary'] })

    } catch (error: any) {

      toast.error(`Erro ao salvar conta a pagar: ${error.message || 'tente novamente.'}`)

    } finally {

      setIsSavingForm(false)

    }

  })



  const handleSubmitPayment = paymentForm.handleSubmit(async (values) => {

    if (!supabase || !payingItem) return



    const parsedAmount = parseCurrencyInput(values.paidAmount)

    const remaining = Math.max(Number(payingItem.amount) - Number(payingItem.amount_paid), 0)



    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {

      paymentForm.setError('paidAmount', { message: 'Informe um valor maior que zero.' })

      return

    }



    if (parsedAmount > remaining) {

      paymentForm.setError('paidAmount', { message: 'O valor n�o pode ser maior que o saldo restante.' })

      return

    }



    setIsProcessingPayment(true)

    try {

      const [{ data: payableRaw, error: payableError }, { data: accountRaw, error: accountError }] = await Promise.all([

        supabase

          .from('payables')

          .select('id, amount, amount_paid, category_id, notes')

          .eq('id', payingItem.id)

          .single(),

        supabase

          .from('financial_accounts')

          .select('id, balance')

          .eq('id', values.accountId)

          .single(),

      ])



      if (payableError) throw payableError

      if (accountError) throw accountError



      const currentPaid = Number(payableRaw.amount_paid || 0)

      const currentAmount = Number(payableRaw.amount || 0)

      const nextPaid = Number((currentPaid + parsedAmount).toFixed(2))



      const mergedNotes = [

        payableRaw.notes || '',

        values.notes?.trim() || '',

        values.receiptReference?.trim() ? `Comprovante: ${values.receiptReference.trim()}` : '',

      ]

        .filter(Boolean)

        .join('\n')



      const { error: payableUpdateError } = await supabase

        .from('payables')

        .update({

          amount_paid: nextPaid,

          paid_date: values.paidDate,

          account_id: values.accountId,

          notes: mergedNotes || null,

          status: nextPaid >= currentAmount ? 'paid' : 'partial',

        })

        .eq('id', payingItem.id)



      if (payableUpdateError) throw payableUpdateError



      const cashDescription = values.receiptReference?.trim()

        ? `Pagamento - ${payingItem.description} (Ref: ${values.receiptReference.trim()})`

        : `Pagamento - ${payingItem.description}`



      const { error: cashFlowError } = await supabase

        .from('cash_flow_entries')

        .insert({

          date: values.paidDate,

          description: cashDescription,

          amount: parsedAmount,

          type: 'out',

          account_id: values.accountId,

          category_id: payableRaw.category_id || null,

          payable_id: payingItem.id,

        })



      if (cashFlowError) throw cashFlowError



      const nextBalance = Number((Number(accountRaw.balance || 0) - parsedAmount).toFixed(2))

      const { error: accountUpdateError } = await supabase

        .from('financial_accounts')

        .update({ balance: nextBalance })

        .eq('id', values.accountId)



      if (accountUpdateError) throw accountUpdateError



      setPayingItem(null)

      await Promise.all([

        queryClient.invalidateQueries({ queryKey: ['payables-summary'] }),

        queryClient.invalidateQueries({ queryKey: ['payables-accounts'] }),

      ])

      toast.success('Pagamento registrado com sucesso.')

    } catch (error: any) {

      toast.error(`Erro ao registrar pagamento: ${error.message || 'tente novamente.'}`)

    } finally {

      setIsProcessingPayment(false)

    }

  })



  const handleDelete = async (id: string) => {

    if (!supabase) return

    if (!window.confirm('Deseja excluir esta conta a pagar?')) return



    const { error } = await supabase.from('payables').delete().eq('id', id)



    if (error) {

      toast.error(`Erro ao excluir: ${error.message}`)

      return

    }



    await queryClient.invalidateQueries({ queryKey: ['payables-summary'] })

    toast.success('Conta a pagar exclu�da com sucesso.')

  }



  const handleDuplicate = async (item: PayableSummary) => {

    if (!supabase) return



    const { data, error } = await supabase

      .from('payables')

      .select('description, supplier_name, amount, due_date, category_id, cost_center_id, account_id, notes')

      .eq('id', item.id)

      .single()



    if (error) {

      toast.error(`Erro ao duplicar conta: ${error.message}`)

      return

    }



    const { error: insertError } = await supabase

      .from('payables')

      .insert({

        description: data.description,

        supplier_name: data.supplier_name,

        amount: data.amount,

        amount_paid: 0,

        due_date: data.due_date,

        category_id: data.category_id,

        cost_center_id: data.cost_center_id,

        account_id: data.account_id,

        notes: data.notes,

        status: 'pending',

        recurrent: false,

        recurrence_period: null,

      })



    if (insertError) {

      toast.error(`Erro ao duplicar conta: ${insertError.message}`)

      return

    }



    await queryClient.invalidateQueries({ queryKey: ['payables-summary'] })

    toast.success('Despesa duplicada com sucesso.')

  }



  const renderRow = (item: PayableSummary) => {

    const remaining = Number(item.amount) - Number(item.amount_paid)

    const isOverdue = item.status_display === 'overdue'

    const isDueToday = item.due_date === todayIso && (item.status_display === 'pending' || item.status_display === 'partial')

    const statusClass = item.status_display === 'overdue' ? 'status-overdue' : item.status_display === 'paid' ? 'status-received' : 'status-pending'



    return (

      <tr key={item.id} className={isOverdue ? 'row-overdue' : isDueToday ? 'row-due-today' : ''}>

        <td>

          <div className="cell-title">{item.description}</div>

          {item.purchase_order_id && <small className="origin-badge">Vindo do Estoque</small>}

        </td>

        <td>{item.supplier_name || '-'}</td>

        <td>{money.format(item.amount)}</td>

        <td>{new Date(`${item.due_date}T00:00:00`).toLocaleDateString('pt-BR')}</td>

        <td><span className={`status-pill ${statusClass}`}>{item.status_display}</span></td>

        <td>{item.category_name || '-'}</td>

        <td>{item.cost_center_name || '-'}</td>

        <td>

          <div className="row-actions">

            <button className="icon-btn success" title="Pagar" onClick={() => openPaymentModal(item)}>

              <CircleDollarSign size={15} />

            </button>

            <button className="icon-btn edit" title="Duplicar" onClick={() => handleDuplicate(item)}>

              <Copy size={15} />

            </button>

            <button className="icon-btn edit" title="Editar" onClick={() => openEditModal(item)}>

              <Pencil size={15} />

            </button>

            <button className="icon-btn danger" title="Excluir" onClick={() => handleDelete(item.id)}>

              <Trash2 size={15} />

            </button>

          </div>

          <small className="muted">Saldo: {money.format(Math.max(remaining, 0))}</small>

        </td>

      </tr>

    )

  }



  const payAmountRemaining = useMemo(() => {

    if (!payingItem) return 0

    return Math.max(Number(payingItem.amount) - Number(payingItem.amount_paid), 0)

  }, [payingItem])



  return (

    <div className="payables-page">

      {overdueCount > 0 && (

        <div className="overdue-banner" role="alert">

          <span>�?�️ Voc� tem {overdueCount} conta(s) vencida(s) totalizando {money.format(overdueTotal)}</span>

          <button type="button" className="ghost-btn" onClick={() => { setStatusFilter('overdue'); setPage(1) }}>

            Ver todas

          </button>

        </div>

      )}



      <section className="summary-grid">

        <article className="summary-card open"><div className="summary-label"><Clock3 size={16} /> Total a Pagar</div><strong>{money.format(summary.totalPending)}</strong></article>

        <article className="summary-card received"><div className="summary-label"><CircleDollarSign size={16} /> Pago no Mês</div><strong>{money.format(summary.totalPaidInMonth)}</strong></article>

        <article className="summary-card overdue"><div className="summary-label"><TriangleAlert size={16} /> Vencido</div><strong>{money.format(summary.overdue)}</strong></article>

        <article className="summary-card due-soon"><div className="summary-label"><TriangleAlert size={16} /> Vence em 7 dias</div><strong>{money.format(summary.next7Days)}</strong></article>

      </section>



      <section className="page-card">

        <div className="page-header-row">

          <div>

            <h3>Contas a Pagar</h3>

            <p>Gestão de despesas, vencimentos e pagamentos</p>

          </div>

          <div className="header-actions">

            <button type="button" className="accent-btn" onClick={openCreateModal}><PlusCircle size={16} /> Nova Conta a Pagar</button>

            <button type="button" className="ghost-btn" onClick={() => setGroupByCategory((prev) => !prev)}>

              {groupByCategory ? 'Desagrupar por categoria' : 'Agrupar por categoria'}

            </button>

          </div>

        </div>



        <div className="receivable-filters payables-filters">

          <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por descrição, fornecedor, categoria ou centro de custo" /></label>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">Todos os status</option><option value="pending">Pendente</option><option value="partial">Parcial</option><option value="paid">Pago</option><option value="overdue">Vencido</option><option value="cancelled">Cancelado</option></select>

          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />

          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />

          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Categoria</option>{categoryOptions.map((category) => (<option key={category} value={category}>{category}</option>))}</select>

          <select value={costCenterFilter} onChange={(event) => setCostCenterFilter(event.target.value)}><option value="all">Centro de Custo</option>{costCenterOptions.map((center) => (<option key={center} value={center}>{center}</option>))}</select>

          <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="all">Fornecedor</option>{supplierOptions.map((supplier) => (<option key={supplier} value={supplier}>{supplier}</option>))}</select>

          <button type="button" className="ghost-btn" onClick={resetFilters}>Limpar filtros</button>

        </div>



        {isLoading ? (

          <div className="skeleton-wrap">{Array.from({ length: 6 }).map((_, idx) => (<div key={idx} className="skeleton-row" />))}</div>

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

                  <th><button className="sort-btn" onClick={() => toggleSort('supplier_name')}>Fornecedor</button></th>

                  <th><button className="sort-btn" onClick={() => toggleSort('amount')}>Valor</button></th>

                  <th><button className="sort-btn" onClick={() => toggleSort('due_date')}>Vencimento</button></th>

                  <th><button className="sort-btn" onClick={() => toggleSort('status_display')}>Status</button></th>

                  <th><button className="sort-btn" onClick={() => toggleSort('category_name')}>Categoria</button></th>

                  <th><button className="sort-btn" onClick={() => toggleSort('cost_center_name')}>Centro de Custo</button></th>

                  <th>Ações</th>

                </tr>

              </thead>



              {!groupByCategory && <tbody>{paginatedItems.map((item) => renderRow(item))}</tbody>}



              {groupByCategory && groupedItems.map(([category, group]) => (

                <tbody key={category}>

                  <tr className="group-row"><td colSpan={8}><strong>{category}</strong> � {group.length} conta(s)</td></tr>

                  {group.map((item) => renderRow(item))}

                </tbody>

              ))}

            </table>

          </div>

        )}



        {!isLoading && filteredAndSorted.length > 0 && (

          <div className="pagination-row">

            <button className="ghost-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>Anterior</button>

            <span>P�gina {Math.min(page, totalPages)} de {totalPages}</span>

            <button className="ghost-btn" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>Pr�xima</button>

          </div>

        )}

      </section>



      {showFormModal && (

        <div className="modal-overlay" role="dialog" aria-modal="true">

          <form className="modal-card" onSubmit={handleSubmitPayableForm}>

            <h3>{editingItem ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}</h3>



            <label>

              {/* Descrição do lançamento */}
              Descrição*

              <input {...payableForm.register('description')} />

              {payableForm.formState.errors.description && <small className="feedback error">{payableForm.formState.errors.description.message}</small>}

            </label>



            <label>

              Fornecedor

              <input list="payable-suppliers" {...payableForm.register('supplierName')} placeholder="Digite para buscar fornecedor" />

              <datalist id="payable-suppliers">{supplierOptions.map((supplier) => (<option key={supplier} value={supplier} />))}</datalist>

            </label>



            <div className="modal-grid two-columns">

              <label>

                Valor*

                <input {...payableForm.register('amount')} inputMode="numeric" onChange={(event) => payableForm.setValue('amount', formatCurrencyInput(event.target.value), { shouldValidate: true })} />

                {payableForm.formState.errors.amount && <small className="feedback error">{payableForm.formState.errors.amount.message}</small>}

              </label>



              <label>

                Data de Vencimento*

                <input type="date" {...payableForm.register('dueDate')} />

                {payableForm.formState.errors.dueDate && <small className="feedback error">{payableForm.formState.errors.dueDate.message}</small>}

              </label>

            </div>



            <div className="modal-grid two-columns">

              <label>

                Categoria*

                <select {...payableForm.register('categoryId')}>

                  <option value="">Selecione...</option>

                  {categories.map((category) => (<option key={category.id} value={category.id}>{category.code} - {category.name}</option>))}

                </select>

                {payableForm.formState.errors.categoryId && <small className="feedback error">{payableForm.formState.errors.categoryId.message}</small>}

              </label>



              <label>

                Centro de Custo

                <select {...payableForm.register('costCenterId')}>

                  <option value="">Selecione...</option>

                  {costCenters.map((center) => (<option key={center.id} value={center.id}>{center.name}</option>))}

                </select>

              </label>

            </div>



            <label>

              Conta para Pagamento

              <select {...payableForm.register('paymentAccountId')}>

                <option value="">Selecione...</option>

                {accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}

              </select>

            </label>



            {!editingItem && (

              <>

                <h4 className="muted">Despesa Recorrente</h4>

                <div className="modal-toggle-row">

                  <label className="toggle-check">

                    <input type="checkbox" {...payableForm.register('isRecurring')} />

                    Esta despesa se repete?

                  </label>

                </div>



                {watchedRecurring && (

                  <>

                    <div className="modal-grid two-columns">

                      <label>

                        Frequência

                        <select {...payableForm.register('recurrenceFrequency')}>

                          {recurrenceFrequencyOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}

                        </select>

                        {payableForm.formState.errors.recurrenceFrequency && <small className="feedback error">{payableForm.formState.errors.recurrenceFrequency.message}</small>}

                      </label>



                      <label>

                        Data de início

                        <input type="date" {...payableForm.register('recurrenceStartDate')} />

                        {payableForm.formState.errors.recurrenceStartDate && <small className="feedback error">{payableForm.formState.errors.recurrenceStartDate.message}</small>}

                      </label>

                    </div>



                    <label>

                      Data de término (opcional)

                      <input type="date" {...payableForm.register('recurrenceEndDate')} />

                      {payableForm.formState.errors.recurrenceEndDate && <small className="feedback error">{payableForm.formState.errors.recurrenceEndDate.message}</small>}

                    </label>



                    {recurrencePreviewDates.length > 0 && (

                      <div className="installment-preview">

                        <strong>

                          Serão criadas {recurrencePreviewDates.length} parcela(s) entre{' '}

                          {new Date(`${recurrencePreviewDates[0]}T00:00:00`).toLocaleDateString('pt-BR')} e{' '}

                          {new Date(`${recurrencePreviewDates[recurrencePreviewDates.length - 1]}T00:00:00`).toLocaleDateString('pt-BR')}

                        </strong>

                      </div>

                    )}

                  </>

                )}

              </>

            )}



            <h4 className="muted">Dados da NFe</h4>

            <div className="modal-grid two-columns">

              <label>

                Número da NFe

                <input {...payableForm.register('nfeNumber')} placeholder="Ex: 000123456" />

              </label>

              <label>

                Série

                <input {...payableForm.register('nfeSerie')} placeholder="Ex: 1" />

              </label>

            </div>

            <div className="modal-grid two-columns">

              <label>

                Data de Emissão

                <input type="date" {...payableForm.register('nfeEmissionDate')} />

              </label>

              <label>

                Valor Total da NFe

                <input {...payableForm.register('nfeTotalValue')} inputMode="numeric" placeholder="0,00" onChange={(e) => payableForm.setValue('nfeTotalValue', formatCurrencyInput(e.target.value))} />

              </label>

            </div>

            <label>

              CNPJ do Emitente

              <input {...payableForm.register('nfeIssuerCnpj')} placeholder="Ex: 00.000.000/0001-00" />

            </label>

            <label>

              Chave de Acesso (44 dígitos)

              <input {...payableForm.register('nfeAccessKey')} placeholder="Ex: 35250312345678000195550010000012341234567890" maxLength={44} />

            </label>

            <label>

              {/* Observações do lançamento */}
              Observações

              <textarea rows={3} {...payableForm.register('notes')} />

            </label>



            <input type="hidden" {...payableForm.register('mode')} />



            <div className="modal-actions">

              <button type="button" className="danger-btn" onClick={() => { setShowFormModal(false); setEditingItem(null) }} disabled={isSavingForm}>Cancelar</button>

              <button type="submit" className="accent-btn" disabled={isSavingForm}>{isSavingForm ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Salvar Conta'}</button>

            </div>

          </form>

        </div>

      )}



      {payingItem && (

        <div className="modal-overlay" role="dialog" aria-modal="true">

          <form className="modal-card" onSubmit={handleSubmitPayment}>

            <h3>Registrar Pagamento</h3>

            <p className="muted">{payingItem.description}</p>

            <p className="muted">Saldo atual: {money.format(payAmountRemaining)}</p>



            <div className="modal-grid two-columns">

              <label>

                Valor pago*

                <input {...paymentForm.register('paidAmount')} inputMode="numeric" onChange={(event) => paymentForm.setValue('paidAmount', formatCurrencyInput(event.target.value), { shouldValidate: true })} />

                {paymentForm.formState.errors.paidAmount && <small className="feedback error">{paymentForm.formState.errors.paidAmount.message}</small>}

              </label>



              <label>

                Data do pagamento*

                <input type="date" {...paymentForm.register('paidDate')} />

                {paymentForm.formState.errors.paidDate && <small className="feedback error">{paymentForm.formState.errors.paidDate.message}</small>}

              </label>

            </div>



            <label>

              Conta Bancária usada*

              <select {...paymentForm.register('accountId')}>

                <option value="">Selecione...</option>

                {accounts.map((account) => (<option key={account.id} value={account.id}>{account.name}</option>))}

              </select>

              {paymentForm.formState.errors.accountId && <small className="feedback error">{paymentForm.formState.errors.accountId.message}</small>}

            </label>



            <label>

              Comprovante

              <input {...paymentForm.register('receiptReference')} placeholder="Número ou referência" />

            </label>



            <label>

              {/* Observações do pagamento */}
              Observações

              <textarea rows={3} {...paymentForm.register('notes')} />

            </label>



            <div className="modal-actions">

              <button type="button" className="danger-btn" onClick={() => setPayingItem(null)} disabled={isProcessingPayment}>Cancelar</button>

              <button type="submit" className="accent-btn" disabled={isProcessingPayment}>{isProcessingPayment ? 'Processando...' : 'Confirmar Pagamento'}</button>

            </div>

          </form>

        </div>

      )}



    </div>

  )

}



