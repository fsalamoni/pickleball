# 00-INDEX — Porta de entrada da documentação

> **Comece aqui.** Este arquivo é o mapa do todo: diz **onde** está cada
> assunto. O guia-mestre (como trabalhar, princípios, "onde está X") é o
> [`CLAUDE.md`](../CLAUDE.md) na raiz — IA ou humano, leia-o antes de mexer.
>
> **Números** (módulos, telas, rotas, coleções, índices, funções, flags) **não
> são escritos à mão**: ficam em [`46-INVENTARIO.md`](./46-INVENTARIO.md),
> gerado do código. Se um número aparecer em outro doc e discordar do
> inventário, vale o inventário.

---

## 1. Regra de manutenção (obrigatória)

**Toda implementação atualiza a documentação, no mesmo PR.** Não é etapa
opcional nem "depois":

1. Atualize o doc do **assunto** que você tocou (tabela abaixo) e, se o módulo
   mudou, o `src/modules/X/README.md`.
2. Mudou rota, coleção, regra, índice, Cloud Function, flag ou módulo?
   Rode `npm run docs:inventario` e comite `docs/46-INVENTARIO.md`.
3. Mudou princípio, mapa "onde está X" ou fluxo de trabalho? Atualize o
   [`CLAUDE.md`](../CLAUDE.md) (§2, §4, §5).
4. O CI cobra: o passo `docs:inventario:check` reprova inventário
   desatualizado, e o job `docs-obrigatorios` reprova PR que muda código sem
   tocar em nenhum documento. Quando de fato nada muda para quem lê a
   documentação, escreva no corpo do PR `Docs: não se aplica — <motivo>`.

