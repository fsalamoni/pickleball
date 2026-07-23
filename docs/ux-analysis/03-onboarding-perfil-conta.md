# 03 — Onboarding, Perfil e Conta

Contexto: login exclusivamente Google (`src/v2/pages/V2Login.jsx`); após o login o usuário cai direto no dashboard. `ProfileCompletionModal.jsx` valida os campos obrigatórios para torneios mas **nunca é montado** (nenhum import no código). O usuário só descobre que o perfil está incompleto quando é bloqueado na inscrição.

---

### ONB-01 — Reativar a completude de perfil (P0 · B)
**Problema:** `src/components/ProfileCompletionModal.jsx` é código morto; nenhuma nudge de perfil existe no V2.
**Proposta:** montar o modal no `V2Layout` quando o perfil estiver incompleto (`isRequiredProfileComplete` já existe em `core/lib/profileValidation`), com botão "Deixar para depois" (adia por sessão via sessionStorage) para não bloquear a exploração — bloqueio duro continua apenas na inscrição.
**Flag:** `PROFILE_ONBOARDING`.

### ONB-02 — Onboarding em 3 passos com seleção de interesse (P1 · A)
**Proposta:** wizard pós-primeiro-login: (1) dados essenciais (nome, nascimento, telefone, cidade/UF); (2) "O que você quer fazer na PickleRush?" — chips multi-seleção: Jogar torneios / Organizar torneios / Gerenciar arena / Dar aulas / Só acompanhar; (3) convite ao nivelamento (preview de 1 pergunta + "leva 3 min"). A seleção do passo 2 personaliza dashboard e nav (NAV-06) e é gravada em `users/{uid}.interests` (array).
**Flag:** `ONBOARDING_WIZARD` (substitui ONB-01 quando ligada).

### ONB-03 — Checklist de perfil gamificado no dashboard (P1 · M)
**Proposta:** card "Complete seu perfil — 60%" com barra e itens clicáveis (foto, nivelamento, cidade, privacidade). Some ao atingir 100%. Reusa `validateRequiredProfile` + campos do perfil.

### ONB-04 — Tour contextual de primeira visita (P2 · M)
**Proposta:** tooltips sequenciais (3–4 passos) na primeira visita a áreas complexas (painel do torneio, sorteio) com "não mostrar de novo" (localStorage). Sem biblioteca externa: popover próprio ancorado por `data-tour` attrs.

### ONB-05 — Página /configuracoes unificada (P1 · M)
**Problema:** privacidade (phone_public, email_public, address_public, directory_listed) vive dentro do editor de perfil (`V2ProfileEdit.jsx`); não há lugar para preferências gerais.
**Proposta:** rota `/configuracoes` com seções: Conta, Privacidade, Notificações (ONB-06), Aparência (tema DS-08), Dados (ONB-08). Editor de perfil mantém apenas identidade/atleta.

### ONB-06 — Preferências de notificação (P1 · M)
**Problema:** o usuário não controla nenhum tipo de notificação.
**Proposta:** matriz tipo × canal (in-app hoje; push/email quando TRV-01/02 existirem): torneios, chat, clube, reservas. Documento `users/{uid}/settings/notifications`; `notificationService.js` passa a checar preferências antes de criar.

### ONB-07 — Múltiplos métodos de login (P1 · M)
**Problema:** Google é o único provedor (`V2Login.jsx`) — exclui quem não tem/não quer conta Google e não há fallback corporativo.
**Proposta:** adicionar e-mail/senha (com verificação) e Apple (exigência prática para eventual app iOS). Firebase Auth já suporta; cuidar de vinculação de contas com mesmo e-mail.

### ONB-08 — Exportar dados e excluir conta (LGPD) (P1 · M)
**Problema:** não existe nenhum fluxo de exportação/exclusão.
**Proposta:** em Configurações → Dados: "Baixar meus dados" (JSON com perfil, inscrições, jogos — Cloud Function callable) e "Excluir minha conta" (soft-delete com anonimização de jogos históricos para não corromper rankings; confirmação por digitação do e-mail).

### ONB-09 — Perfil próprio completo (P1 · M)
**Problema:** `/perfil` (`V2Profile.jsx`) mostra só hero + 4 stats; histórico, conquistas, H2H e sparkline existem apenas no perfil público `/atleta/:uid` — o dono vê menos do próprio perfil do que os outros veem dele.
**Proposta:** compor `V2Profile` com os mesmos blocos do `V2AthleteProfile` (respeitando flags) + bloco privado (privacidade, checklist ONB-03). Remover o banner obsoleto das linhas 96-99 (QW-03).

### ONB-10 — Dirty-state warning no editor de perfil (P2 · B)
**Problema:** `V2ProfileEdit.jsx` tem 4 blocos com saves independentes; navegar com alterações não salvas descarta silenciosamente.
**Proposta:** rastrear dirty por bloco; `beforeunload` + bloqueio de navegação interna com dialog "Salvar antes de sair?".

### ONB-11 — Máscara e validação de telefone (P2 · B)
**Proposta:** máscara `(11) 99999-9999` no input de telefone (perfil e modal ONB-01), validação de DDD, normalização E.164 ao salvar — telefone é insumo do wa.me e precisa ser confiável.

### ONB-12 — Verificação de telefone via WhatsApp (P3 · M)
**Proposta:** selo "verificado" após confirmação de código enviado por link wa.me (fase 1 manual pelo admin; fase 2 com provider). Aumenta confiança em duplas/reservas.

### ONB-13 — Preview do perfil público (P2 · B)
**Proposta:** botão "Ver como os outros veem" no editor — abre `/atleta/:uid` própria em nova aba (respeitando flags de privacidade), tornando tangível o efeito dos toggles de privacidade.

### ONB-14 — Nivelamento com resultado explicado (P2 · B)
**Proposta:** ao concluir o questionário (`V2Leveling`), tela de resultado com o nível, o que significa (descrição de `levels.js`), próximos passos ("torneios do seu nível" quando houver filtro) e CTA de compartilhar.

### ONB-15 — Sessões e segurança (P3 · M)
**Proposta:** em Configurações → Conta: lista de sessões/dispositivos ativos (metadata do Firebase Auth), "sair de todos os dispositivos" (revoke refresh tokens via function), histórico de último acesso.
