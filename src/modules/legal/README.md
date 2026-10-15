# `legal/` — Documentos legais e consentimento

## Status
- **Flag**: nenhuma — sempre ligado (a antiga `legal_center` virou código)
- **Páginas V2**: `V2Legal` (central `/legal`), `V2LegalDocument` (`/legal/:docRoute`)
- **Componentes**: `LegalDocumentView`, `LegalConsentGate` e `MarketTermsGate`
  (avisos bloqueantes, sobre `ConsentNotice`),
  `useRoleConsent` (caixa de aceite por papel nos fluxos)
- **Coleção**: `legal_consents` (id determinístico `${uid}_${docKey}`)
- **Tests**: 14 (consentimento + integridade do registro)

## Documentos (registro em `domain/legalDocuments.js`)
Dado puro (sem JSX), renderizado no padrão de conteúdo. Versionado por `version`
(bump força novo aceite).

- **Essenciais** (`gate: true`, aceite bloqueante para todos): Termos de Uso,
  Política de Privacidade (LGPD), Termo de Ciência de Riscos e Isenção de
  Responsabilidade.
- **Complementares** (todos): Política de Cookies, Diretrizes da Comunidade,
  Política de Pagamentos e Reembolsos, Política de Cancelamento.
- **Por papel** (aceite no fluxo que assume o papel): Termos do Organizador
  (`termos-organizador` — criar torneio), Termos do Proprietário de Arena
  (`termos-arena` — criar arena), Termos do Professor (`termos-professor` —
  ativar "Sou professor").

## Tradução de cortesia (en, es)
O português é o texto que vale. `i18n/documentos/<codigo>.js` traz, por `key`, a
mesma estrutura de seções traduzida e a `fonte` (`legalSourceHash` do português).
`hooks/useLegalTranslations` baixa só o idioma ativo (pt-BR não baixa nada) e
`domain/legalTranslation.legalDocTranslation` só devolve a tradução se a `fonte`
bater — senão a tela mostra o original. `LegalDocumentView` avisa que o
português prevalece e oferece "Ver original em português". O aceite segue sobre
o documento em português (`key`, `version` e título). Mudou um texto em
português? `legalTranslation.test.js` reprova listando o documento.

## Consentimento
- `domain/consent.js` — lógica pura (pendências, versão, mapa). Um documento é
  válido quando a versão aceita ≥ versão vigente.
- `services/consentService.js` + `hooks/useConsents.js` — I/O e React Query.
- `LegalConsentGate` (montado no `V2Layout`) bloqueia o uso até o aceite dos
  documentos essenciais; reaparece quando a versão sobe. `MarketTermsGate` faz
  o mesmo com os termos do Mercado no primeiro acesso a `/mercado`.
- ⚠️ **Um aviso por vez** (o `V2Layout` decide): primeiro os essenciais, depois
  os do Mercado, e só então o assistente de cadastro. 🐞 Com o cadastro aberto
  por cima, os termos do Mercado ficavam na tela sem responder ao toque (o
  Dialog do Radix de cima desliga os toques no de baixo). Com um aviso na tela,
  a página atrás não monta — nenhum diálogo dela (`?criar=1`, `?marcar=1`)
  abre por cima do aviso. Prova no e2e (`tests/e2e/logado.spec.js`).
- Os dois avisos leem de cima para baixo, numa ordem só (`ConsentNotice.jsx`):
  os documentos numerados, cada um abrindo o texto ali mesmo (`<details>`,
  nunca outra aba — no celular tirava a pessoa do aviso), e por ÚLTIMO a frase
  "Ao selecionar … você declara que leu e aceita os documentos acima" e o
  botão de aceite, sempre ativo. Nada vem depois do botão ("Agora não", no
  Mercado, fica no topo). Os essenciais são uma camada que cobre o app (a
  camada inteira rola); os do Mercado são uma PÁGINA no lugar do Mercado, no
  `<main>` (rola como qualquer página). 🐞 Antes cada documento tinha uma caixa,
  o botão só acendia com todas marcadas e ficava preso num rodapé com termos
  rolando por baixo: no celular a pessoa via "2 de 4" com o botão apagado.
- O aceite é UMA escrita em lote (`recordConsents`); confirmada pelo servidor,
  entra no cache na hora e o aviso fecha. Não fecha ANTES da confirmação de
  propósito: sem o registro gravado, a pessoa veria o aviso de novo ao
  recarregar. A auditoria não segura o aceite.
- `useRoleConsent(docKey)` — caixa "Li e aceito os Termos do X" + guarda de
  submit + registro, usada em criar torneio, criar arena e ativar professor.

## Onde achar mais
- `docs/05-DATA-MODEL.md` § legal_consents
- `docs/06-MODULES.md` § legal