Tabela "mudei X → atualizo Y" em [§8](#8-mudei-x--atualizo-y).

---

## 2. Visão geral e fundamentos (leia nesta ordem)

| Ordem | Doc | Para quê |
|---|---|---|
| 0 | [`../CLAUDE.md`](../CLAUDE.md) | Guia-mestre: princípios, mapa "onde está X", checklist de entrega. |
| 1 | [`01-AI-CONTEXT.md`](./01-AI-CONTEXT.md) | Panorama: o que é, stack, perfis, rotas, dados, deploy. Uma leitura e você está orientado. |
| 2 | [`46-INVENTARIO.md`](./46-INVENTARIO.md) | ⚙️ **Gerado do código**: o que existe hoje (módulos, rotas, coleções, índices, funções, flags). |
| 3 | [`04-ARCHITECTURE.md`](./04-ARCHITECTURE.md) | Camadas, estado, erros, PWA, testes, CI/CD. |
| 4 | [`02-STANDARDS.md`](./02-STANDARDS.md) | Como codar (flags, domain/service/hook, JSDoc, i18n, testes, documentação). |
| 5 | [`03-WORKFLOW.md`](./03-WORKFLOW.md) | Git, PR, GitHub Actions, deploy Firebase, Cloud Functions. |

## 3. Dados, backend e permissões

| Doc | Conteúdo |
|---|---|
| [`05-DATA-MODEL.md`](./05-DATA-MODEL.md) | Coleções Firestore, campos, relações, Storage, índices. **Schema.** |
| [`47-BACKEND-CLOUD-FUNCTIONS.md`](./47-BACKEND-CLOUD-FUNCTIONS.md) | Cada Cloud Function: gatilho, o que escreve, testes, deploy. |
| [`48-PERMISSOES-POR-PERFIL.md`](./48-PERMISSOES-POR-PERFIL.md) | Matriz perfil × recurso e onde cada regra é imposta (regras, função ou só tela). |
| [`18-RANKINGS.md`](./18-RANKINGS.md) | Quando ranking e rating atualizam; servidor como único escritor. |
| [`13-NIVEL-UNIFICADO.md`](./13-NIVEL-UNIFICADO.md) | Régua 2.0–8.0 usada em todos os sorteios. |
| [`20-SEGURANCA-E-PRIVACIDADE/`](./20-SEGURANCA-E-PRIVACIDADE/00-INDEX.md) | 🔴 Segurança, LGPD, documentos legais, suporte do admin, varreduras. **Leia antes de tocar em dado pessoal.** |

## 4. Módulos de domínio e telas

| Doc | Conteúdo |
|---|---|
| [`06-MODULES.md`](./06-MODULES.md) | Um módulo por seção: o que faz, arquivos-chave, telas, coleções. |
| `../src/modules/<módulo>/README.md` | README de cada módulo (propósito, arquivos, consumo). |
| [`07-DESIGN-STANDARD.md`](./07-DESIGN-STANDARD.md) | Design system: tokens, tipografia, primitivos, navegação, acessibilidade. |
| [`45-MOLDURA-DAS-PAGINAS.md`](./45-MOLDURA-DAS-PAGINAS.md) | Uma largura (1200 px), um recuo, um título. |
| [`30-MODO-ESCURO.md`](./30-MODO-ESCURO.md) | Modo escuro por usuário (paleta como fonte única). |
| [`44-IDIOMAS.md`](./44-IDIOMAS.md) | Inglês/espanhol: `t()`, `tk()`, catálogos por módulo. |
| [`27-FALHA-NAO-E-VAZIO.md`](./27-FALHA-NAO-E-VAZIO.md) · [`28-ERRO-NAO-DERRUBA-O-APP.md`](./28-ERRO-NAO-DERRUBA-O-APP.md) | Estados de erro/vazio e boundaries por rota. |

## 5. Funcionalidades por área

**Dia de jogo:** [`14` telão](./14-DIA-DE-JOGO-TELAO.md) · [`15` permissões](./15-DIA-DE-JOGO-PERMISSOES.md) · [`16` rodízio do Play](./16-DIA-DE-JOGO-RODIZIO.md) · [`17` Americano aprimorado](./17-DIA-DE-JOGO-AMERICANO-APRIMORADO.md) · [`22` dia de jogo da arena](./22-DIA-DE-JOGO-DA-ARENA.md) · [`25` como módulo](./25-DIA-DE-JOGO-COMO-MODULO.md) · [`39` grupos do Play](./39-PLAY-GRUPOS.md) · [`35` jogar, entrar e sair](./35-JOGAR-ENTRAR-E-SAIR.md).

**Torneio:** [`12` equipes](./12-TEAM-TOURNAMENTS.md) · [`26` formatos e regras](./26-TORNEIO-FORMATOS-E-REGRAS.md) · [`37` etapas, turnos e check-in](./37-TORNEIO-ETAPAS-TURNOS-E-CHECKIN.md) · [`43` troféus e cartões](./43-TROFEUS-E-CARTOES.md).

**Arena:** [`08` roadmap](./08-ARENA-ROADMAP.md) · [`23` calendário e reserva](./23-ARENA-CALENDARIO-E-RESERVA.md) · [`24-MODULOS-DE-ARENA/`](./24-MODULOS-DE-ARENA/00-INDEX.md) (matchmaking, membros, marketing, operações, aulas, PDV, chegada/totem, integração) · [`10-ARENA-V3/`](./10-ARENA-V3/00-INDEX.md) (histórico e referência do V3).

**Atleta e comunidade:** [`29` início e divulgação](./29-INICIO-PERSONALIZADO-E-DIVULGACAO.md) · [`31` início sob medida](./31-INICIO-SOB-MEDIDA.md) · [`34` minha região](./34-MINHA-REGIAO.md) · [`33` cadastro essencial](./33-CADASTRO-ESSENCIAL.md) · [`36` notificações](./36-NOTIFICACOES.md) · [`38` gamificação V2](./38-GAMIFICACAO-V2.md) · [`41` Minha área](./41-MINHA-AREA.md).

**Treino:** [`40` Centro de Treino](./40-CENTRO-DE-TREINO.md) · [`40a` avaliação dos 100 drills](./40a-AVALIACAO-100-DRILLS.md) · [`42` balanço do jogo](./42-BALANCO-DO-JOGO.md).

**Ajuda ao usuário:** [`19` tutoriais](./19-TUTORIAIS.md) · [`21` central de ajuda](./21-CENTRAL-DE-AJUDA.md) · [`32` dicas guiadas](./32-DICAS-GUIADAS.md).

**Mercado (marketplace):** código em `src/modules/marketplace/README.md`; plano e decisões fora do repositório (pasta de arquivos do projeto). O desenho antigo está em [`FUTURO/MERCADO/`](./FUTURO/MERCADO/).

## 6. Auditorias, histórico e referência

| Doc | Conteúdo |
|---|---|
| [`09-UX-ANALYSIS/`](./09-UX-ANALYSIS/00-README.md) | Auditorias UX/UI por persona. [`15-backlog-remanescente.md`](./09-UX-ANALYSIS/15-backlog-remanescente.md) = backlog consolidado. |
| [`AUDIT-2026-09-28.md`](./AUDIT-2026-09-28.md) | Relatório de auditoria geral. |
| [`11-REFERENCE/`](./11-REFERENCE/cheatsheet.md) | Cheatsheet, glossário, FAQ. |
| [`PUSH-ATIVACAO.md`](./PUSH-ATIVACAO.md) | Ativar push (PWA + FCM). |
| [`FUTURO/`](./FUTURO/00-INDEX.md) | 📐 Desenhado, **sem código**: feed/rede social, moderação compartilhada, marketplace aberto original. (A gamificação desenhada ali virou código: ver `38`.) |
| `../diagnostico-club-ranking.md` | Roteiro de diagnóstico pontual (julho/2026), mantido por histórico. |

## 7. Documentos fora de `docs/`

`../README.md` (visão para quem chega ao repositório) · `../AGENTS.md` (alias do CLAUDE.md) · `../.github/pull_request_template.md` (checklist de PR, inclui documentação) · `../functions/README.md` · `../Design System/` (insumos originais de design, histórico).

## 8. Mudei X → atualizo Y

| Mudei… | Atualize |
|---|---|
| Rota, tela, módulo, coleção, índice, função, flag | `npm run docs:inventario` + o doc do assunto |
| Coleção/campo/regra do Firestore ou Storage | `05-DATA-MODEL.md`, `48-PERMISSOES-POR-PERFIL.md`, `20-SEGURANCA-E-PRIVACIDADE/` se for dado pessoal |
| Cloud Function | `47-BACKEND-CLOUD-FUNCTIONS.md` |
| Módulo (comportamento, arquivos-chave) | `src/modules/X/README.md` + seção em `06-MODULES.md` |
| Componente de UI compartilhado, token, navegação | `07-DESIGN-STANDARD.md` (+ `45`/`30`/`44` se couber) |
| Fluxo de dia de jogo / torneio / arena | o doc temático da §5; e o tutorial/guia/ajuda (`19`, `21`, `32`) |
| Regra de ranking/rating | `18-RANKINGS.md` (+ paridade cliente × servidor) |
| Padrão de código, fluxo de trabalho, deploy | `02-STANDARDS.md` / `03-WORKFLOW.md` e `CLAUDE.md` |
| Novo princípio ou armadilha aprendida | `CLAUDE.md` §2/§4 |
| Doc novo | linha neste índice |
