# `leveling/` — Nivelamento (CBPE/USAP)

Tabela de níveis + questionário auto-avaliativo.

## Status
- **Páginas V2**: `V2Leveling` (página pública `/nivelamento`)
- **Componentes**: `V2LevelTable`, `V2LevelingQuestionnaire`
- **Data**: `data/levels.js` (catálogo CBPE + USAP)
- **Domain**: `questionnaire.js` (cálculo do nível)
- **Tests**: 20+

## Schema
Resultado salvo em `users/{uid}.leveling_*`:
- `leveling_level` (1.0-5.5)
- `leveling_method` ('form' | 'manual')
- `leveling_manual_level`
- `leveling_assessment` (objeto do questionário)

Validação por professor: `coach_level_validations/{id}` (Onda 7b)

## Onde achar mais
- `docs/06-MODULES.md` § leveling
- `docs/05-DATA-MODEL.md` § Identidade
