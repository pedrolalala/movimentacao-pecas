import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowLeftRight, History, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/Logo/lucenera-vertical.png`

const ABAS = [
  { to: '/', rotulo: 'Movimentar', icone: ArrowLeftRight },
  { to: '/historico', rotulo: 'Histórico', icone: History },
]

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 px-4 md:px-6 h-14">
          <img src={LOGO_URL} alt="Lucenera" className="h-8 w-auto object-contain" />
          <span className="font-semibold text-slate-900">Movimentação de Peças</span>
          <span className="flex-1" />
          <span className="hidden sm:inline text-xs text-slate-500">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
        <nav className="flex gap-1 px-4 md:px-6">
          {ABAS.map((a) => (
            <NavLink
              key={a.to}
              to={a.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50',
                )
              }
            >
              <a.icone className="w-4 h-4" />
              {a.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 w-full px-4 md:px-6 py-4">{children}</main>
    </div>
  )
}
