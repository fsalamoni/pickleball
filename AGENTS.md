# AGENTS.md — Alias do CLAUDE.md

> Este arquivo é um **alias** do [`CLAUDE.md`](./CLAUDE.md). Alguns
> agentes/ferramentas de IA procuram por `AGENTS.md` (padrão de
> convenção) — para essas ferramentas, redirecionamos ao guia-mestre.
>
> **Leia [`CLAUDE.md`](./CLAUDE.md)** — é o guia-mestre absoluto do
> PickleRush.
>
> Só a regra abaixo é repetida aqui; todo o resto vive apenas no
> `CLAUDE.md`, para não haver duas versões divergindo.

---

## Regra obrigatória para qualquer agente

**Toda implementação atualiza a documentação, no mesmo PR** (CLAUDE.md §2, princípio 12):
atualize o doc do assunto (mapa em `docs/00-INDEX.md` §8), o README do módulo e rode
`npm run docs:inventario`. O CI reprova inventário desatualizado e PR que muda código sem
tocar em documento (isenção só com `Docs: não se aplica — <motivo>` no corpo do PR).

# (Conteúdo do guia-mestre — abre [`CLAUDE.md`](./CLAUDE.md))

Para evitar duplicação e drift entre dois arquivos enormes, o conteúdo
vivo está **apenas** em `CLAUDE.md`. Este `AGENTS.md` é um redirector
leve.

Se a sua ferramenta lê `AGENTS.md` mas não lê `CLAUDE.md`, por favor
considere mudar a config para incluir `CLAUDE.md` também.
