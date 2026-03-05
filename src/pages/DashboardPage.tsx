import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Tag, Skeleton, Table } from 'antd'
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Clock, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const todayIso = new Date().toISOString().slice(0, 10)
const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

interface DashData {
  totalBalance: number
  faturamentoMes: number
  despesasMes: number
  overdueReceivables: { count: number; total: number }
  dueTodayReceivables: { count: number; total: number }
  dueIn7daysReceivables: { count: number; total: number }
  overduePayables: { count: number; total: number }
  recentActivity: any[]
  urgentPayables: any[]
  topReceivables: any[]
}

const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashData>({
    totalBalance: 0,
    faturamentoMes: 0,
    despesasMes: 0,
    overdueReceivables: { count: 0, total: 0 },
    dueTodayReceivables: { count: 0, total: 0 },
    dueIn7daysReceivables: { count: 0, total: 0 },
    overduePayables: { count: 0, total: 0 },
    recentActivity: [],
    urgentPayables: [],
    topReceivables: [],
  })

  useEffect(() => {
    const fetchAll = async () => {
      if (!supabase) return
      setLoading(true)
      try {
        const [
          accRes,
          recMonthRes,
          payMonthRes,
          allRecRes,
          allPayRes,
          recentRecRes,
          recentPayRes,
        ] = await Promise.all([
          supabase.from('financial_accounts').select('balance'),
          supabase.from('receivables').select('amount_received').eq('status', 'received').gte('received_date', firstOfMonth),
          supabase.from('payables').select('amount_paid').eq('status', 'paid').gte('paid_date', firstOfMonth),
          supabase.from('vw_receivables_summary').select('id, amount, due_date, status_display, description, customer_name'),
          supabase.from('vw_payables_summary').select('id, amount, amount_paid, due_date, status_display, description, supplier_name').order('due_date', { ascending: true }).limit(20),
          supabase.from('receivables').select('id, description, amount, due_date, status').order('due_date', { ascending: false }).limit(5),
          supabase.from('payables').select('id, description, amount, due_date, status').order('due_date', { ascending: false }).limit(5),
        ])

        if (accRes.error) console.warn('financial_accounts error:', accRes.error.message)
        if (recMonthRes.error) console.warn('receivables month error:', recMonthRes.error.message)
        if (payMonthRes.error) console.warn('payables month error:', payMonthRes.error.message)
        if (allRecRes.error) console.warn('vw_receivables_summary error:', allRecRes.error.message)
        if (allPayRes.error) console.warn('vw_payables_summary error:', allPayRes.error.message)

        const accounts = accRes.data || []
        const receivedThisMonth = recMonthRes.data || []
        const paidThisMonth = payMonthRes.data || []
        const allReceivables = allRecRes.data || []
        const allPayables = allPayRes.data || []
        const recentRec = recentRecRes.data || []
        const recentPay = recentPayRes.data || []

        const totalBalance = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0)
        const faturamentoMes = receivedThisMonth.reduce((s, r) => s + (Number(r.amount_received) || 0), 0)
        const despesasMes = paidThisMonth.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0)

        const overdue = allReceivables.filter(r => r.status_display === 'overdue')
        const dueToday = allReceivables.filter(r => r.due_date === todayIso && (r.status_display === 'pending' || r.status_display === 'partial'))
        const due7 = allReceivables.filter(r => r.due_date > todayIso && r.due_date <= in7days && (r.status_display === 'pending' || r.status_display === 'partial'))
        const overdueP = allPayables.filter((p: any) => p.status_display === 'overdue')

        const recentCombined = [
          ...recentRec.map((r: any) => ({ ...r, _type: 'recebível' })),
          ...recentPay.map((p: any) => ({ ...p, _type: 'pagamento' })),
        ].sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()).slice(0, 8)

        setData({
          totalBalance,
          faturamentoMes,
          despesasMes,
          overdueReceivables: { count: overdue.length, total: overdue.reduce((s, r) => s + Number(r.amount), 0) },
          dueTodayReceivables: { count: dueToday.length, total: dueToday.reduce((s, r) => s + Number(r.amount), 0) },
          dueIn7daysReceivables: { count: due7.length, total: due7.reduce((s, r) => s + Number(r.amount), 0) },
          overduePayables: { count: overdueP.length, total: overdueP.reduce((s: number, p: any) => s + Number(p.amount), 0) },
          recentActivity: recentCombined,
          urgentPayables: allPayables.filter((p: any) => p.status_display === 'overdue' || p.status_display === 'pending').slice(0, 5),
          topReceivables: allReceivables.filter(r => r.status_display === 'pending' || r.status_display === 'partial' || r.status_display === 'overdue').sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
        })
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const lucroMes = data.faturamentoMes - data.despesasMes
  const margemPct = data.faturamentoMes > 0 ? Math.round((lucroMes / data.faturamentoMes) * 100) : 0

  const kpis = [
    { label: 'Saldo Total em Caixa', value: money.format(data.totalBalance), icon: <DollarSign size={32} color="#1677ff" /> },
    { label: 'Faturamento do Mês', value: money.format(data.faturamentoMes), icon: <TrendingUp size={32} color="#52c41a" /> },
    { label: 'Despesas do Mês', value: money.format(data.despesasMes), icon: <TrendingDown size={32} color="#ff4d4f" /> },
    { label: 'Lucro do Mês', value: money.format(lucroMes), icon: <DollarSign size={32} color="#13c2c2" />, extra: <Tag color={lucroMes >= 0 ? 'green' : 'red'}>Margem {margemPct}%</Tag> },
  ]

  const alerts = [
    data.overdueReceivables.count > 0 && { type: 'error', icon: '🔴', text: `${data.overdueReceivables.count} recebível(is) vencido(s)`, value: money.format(data.overdueReceivables.total) },
    data.dueTodayReceivables.count > 0 && { type: 'warning', icon: '🟠', text: `${data.dueTodayReceivables.count} recebível(is) vencem hoje`, value: money.format(data.dueTodayReceivables.total) },
    data.dueIn7daysReceivables.count > 0 && { type: 'info', icon: '🟡', text: `${data.dueIn7daysReceivables.count} recebível(is) vencem em 7 dias`, value: money.format(data.dueIn7daysReceivables.total) },
    data.overduePayables.count > 0 && { type: 'error', icon: '🔴', text: `${data.overduePayables.count} conta(s) a pagar vencida(s)`, value: money.format(data.overduePayables.total) },
    (data.overdueReceivables.count === 0 && data.overduePayables.count === 0) && { type: 'success', icon: '✅', text: 'Nenhuma conta vencida', value: '' },
  ].filter(Boolean) as { type: string; icon: string; text: string; value: string }[]

  const recentColumns = [
    { title: 'Descrição', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Tipo', dataIndex: '_type', key: '_type', render: (v: string) => <Tag color={v === 'recebível' ? 'green' : 'red'}>{v}</Tag> },
    { title: 'Valor', dataIndex: 'amount', key: 'amount', render: (v: number) => money.format(Number(v)) },
    { title: 'Vencimento', dataIndex: 'due_date', key: 'due_date', render: (v: string) => new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: string) => {
      const map: Record<string, string> = { received: 'Recebido', paid: 'Pago', pending: 'Pendente', overdue: 'Vencido', cancelled: 'Cancelado', partial: 'Parcial' }
      const color: Record<string, string> = { received: 'green', paid: 'green', pending: 'blue', overdue: 'red', cancelled: 'default', partial: 'orange' }
      return <Tag color={color[v] || 'default'}>{map[v] || v}</Tag>
    }},
  ]

  const payableColumns = [
    { title: 'Descrição', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Fornecedor', dataIndex: 'supplier_name', key: 'supplier_name', render: (v: string) => v || '-' },
    { title: 'Valor', dataIndex: 'amount', key: 'amount', render: (v: number) => money.format(Number(v)) },
    { title: 'Vencimento', dataIndex: 'due_date', key: 'due_date', render: (v: string) => <span style={{ color: v < todayIso ? '#ff4d4f' : 'inherit' }}>{new Date(v + 'T00:00:00').toLocaleDateString('pt-BR')}</span> },
  ]

  const receivableColumns = [
    { title: 'Descrição', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Cliente', dataIndex: 'customer_name', key: 'customer_name', render: (v: string) => v || '-' },
    { title: 'Valor', dataIndex: 'amount', key: 'amount', render: (v: number) => money.format(Number(v)) },
    { title: 'Vencimento', dataIndex: 'due_date', key: 'due_date', render: (v: string) => <span style={{ color: v < todayIso ? '#ff4d4f' : 'inherit' }}>{new Date(v + 'T00:00:00').toLocaleDateString('pt-BR')}</span> },
  ]

  return (
    <div className="dashboard-page">
      {/* KPIs */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        {kpis.map((kpi, i) => (
          <Col span={6} key={i}>
            <Skeleton loading={loading} active>
              <Card className="kpi-card" bordered={false} style={{ minHeight: 120 }}>
                <Row align="middle" gutter={16}>
                  <Col>{kpi.icon}</Col>
                  <Col flex="auto">
                    <div className="kpi-label">{kpi.label}</div>
                    <div className="kpi-value" style={{ fontSize: 24, fontWeight: 700 }}>{kpi.value}</div>
                    {kpi.extra}
                  </Col>
                </Row>
              </Card>
            </Skeleton>
          </Col>
        ))}
      </Row>

      {/* Alertas */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title={<span><AlertTriangle size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Alertas</span>} className="alert-panel">
            <Skeleton loading={loading} active paragraph={{ rows: 3 }}>
              {alerts.length === 0 ? (
                <div className="alert-row alert-success"><CheckCircle size={16} style={{ marginRight: 8 }} />Tudo em dia!</div>
              ) : alerts.map((alert, i) => (
                <div key={i} className={`alert-row alert-${alert.type}`}>
                  <span>{alert.icon}</span> {alert.text}
                  {alert.value && <b style={{ float: 'right' }}>{alert.value}</b>}
                </div>
              ))}
            </Skeleton>
          </Card>
        </Col>
      </Row>

      {/* Atividade Recente */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title={<span><Clock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Atividade Recente</span>}>
            <Table dataSource={data.recentActivity} columns={recentColumns} pagination={false} rowKey={(r) => r.id + r._type} loading={loading} size="small" />
          </Card>
        </Col>
      </Row>

      {/* Urgentes */}
      <Row gutter={24}>
        <Col span={12}>
          <Card title="Contas a Pagar Mais Urgentes">
            <Table dataSource={data.urgentPayables} columns={payableColumns} pagination={false} rowKey="id" loading={loading} size="small" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Maiores Valores a Receber">
            <Table dataSource={data.topReceivables} columns={receivableColumns} pagination={false} rowKey="id" loading={loading} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DashboardPage
