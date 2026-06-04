## Objetivo

Reforçar o editor 2D (que alimenta o 3D) com:
1. Edição **ao vivo** de textos já adicionados (cor, contorno, tamanho).
2. **Texto em arco** com curvatura ajustável (slider).
3. Nova aba **Nome** (texto rápido com presets prontos).
4. Nova aba **Emblemas** com biblioteca do admin **+ upload do cliente**.

A aba **Logo** continua existindo como hoje.

---

## 1. Edição ao vivo do texto selecionado

Hoje os controles (cor, contorno, fonte, tamanho, sombra) só valem para o **próximo** texto a ser adicionado. Vou ligar esses inputs também ao objeto Fabric selecionado:

- Ao selecionar um texto no canvas, o painel carrega seus valores atuais.
- Ao mudar qualquer slider/cor/fonte, aplica em tempo real (`obj.set(...) + canvas.requestRenderAll() + bumpEdits()`).
- Funciona tanto na aba **Texto** quanto na aba **Nome**.

## 2. Texto em arco (curvatura ajustável)

Adicionar um slider **"Curvatura"** (-100 a +100, 0 = reto) no painel de texto.

Implementação: gerar um path SVG de arco com base na largura do texto e na curvatura, criar um `Path` Fabric invisível e usar `path` em `FabricText` (Fabric v6 suporta texto em path). Reaplicar quando o texto, fonte ou curvatura mudarem.

Limitação: textos multi-linha (Textbox) seguem retos — arco só faz sentido em uma linha.

## 3. Aba "Nome"

Nova aba no toolbar (entre Texto e Logo), com ícone próprio. Reaproveita o mesmo motor de texto, mas com UX simplificada:

- Campo "Nome" + Campo "Número" (opcional).
- Presets rápidos: estilo Camisa Esportiva (nome em arco em cima + número grande embaixo) e estilo Reto.
- Mesmos controles de cor/contorno/tamanho/curvatura.
- Internamente cria 1 ou 2 objetos `FabricText` com `_elementType = 'name'`.

## 4. Aba "Emblemas"

Nova aba no toolbar com:

**Biblioteca pública (admin):**
- Nova tabela `emblems` (id, user_id do admin/dono, name, category, image_url, niche_id, active, position).
- Filtra por nicho selecionado igual estampas/patches.
- Admin gerencia via página existente de configurações do editor (nova seção "Emblemas").

**Uploads do cliente:**
- Botão "Enviar meu emblema" que abre o file picker.
- Imagem vai pro bucket `shirt-designs` (já existe e é público), namespace `emblems-uploads/`.
- Persistido por sessão do editor (estado local `clientEmblems`) — não polui o catálogo público.
- Mesmo comportamento de inserção que estampas/logos (centraliza no canvas ativo, respeita zonas).

## 5. Banco de dados

Migration nova:

```sql
CREATE TABLE public.emblems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  image_url text NOT NULL,
  niche_id uuid REFERENCES public.niches(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emblems TO authenticated;
GRANT SELECT ON public.emblems TO anon;  -- editor público lê por user_id
GRANT ALL ON public.emblems TO service_role;

ALTER TABLE public.emblems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own emblems" ON public.emblems
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "public can read active emblems" ON public.emblems
  FOR SELECT TO anon, authenticated
  USING (active = true);
```

## 6. Arquivos a tocar

```text
src/pages/ShirtEditor.tsx          # edição ao vivo, slider arco, abas Nome/Emblemas, fetch+upload
src/pages/EditorSettings.tsx       # nova seção admin de Emblemas (CRUD igual estampas)
src/lib/fabricArcText.ts (novo)    # helper p/ gerar path de arco e aplicar em FabricText
supabase/migrations/<novo>.sql     # tabela emblems
```

Nada de mudanças no `Shirt3DPreview` / `Shirt3DEditor` — tudo continua sendo "bakeado" no canvas 2D e jogado na textura UV, como já funciona hoje. Sem risco para o que acertamos na iluminação 3D.

---

## Detalhes técnicos

- **Arco**: usa `M x0,y0 A r,r 0 0,1 x1,y1` calculado a partir da largura do texto e da curvatura (raio = `largura / (2 * sin(angulo/2))`).
- **Live edit**: handlers em `onChange` checam `canvas.getActiveObject()` e, se for `_userElement` do tipo text/name, aplicam a mudança neles em vez de só salvar no state.
- **Upload cliente**: usa `supabase.storage.from('shirt-designs').upload(...)` + `getPublicUrl`. Sem precisar de bucket novo.
- **Performance**: re-renderizar arco em cada keystroke é OK (objetos Fabric são leves), mas faço `requestRenderAll` (não `renderAll`) e debouncing só se notar lag no mobile.
