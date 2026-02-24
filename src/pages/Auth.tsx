import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { LogIn, UserPlus, Search } from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/fingerprint';

const ALLOWED_DOMAINS = ['gmail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br', 'live.com', 'msn.com'];

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/', { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateEmailDomain = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    return !!domain && ALLOWED_DOMAINS.includes(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Login realizado!');
      } else {
        // Client-side domain check
        if (!validateEmailDomain(email)) {
          toast.error('Utilize um e-mail Gmail, Hotmail ou Outlook para se cadastrar.');
          setLoading(false);
          return;
        }

        // Server-side validation + fingerprint check
        const fingerprint = await getDeviceFingerprint();
        const { data, error: fnError } = await supabase.functions.invoke('validate-signup', {
          body: { email, fingerprint },
        });

        if (fnError) throw fnError;
        if (!data?.allowed) {
          toast.error(data?.reason || 'Cadastro não permitido.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu e-mail para confirmar.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold font-display">
            <span className="text-accent">●</span> GestãoPro
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Entre na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">E-mail</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@gmail.com"
                required
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Aceito: Gmail, Hotmail ou Outlook
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {isLogin ? <LogIn className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar Conta'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? 'Não tem conta? Criar uma' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <a
            href="/rastreio"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-border bg-card text-foreground font-medium hover:bg-accent transition-colors"
          >
            <Search className="h-4 w-4" />
            Consultar pedido
          </a>
        </div>
      </div>
    </div>
  );
};

export default Auth;
