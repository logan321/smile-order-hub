import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import { SiteConfigProvider } from "@/contexts/SiteConfigContext";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import AppLayout from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Orders from "./pages/Orders";
import Services from "./pages/Services";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Auth from "./pages/Auth";
import TrackOrder from "./pages/TrackOrder";
import Admin from "./pages/Admin";
import SubscriptionPage from "./pages/Subscription";
import ShirtEditor from "./pages/ShirtEditor";
import EditorSettings from "./pages/EditorSettings";
import AdminEditorConfig from "./pages/AdminEditorConfig";
import AdminConfigPage from "./pages/AdminConfigPage";
import Budgets from "./pages/Budgets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const SubscriptionGuard = ({ children }: { children: React.ReactNode }) => {
  const { active, isAdmin, status, trialEndsAt, loading } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Verificando assinatura...</div>
      </div>
    );
  }

  if (!active && !isAdmin) {
    return <SubscriptionPage status={status} trialEndsAt={trialEndsAt} />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AppProvider>
        <SiteConfigProvider>
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Auth />} />
            <Route path="/rastreio/:slug" element={<TrackOrder />} />
            <Route path="/editor/:userId" element={<ShirtEditor />} />

            {/* Protected + subscription required routes */}
            <Route path="/" element={<ProtectedRoute><SubscriptionGuard><AppLayout><Dashboard /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><SubscriptionGuard><AppLayout><Clients /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/pedidos" element={<ProtectedRoute><SubscriptionGuard><AppLayout><Orders /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/servicos" element={<ProtectedRoute><SubscriptionGuard><AppLayout><Services /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/orcamentos" element={<ProtectedRoute><SubscriptionGuard><AppLayout><Budgets /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><SubscriptionGuard><AppLayout><Reports /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><SubscriptionGuard><AppLayout><SettingsPage /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/config-editor" element={<ProtectedRoute><SubscriptionGuard><AppLayout><EditorSettings /></AppLayout></SubscriptionGuard></ProtectedRoute>} />
            <Route path="/meu-editor" element={<ProtectedRoute><SubscriptionGuard><ShirtEditor useOwnAssets /></SubscriptionGuard></ProtectedRoute>} />

            {/* Admin only */}
            <Route path="/admin" element={<ProtectedRoute><AdminRoute><AppLayout><Admin /></AppLayout></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/editor/:userId" element={<ProtectedRoute><AdminRoute><AppLayout><AdminEditorConfig /></AppLayout></AdminRoute></ProtectedRoute>} />
            <Route path="/admin/site-config" element={<ProtectedRoute><AdminRoute><AppLayout><AdminConfigPage /></AppLayout></AdminRoute></ProtectedRoute>} />

            {/* Subscription page */}
            <Route path="/assinatura" element={<ProtectedRoute><SubscriptionPage status="none" /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
