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
   recebidos não lidos. Cada linha leva ao lugar que resolve (outra tela ou uma
   seção daqui). A conta é a **mesma** da tela que resolve.
3. **Seções** (`userAreaSections`), com `?secao=` na URL e a barra
   `V2SectionNav` em duas linhas com nome:

| Linha | Seção (`?secao=`) | Quem vê |
|---|---|---|
| **Você** | `resumo` (padrão: a chamada da fila do jogo aberto, se houver; o treino da semana; os atalhos) | todos |
| | `perfil` (a vitrine e os números do ranking) | todos |
| | `treino` (a semana de treino e o que chegou) | com `training_center` |
| | `jogo`, `agenda`, `torneios` (os que eu jogo) | todos |
| | `clubes` (meus clubes e convites para responder) | membro de clube **ou** quem tem convite pendente |
| | `conta` | todos |
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

## 5. Ajuda e dicas

- Artigo "Minha área: tudo o que é seu, num lugar só" (`helpCenter.js`,
  `flags: ['user_hub']`), primeiro da pista de rota de `/perfil`.
- Guia `minha-area` (`guias.js`) e o ponto `minha-area:pendencias`
  (`pontosDeDica.js`), ambos atrás da flag. Âncoras: `minha-area-pendencias`,
  `minha-area-secoes` e `perfil-editar`.

## 6. Fica para depois

- Excluir a própria conta pela Minha área. Hoje é um **pedido** ao encarregado
  (e-mail na Política de Privacidade) que o admin executa em Painel admin →
  Comunidade → Cadastros (decisão do dono, 2026-10-08).
- Aprovações de entrada em clube na faixa "Precisa de você".
