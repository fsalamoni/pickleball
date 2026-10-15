# 41 — Minha área (flag `user_hub`)

> Flag `user_hub` — **padrão DESLIGADA**. Desligada, `/perfil` é o perfil de
> sempre, e os rótulos da navegação dizem "Meu perfil" e "Meus torneios".
> Domínio: `src/modules/athletes/domain/userArea.js` (+ teste).
> Telas: `src/v2/components/userArea/` (`UserArea`, `UserAreaSections`,
> `ProfileShowcase`), montadas por `src/v2/pages/V2Profile.jsx`.
> Banco: **zero** — nenhuma coleção, campo, índice ou regra. Só lê o que as
> outras telas já leem, pelas mesmas chaves de cache.

## 1. O pedido

O perfil virou a central da pessoa: *o que precisa de mim agora* e *tudo o que
é meu*, por papel — atleta, professor, arena, clube, admin — num lugar só. O
Centro de Treino (`docs/40-CENTRO-DE-TREINO.md`) entra por aqui.

## 2. Três andares, sempre nesta ordem

1. **Cabeçalho** — foto, nome, nível na régua 2.0–8.0 (quando não é só o
   rating interno), cidade, "Membro desde", **Editar perfil** (âncora
   `perfil-editar`) e "Ver perfil público". Igual em toda seção.
2. **Precisa de você** (`userAreaPending`) — pedidos de reserva das arenas que
   a pessoa gere, pedidos de aula esperando resposta, convites de clube e de
   evento ainda não respondidos, dúvidas de treino esperando por ela e treinos
   recebidos não lidos, e — com a flag `marketplace` — o **Mercado**
   (`marketPendingCounts`): vendas esperando o vendedor (`placed`,
   `payment_review`, `paid`, `ready`, a mesma conta do Resumo de
   `/mercado/vender`) → `?aba=vendas`; ofertas `pending` não vencidas →
   `?aba=ofertas`; perguntas `open` → `?aba=perguntas`; compras esperando o
   Pix (`accepted`) e para confirmar o recebimento (`shipped`, `ready`,
   `delivered` que não é vale digital) → `/mercado/pedidos`; contrapropostas
   do vendedor (`countered`) → `/mercado/pedidos?aba=ofertas`. As vendas só
   são consultadas para quem tem a ficha pessoal `athlete_{uid}`; vendas como
   professor, arena ou loja ficam no painel de vendas. Cada linha leva ao lugar que resolve (outra tela ou uma
   seção daqui). A conta é a **mesma** da tela que resolve.
3. **Seções** (`userAreaSections`), com `?secao=` na URL e a barra
   `V2SectionNav` em duas linhas com nome:

| Linha | Seção (`?secao=`) | Quem vê |
|---|---|---|
| **Você** | `resumo` (padrão: a chamada da fila do jogo aberto, se houver; o treino da semana; os atalhos) | todos |
| | `perfil` — **Perfil e conta** (os números do ranking, o editor, a progressão, as configurações e os códigos de indicação) | todos |
| | `treino` (a semana de treino e o que chegou) | todos |
| | `jogos` — **Meus jogos** (o que vem: reservas, aulas, dias de jogo; o que foi: desempenho e ranking — um link por destino), `torneios` (os que eu jogo) | todos |
| | `mercado` — **Mercado**: *Comprando* (Minhas compras, Carrinho com a contagem, Favoritos, Buscas salvas, Vales-presente) e *Vendendo* (Painel de vendas com os anúncios no ar, Novo anúncio, Vendas, Ofertas e Perguntas com o "esperando você"; sem ficha, "Começar a vender") | com a flag `marketplace` |
| | `clubes` (meus clubes e convites para responder) | membro de clube **ou** quem tem convite pendente |
| **Gerencio** | `professor` | quem tem `coaches/{uid}` |
| | `arenas` | quem gere arena |
| | `admin` | administrador da plataforma |

## 3. Regras que não podem regredir

1. **Fonte que não respondeu não vira zero.** Em `userAreaPending`, uma fonte
   `undefined` (carregando ou falhou) simplesmente não entra. A faixa não diz
   "tudo em dia" sem saber, e quando algo falhou ela diz **o que ficou de
   fora** ("Ficou de fora: os pedidos de aula") com "Tentar de novo".
2. **Papel que falhou mostra a seção** (`'erro'`), e é a seção que mostra a
   falha — senão a pessoa acharia que perdeu a arena ou o perfil de professor.
3. **Só a seção aberta é montada**, então só ela consulta. As consultas de
   papel são as da barra lateral (mesmas chaves).
