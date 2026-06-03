## Objetivo

Replicar a experiência da imagem de referência (Jumptec): o cliente vê a camisa em 3D ocupando o centro da tela, e na lateral esquerda escolhe entre miniaturas que já mostram a camisa com a estampa aplicada (mockup 2D). Ao clicar numa miniatura, o 3D atualiza com a estampa escolhida.

## Mudanças

### 1. Miniatura mockup 2D (composição automática)
Criar um helper `composeShirtMockup(frontImageUrl, stampImageUrl)` que:
- Desenha a frente da camisa do template num canvas off-screen
- Sobrepõe a estampa centralizada (≈ 60% da largura)
- Retorna um data URL para usar como `<img src>` da miniatura

Usar esse helper para renderizar cada item do painel "Estampas". Sem mudança no banco — composição é feita em runtime e cacheada em memória por `templateId+stampId`.

### 2. Layout do editor para o cliente
No `src/pages/ShirtEditor.tsx`:
- Adicionar um novo modo de visualização "3D principal" ativado por padrão quando o template tem `uvMapUrl` configurado
- Centro da tela: `Shirt3DPreview` ocupando praticamente toda a área (canvas 2D Fabric continua existindo escondido para edição de texto/logo/escudo via modal)
- Lateral esquerda: painéis existentes (Modelo, Cores, Estampas, etc.) — miniaturas de Estampas agora usam o mockup composto
- Quando o cliente clica numa estampa, ela é aplicada ao canvas Fabric (como hoje) e o 3D re-renderiza com a textura UV atualizada
- Botão "Ver 2D" abre modal com o canvas Fabric para ajustes finos
- Templates sem `uvMapUrl` mantêm o fluxo 2D atual (fallback)

### 3. Re-geração da textura UV em tempo real
O `Shirt3DPreview` hoje recebe `uvMapUrl` estático. Vamos passar um `uvCanvas` opcional: quando o cliente aplica uma estampa, geramos um canvas composto = UV base + estampa posicionada na região da frente do molde. Esse canvas vira textura do 3D. Sem isso o 3D não muda quando o cliente troca a estampa.

Para a v1, vamos posicionar a estampa numa região fixa pré-definida do UV (centro da frente) — futuramente o dono poderá ajustar a região no `EditorSettings`.

## Detalhes técnicos

- Novo arquivo: `src/lib/composeMockup.ts` — funções `composeShirtMockup` e `composeUvWithStamp` usando canvas 2D nativo
- `Shirt3DPreview.tsx`: aceitar `uvCanvas?: HTMLCanvasElement | null` além de `uvMapUrl`, e usar `CanvasTexture` quando fornecido
- `ShirtEditor.tsx`: novo state `mainView: '3d' | '2d'`, ref para o canvas UV composto, regenerar quando estampa muda
- Layout mobile: 3D ocupa toda a tela; estampas em drawer/sheet por baixo (manter padrão mobile-first do projeto)

## Fora de escopo

- Edição interativa da posição da estampa no UV (v1 = posição fixa no centro da frente)
- Mockup para meião/calção (foco só na camisa)
- Cachear mockups no banco (tudo em runtime por enquanto)
