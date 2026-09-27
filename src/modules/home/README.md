# home/ — a tela inicial personalizada (Onda CG)

Flag `personalized_home` (default OFF). Desligada, `/` segue a tela clássica.
Documento completo: `docs/29-INICIO-PERSONALIZADO-E-DIVULGACAO.md` §1.

```
home/
├── domain/
│   ├── freshness.js        # ⭐ a régua única de "isto ainda está valendo?" (data sem hora = dia LOCAL)
│   ├── homeProfile.js      # papel real + interesses → frentes → seções (resolveHomeFoci, homeSectionsFor)
│   ├── homeAgenda.js       # todas as fontes da agenda numa lista por dia
│   ├── homeTournaments.js  # meus torneios, abertos perto de mim, último resultado, o que o organizador precisa ver
│   ├── homeShortcuts.js    # os atalhos (um por frente), a saudação e a frase do dia
│   └── homePlay.js         # convites abertos, a "arena de sempre" e os próximos horários livres
└── hooks/
    └── useHomeAgenda.js    # junta as fontes (mesmas chaves de cache das outras telas)
```

A interface vive em `src/v2/components/home/personal/` (`V2PersonalHome` e uma
seção por arquivo). Três regras:

1. **Nada vencido** — toda data passa por `freshness.js`.
2. **Falha não é vazio** — cada seção separa "não carregou" (com Tentar de
   novo) de "não há" (com o próximo passo). A varredura de
   `src/core/guards/falhaNaoEVazio.test.js` examina a tela inicial inteira.
3. **Seção que não é da pessoa não consulta nada** — os hooks usados aqui
   aceitam `{ enabled }`.

Banco: **zero**. Só leitura, e o "Personalizar" grava `users.interests` pelo
caminho de sempre.
