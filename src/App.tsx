import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoaderCircle, Wallet, TrendingUp, TrendingDown, BarChart3, ShieldCheck, Zap, ArrowRight, CheckCircle2, DollarSign, FileText, CreditCard } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { ReceivablesPage } from './pages/ReceivablesPage'
import { PayablesPage } from './pages/PayablesPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import CashFlowPage from './pages/CashFlowPage'
import DrePage from './pages/DrePage'
import RelatoriosPage from './pages/RelatoriosPage'
import DashboardPage from './pages/DashboardPage'
import FinancialAccountsPage from './pages/FinancialAccountsPage'
import PlanoDeContasPage from './pages/PlanoDeContasPage'
import CostCentersPage from './pages/CostCentersPage'
import { hasSupabaseConfig, supabase } from './lib/supabase'
import type { NavKey } from './types/finance'

const navPathMap: Record<NavKey, string> = {
  dashboard: '/smart_financeiro/financeiro/dashboard',
  receivables: '/smart_financeiro/financeiro/contas-a-receber',
  payables: '/smart_financeiro/financeiro/contas-a-pagar',
  cashflow: '/smart_financeiro/financeiro/fluxo-de-caixa',
  dre: '/smart_financeiro/financeiro/dre-relatorios',
  settings_chart: '/smart_financeiro/financeiro/configuracoes/plano-de-contas',
  settings_costcenters: '/smart_financeiro/financeiro/configuracoes/centros-de-custo',
  settings_accounts: '/smart_financeiro/financeiro/configuracoes/contas-bancarias',
}

