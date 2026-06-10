import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import EditorSettings from './EditorSettings';
import MobileEditorSettings from '@/components/MobileEditorSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const AdminEditorConfig = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || undefined;
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao painel
        </Button>
      </div>

      <Tabs defaultValue="production" className="w-full">
        <TabsList className="mb-8 w-full max-w-md mx-auto grid grid-cols-2 bg-slate-100 p-1">
          <TabsTrigger value="production">Configuração Produção</TabsTrigger>
          <TabsTrigger value="mobile-test" className="text-orange-600 font-bold">Laboratório Mobile (Teste)</TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="animate-in fade-in duration-500">
          <EditorSettings targetUserId={userId} targetEmail={email} />
        </TabsContent>

        <TabsContent value="mobile-test" className="animate-in fade-in duration-500">
          <MobileEditorSettings targetUserId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminEditorConfig;
