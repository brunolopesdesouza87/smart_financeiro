import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoaderCircle, Wallet } from 'lucide-react'
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
  dashboard: '/financeiro/dashboard',
  receivables: '/financeiro/contas-a-receber',
  payables: '/financeiro/contas-a-pagar',
  cashflow: '/financeiro/fluxo-de-caixa',
  dre: '/financeiro/dre-relatorios',
  settings_chart: '/financeiro/configuracoes/plano-de-contas',
  settings_costcenters: '/financeiro/configuracoes/centros-de-custo',
  settings_accounts: '/financeiro/configuracoes/contas-bancarias',
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
