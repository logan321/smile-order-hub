import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ShoppingCart, Wrench, FileText, Settings, Menu, X, LogOut, Shield, Shirt, Palette, Calculator, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { useSiteConfigContext } from '@/contexts/SiteConfigContext';
import { getColor } from '@/lib/siteConfigUtils';
import logoOriginal from '@/assets/logo.png';

const navItems = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Pedidos', to: '/pedidos', icon: ShoppingCart },
  { label: 'Serviços', to: '/servicos', icon: Wrench },
  { label: 'Orçamentos', to: '/orcamentos', icon: Calculator },
  { label: 'Relatórios', to: '/relatorios', icon: FileText },
  { label: 'Configurações', to: '/configuracoes', icon: Settings },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, editorEnabled } = useSubscription();
  const { theme, toggle: toggleTheme } = useTheme();
  const { configs } = useSiteConfigContext();

  const logo = configs['logo_url']?.trim() || logoOriginal;
  const sidebarBg = getColor(configs, 'sidebar_bg_color', 'var(--sidebar-background)');
  const sidebarText = getColor(configs, 'sidebar_text_color', 'var(--sidebar-foreground)');
  const headerBg = getColor(configs, 'header_bg_color', 'var(--background)');
  const headerText = getColor(configs, 'header_text_color', 'var(--foreground)');
  const appTitle = configs['app_title'] || 'Macro Master';

  const allNavItems = [
    ...navItems,
    ...(editorEnabled ? [
      { label: 'Config. Editor', to: '/config-editor', icon: Palette },
      { label: 'Editor', to: '/meu-editor', icon: Shirt },
    ] : []),
    ...(isAdmin ? [
      { label: 'Admin', to: '/admin', icon: Shield },
      { label: 'Aparência do Site', to: '/admin/site-config', icon: Palette }
    ] : []),
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Desconectado!');
    navigate('/login');
  };

  return (
    <div 
      className="min-h-screen flex" 
      style={{ 
        fontFamily: configs['font_family'] || 'inherit',
        fontSize: configs['font_size_base'] || 'inherit'
      }}
    >
      {/* Desktop Sidebar */}
      <aside 
        className="hidden md:flex flex-col w-60 border-r border-sidebar-border shrink-0 transition-colors"
        style={{ backgroundColor: sidebarBg, color: sidebarText }}
      >
        <div className="p-5 flex items-center gap-2">
          <img src={logo} alt={appTitle} className="h-8 w-auto object-contain" />
          <span className="font-bold text-sm hidden lg:block uppercase tracking-tight">{appTitle}</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {allNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full mb-1"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header 
          className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border transition-colors"
          style={{ backgroundColor: headerBg, color: headerText }}
        >
          <img src={logo} alt={appTitle} className="h-7 w-auto object-contain" />
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2" aria-label="Alternar tema">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </header>

        {/* Mobile Nav Overlay */}
        {mobileOpen && (
          <div className="md:hidden bg-card border-b border-border px-4 pb-3 animate-fade-in">
            {allNavItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-muted transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
