# 44 — Vários idiomas (flag `multi_language`)

Plano completo e fases: `/mnt/project-files/i18n/plano-multi-idiomas.md`. Código: `src/core/i18n/`.

## Como funciona
- **O texto em português é a chave**: `t('Entrar num jogo')`. Sem catálogo (pt-BR) ou sem tradução, aparece o próprio português.
- Rótulos em constantes do módulo: marque com `tk('Texto')` e traduza ao desenhar com `t(rotulo)`.
- Variáveis `t('Você tem {n} XP', { n })`; plural `tn(n, '{n} jogo', '{n} jogos')` (o catálogo guarda `['{n} game', '{n} games']` na chave do plural).
- Datas/números/moeda: `fmtData`, `fmtNumero`, `fmtMoeda`, `fmtLista` (`Intl` pelo idioma ativo). Não escreva `'pt-BR'` em tela nova.
- Catálogos por módulo: `src/<área>/i18n/locales/<codigo>.js` (`export default { 'texto pt': 'text' }`), carregados só para o idioma escolhido. pt-BR não baixa nada.
- Troca de idioma = grava `picklerush:idioma` e recarrega a página. Flag desligada: tudo em português e a escolha é apagada (`IdiomaBridge`).

## Regras que não podem regredir
1. **Nunca chame `t()` no nível do módulo** (constante calculada ao importar): o catálogo chega depois. Use função ou chame no render.
2. A chave é o texto exato: mudou o texto no código, mude a chave nos catálogos (`src/core/guards/i18nCatalogos.test.js` reprova o `t('…')` sem tradução e catálogos fora de paridade).
3. Conteúdo escrito por pessoas não é traduzido.
4. Cada pasta `locales/` precisa de TODOS os idiomas do registro.

## Incluir um idioma novo
1. Uma linha em `src/core/i18n/languages.js`.
2. Copiar cada `locales/en.js` para `locales/<codigo>.js` e traduzir os valores.
3. `npx vitest run src/core/guards/i18nCatalogos.test.js` mostra o que falta.

## Glossário
| pt-BR | en | es |
|---|---|---|
| Dia de jogo | Game day | Día de juego |
| Torneio | Tournament | Torneo |
| Arena | Arena | Arena |
| Quadra | Court | Cancha |
| Professor | Coach | Entrenador/a |
| Ranking | Ranking | Ranking |
| Inscrição | Registration | Inscripción |
| Dupla | Pair (doubles team) | Pareja |
| Sorteio | Draw | Sorteo |

## O que está traduzido e o que fica em português de propósito
Traduzido (en, es): o casco (menus, cabeçalho, Configurações, cadastro), início, Jogar e dia de jogo (inclusive telão), torneio (gestão, página pública, impressão), arena (Central, página pública, reserva, módulos), professor, clubes, ranking e rating, gamificação, Centro de Treino, Mercado, Minha área, notificações (moldura), ajuda e dicas, Painel admin.

Fica em português **de propósito** — é dado gravado, não tela:
- o que o app GRAVA no banco: nomes padrão ("Grupo único", "(cópia)", grupos-modelo do Play, nome de busca salva, nome do dispositivo do totem), motivos, auditoria, sementes (biblioteca de treino), palavras-chave;
- o texto de quem escreve (campanhas, descrições, comentários);
- arquivos exportados (CSV, "Baixar meus dados");
- os documentos legais (Termos, Privacidade, termos do Mercado): tradução precisa de revisão jurídica;
- mensagens só de desenvolvedor (logger, validação de esquema).

⚠️ Chave com quebra de linha (`\n`) no `t('…')` não é conferida pelo guarda nem por `scripts/i18n-faltando.mjs`: confira à mão.