const resolveNavKeyFromPath = (pathname: string): NavKey => {
  const matched = (Object.entries(navPathMap) as Array<[NavKey, string]>).find(([, path]) => pathname.startsWith(path))
  return matched?.[0] || 'receivables'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingAuthAction, setLoadingAuthAction] = useState(false)
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false)
  const [showLanding, setShowLanding] = useState(true)

  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [activeKey, setActiveKey] = useState<NavKey>(() => resolveNavKeyFromPath(window.location.pathname))

  useEffect(() => {
    const onPopState = () => {
      setActiveKey(resolveNavKeyFromPath(window.location.pathname))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const handleNavigate = (key: NavKey) => {
    setActiveKey(key)
    const targetPath = navPathMap[key]
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath)
    }
  }

  const checkUserSubscription = async (userId: string): Promise<boolean> => {
    if (!supabase) return false
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single()
    if (!profile?.organization_id) return false
    const { data: subscription } = await supabase
      .from('Subscriptions')
      .select('status')
      .eq('organization_id', profile.organization_id)
      .single()
    return subscription?.status === 'active'
  }

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false)
      return
    }

    const client = supabase

    const loadSession = async () => {
      const { data } = await client.auth.getSession()
      if (data.session) {
        const isActive = await checkUserSubscription(data.session.user.id)
        if (!isActive) {
          setSubscriptionBlocked(true)
          await client.auth.signOut()
          setAuthMessage({ type: 'error', text: 'Sua assinatura está inativa ou expirada. Entre em contato com o suporte para renovar.' })
          setLoadingSession(false)
          return
        }
      }
      setSession(data.session)
      setLoadingSession(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return

    setAuthMessage(null)
    setLoadingAuthAction(true)

    try {
      const email = authEmail.trim().toLowerCase()
      const password = authPassword

      if (!email) {
        setAuthMessage({ type: 'error', text: 'Informe seu e-mail.' })
        return
      }

      const { data: loginData, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (loginData.user) {
        const isActive = await checkUserSubscription(loginData.user.id)
        if (!isActive) {
          setSubscriptionBlocked(true)
          await supabase.auth.signOut()
          setAuthMessage({ type: 'error', text: 'Sua assinatura está inativa ou expirada. Entre em contato com o suporte para renovar.' })
          return
        }
        setSubscriptionBlocked(false)
      }
    } catch (error: any) {
      setAuthMessage({ type: 'error', text: error.message || 'Falha na autenticação.' })
    } finally {
      setLoadingAuthAction(false)
    }
  }

  const handleLogout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setAuthPassword('')
  }

  const renderPage = () => {
    if (activeKey === 'receivables') return <ReceivablesPage />

    if (activeKey === 'dashboard') {
      return <DashboardPage />
    }

    if (activeKey === 'payables') {
      return <PayablesPage />
    }

    if (activeKey === 'cashflow') {
      return <CashFlowPage />
    }


    if (window.location.pathname.startsWith('/financeiro/relatorios/dre')) {
      return <DrePage />
    }
    if (activeKey === 'dre') {
      return <RelatoriosPage />
    }

    if (activeKey === 'settings_chart') {
      return <PlanoDeContasPage />
    }
    if (activeKey === 'settings_costcenters') {
      return <CostCentersPage />
    }
    if (activeKey === 'settings_accounts') {
      return <FinancialAccountsPage />
    }
  }

  if (!hasSupabaseConfig || !supabase) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand-header">
            <div className="auth-brand-icon"><Wallet size={28} /></div>
            <h1>SmartFinanceiro</h1>
          </div>
          <p className="muted">Configure as variáveis de ambiente para conectar ao Supabase.</p>
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_ANON_KEY</code>
          <p className="muted">Use o arquivo <strong>.env</strong> baseado em <strong>.env.example</strong>.</p>
        </div>
      </div>
    )
  }

  if (loadingSession) {
    return (
      <div className="auth-shell">
        <div className="loading-block">
          <LoaderCircle className="spin" size={24} /> Carregando sessão...
        </div>
      </div>
    )
  }

  if (!session || subscriptionBlocked) {
    if (showLanding) {
      return (
        <div className="min-h-screen bg-white font-sans">
          {/* Header */}
          <header className="sticky top-0 z-50 backdrop-blur-sm bg-white/90 border-b border-slate-100">
            <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
              <div className="flex items-center gap-2 text-emerald-600 font-black text-2xl">
                <Wallet size={28} /> SmartFinanceiro
              </div>
              <button
                onClick={() => setShowLanding(false)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg"
              >
                Login
              </button>
            </div>
          </header>

          {/* Hero */}
          <section className="max-w-7xl mx-auto px-6 py-24 text-center">
            <span className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
              Módulo Financeiro Completo
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 leading-tight">
              Suas finanças sob<br />
              <span className="text-emerald-600">total controle.</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12">
              Contas a pagar e receber, fluxo de caixa, DRE gerencial e conciliação bancária — tudo integrado em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowLanding(false)}
                className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <Zap size={20} /> Acessar Sistema
              </button>
              <a href="https://r2b.ia.br" className="px-10 py-4 border border-slate-200 text-slate-700 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                Conhecer R2B <ArrowRight size={18} />
              </a>
            </div>
          </section>

          {/* Features */}
          <section className="bg-slate-50 py-20">
            <div className="max-w-7xl mx-auto px-6">
              <h2 className="text-4xl font-extrabold text-center mb-16 text-slate-900">Por que usar o SmartFinanceiro?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { icon: TrendingUp, title: 'Contas a Receber', desc: 'Controle todos os recebimentos, parcelas e datas de vencimento com alertas automáticos de inadimplência.' },
                  { icon: TrendingDown, title: 'Contas a Pagar', desc: 'Organize suas obrigações, evite atrasos e tenha visibilidade de todos os compromissos futuros.' },
                  { icon: BarChart3, title: 'Fluxo de Caixa', desc: 'Visualize entradas e saídas projetadas e reais para tomar decisões financeiras com segurança.' },
                  { icon: FileText, title: 'DRE Gerencial', desc: 'Relatório de resultado automático com receitas, despesas e lucro líquido do período.' },
                  { icon: CreditCard, title: 'Conciliação Bancária', desc: 'Reconcilie extratos com os lançamentos do sistema em poucos cliques.' },
                  { icon: ShieldCheck, title: 'Seguro e Integrado', desc: 'Dados protegidos na nuvem e integração nativa com o PDV e Estoque da R2B.' },
                ].map((item, i) => (
                  <div key={i} className="p-8 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:shadow-lg transition-all group">
                    <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white text-emerald-600 transition-all">
                      <item.icon size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Industries */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-6">
              <h2 className="text-4xl font-extrabold text-center mb-16 text-slate-900">Funciona para qualquer negócio</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {[
                  { name: 'Restaurantes', emoji: '🍽️' },
                  { name: 'Lojas', emoji: '🛍️' },
                  { name: 'Clínicas', emoji: '🏥' },
                  { name: 'Escritórios', emoji: '🏢' },
                  { name: 'Farmácias', emoji: '💊' },
                  { name: 'Distribuidoras', emoji: '📦' },
                  { name: 'Serviços', emoji: '🔧' },
                  { name: 'E muito mais', emoji: '✨' },
                ].map((item, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center hover:shadow-md transition-all">
                    <div className="text-4xl mb-3">{item.emoji}</div>
                    <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="py-20 bg-emerald-600 text-white">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
                {[
                  { value: '100%', label: 'Integrado com PDV e Estoque' },
                  { value: 'Zero', label: 'Retrabalho com planilhas' },
                  { value: '24h', label: 'Visibilidade do seu negócio' },
                ].map((s, i) => (
                  <div key={i}>
                    <p className="text-5xl font-black mb-2">{s.value}</p>
                    <p className="text-emerald-100 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 bg-slate-900 text-white text-center">
            <div className="max-w-2xl mx-auto px-6 space-y-6">
              <h2 className="text-4xl font-extrabold">Pronto para organizar suas finanças?</h2>
              <p className="text-slate-400">Acesse agora e tenha controle total do seu financeiro.</p>
              <button
                onClick={() => setShowLanding(false)}
                className="px-10 py-5 bg-emerald-500 text-white rounded-2xl font-bold text-lg hover:bg-emerald-400 transition-all shadow-2xl"
              >
                Entrar no Sistema
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="bg-slate-950 text-slate-500 py-8 text-center">
            <p className="text-sm font-medium">© {new Date().getFullYear()} R2B · SmartFinanceiro. Todos os direitos reservados.</p>
          </footer>
        </div>
      )
    }

    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={handleAuthAction}>
          <div className="auth-brand-header">
            <div className="auth-brand-icon"><Wallet size={28} /></div>
            <h1>SmartFinanceiro</h1>
          </div>
          <p className="muted">Acesso separado para o módulo financeiro.</p>

          <label>
            E-mail
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="seu@email.com"
              required
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="******"
              required
            />
          </label>

          {authMessage && <p className={`feedback ${authMessage.type}`}>{authMessage.text}</p>}

          <button type="submit" className="primary" disabled={loadingAuthAction}>
            {loadingAuthAction ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <AppLayout
      activeKey={activeKey}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userEmail={session.user.email || 'Usuário autenticado'}
    >
      {renderPage()}
    </AppLayout>
  )
}

export default App
