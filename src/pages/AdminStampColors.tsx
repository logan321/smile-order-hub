import { useState } from 'react';
import { useStampCatalog } from '@/hooks/useStampCatalog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Palette, Upload, Loader2, ChevronRight, Image as ImageIcon } from 'lucide-react';
import StampUvColorManager from '@/components/StampUvColorManager';
import { toast } from 'sonner';

export default function AdminStampColors() {
  const { stamps, loading, updateStampUv } = useStampCatalog();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [uploadingUv, setUploadingUv] = useState<string | null>(null);

  const filteredStamps = stamps.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedStamp = stamps.find(s => s.id === selectedStampId);

  const handleUvUpload = async (stampId: string, file: File) => {
    if (!file.type.includes('svg')) {
      toast.error('Por favor, selecione um arquivo SVG');
      return;
    }

    setUploadingUv(stampId);
    try {
      await updateStampUv(stampId, file);
      toast.success('SVG de UV atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploadingUv(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Cores das Estampas</h1>
        <p className="page-description">Gerencie as regiões coloríveis de cada estampa usando SVGs de UV</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar: Stamp List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="p-4 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar estampa..."
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-0 h-[600px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStamps.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground italic">Nenhuma estampa encontrada.</p>
              ) : (
                <div className="space-y-1">
                  {filteredStamps.map((stamp) => (
                    <button
                      key={stamp.id}
                      onClick={() => setSelectedStampId(stamp.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                        selectedStampId === stamp.id 
                          ? 'bg-primary/10 border border-primary/20 ring-1 ring-primary/10' 
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="relative h-12 w-10 shrink-0 bg-muted rounded overflow-hidden border border-border/50">
                        <img 
                          src={stamp.imageUrl} 
                          alt={stamp.name} 
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{stamp.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stamp.category}</p>
                      </div>
                      {stamp.uvMapUrl ? (
                        <div className="h-2 w-2 rounded-full bg-success" title="UV configurado" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted" title="Sem UV" />
                      )}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${selectedStampId === stamp.id ? 'rotate-90 text-primary' : ''}`} />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content: Config Area */}
        <div className="lg:col-span-8">
          {selectedStamp ? (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6">
                {!selectedStamp.uvMapUrl ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-lg font-semibold">Nenhum SVG de UV configurado</h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                        Para configurar cores dinâmicas, faça o upload do SVG de UV correspondente a esta estampa.
                      </p>
                    </div>
                    <div className="pt-4">
                      <input
                        type="file"
                        id="uv-upload"
                        className="hidden"
                        accept=".svg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUvUpload(selectedStamp.id, file);
                        }}
                      />
                      <Button asChild disabled={uploadingUv === selectedStamp.id}>
                        <label htmlFor="uv-upload" className="cursor-pointer">
                          {uploadingUv === selectedStamp.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Fazer Upload do SVG UV
                        </label>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <StampUvColorManager 
                      stampId={selectedStamp.id}
                      stampName={selectedStamp.name}
                      svgUrl={selectedStamp.uvMapUrl}
                    />
                    
                    <div className="pt-6 border-t border-border/30">
                      <p className="text-xs text-muted-foreground mb-3 font-medium">Alterar arquivo UV:</p>
                      <input
                        type="file"
                        id="uv-update"
                        className="hidden"
                        accept=".svg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUvUpload(selectedStamp.id, file);
                        }}
                      />
                      <Button variant="outline" size="sm" asChild disabled={uploadingUv === selectedStamp.id}>
                        <label htmlFor="uv-update" className="cursor-pointer">
                          <Upload className="h-3.5 w-3.5 mr-2" />
                          Substituir SVG UV
                        </label>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 border-dashed bg-muted/10 h-full min-h-[400px]">
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Palette className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Selecione uma estampa</h3>
                <p className="text-sm text-muted-foreground max-w-xs mt-1">
                  Escolha uma estampa na lista lateral para configurar o mapeamento de cores dinâmicas.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
