# Biblioteca de UVs + Zonas sobre UV

## 1. Nova biblioteca de UVs (independente)

**Nova tabela `uv_maps`:**
- `id`, `user_id`, `code` (único por usuário, ex: "UV-001"), `name` (opcional), `image_url`, `created_at`, `updated_at`
- RLS: dono gerencia tudo; service_role full.

**Novo bucket** já existe (`stamp-catalog` reutilizado) — vamos usar um subpath `uv-library/` ou criar bucket `uv-maps`. Plano: reutilizar `stamp-catalog` com prefixo `uv-library/` pra evitar nova config.

**Nova aba em `EditorSettings.tsx` → "Biblioteca de UVs":**
- Listagem em grid: miniatura do UV + código + nome
- Botões: upload novo UV (código + arquivo), editar código/nome, deletar
- Hook novo: `useUvLibrary.ts` (fetch/add/update/delete)

## 2. Vincular estampa ao UV pelo código

**Alteração em `stamp_catalog`:**
- Adicionar `uv_map_id uuid references uv_maps(id) on delete set null`
- Manter `uv_map_url` por compatibilidade (legacy), mas UI nova usa só `uv_map_id`
- No formulário de cadastro de estampa: trocar o upload de UV por um **select de UV** (lista os códigos da biblioteca). Mostra preview do UV escolhido.

**Em `ShirtEditor.tsx`:**
- `effectiveUvUrl` passa a resolver via `stamp.uvMapId → uv_maps.image_url` (com fallback ao `uvMapUrl` legacy)

## 3. Zonas sobre o UV map (substituindo template)

**Alteração em `template_zones`:**
- Adicionar `uv_map_id uuid references uv_maps(id) on delete cascade`
- Tornar `template_id` opcional (nullable)
- Zonas passam a ser vinculadas a um UV, não a um template

**Hook `useTemplateZones.ts` → renomear conceitualmente:** aceita `uvMapId` em vez de `templateId`. Mantém mesma API. (Renomeio só de parâmetro; vou criar `useUvZones.ts` novo e manter o antigo só pra leitura legacy.)

**`ZoneEditor.tsx`:** já recebe `imageUrl` como prop — passa a receber a URL do UV em vez do template. Sem mudanças internas.

**Em `EditorSettings.tsx`:**
- Remover botão "Editar Zonas" do card de template
- Adicionar botão "Editar Zonas" em cada UV da biblioteca → abre `ZoneEditor` com a imagem do UV

**Em `ShirtEditor.tsx`:**
- Zonas exibidas no editor passam a vir do UV ativo (da estampa selecionada ou do template)
- As coordenadas % das zonas mapeiam sobre o UV (que é mapeado no 3D), garantindo posição correta no modelo

## 4. Migração de dados existentes

- Para cada template com `uv_map_url`: cria entrada em `uv_maps` (code = "TPL-" + 4 chars do id), seta `template.uv_map_id` (novo campo) e migra zonas antigas (`template_id` → `uv_map_id`).
- Para cada stamp com `uv_map_url`: idem, cria UV na biblioteca e seta `stamp.uv_map_id`.

## Arquivos

**Novos:**
- `src/hooks/useUvLibrary.ts`
- Migration: criar `uv_maps`, adicionar colunas, migrar dados, atualizar trigger redirect.

**Editados:**
- `src/pages/EditorSettings.tsx` — nova aba "Biblioteca de UVs", remover botão zonas do template, adicionar nos UVs, trocar upload de UV por select nas estampas
- `src/hooks/useStampCatalog.ts` — suportar `uvMapId`
- `src/hooks/useShirtTemplates.ts` — suportar `uvMapId` (opcional, legacy)
- `src/hooks/useTemplateZones.ts` — aceitar `uvMapId` além de `templateId`
- `src/pages/ShirtEditor.tsx` — resolver UV via id, exibir zonas do UV ativo
- `src/components/ZoneEditor.tsx` — só ajuste de label ("UV map" em vez de "template")
- `src/integrations/supabase/types.ts` — regerado após migração

## Notas técnicas

- Manter compatibilidade: `uv_map_url` antigo continua funcionando, mas UI nova prioriza `uv_map_id`.
- Trigger `redirect_stamp_like_template` continua válido (sem mudanças).
- Zonas legadas amarradas a `template_id` continuam funcionando no ShirtEditor como fallback se o template não tiver UV vinculada ainda.
