# 54 — Minha carreira (carreira do atleta)

> Estado: **PR 1 — núcleo, foto e passado** (2026-11-04). Flag
> `athlete_career` (`FEATURE_FLAG.ATHLETE_CAREER`, padrão **desligada**, só o
> admin liga; grupo "Carreira do atleta" no painel). O plano completo, com os
> PRs seguintes, está fora do repositório
> (`/mnt/project-files/carreira/plano-gestao-de-carreira.md`). Este documento
> descreve **só o que existe no código**.

## 1. O que é

`/carreira` é a linha do tempo da pessoa: os torneios e dias de jogo da
plataforma aparecem sozinhos, e ela **registra os torneios que jogou fora do
PickleRush** (o passado e os que vai jogar). O resultado registrado é
**declarado**: fica na carreira e na estante de troféus, mas **nunca** entra
em ranking, rating nem XP (guarda `src/core/guards/carreiraNaoPontua.test.js`).

| Peça | Onde |
|---|---|
| Domínio (puro, com teste) | `src/modules/career/domain/careerEvent.js`, `timeline.js`, `draftQueue.js` |
| Serviço (I/O) | `src/modules/career/services/careerService.js`, `careerExportService.js` |
| Hooks (React Query) | `src/modules/career/hooks/useCareer.js` |
| Página | `src/v2/pages/V2Career.jsx` (lazy, em `<Isolada nome="carreira">`, `V2Page`) |
| Componentes | `src/v2/components/career/` |
| Catálogos en/es | `src/modules/career/i18n/locales/` |

## 2. O dado

### 2.1 `career_events/{uid}_{sufixo}`

Um documento por torneio de fora. Id = `newCareerEventId(uid)` (o uid é o
prefixo — a regra confere). Tudo passa por `normalizeCareerEvent` antes de
gravar (limites em `CAREER_LIMITS`).

| Campo | Tipo | Observação |
|---|---|---|
| `uid` | string | dono; imutável na prática (a regra exige o próprio) |
| `name` | string ≤ 120 | obrigatório |
| `organizer`, `city`, `state` | string | `state` só UF válida |
| `start_date`, `end_date` | `AAAA-MM-DD` | `date_precision`: `day` ou `year` (modo lista) |
| `status` | `played` / `planned` / `cancelled` | derivado da data (`deriveCareerStatus`): futura ⇒ planejado |
| `entries[]` (≤ 6) | objeto | `format` (`singles`/`doubles`/`teams`), `gender` (`male`/`female`/`mixed`/`open`), `age`, `level_bracket`, `placement` (`champion`/`runner_up`/`third`/`semis`/`quarters`/`round_of_16`/`groups`/`other`), `placement_n`, `points_declared`, `partner { name, uid }` |
| `federated`, `federation_id`, `federation_name`, `federation_acronym`, `stage_tier` | | federação do diretório (com a flag `federations`) ou texto livre |
| `link` | `https://…` ≤ 300 | guardado, nunca aberto pela plataforma |
| `photos[]` (≤ 6) | `{ path, url, kind, alt }` | `kind`: `medal`/`podium`/`draw`/`other`; `alt` é a descrição |
| `notes` | ≤ 2000 | só o dono lê |
| `platform_tournament_id` | string \| null | gravado quando a pessoa responde "É este" (ver §4.3) |
| `created_at_ms`, `updated_at_ms` | número | |

**Zero índice composto**: a única consulta é `where('uid', '==', uid)`, com a
ordenação em memória. Os valores de enum (formato, gênero, colocação, tipo de
foto) são **gravados** — nunca renomeie.

### 2.2 Storage `carreira/{uid}/{arquivo}`

Só o dono lê, lista e apaga; cria só o dono, arquivo novo (`resource == null`),
`image/(webp|jpeg|png)` e < 3 MB. O envio passa por `prepareUpload`
(`{ imageMb: 3, videoEnabled: false }`), que reduz e recodifica a imagem — o
que descarta EXIF/GPS (`docs/20-SEGURANCA-E-PRIVACIDADE/08` item 5). Até 6
fotos por torneio; cada foto tem descrição (texto alternativo).

### 2.3 `dupr_links.rating_points`

Série do rating DUPR (`{ ms, singles, doubles }`, no máximo 120 pontos) que o
webhook do DUPR acrescenta **só quando o rating muda**
(`proximosPontosDupr`, `functions/dupr.js`). É a base do gráfico de evolução
de um PR futuro; neste PR nada a mostra. Ver `docs/51-DUPR.md`.

## 3. Quem pode o quê

```
match /career_events/{id} {
  allow read, delete: if isOwner(od().uid);
  allow create, update: if isOwner(nd().uid) && id.matches(me() + '_.+') && careerOn();
}
```

- **Só o dono** lê e escreve. Nem o admin lê pelo cliente.
- `careerOn()` lê `platform_settings/global.feature_flags.athlete_career`:
  com a flag desligada, criar e editar são recusados; **ler e apagar
  continuam valendo** (a pessoa nunca fica presa ao próprio dado).
- Prova no emulador: `tests/rules/career.rules.test.js` e os casos de
  `carreira/` em `tests/rules/storage.rules.test.js`.

## 4. A tela

### 4.1 Abas (`?aba=`)

