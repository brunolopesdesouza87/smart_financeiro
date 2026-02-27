import { useMemo, useState } from 'react'
import {
  BarChart3,
  ChevronDown,
  FileText,
  Landmark,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import type { NavKey } from '../../types/finance'

interface AppLayoutProps {
  activeKey: NavKey
  onNavigate: (key: NavKey) => void
  onLogout: () => void
  userEmail: string
  children: React.ReactNode
}

export function AppLayout({ activeKey, onNavigate, onLogout, userEmail, children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(true)

  const title = useMemo(() => {
    const map: Record<NavKey, string> = {
      dashboard: 'Dashboard',
      receivables: 'Contas a Receber',
      payables: 'Contas a Pagar',
      cashflow: 'Fluxo de Caixa',
      dre: 'DRE / Relatórios',
      settings_chart: 'Plano de Contas',
      settings_costcenters: 'Centros de Custo',
      settings_accounts: 'Contas Bancárias',
    }

    return map[activeKey]
  }, [activeKey])

  const navigate = (key: NavKey) => {
    onNavigate(key)
    setSidebarOpen(false)
  }

  return (
    <div className="finance-layout">
      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-area">
          <div className="brand-icon"><Wallet size={20} /></div>
          <div>
            <h1>SmartFinanceiro</h1>
            <p>Módulo Financeiro</p>
          </div>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeKey === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>

          <button className={`nav-item ${activeKey === 'receivables' ? 'active' : ''}`} onClick={() => navigate('receivables')}>
            <TrendingUp size={18} /> Contas a Receber
          </button>

          <button className={`nav-item ${activeKey === 'payables' ? 'active' : ''}`} onClick={() => navigate('payables')}>
            <TrendingDown size={18} /> Contas a Pagar
          </button>

          <button className={`nav-item ${activeKey === 'cashflow' ? 'active' : ''}`} onClick={() => navigate('cashflow')}>
            <BarChart3 size={18} /> Fluxo de Caixa
          </button>

          <button className={`nav-item ${activeKey === 'dre' ? 'active' : ''}`} onClick={() => navigate('dre')}>
            <FileText size={18} /> DRE / Relatórios
          </button>

          <button className={`nav-item ${activeKey.startsWith('settings') ? 'active' : ''}`} onClick={() => setSettingsOpen((prev) => !prev)}>
            <Settings size={18} /> Configurações
            <ChevronDown size={16} className={`chevron ${settingsOpen ? 'open' : ''}`} />
          </button>

          {settingsOpen && (
            <div className="submenu">
              <button className={`sub-item ${activeKey === 'settings_chart' ? 'active' : ''}`} onClick={() => navigate('settings_chart')}>
                <ListTree size={16} /> Plano de Contas
              </button>
              <button className={`sub-item ${activeKey === 'settings_costcenters' ? 'active' : ''}`} onClick={() => navigate('settings_costcenters')}>
                <Landmark size={16} /> Centros de Custo
              </button>
              <button className={`sub-item ${activeKey === 'settings_accounts' ? 'active' : ''}`} onClick={() => navigate('settings_accounts')}>
                <Wallet size={16} /> Contas Bancárias
              </button>
            </div>
          )}
        </nav>
      </aside>

      <div className="layout-content">
        <header className="layout-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Abrir menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div>
            <h2>{title}</h2>
            <p>{userEmail}</p>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Sair
          </button>
        </header>

        <main className="layout-main">{children}</main>
      </div>
    </div>
  )
}
