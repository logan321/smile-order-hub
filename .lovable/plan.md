# Personalização 100% UV-based

## Mudança fundamental

Hoje: posições calculadas no preview 2D da camisa → bake → textura UV → 3D (gera deslocamento).
Novo: usuário edita elementos em um **canvas com o tamanho exato da textura UV**, dentro de **zonas definidas em pixels UV reais**. Essa textura UV vira diretamente o `map` do material 3D — sem conversão de coordenadas, sem bake intermediário.

## Modelo de dados

Cada `shirt_template` (ou `uv_map`) recebe um JSON `uv_zones` com zonas em pixels da textura UV:

```json
{
  "uvWidth": 4096,
  "uvHeight": 4096,
  "zones": {
    "name_back":    { "x": 1600, "y": 700,  "width": 900, "height": 200 },
    "number_back":  { "x": 1700, "y": 950,  "width": 700, "height": 700 },
    "chest_right":  { "x": 2800, "y": 1200, "width": 400, "height": 300 },
    "sleeve_left":  { "x": 200,  "y": 1400, "width": 350, "height": 350 }
  }
}
```

Migração:
- `uv_maps.uv_zones jsonb` (canônico) + `uv_maps.uv_width int`, `uv_maps.uv_height int`
- Manter `template_zones` (coords 2D do preview) só para overlay visual das zonas — não usado em render.

## Render pipeline (UV Compositor)

Novo módulo `src/lib/uvCompositor.ts`:

1. Cria um `OffscreenCanvas` (fallback HTMLCanvas) `uvWidth × uvHeight`.
2. Desenha a textura UV base (imagem original do CLO3D) como camada 0.
3. Para cada `layer` do usuário (`{ zoneKey, type: 'text'|'image', content, fontFamily, fontSize, color, rotation, scale, offsetX, offsetY, align }`):
   - Lê a zona pelo `zoneKey` do JSON.
   - Aplica `ctx.save() / translate(zone center) / rotate / clip(zone rect)`.
   - Renderiza texto (auto-fit dentro da zona) ou imagem PNG (contain).
   - `ctx.restore()`.
4. Retorna um `THREE.CanvasTexture` (ou atualiza o existente com `texture.needsUpdate = true`).

Hook `useUvCompositor(baseUrl, zones, layers)` devolve `{ texture, dataURL, redraw }`.

## Three.js

`Shirt3DPreview` (atual) passa a aceitar `texture: THREE.Texture` em vez de URL. O material da malha usa `material.map = texture; material.needsUpdate = true`. Modelo nunca é recarregado, só a textura.

## Editor (ShirtEditor.tsx)

- Sidebar de camadas em vez de canvas Fabric livre.
- Botão "Adicionar nome" → cria layer `{ zoneKey: 'name_back', type: 'text', content: '' }`. Usuário edita texto/fonte/cor no painel.
- Cada layer aparece como item editável (texto, imagem upload, número, logo do catálogo).
- Preview 2D frontal/traseiro = imagem da camisa com **overlays semi-transparentes** das zonas (lidos do JSON via mapeamento UV→2D só visual, opcional) — clique na zona seleciona/cria layer. **Nunca usado para coordenadas.**
- Preview 3D = `Shirt3DPreview` recebendo a `CanvasTexture` ao vivo.

## Admin: definir zonas UV

Nova aba em `EditorSettings` → "Zonas UV":
- Carrega a imagem UV base.
- Mostra retângulos sobre ela; admin arrasta/resize.
- Salva `uv_zones` no template/uv_map.
- Permite renomear chaves (`name_back`, `chest_right`, etc.).

## Exportação (PDF/orçamento)

- Frente/costas: captura do canvas 3D em 0° e 180° (já implementado).
- "Textura final": exporta o `dataURL` do compositor como PNG (útil para produção/CLO3D).

## Arquivos afetados

- **Nova migration**: add `uv_zones jsonb`, `uv_width int`, `uv_height int` em `uv_maps`.
- **Novo**: `src/lib/uvCompositor.ts`, `src/hooks/useUvCompositor.ts`, `src/components/UvZoneAdminEditor.tsx`, `src/components/LayerPanel.tsx`.
- **Refatorar**: `src/pages/ShirtEditor.tsx` (remove Fabric coord-based logic; usa LayerPanel + compositor), `src/components/Shirt3DPreview.tsx` (aceita texture), `src/pages/EditorSettings.tsx` (nova aba), `src/hooks/useUvLibrary.ts` (expor uv_zones).
- **Manter como fallback**: `template_zones` 2D e Fabric (modo legacy enquanto admin não cadastra zonas UV).

## Ordem de entrega

1. Migration `uv_zones` + hook expondo.
2. `uvCompositor` + `useUvCompositor` + `Shirt3DPreview` aceitando texture viva. Teste com zonas hardcoded.
3. Admin UI de zonas UV.
4. Refatorar ShirtEditor para usar LayerPanel (texto/número/logo).
5. Remover paths legacy quando o usuário confirmar.

Quer que eu siga nessa ordem? Posso começar pelos passos 1+2 agora (base funcional ponta-a-ponta) e depois iterar admin/editor.
