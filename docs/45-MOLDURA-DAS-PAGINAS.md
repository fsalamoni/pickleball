# 45 — A moldura das páginas

> Pedido do dono (2026-10-15): *"Há diferença de posicionamento interno da
> página central, do posicionamento dos textos, heroes e funcionalidades.
> Algumas páginas são mais largas que outras, não há um padrão. Eu preciso que
> exista um padrão, um padrão bem definido e que seja respeitado por toda
> plataforma."*

## 1. O que estava errado

Medido no código, antes da mudança:

- **cinco larguras de página**: 720, 1000, 1200 e 1400 px, e telas sem
  largura nenhuma (ocupando a tela toda);
- **recuos somados**: páginas com `p-4`, `px-4`, `pt-6` ou `py-6` próprios por
  cima do recuo que o layout já dá — o título começava em lugares diferentes;
- **títulos de três tamanhos** (`text-xl`, `text-2xl`, `text-3xl/4xl`),
  com e sem `tracking-tight`;
- a **barra de abas** dos menus começava na borda da coluna, e o conteúdo
  logo abaixo começava noutra linha;
- com **barra de rolagem clássica** (Windows), a página comprida ficava alguns
  pixels mais estreita que a curta: o conteúdo pulava ao trocar de tela.

## 2. O padrão

| O quê | Regra | Onde mora |
|---|---|---|
| Largura | **uma**: 1200 px, centralizada | `PAGE_FRAME` / `<V2Page>` (`src/v2/ui/pageFrame.js`) |
| Recuo lateral e de cima | só o do `<main>` do `V2Layout` (16 / 24 / 40 px; 24 px em cima) | `V2Layout.jsx` |
| Barra de abas | mesma moldura e mesmo recuo do conteúdo | `SubnavBar` em `V2Layout.jsx` |
| Calha de rolagem | estável (`scrollbar-gutter: stable`) no conteúdo e na barra de abas | `V2Layout.jsx` |
| Título da página | um tamanho: 30 px, 36 px a partir de `sm` | `PAGE_TITLE` (fundo claro), `HERO_TITLE` (herói escuro), `TITLE_TYPE` (a cor vem de fora) |
| Texto corrido | no máximo 80 caracteres por linha | `V2ContentSection` (`max-w-[80ch]`) |

Formulário, leitura e vitrine usam a **mesma** moldura. O que muda entre eles
é o que vai DENTRO dela (uma coluna, duas colunas, grade), nunca a borda
esquerda: o título de toda tela começa no mesmo lugar.

## 3. Como escrever uma página

```jsx
import { V2Page, V2PageHeader } from '@/v2/ui/primitives';

export default function V2Xxx() {
  return (
    <V2Page className="space-y-6">
      <V2PageHeader voltarPara="/onde" title={t('Título')} description={t('…')} />
      {/* conteúdo */}
    </V2Page>
  );
}
```

- Toda saída da página (carregando, erro, vazio, conteúdo) fica dentro de
  `<V2Page>` — senão o esqueleto aparece numa largura e a tela pronta noutra.
- `className` do `V2Page` leva espaçamento entre blocos (`space-y-*`), nunca
  recuo (`p-*`, `px-*`, `pt-*`, `mt-*`). `pb-*` só para abrir espaço para uma
  barra fixa no rodapé.
- Título solto: `<h1 className={PAGE_TITLE}>`. Precisa de margem ou `truncate`:
  `` className={`mt-4 ${PAGE_TITLE}`} ``.
- Cartão centralizado (login, aviso, recibo) até `max-w-2xl` não é página e
  pode usar `mx-auto` à vontade, **dentro** da moldura.

As portas que já entregam a moldura: `TrainingGate` (o treino), `UserArea`
(Minha área) e `V2PersonalHome` (o início). O `MarketGate` só a usa enquanto
carrega; as telas do Mercado põem o `V2Page` por dentro.

## 4. O que fica fora, de propósito

Telas que não estão dentro do `V2Layout`, com o próprio desenho de tela cheia:
apresentação (`V2Landing`), entrada (`V2Login`), convite (`V2ReferralLanding`),
totem (`V2ArenaKiosk`), telão (`V2GameDayTelao`), modo quadra do treino
(`CourtMode`) e a falha do telão em `V2RouteBoundary`.

Títulos com tipografia própria: a barra fixa e compacta do console do torneio
(`V2TournamentAdmin`) e o recibo para imprimir (`V2MarketOrder`).

## 5. A guarda

`src/core/guards/larguraDePagina.test.js` reprova:

1. `mx-auto` com largura de página (`max-w-3xl` ou mais, ou `[≥600px]`) fora
   de `pageFrame.js` e das isenções;
2. página de `src/v2/pages` sem `V2Page`/`PAGE_FRAME` nem uma porta — a rota
   antiga que só redireciona fica numa lista com o destino escrito;
3. `<V2Page>` com recuo próprio;
4. barra de abas fora da moldura;
5. `<h1 className="…">` com tipografia escrita à mão.

Cada isenção tem motivo escrito, conferido pelo próprio teste.

**Banco: zero.**
