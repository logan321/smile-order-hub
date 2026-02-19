import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Palette, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useStampColors } from '@/hooks/useStampColors';

interface StampColorManagerProps {
  stampId: string;
  stampName: string;
  targetUserId?: string;
}

const StampColorManager = ({ stampId, stampName, targetUserId }: StampColorManagerProps) => {
  const [open, setOpen] = useState(false);
  const { colors, loading, addColor, deleteColor } = useStampColors(open ? stampId : undefined, targetUserId);

  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#000000');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (!colorName.trim() || !frontFile) {
      toast.error('Nome da cor e imagem frente são obrigatórios');
      return;
    }
    setUploading(true);
    try {
      await addColor(colorName.trim(), colorHex, frontFile, backFile || undefined);
      setColorName('');
      setColorHex('#000000');
      setFrontFile(null);
      setBackFile(null);
      if (frontRef.current) frontRef.current.value = '';
      if (backRef.current) backRef.current.value = '';
      toast.success('Cor adicionada!');
    } catch {
      toast.error('Erro ao adicionar cor');
    }
    setUploading(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={() => setOpen(true)}
        title="Gerenciar cores"
      >
        <Palette className="h-3.5 w-3.5 text-primary" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Cores - {stampName}
            </DialogTitle>
            <DialogDescription>
              Adicione variantes de cor com imagens diferentes para esta estampa
            </DialogDescription>
          </DialogHeader>

          {/* Existing colors */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : colors.length > 0 ? (
            <div className="space-y-2">
              {colors.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-muted/20">
                  <div
                    className="h-8 w-8 rounded-full border-2 border-border flex-shrink-0"
                    style={{ backgroundColor: c.colorHex }}
                  />
                  <img src={c.imageUrl} alt={c.colorName} className="h-10 w-8 object-contain rounded flex-shrink-0" />
                  {c.backImageUrl && (
                    <img src={c.backImageUrl} alt={`${c.colorName} costas`} className="h-10 w-8 object-contain rounded flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium flex-1 truncate">{c.colorName}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { if (confirm('Remover esta cor?')) deleteColor(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma variante de cor cadastrada
            </p>
          )}

          {/* Add new color */}
          <div className="space-y-3 border-t border-border/50 pt-4">
            <p className="text-sm font-medium">Adicionar nova cor</p>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={colorHex}
                onChange={e => setColorHex(e.target.value)}
                className="h-9 w-9 rounded border border-border cursor-pointer flex-shrink-0"
              />
              <Input
                value={colorName}
                onChange={e => setColorName(e.target.value)}
                placeholder="Nome da cor (ex: Vermelho)"
                className="flex-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Imagem Frente *</label>
                <div className="border border-dashed border-border rounded-lg p-3">
                  <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{frontFile ? frontFile.name : 'Selecionar'}</span>
                    <input
                      ref={frontRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={e => setFrontFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Imagem Costas</label>
                <div className="border border-dashed border-border rounded-lg p-3">
                  <label className="flex flex-col items-center gap-1 cursor-pointer text-center">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{backFile ? backFile.name : 'Selecionar'}</span>
                    <input
                      ref={backRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={e => setBackFile(e.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
            <Button onClick={handleAdd} disabled={uploading || !colorName.trim() || !frontFile} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Adicionar Cor'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StampColorManager;
