# `legal/` — Documentos legais e consentimento

## Status
- **Flag**: nenhuma — sempre ligado (a antiga `legal_center` virou código)
- **Páginas V2**: `V2Legal` (central `/legal`), `V2LegalDocument` (`/legal/:docRoute`)
- **Componentes**: `LegalDocumentView`, `LegalConsentGate` (portão bloqueante),
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
  documentos essenciais; reaparece quando a versão sobe.
- `useRoleConsent(docKey)` — caixa "Li e aceito os Termos do X" + guarda de
  submit + registro, usada em criar torneio, criar arena e ativar professor.

## Onde achar mais
- `docs/05-DATA-MODEL.md` § legal_consents
- `docs/06-MODULES.md` § legal
