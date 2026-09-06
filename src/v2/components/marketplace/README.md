# `v2/components/marketplace/` — UI do Mercado (PLANEJADO)

26 componentes previstos. Lista completa com responsabilidades em
`docs/FUTURO/MERCADO/06-UX-ROTAS-E-TELAS.md` §4.

Lembretes de design (`docs/07-DESIGN-STANDARD.md`):
- toda `V2Dialog`/`AlertDialog`: `max-h-[90dvh] overflow-y-auto`;
- foto do card sempre `aspect-square` + skeleton (zero layout shift);
- badge de status com **texto**, nunca só cor;
- seções longas com `V2CollapsibleCard` e `sectionId` **estável**;
- ação sem permissão **não é renderizada**.
