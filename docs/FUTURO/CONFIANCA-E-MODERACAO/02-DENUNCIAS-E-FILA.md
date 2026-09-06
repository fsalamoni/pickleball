# 18.02 — Denúncias e fila de moderação

## 1. Alvos possíveis

```js
export const REPORT_TARGET = Object.freeze({
  FEED_POST:      'feed_post',
  FEED_COMMENT:   'feed_comment',
  MARKET_LISTING: 'market_listing',
  MARKET_REVIEW:  'market_review',
  MARKET_SELLER:  'market_seller',
  USER:           'user',
  CHAT_MESSAGE:   'chat_message',      // Fase 2
});
```

## 2. Motivos e gravidade

| Motivo | Rótulo (pt-BR) | Gravidade | Alvos |
|---|---|---|---|
| `menor_envolvido` | Conteúdo envolvendo menor de idade | 🔴 crítica | todos |
| `nudez_privada_de_mim` | Imagem íntima minha sem consentimento | 🔴 crítica | post, comentário |
| `ameaca` | Ameaça ou incitação à violência | 🔴 crítica | todos |
| `assedio_ou_odio` | Assédio, discurso de ódio, discriminação | 🟠 alta | todos |
| `golpe_ou_fraude` | Golpe, fraude, produto falsificado | 🟠 alta | anúncio, vendedor, post |
| `nudez_ou_sexual` | Nudez ou conteúdo sexual | 🟠 alta | post, comentário |
| `item_proibido` | Item proibido nas regras | 🟠 alta | anúncio |
| `direito_autoral` | Uso de conteúdo sem autorização | 🟡 média | post, anúncio |
| `uso_indevido_de_imagem` | Minha imagem sem autorização | 🟡 média | post |
| `desinformacao` | Informação falsa | 🟡 média | post |
| `avaliacao_injusta` | Avaliação falsa ou retaliação | 🟡 média | avaliação |
| `spam` | Spam ou repetição | 🟢 baixa | todos |
| `fora_do_tema` | Não tem a ver com pickleball | 🟢 baixa | post, anúncio |
| `outro` | Outro motivo | 🟢 baixa | todos |

Os dois primeiros têm tratamento especial: `nudez_privada_de_mim` é o
art. 21 do Marco Civil (remoção por notificação extrajudicial) e
`menor_envolvido` é ECA. Ambos entram na fila com prioridade máxima e
**visibilidade restrita** (só admin da plataforma, nunca gestor de arena).

## 3. Diálogo de denúncia (`ReportDialog`) — componente compartilhado

```
┌──────────────────────────────────────────┐
│ Denunciar publicação                 [✕] │
├──────────────────────────────────────────┤
│ Por que você está denunciando?           │
│  ○ Spam                                  │
│  ○ Assédio ou discurso de ódio           │
│  ○ Golpe ou fraude                       │
│  ○ Nudez ou conteúdo sexual              │
│  ○ Conteúdo envolvendo menor de idade    │
│  ○ Direito autoral                       │
│  ○ Fora do tema                          │
│  ○ Outro                                 │
├──────────────────────────────────────────┤
│ Conte mais (opcional)                    │
│ [                                      ] │
├──────────────────────────────────────────┤
│ [x] Também quero bloquear este usuário   │
│ [x] Também quero silenciar este autor    │
├──────────────────────────────────────────┤
│ Sua denúncia é anônima para o denunciado.│
│                    [Cancelar] [Denunciar]│
└──────────────────────────────────────────┘
```

Depois de enviar: confirmação clara ("Recebemos. Vamos analisar."), sem
prometer prazo que não se cumpre, e com link para as Diretrizes.

**Anonimato**: o denunciado nunca sabe quem denunciou. O admin sabe (é
necessário para detectar denúncia coordenada e denunciante mal-intencionado).

## 4. Priorização da fila

