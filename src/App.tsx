import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoaderCircle } from 'lucide-react'
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

type AuthMode = 'login' | 'register' | 'reset'

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

  const [authMode, setAuthMode] = useState<AuthMode>('login')
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

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false)
      return
    }

    const client = supabase

    const loadSession = async () => {
      const { data } = await client.auth.getSession()
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

      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }

      if (authMode === 'register') {
        if (password.length < 6) {
          setAuthMessage({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres.' })
          return
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setAuthMessage({ type: 'success', text: 'Cadastro realizado! Verifique seu e-mail para confirmar o acesso.' })
      }

      if (authMode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setAuthMessage({ type: 'success', text: 'Link de recuperação enviado para seu e-mail.' })
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
    setAuthMode('login')
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
          <h1>SmartFinanceiro</h1>
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

  if (!session) {
    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={handleAuthAction}>
          <h1>SmartFinanceiro</h1>
          <p className="muted">Acesso separado para o módulo financeiro.</p>

          <div className="tabs">
            <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Entrar</button>
            <button type="button" className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Cadastrar</button>
            <button type="button" className={authMode === 'reset' ? 'active' : ''} onClick={() => setAuthMode('reset')}>Recuperar</button>
          </div>

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

          {authMode !== 'reset' && (
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
          )}

          {authMessage && <p className={`feedback ${authMessage.type}`}>{authMessage.text}</p>}

          <button type="submit" className="primary" disabled={loadingAuthAction}>
            {loadingAuthAction
              ? 'Aguarde...'
              : authMode === 'login'
                ? 'Entrar'
                : authMode === 'register'
                  ? 'Criar conta'
                  : 'Enviar link'}
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
