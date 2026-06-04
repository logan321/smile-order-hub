## Objetivo
Substituir o editor atual (Fabric 2D + preview 3D) por um **editor 100% 3D** com layout inspirado no Jumptec: sidebar vertical de ícones à esquerda + painel deslizante de opções + visualização 3D grande no centro/direita.

## Por que rebuild
O `ShirtEditor.tsx` atual tem 2595 linhas com lógica Fabric.js (2D) profundamente acoplada. Você relatou que mudanças no 2D não refletem no 3D — isso vai continuar acontecendo enquanto os dois sistemas coexistirem. Solução: **remover o Fabric.js do fluxo do cliente** e fazer toda edição direto no 3D usando o pipeline UV (texto/imagem desenhados no canvas de textura via `composeUvTexture` que já existe e já alimenta o 3D).

## Novo layout (igual ao Jumptec)

```text
┌──────┬──────────────────┬─────────────────────────────────┐
│ ICO  │  PAINEL          │                                 │
│ BAR  │  da aba ativa    │     CAMISA 3D                   │
│      │                  │     (grande, rotaciona)         │
│ 👕   │ [opções]         │                                 │
│ 🎨   │                  │   [Salvar] [Enviar Orçamento]   │
│ ✂️   │                  │                                 │
│ A    │                  │   ◀  →  controles de câmera     │
│ 🛡    │                  │                                 │
│ ⬆    │                  │                                 │
└──────┴──────────────────┴─────────────────────────────────┘
```

**Abas da sidebar (ícones verticais):**
1. **Modelo** — escolher template de camisa
2. **Cores** — cor base do tecido + cores de detalhes
3. **Acabamentos** — gola, manga (presets visuais)
4. **Nome / Número** — input nome, número, fonte, cor, contorno, tamanho, **curvatura em arco**
5. **Escudo / Emblemas** — galeria de emblemas cadastrados pelo admin (trator, peixe, etc.)
6. **Upload** — cliente faz upload da própria logo/imagem (PNG/JPG/SVG)

Cada item adicionado vira uma **layer UV** (texto ou imagem) ancorada em uma **zona** (peito, costas, manga). O cliente clica na zona desejada (ou seleciona em dropdown) e o item é desenhado direto na textura do 3D em tempo real.

## Mudanças técnicas

- **Remover do `ShirtEditor.tsx`**: o `<canvas>` Fabric.js visível, todas as abas `text/stamps/patches/textStyles` que dependiam de Fabric, toggle "Ver 2D/3D".
- **Manter & reusar**: `useUvCompositor`, `composeUvTexture`, `useUvLibrary` (zonas), tabela `emblems` e bucket `shirt-designs`.
- **Novo componente `ShirtEditor3DLayout.tsx`**: sidebar de ícones + painel + `<Shirt3DPreview/>` central. Estado local de `layers: UvLayer[]` em vez de objetos Fabric.
- **Texto em arco no UV**: portar `buildArcPath` para desenhar texto em arco direto no canvas 2D do compositor (usando `Path2D` + `textBaseline`), já que não temos mais Fabric. Implementação: dividir o texto em caracteres e posicionar cada um ao longo de uma curva quadrática.
- **Logo upload**: cliente seleciona arquivo → sobe pro bucket `shirt-designs/{userId}/` → vira layer image na zona escolhida.
- **Emblemas admin**: lista da tabela `emblems` filtrada pelo `niche` do template. (Admin CRUD já estava pendente — fica para próxima etapa, por ora cliente já consegue usar o que estiver cadastrado.)
- **Persistência**: salvar `{ baseTemplateId, fabricColor, layers[] }` em vez do JSON Fabric. Migração: pedidos antigos com payload Fabric continuam carregando como "somente leitura" (ou ignorar — confirmar abaixo).

## Detalhes visuais (estilo Jumptec)
- Sidebar: 64px largura no desktop, ícones grandes + label pequena embaixo, aba ativa com destaque accent.
- Painel da aba: 280px largura, fundo claro, scroll vertical.
- Mobile: sidebar vira barra inferior fixa (igual à atual), painel abre como sheet.
- Botões "Enviar Orçamento" / "Salvar Simulação" no topo do painel 3D.

## Pendências para você confirmar
1. **Pedidos antigos** (já salvos com payload Fabric 2D) — devolver erro, ou mostrar só leitura, ou descartar?
2. **Estampas / Patches** (abas atuais com catálogo de estampas e patches) — continuam? viram emblemas? somem? Vi que você listou só: Modelo, Cores, Acabamentos, Nome/Número, Escudo, Upload — confirma que **estampas e patches saem**?
3. **Texto livre**: além de Nome/Número, quer aba "Texto" separada (frase qualquer com cor/contorno/arco) ou Nome/Número já basta?
