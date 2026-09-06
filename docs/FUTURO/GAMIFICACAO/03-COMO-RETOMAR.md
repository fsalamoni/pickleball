# 03 — Como retomar (passo a passo)

> Este é o roteiro operacional. Siga na ordem; cada passo pressupõe o anterior.

---

## 1. Antes de tudo: confirme que nada apodreceu

A gamificação foi construída sobre a atividade real da plataforma. Se o formato
dos dados de origem mudou desde então, as métricas param de bater **em silêncio**
— foi assim que, na primeira versão, missões contavam datas de campos que não
existiam (`played_at`, `starts_at`; os reais são `at` e `startsAtMillis`).

```bash
npx vitest run src/modules/progression   # lógica pura + testes de contrato
npm run lint
npm run build
```

Os **testes de contrato** em `progression/domain/*.test.js` verificam os campos
contra os produtores reais. Se algum falhar, é sinal de que a fonte mudou — vá
lá antes de qualquer coisa.

---

## 2. Ligar em ambiente de teste (sem afetar ninguém)

A flag é por plataforma, não por usuário — então **não ligue direto em produção**
para "dar uma olhada".

```bash
# 1. Emuladores
firebase emulators:start --only auth,firestore

# 2. App apontando para os emuladores
npm run dev
```

No `/admin/console`, ative `gamification_v2`. Rotas que passam a existir:

| Rota | Tela |
|---|---|
| `/gamification` | hub (missões, tier, conquistas, skill trees, convite) |
| `/conquistas` | as 83 conquistas do atleta |
| `/hall-da-fama` | top 50 público da temporada |
| `/vinculos` | rivais, crews, mentoria |

---

## 3. O que observar no primeiro uso

1. **Um atleta novo não pode ver tela vazia.** Se vir, o primeiro trabalho é o
   onboarding (`02-ESTUDO-VS-IMPLEMENTADO.md` §3.2), não uma mecânica nova.
2. **As missões do dia precisam ser criadas.** Se a lista vier vazia para um
   atleta com atividade, rode o smoke test do §4 — foi exatamente esse o sintoma
   do bug mais caro do projeto.
3. **O XP do atleta antigo não pode mudar de nível.** A curva V2 é idêntica à V1
   de propósito. Se um atleta antigo mudar de nível ao ligar a flag, algo
   regrediu em `progressionV2.js`.

---

## 4. Rodar as suítes que o CI não roda

Estas duas precisam de emulador e por isso ficam fora do `npm test`. **Rode-as
antes de qualquer mudança em `firestore.rules` ou em service de gamificação.**

```bash
# Regras reais contra o emulador (54 asserções)
firebase emulators:exec --only firestore "node tests/rules/gamification.rules.emulator.mjs"

# Fluxo completo de navegador contra Auth + Firestore reais do emulador
firebase emulators:exec --only auth,firestore "node tests/manual/gamification.smoke.mjs"
```

Por que isso importa: o Firestore **mockado** aceita `undefined` em um campo; o
Firestore **real** rejeita o documento inteiro, sem erro visível no cliente. Um
teste unitário verde não prova que a escrita acontece.

---

## 5. Ligar em produção

1. Confirme que a telemetria existe (`02-ESTUDO-VS-IMPLEMENTADO.md` §3.1).
   **Ligar sem medir é ligar no escuro.**
2. Ative `gamification_v2` no `/admin/console`.
3. Acompanhe por alguns dias: volume de documentos criados em
   `user_progression_v2` e `user_missions`, e erros no console do Firebase.
4. Para desligar: basta desligar a flag. As escritas param. **Nada existente é
   alterado ou apagado** — os documentos já criados ficam parados e voltam a ser
   usados se a flag for religada.

---

## 6. Regras de ouro para evoluir

1. **Toda mecânica nova nasce em coleção nova.** Nenhuma escrita em coleção
   pré-existente. Foi assim que a V2 inteira entrou sem tocar no banco.
2. **Lógica pura em `domain/` com teste.** Nenhuma regra de progressão em
   componente.
3. **Valide com o schema zod antes de gravar.** Sempre. Ver §4 acima.
4. **Rótulos em pt-BR no domínio**, não no componente — as missões e conquistas
   são conteúdo, e conteúdo espalhado pela UI não se revisa.
5. **`gamification_v2` continua sendo o interruptor mestre.** Mecânica nova
   ganha sub-flag própria, mas continua abaixo da mestra.
