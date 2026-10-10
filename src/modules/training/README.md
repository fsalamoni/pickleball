# training/ — Centro de Treino (flag `training_center`)

Biblioteca de drills e treinos de todos os autores (Equipe PickleRush,
professores, atletas), compartilhamento, treino de hoje, planos, diário,
evolução, dúvidas com o professor e o painel do admin. Documento completo:
`docs/40-CENTRO-DE-TREINO.md`.

```
training/
├── domain/      # PURO e testado — nada de React/Firebase
│   ├── taxonomy.js      # habilidades (paridade com o nivelamento), tipos, locais, RPE, blocos
│   ├── trainingItem.js  # normalizeItemInput (a validação de TODO caminho de escrita), itemQuality, filtros
│   ├── visibility.js    # publico/privado/alunos, revisão pela política, quem vê/edita, autoria
│   ├── copy.js          # "copiar e adaptar" com crédito e trava (`locked`)
│   ├── diagram.js       # a quadra em coordenadas 0–100, elementos, vistas
│   ├── media.js         # link de vídeo (YouTube/Vimeo), limites e permissão de envio
│   ├── share.js         # indicação × envio de professor, caixa de entrada
│   ├── session.js · plan.js · today.js · treinar.js · evolution.js · question.js
│   ├── debrief.js       # BALANÇO DO JOGO (flag `game_debrief`): perguntas, focos, semana sugerida
│   ├── debriefEvents.js # dia de jogo / torneio / reserva → "jogo que pede balanço"
│   ├── settings.js      # padrões de `platform_settings/training` (os MESMOS da regra)
│   ├── aiTemplate.js    # pedido para IA + validação local do JSON
│   └── dates.js         # todayLocal (nunca `toISOString().slice(0, 10)`)
├── content/
│   └── seed.js          # biblioteca inicial — SÓ import dinâmico (guarda de fonte)
├── services/            # I/O: um serviço por coleção + mediaUploadService + seedService
└── hooks/               # React Query; chaves em `trainingKeys.js`
```

As telas vivem em `src/v2/pages/V2Training*.jsx`,
`src/v2/components/training/` e `src/v2/components/admin/training/`.

⚠️ O que não pode regredir:

1. **todo caminho de escrita passa por `normalizeItemInput`** — formulário,
   IA, importação em lote e semente;
2. autoria (`author_uid`, `author_role`, `created_by`) é **imutável** e a
   moderação (`hidden`, `featured`, `review_note`…) é **só do admin** — a
   regra confere;
3. enviar para aluno exige vínculo **ativo** (`coach_students/{coach}_{aluno}`),
   conferido pela regra;
4. compartilhamento em lotes de `SHARE_BATCH = 4` (cada indicação faz leituras
   de regra; o lote do Firestore tem teto de 20);
5. falha não é vazio: hook que junta fontes devolve `{ items, incompleto }`;
6. **zero índice composto**: consultas só por igualdade/`array-contains`,
   ordenação em memória;
7. a semente nunca entra no pacote principal.
8. **coleção nova `training_*` entra na exclusão de conta**
   (`functions/accountDeletion.js`) **e na exportação**
   (`services/trainingExportService.js`) — o guarda
   `src/core/guards/exclusaoCobreColecoes.test.js` lê o `firestore.rules` e
   reprova a que ficou de fora.
