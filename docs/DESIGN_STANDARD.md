# DESIGN_STANDARD — padrão visual obrigatório da plataforma

Documento normativo para páginas, tabs e modais da PickleRush. Ele existe para
eliminar deriva visual: qualquer nova tela deve parecer parte do mesmo produto,
não uma implementação isolada.

## 1. Escopo

Aplicação obrigatória em:

1. páginas novas;
2. tabs que funcionam como páginas internas;
3. modais de criação/edição com mais de um bloco de informação;
4. refinamentos futuros de páginas existentes.

## 2. Fundamentos visuais

Os tokens-base vivem em [src/index.css](../src/index.css).

Classes estruturais obrigatórias:

1. `arena-panel-strong`: hero principal ou bloco de destaque máximo.
2. `arena-chip`: etiqueta curta de contexto no topo de heros e painéis.
3. `match-surface`: cards de listagem clicáveis.
4. `rounded-[2rem] border-white/80 bg-white/82`: superfície neutra principal.
5. `rounded-[1.5rem] border border-emerald-950/10 bg-white/75 p-5`: bloco interno de formulário ou conteúdo agrupado.

## 3. Componentes padrão

Para reduzir variação, novas telas devem priorizar os componentes de
[src/components/ui/platform-page.jsx](../src/components/ui/platform-page.jsx).

Componentes canônicos:

1. `PlatformSurfaceCard`: card neutro principal da página.
2. `PlatformSectionHeader`: cabeçalho de seção com eyebrow, título, descrição e ação.
3. `PlatformMetricCard`: card pequeno de métrica ou resumo.
4. `PlatformFormSection`: bloco interno de formulário/configuração.
5. `PlatformNotice`: aviso ou nota operacional em tom informativo.

## 4. Composição obrigatória por tipo de tela

### 4.1 Página de entrada de fluxo

Exemplos: criar torneio, ingressar com código, listagem pública.

Estrutura:

1. hero forte à esquerda (`arena-panel-strong`);
2. painel de apoio/resumo à direita (`PlatformSurfaceCard`);
3. corpo principal em `PlatformSurfaceCard`;
4. seções internas divididas por `PlatformFormSection`.

### 4.2 Página de detalhe

Exemplos: torneio, modalidade.

Estrutura:

1. hero com nome, contexto e poucas badges;
2. painel lateral de decisão ou ações rápidas;
3. grid curto de métricas usando `PlatformMetricCard`;
4. seções internas com cabeçalhos consistentes;
5. tabs em superfície neutra, nunca soltas no fundo.

### 4.3 Modal ou diálogo complexo

Exemplos: criação e edição de modalidade.

Regras:

1. o conteúdo deve ser agrupado em blocos lógicos;
2. cada bloco deve ter título explícito e descrição curta;
3. não misturar identidade, vagas, pontuação e operação no mesmo bloco;
4. formulários longos precisam de rolagem interna e hierarquia clara.

## 5. Regras de conteúdo e densidade

1. O hero não deve repetir tudo o que aparecerá nas métricas.
2. Cards laterais não devem inflar a interface com promessas vagas ou marketing genérico.
3. “Por que participar” ou equivalentes só podem usar razões objetivas derivadas dos dados da tela.
4. Métricas pequenas devem responder a uma pergunta concreta: perfil, capacidade, datas, acesso, operação.
5. Quando houver texto explicativo maior, ele deve ficar em bloco técnico ou contextual, não espalhado em vários cards ornamentais.

## 6. Tipografia e hierarquia

1. Eyebrow: `text-xs font-semibold uppercase tracking-[0.16em]` a `0.2em`.
2. Título principal de seção: `text-2xl font-semibold text-slate-950`.
3. Descrição de seção: `text-sm leading-6 text-slate-600`.
4. Texto de apoio: evitar corpo menor que `text-xs` fora de hints e badges.

## 7. Formulários

1. Inputs e selects sempre com label acima.
2. O espaçamento vertical padrão entre campos é `gap-3` ou `gap-4`.
3. Ajuda contextual deve ficar no mesmo bloco do campo que ela explica.
4. Configuração avançada não pode aparecer antes da definição básica da entidade.
5. Pontos por game e sets por partida devem ficar na modalidade/fase, nunca no pano de fundo do torneio.

## 8. Estados de interface

1. Empty state deve usar `EmptyState` quando a ausência de dados for o foco.
2. Loading state deve refletir a geometria real da página com `Skeleton`.
3. Avisos operacionais usam `PlatformNotice` ou bloco equivalente, nunca texto solto perdido entre seções.

## 9. Responsividade

1. Hero e painel lateral quebram para uma coluna no mobile.
2. Tabs precisam manter rolagem horizontal controlada (`overflow-x-auto`).
3. Cards de métrica devem refluír para 1 ou 2 colunas antes de 4.
4. Nenhum texto crítico pode depender de hover.

## 10. Checklist de revisão visual

Antes de concluir uma página nova ou refatorada, valide:

1. A página usa hero forte + superfície neutra + blocos internos coerentes?
2. Há no máximo uma camada de destaque forte por viewport inicial?
3. As métricas explicam algo real ou só ocupam espaço?
4. O cabeçalho de cada seção segue o mesmo padrão?
5. O formulário está dividido por intenção e ordem lógica?
6. O mobile continua legível sem colapsar a hierarquia?

## 11. Regra final

Se uma nova implementação precisar inventar um padrão visual fora destes
componentes e regras, isso deve ser tratado como exceção deliberada e
documentada, não como liberdade default.