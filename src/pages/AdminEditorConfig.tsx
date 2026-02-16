import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import EditorSettings from './EditorSettings';

const AdminEditorConfig = () => {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || undefined;
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao painel
        </Button>
      </div>
      <EditorSettings targetUserId={userId} targetEmail={email} />
    </div>
  );
};

export default AdminEditorConfig;
