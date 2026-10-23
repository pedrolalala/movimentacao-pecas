import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SystemSwitcher } from '@/components/SystemSwitcher'
import { Layout } from '@/components/Layout'

// SPEC-224: sistema "Movimentação de Peças" — Movimentar e Histórico.
const LoginPage = lazy(() => import('./pages/LoginPage'))
const MovimentarPage = lazy(() => import('./pages/MovimentarPage'))
const HistoricoPage = lazy(() => import('./pages/HistoricoPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

const LoadingFallback = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <div className="animate-pulse text-muted-foreground">Carregando...</div>
  </div>
)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Sonner position="bottom-center" />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MovimentarPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/historico"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HistoricoPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <SystemSwitcher currentSlug="movimentacao-pecas" />
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
