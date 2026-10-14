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

## Avisos e push no idioma da pessoa
- Quem cria o aviso não sabe o idioma de quem recebe. Por isso o aviso marca o texto com `tx('Texto pt {nome}', { nome })` (de `@/core/i18n`; no servidor, `functions/avisoI18n.js`) em `title`/`message`.
- `notifyUsers`/`createNotification` gravam o português em `title`/`message` (como sempre) e, só quando há marca, `i18n: { title: {key, params}, message: {key, params} }`. Texto solto continua valendo. Parâmetro que não é texto/número descarta o `i18n` do campo (senão sobraria `{variavel}`).
- O que a pessoa escreveu (nome, texto de campanha, motivo) vai como **parâmetro**, nunca dentro da chave. Frase com pedaço opcional vira **duas chaves** (ex.: com e sem motivo).
- Mostrar: sempre `noticeText(n, 'title' | 'message')` (sino, central, busca da central) — nunca `n.title` cru.
- Idioma da pessoa: `users/{uid}.language`, gravado ao trocar o idioma (e lido no login, para a escolha seguir a pessoa em outro aparelho).
- Push: `pushOnNotificationCreate` lê `users.language` (na mesma leitura das preferências; falhou ⇒ português) e traduz por `functions/i18n/avisos.json`, **gerado** com `npm run i18n:avisos` a partir dos `tx('…')` de `src` e `functions` e dos catálogos. A guarda `src/core/guards/i18nAvisos.test.js` reprova o arquivo desatualizado; `functions/avisoI18n.parity.test.js` trava cliente × servidor.
- Os textos dos avisos moram em `src/modules/notifications/i18n/locales/` (ou no catálogo do módulo, se a chave já existir lá).
- Ainda em português (texto montado no domínio ou escrito por pessoas): campanhas e cupons de arena/professor/plataforma, aviso em massa do admin, mudança de status de aula, vínculo professor-aluno (`statusNotice`), cadastro de vendedor do Mercado (`sellerReviewNotice`), transições de pedido do Mercado.

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
- os documentos legais (Termos, Privacidade, termos do Mercado) **valem em português**. Em en/es a tela mostra uma **tradução de cortesia** (`src/modules/legal/i18n/documentos/<codigo>.js`, baixada só por quem usa o idioma), com o aviso "o português prevalece" e o botão "Ver original em português". O aceite não muda: mesma `key`, mesma `version`, título gravado em português. Cada tradução guarda a impressão (`fonte`) do texto em português de onde saiu: mudou o português, a tela volta ao original e `legalTranslation.test.js` diz qual documento atualizar (recalcule a `fonte` com `legalSourceHash`);
- mensagens só de desenvolvedor (logger, validação de esquema).

⚠️ Chave com quebra de linha (`\n`) no `t('…')` não é conferida pelo guarda nem por `scripts/i18n-faltando.mjs`: confira à mão.