`linha-do-tempo` (padrão) e `conquistas` (`CAREER_TAB`). Não há aba vazia
"em breve". Outros parâmetros: `?evento=<id>` abre a ficha, `?registrar=1`
abre o registro rápido, `?lista=1` o modo lista. Com a flag desligada,
`/carreira` redireciona para `/perfil`. O título vem do `V2Layout`
(`PAGE_TITLES`) e o item "Minha carreira" fica dentro do hub do perfil (não
há hub novo na barra lateral).

### 4.2 Linha do tempo (`CareerTimeline`, `buildCareerTimeline`)

Cinco fontes, cada uma falha sozinha: os torneios de fora (`career_events`),
os torneios da plataforma em que a pessoa jogou (`useMyTournaments`, mesma
chave do início), os pódios (`useTrophies`), os dias de jogo publicados
(`usePublishedGameDayGames`) e os pontos lançados pelas federações
(`federation_points` por `uid`, leitura pública). Fonte que falhou é **dita**
("Não deu para carregar …", com Tentar de novo só nelas) e o vazio "Sua
carreira começa aqui" só aparece quando nada falhou (`docs/27`).

- Filtros na URL (`podios=1`, `federados=1`, `origem=fora|plataforma`).
- "O que vem" (planejados), a divisória "Hoje" e uma seção por temporada —
  as temporadas fechadas nascem recolhidas.
- Selo por item (`careerSeal`): **Oficial** (veio da plataforma, ou o torneio
  de fora ligado por "É este") ou **Declarado**. Ninguém digita o selo.

### 4.3 Registrar (`CareerQuickRegister`)

Em 30 segundos: nome, data, formato (Simples / Duplas / Equipe), categoria
(Masc / Fem / Mista) e a medalha opcional. Data futura entra como planejado.
Depois de salvar: "Outra categoria", "Completar a ficha" e "Pronto".
"Repetir o torneio do ano passado" (`repeatableEvents` / `repeatEvent`)
preenche nome, organizador, cidade e federação.

**Sem sinal**: `useCareerSaveWithDraft` guarda o registro no aparelho
(`v2:view:<uid>:carreira:pendentes`, até 20) e envia quando a conexão volta;
a linha do tempo mostra quantos estão esperando, com "Enviar agora".

### 4.4 A ficha (`CareerEventSheet`)

Completa-se em camadas (`careerCompleteness`): **resultado** (colocação,
faixa, idade, pontos declarados, federação, etapa, link), **foto** e
**dupla** (nome livre ou a conta escolhida da lista de usuários). O cartão
diz "2 de 3" e o próximo passo. A camada "balanço" só conta quando o balanço
do jogo existir para a carreira (PR futuro).

"É este torneio do PickleRush?": `matchPlatformTournament` compara o nome
normalizado e a data com os torneios em que a pessoa jogou; confirmando,
grava `platform_tournament_id` e o item aparece uma vez só, com selo
oficial. "Não é" fica no aparelho (`carreira:nao-e`). Excluir pede dois
toques e apaga as fotos junto.

### 4.5 Vários de uma vez (`CareerListMode`)

Para o passado: uma linha por torneio (ano, nome, formato, categoria,
medalha), até 30, gravadas num lote (`writeBatch`). Pergunta antes "Quantos
torneios você já jogou fora do PickleRush?" (estimativa no aparelho,
`carreira:estimativa`, com "Agora não") e mostra "N de ~M registrados".

### 4.6 Conquistas

A aba abre a `TrophyShelf` na aba **"Fora da plataforma"** (`ABA_FORA`):
os pódios declarados (`careerTrophies`), com selo "Declarado" e o cartão de
compartilhar com o rodapé **"Resultado declarado"** (`MedalCard`,
`event.declared`). Ver `docs/43-TROFEUS-E-CARTOES.md`.

## 5. Outros lugares

- **Minha área**: seção `carreira` (grupo "Você", `userAreaSections` com
  `carreira: flag`), `CareerAreaSection` — contagens, o último registro com o
  que falta e os atalhos. Ver `docs/41-MINHA-AREA.md`.
- **Exportação de dados** (Configurações): bloco `career` em
  `dataExport.js`, com as fontes que falharam ditas (`careerExportService`).
- **Exclusão de conta**: `career_events` por `uid` e o prefixo `carreira/`
  do Storage (`functions/accountDeletion.js`); a guarda
  `exclusaoCobreColecoes` cobre o prefixo `career_`.
- **Ajuda**: artigos `carreira-registrar` e `carreira-selos` (parte Atleta),
  pista de rota `/carreira` e o guia `carreira-registrar` (âncoras
  `carreira-registrar`, `carreira-registrar-formato`, `carreira-lista`,
  `carreira-foto`, `carreira-abas`) — todos com `flags: ['athlete_career']`.
- **E2E**: `tests/e2e/logado.spec.js`, teste "Minha carreira" (liga a flag e
  abre as duas abas).

## 6. O que não pode regredir

1. **Declarado nunca pontua**: nenhum motor de ranking, rating, federação ou
   XP lê `career_*` (guarda `carreiraNaoPontua.test.js`).
2. **Só o dono** lê e escreve; a flag vale **na regra** só para criar e
   editar.
3. **Fonte que falhou é dita**, nunca vira "você ainda não jogou".
4. Toda coleção `career_*` nova entra na exclusão **e** na exportação.
5. Foto só pelo `prepareUpload` (sem EXIF), com descrição, até 6.

## 7. Fora deste PR

Confirmação da dupla, balanço do torneio, desempenho, abas "Próximos" e
"Metas", ranking da carreira, visão do professor, avisos pelo servidor, card
no início, XP, vitrine pública e importação do DUPR.