```js
priorityScore(report, context) =
    gravidade                    // crítica 100 · alta 60 · média 30 · baixa 10
  + 8 · denunciantesDistintos    // teto 40
  + reputacaoDoDenunciante       // −10 a +10 (reporterWeight)
  + historicoDoAutor             // 0 a 25 (strikes ativos, remoções)
  + alcanceDoConteudo            // 0 a 15 (impressões — conteúdo visto por
                                 //   muita gente é mais urgente)
  + idadeNaFila                  // +2 por hora, teto 30 (nada apodrece)
```
Função pura, testada. O envelhecimento (`idadeNaFila`) é o que impede que
denúncias de baixa gravidade fiquem para sempre no fim.

## 5. Tela da fila (admin)

```
┌─────────────────────────────────────────────────────────────┐
│ Moderação            [Todos ▾][Feed][Mercado]  [Abertas ▾]  │
│ 12 abertas · 3 críticas · mais antiga: 6h                   │
├─────────────────────────────────────────────────────────────┤
│ 🔴 CRÍTICA · Publicação · 3 denúncias · 2h                  │
│ ┌─ prévia do conteúdo ──────────────────────────────────┐   │
│ │ [foto]  "texto do post..."                            │   │
│ └───────────────────────────────────────────────────────┘   │
│ Autor: Fulano · 2 strikes ativos · 1 remoção anterior       │
│ Motivos: assédio (2), spam (1)                              │
│ Alcance: 1.240 impressões                                   │
│ [Manter] [Limitar] [Ocultar] [Remover] [Strike] [Suspender] │
│ Motivo: [___________________________________] (obrigatório) │
├─────────────────────────────────────────────────────────────┤
│ 🟠 ALTA · Anúncio · 1 denúncia · 8h                         │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
```

Requisitos:
- **Prévia inline** — abrir cada item em outra aba mata a produtividade.
- **Atalhos de teclado**: `J/K` navegar, `M` manter, `L` limitar,
  `R` remover, `S` strike, `Enter` confirmar.
- **Motivo obrigatório** em toda ação que não seja "manter".
- **Agrupamento**: várias denúncias do mesmo conteúdo = **um** item.
- **Denúncia coordenada**: destacar quando os denunciantes se seguem entre
  si ou entraram no mesmo minuto.
- **Ações em massa** para spam evidente (remover 12 posts do mesmo autor).
- Filtro por origem (Feed / Mercado), gravidade, motivo, idade, autor.

## 6. Efeito de cada ação

| Ação | Conteúdo | Autor | Denunciante | Registro |
|---|---|---|---|---|
| Manter | volta ao normal (sai de `limited`) | — | notificado ("analisamos e mantivemos") | ✅ |
| Limitar | `status: 'limited'` | notificado com motivo | notificado | ✅ |
| Ocultar | `status: 'hidden'` | notificado | notificado | ✅ |
| Remover | `status: 'removed'` (terminal) | notificado + 1 strike | notificado | ✅ |
| Strike | — | +1 strike, avisado do total e do que acontece a seguir | — | ✅ |
| Suspender | conteúdo do autor pausado | não publica por N dias | — | ✅ |
| Banir | tudo removido | conta restrita | — | ✅ |

Todo registro vai para `moderation_actions` **e** `audit_logs`.

## 7. Recurso

O autor responde à notificação de sanção com uma justificativa. Isso cria
um `content_reports` do tipo `appeal`, com prioridade alta, vinculado à
ação original. Decisão: manter ou reverter (revertendo, o strike some e o
conteúdo volta).

Sem caminho de recurso, moderação errada vira usuário perdido para sempre.

## 8. Métricas da moderação (o admin precisa ver)

- fila aberta por gravidade · idade da mais antiga · tempo médio de decisão;
- denúncias por 1000 posts/anúncios (saúde da comunidade);
- taxa de procedência por motivo (motivo com procedência muito baixa
  provavelmente está mal explicado na UI);
- reincidência (% de autores sancionados que voltam a ser);
- top denunciantes e a procedência deles (detecta abuso da denúncia);
- ações revertidas em recurso (mede a qualidade da moderação).
