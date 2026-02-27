export type NavKey =
  | 'dashboard'
  | 'receivables'
  | 'payables'
  | 'cashflow'
  | 'dre'
  | 'settings_chart'
  | 'settings_costcenters'
  | 'settings_accounts'

export interface ReceivableSummary {
  id: string
  description: string
  customer_name: string | null
  sale_id: string | null
  amount: number
  amount_received: number
  due_date: string
  status_display: 'pending' | 'received' | 'overdue' | 'cancelled' | 'partial' | string
  payment_method: string | null
  days_overdue: number
  installment_number?: number | null
  total_installments?: number | null
}

export interface PayableSummary {
  id: string
  description: string
  supplier_name: string | null
  amount: number
  amount_paid: number
  due_date: string
  paid_date?: string | null
  purchase_order_id?: string | null
  status_display: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partial' | string
  category_name: string | null
  days_overdue: number
  cost_center_name?: string | null
}
