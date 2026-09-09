import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAppLifecycle } from "@/hooks/useAppLifecycle";
import { usePreloadRoutes } from "@/hooks/usePreloadRoutes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import InstallBanner from "./components/InstallBanner";
import BottomNav from "./components/BottomNav";
import PageSkeleton from "./components/PageSkeleton";
import { setupDeepLinkListener } from "@/lib/capacitorAuth";

// Fábricas separadas: o mesmo `import()` serve pro lazy() e pro preload.
const loadDiary = () => import("./pages/DiaryPage");
const loadProfile = () => import("./pages/ProfilePage");
const loadGoals = () => import("./pages/GoalsPage");
const loadSettings = () => import("./pages/SettingsPage");

const DiaryPage = lazy(loadDiary);
const ProfilePage = lazy(loadProfile);
const GoalsPage = lazy(loadGoals);
const SettingsPage = lazy(loadSettings);
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

setupDeepLinkListener();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      refetchOnReconnect: "always",
      refetchOnWindowFocus: false,
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 1,
      networkMode: "offlineFirst",
    },
  },
});

/** Só no boot frio / login / admin — as abas usam o PageSkeleton (nav continua na tela). */
function Splash({ label }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background fade-enter">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2" />
        {label && <p className="text-sm text-muted-foreground font-body">{label}</p>}
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash label="Carregando..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Shell das abas: o BottomNav fica FORA do Suspense, então nunca some ao
 * trocar de aba; o conteúdo carrega no lugar (skeleton) e as outras rotas são
 * pré-carregadas em idle — troca de aba sem esperar chunk.
 */
function AppShell() {
  usePreloadRoutes([loadGoals, loadSettings, loadProfile]);
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
      <BottomNav />
    </>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { triggerSync } = useOfflineSync();

  // Capacitor: refresh sessão + re-sync ao voltar do background
  useAppLifecycle(triggerSync);

  if (loading) return <Splash />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Suspense fallback={<Splash />}><LoginPage /></Suspense>}
      />
      <Route path="/admin" element={<Suspense fallback={<Splash />}><AdminPage /></Suspense>} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/" element={<DiaryPage />} />
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/metas" element={<GoalsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Suspense fallback={<Splash />}><NotFound /></Suspense>} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <ErrorBoundary>
                  <AppRoutes />
                </ErrorBoundary>
                <InstallBanner />
              </BrowserRouter>
            </TooltipProvider>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
