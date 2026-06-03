# Adotar mecânica de decals 3D (estilo Jumptec) no editor de camisas

## O que muda na prática (visão do usuário)

Hoje:
- Você marca uma "zona" no editor 2D (peito, costas, etc.)
- O sistema tenta **pintar uma textura** com tudo dentro dessa zona e aplicar na camisa 3D
- Qualquer descasamento entre o 2D e o UV map da camisa desloca o emblema → bug atual

Novo:
- Cada emblema/texto/logo vira um **adesivo (decal)** colado direto na superfície 3D da camisa
- Você pode **clicar no 3D** para posicionar, e arrastar/girar/escalar o adesivo lá mesmo
- Zonas pré-definidas continuam existindo (peito direito, costas, manga…) mas agora são **pontos salvos no modelo 3D**, não retângulos no 2D
- Resultado: o emblema cai exatamente onde foi marcado, sempre — porque o decal "envelopa" a malha automaticamente

## Por que isso resolve o bug

A Jumptec usa `THREE.DecalGeometry`. É o método oficial do Three.js para colar adesivos em modelo 3D arbitrário. Ele não depende de UV map nem de bake de textura — projeta direto na malha usando ponto + normal da superfície. Por isso nunca desloca.

## Etapas

### 1. Novo componente `Shirt3DEditor` (substitui o `Shirt3DPreview` atual no editor)
- Carrega o GLB já existente
- Aceita uma lista de "decals": `{ id, textureUrl, position, normal, size, rotation }`
- Renderiza cada decal com `DecalGeometry` por cima do mesh da camisa
- Clique no 3D faz raycast → devolve `position + normal` para o editor
- Decal selecionado mostra handles de mover/girar/escalar (gizmo)
- Cor de tecido continua aplicada no material base do mesh

### 2. Conversão de objeto Fabric → textura PNG individual
- Cada texto/logo/patch é renderizado isoladamente em um canvas off-screen → `dataURL`
- Essa imagem vira a textura do decal correspondente
- Atualizar texto ou cor regera só a textura daquele decal (sem rebake do UV inteiro)

### 3. Zonas como presets 3D
- Nova tela em admin de templates: "Definir zonas no 3D"
- Admin clica nos pontos da camisa 3D (peito direito, costas, manga esq…) e salva `position + normal + tamanho padrão` por zona
- Migração: adicionar colunas `position_3d (jsonb)`, `normal_3d (jsonb)`, `default_size` em `template_zones`
- Zonas 2D antigas continuam funcionando como fallback até o admin recadastrar

### 4. Editor (ShirtEditor.tsx)
- Quando o usuário escolhe um emblema/texto/logo e seleciona uma zona, em vez de adicionar ao canvas Fabric da zona, criar um decal no `Shirt3DEditor` usando o preset 3D da zona
- "Adicionar livre" (sem zona): usuário clica no 3D → cria decal naquele ponto
- Painel lateral lista os decals atuais (excluir, duplicar, ajustar tamanho/rotação)
- Modo 2D continua existindo para compatibilidade (e para o PDF de produção)

### 5. Exportação
- PDF/orçamento: render do canvas 3D para PNG (`gl.preserveDrawingBuffer` já está ligado)
- Frente/costas: girar câmera para 0° e 180°, capturar cada vista

## Detalhes técnicos

- `import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'`
- Raycast: `new THREE.Raycaster()` em `onPointerDown` do `<Canvas>` do R3F
- Material do decal: `MeshStandardMaterial({ map, transparent: true, polygonOffset: true, polygonOffsetFactor: -4, depthTest: true, depthWrite: false })`
- Tamanho do decal: `new THREE.Vector3(w, h, depth)` — `depth` define até onde "envelopa" a malha
- Rotação: euler em torno da normal
- Para evitar z-fighting: `polygonOffsetFactor: -4` é padrão

## Arquivos afetados

- `src/components/Shirt3DPreview.tsx` — vira `Shirt3DEditor.tsx` (modo edit) + mantém leitura simples
- `src/pages/ShirtEditor.tsx` — fluxo de adicionar texto/logo/patch passa a criar decals
- `src/hooks/useTemplateZones.ts` — expor campos 3D quando existirem
- Nova página/aba no admin para marcar zonas 3D
- Migration Supabase: colunas 3D em `template_zones`

## O que NÃO muda

- GLB existente, lista de zonas existentes, catálogo de stamps/patches, fluxo de orçamento, PDF
- Modo 2D do editor continua funcionando — o 3D só vira a "verdade" visual

## Riscos

- Refatoração grande: ~2 dias de trabalho equivalente. Vou em etapas com você testando cada uma.
- Admin precisará **recadastrar zonas 3D** clicando no modelo (poucos cliques por template)
- Até o admin recadastrar, a camisa daquele template usa fallback 2D (não piora vs. hoje)

## Ordem de entrega sugerida

1. Migration + componente `Shirt3DEditor` com decals controlados por props (sem UI ainda)
2. Tela admin "Definir zonas 3D" + salvar no banco
3. Ligar fluxo do editor: adicionar texto/logo/patch → decal 3D
4. Gizmo de mover/girar/escalar no 3D
5. Captura 3D para PDF

Quer que eu siga nessa ordem?
