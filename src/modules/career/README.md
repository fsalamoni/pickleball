# career/ — Minha carreira (flag `athlete_career`)

A linha do tempo do atleta (`/carreira`): os torneios e dias de jogo da
plataforma, mais os torneios de FORA que a pessoa registra (resultado
declarado, foto, dupla). Documento completo: `docs/54-CARREIRA-DO-ATLETA.md`.

```
career/
├── domain/      # PURO e testado — nada de React/Firebase
│   ├── careerEvent.js  # o documento (normalizeCareerEvent), enums gravados, camadas da ficha,
│   │                   # "É este?" (matchPlatformTournament), selo, modo lista, "repetir"
│   ├── timeline.js     # buildCareerTimeline (5 fontes, cada uma falha sozinha), temporadas,
│   │                   # filtros da URL, troféus de fora, abas (CAREER_TAB), resumo da Minha área
│   └── draftQueue.js   # a fila do aparelho para quando não há sinal
├── services/
│   ├── careerService.js        # career_events + Storage carreira/{uid}/
│   └── careerExportService.js  # o bloco `career` da exportação de dados
├── hooks/useCareer.js  # useCareerEvents, useCareerTimeline, mutações, useCareerSaveWithDraft
└── i18n/locales/       # en.js, es.js
```

Telas: `src/v2/pages/V2Career.jsx` + `src/v2/components/career/`. A seção da
Minha área é `CareerAreaSection`; a aba "Fora da plataforma" da estante é a
`TrophyShelf` (`ABA_FORA`).

## O que não pode regredir

1. **Declarado nunca pontua**: nenhum motor de ranking, rating, federação ou
   XP lê `career_*` (`src/core/guards/carreiraNaoPontua.test.js`).
2. **Só o dono** lê e escreve `career_events` (o id começa pelo uid); a flag
   vale na regra (`careerOn()`) só para criar e editar — ler e apagar seguem.
3. **Fonte que falhou é dita**, nunca vira vazio (`timeline.faltou`).
4. Foto só por `prepareUpload` (sem EXIF), com descrição, até 6.
5. Coleção `career_*` nova entra na exclusão de conta **e** na exportação.
6. Os valores de enum (formato, gênero, colocação, tipo de foto) e os
   `?aba=`/`?origem=` são gravados/contrato — nunca renomeie.
7. Zero índice composto: só `where('uid', '==', uid)`.