4. **Convite pendente abre "Clubes"** mesmo para quem ainda não é membro de
   nenhum — é lá que se responde.
5. Seção pedida na URL que a pessoa não vê cai no **resumo**
   (`resolveUserAreaSection`), nunca em branco.

## 4. Nomes na navegação

Com a flag: "Minha área" na barra lateral, na gaveta do celular, na barra
inferior, no menu do avatar e no título da página. `/perfil/torneios` passa a
se chamar **"Torneios que organizo"** (os que a pessoa JOGA estão na seção
Torneios daqui). A tela de torneios que organizo ganhou o estado de erro que
não tinha (falha não é lista vazia).

### 4.1 A barra lateral enxuta e configurável (2026-10-11)

Pedido do dono: *"a minha arena deve entrar dentro de minha área… mesma coisa
para o painel do professor… o slide bar precisa ser mais enxuto… o usuário
deveria poder configurar seu sidebar… um padrão para o atleta, um para a
arena, um para o professor"*.

- **Domínio puro** em `src/core/domain/sidebarNav.js`: os 11 hubs
  (`SIDEBAR_ITEM_META`, com `requer` para os de papel e `fixo` para Início,
  Minha área e Admin), os três padrões (`SIDEBAR_PRESET_ITEMS`), o padrão de
  quem nunca escolheu (`defaultSidebarPreset`: arena > professor > atleta — a
  mesma prioridade da barra inferior) e as operações (`visibleSidebarItems`,
  `toggleSidebarItem`, `moveSidebarItem`, `chosenSidebar`).
- **A escolha mora no navegador**, por uid (`v2:view:<uid>:menu:lateral`,
  `core/lib/sidebarNavPreference.js`, mesmo desenho do início sob medida).
  **Zero banco.** Hook `useSidebarNav(papeis)`.
- **A barra lateral e a gaveta** (`V2Layout`) mostram `hubsVisiveis`; a
  árvore completa `hubs` segue alimentando a busca (Ctrl/⌘+K) e o hub ativo —
  quem está numa tela de hub escondido continua vendo a barra de subpáginas.
- **Cartão Menu** em Configurações (`SidebarSettingsCard`, âncora
  `#menu-lateral`, `data-dica="config-menu"`): padrões, lista com
  interruptor e setas, "Para acrescentar", restaurar. Atalho "Personalizar o
  menu" no rodapé da barra, na gaveta e na seção Conta da Minha área.
- **O que não pode regredir**: Início fica em 1º e Minha área nunca sai (é
  onde moram a Central da arena, o Painel do professor e as configurações —
  sem ela a pessoa esconderia o caminho de volta); item de papel que a pessoa
  perdeu some sozinho; a barra inferior do celular segue `bottomNav.js` (não é
  configurável, de propósito: cinco lugares, e o quarto já é contextual).
  Guarda em `src/core/guards/navV3.test.js`.

## 5. Ajuda e dicas

- Artigo "Minha área: tudo o que é seu, num lugar só" (`helpCenter.js`,
  `flags: ['user_hub']`), primeiro da pista de rota de `/perfil`.
- Guia `minha-area` (`guias.js`) e o ponto `minha-area:pendencias`
  (`pontosDeDica.js`), ambos atrás da flag. Âncoras: `minha-area-pendencias`,
  `minha-area-secoes` e `perfil-editar`.
- Menu configurável: guia `personalizar-menu` (`config-menu`,
  `menu-personalizar`), ponto `config:menu`, e o artigo "Como a plataforma é
  organizada" explica os padrões e onde a arena e o professor moram.

## 6. Fica para depois

- Excluir a própria conta pela Minha área. Hoje é um **pedido** ao encarregado
  (e-mail na Política de Privacidade) que o admin executa em Painel admin →
  Comunidade → Cadastros (decisão do dono, 2026-10-08).
- Aprovações de entrada em clube na faixa "Precisa de você".

> **2026-10-15**: seção **Mercado** (flag `marketplace`) e as pendências do
> Mercado na faixa. No Resumo, os três atalhos soltos do Mercado viraram um só.

> **2026-10-11 (plano de UX, Fase 3.1)**: de 11 para **9 seções** — `jogo` + `agenda`
> viraram `jogos` (Meus jogos) e `conta` entrou em `perfil` (Perfil e conta); o
> Treino é de todos (a flag virou permanente). Os links antigos `?secao=jogo`,
> `agenda` e `conta` caem na seção que os absorveu (`resolveUserAreaSection`).
