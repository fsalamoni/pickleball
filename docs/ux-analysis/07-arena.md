# 07 — Proprietário de arena

Contexto (flag `ARENAS`): o domínio é sólido — preços com regras por dia/horário e exceções (`arenas/domain/pricing.js`, testado), reservas com recorrência de até 52 semanas e detecção de conflito (`booking.js`, testado), estado REQUESTED→NEGOTIATING→CONFIRMED→COMPLETED/CANCELLED/DECLINED. Mas: quadras são só um número (`court_count`), a UI de reservas é lista plana (`V2ArenaManage.jsx` / `V2Bookings.jsx`), tudo é pedido+negociação manual, pagamento é toggle, e o dono usa o mesmo app de atleta sem entrada de gestão no menu.

---

### ARE-01 — Quadra como entidade (P0 · M)
**Problema:** `court_count` é um inteiro; reservas são contra a arena inteira — impossível saber qual quadra está livre.
**Proposta:** subcoleção `arenas/{id}/courts` (nome, tipo coberta/descoberta, piso, foto, ativa/manutenção); reserva ganha `court_id` opcional (compatível com dados antigos); gestão de quadras na aba Informações.
**Flag:** `ARENA_COURTS`.

### ARE-02 — Calendário visual de disponibilidade (P0 · A)
**Problema:** dono e atleta veem reservas como listas ("Ativas"/"Histórico"); o `hasConflictWithConfirmed` existe no domínio mas nenhuma UI mostra livre/ocupado.
**Proposta:** grade semanal (colunas dias × linhas meia-hora; com ARE-01, seletor/lane por quadra): blocos confirmados (ink), pendentes (âmbar), bloqueios (cinza); dono cria bloqueio/reserva por clique-e-arraste; atleta vê a mesma grade em modo leitura na página da arena e escolhe slot livre ao pedir reserva (pré-preenche o `BookingRequestDialog` existente).
**Flag:** `ARENA_CALENDAR`.

### ARE-03 — Reserva instantânea (P1 · M)
**Problema:** todo pedido exige negociação manual — fricção para horário vago de preço conhecido.
**Proposta:** toggle por arena (e por faixa de horário): "confirmar automaticamente pedidos sem conflito com preço de tabela" (`resolveArenaPrice` já dá o preço determinístico). Pedido → CONFIRMED direto + notificação; negociação continua para recorrentes/exceções.

### ARE-04 — Política de cancelamento configurável (P1 · M)
**Proposta:** por arena: prazo sem custo (ex. 24h), taxa % dentro do prazo, no-show. Exibida na reserva; aplicada automaticamente ao cancelar (status + valor devido calculado); histórico de no-show por cliente (ARE-09).

### ARE-05 — Gestão de mensalistas (P1 · M)
**Problema:** `expandRecurring` (52 semanas) existe, mas não há visão "mensalistas" — só a lista de reservas.
**Proposta:** aba "Mensalistas": cartão por cliente recorrente (dia/horário/quadra, valor, status de pagamento mensal), ações de pausar férias, reajustar valor (com aviso), encerrar. Pagamento mensal como checklist por competência (mês a mês).

### ARE-06 — Lista de espera por horário (P2 · M)
**Proposta:** slot ocupado → "Avise-me se vagar"; cancelamento dispara notificação aos inscritos da fila (ordem de chegada, janela de 2h para confirmar).

### ARE-07 — Heatmap de preços sobre a grade (P2 · B)
**Proposta:** na aba Preços, visualização calendário-semana colorindo faixas por valor (`price_rules` existentes) — hoje regras são listas abstratas difíceis de conferir; erros de configuração ficam visíveis de imediato.

### ARE-08 — Painel do proprietário (ocupação e receita) (P1 · M)
**Proposta:** aba "Painel": taxa de ocupação (% slots úteis reservados) por semana/quadra/faixa, receita confirmada × pendente, horários ociosos recorrentes ("terça 14h–16h vazia há 4 semanas — crie promoção"), top clientes. Tudo derivável das reservas existentes.
**Flag:** `ARENA_INSIGHTS`.

### ARE-09 — CRM leve de clientes (P2 · M)
**Proposta:** lista de quem já reservou: histórico, telefone/wa.me, observações privadas, marcador (mensalista/eventual/inadimplente/bloqueado — bloqueado não consegue pedir reserva).

### ARE-10 — Lembrete automático de reserva (P1 · M)
**Proposta:** notificação ao cliente 24h e 2h antes (in-app; push quando TRV-01) com botão "Confirmo presença" / "Preciso cancelar" (aplica ARE-04). Cloud Function agendada (TRV-08). Reduz o principal prejuízo do dono: no-show.

### ARE-11 — Entrada "Minha arena" na navegação (P0 · B)
**Problema:** gestão só por deep-link `/arenas/:id/gerir`; dono vê dashboard de atleta.
**Proposta:** seção no sidebar (ver NAV-06) listando arenas gerenciadas com badge de pedidos pendentes; card no dashboard "Você tem 3 pedidos de reserva aguardando".

### ARE-12 — Página pública da arena aprimorada (P1 · M)
**Problema:** horários são texto livre; sem mapa; contato bom (wa.me já existe) mas reserva pouco proeminente.
**Proposta:** horários estruturados (grade seg–dom), mapa embutido + botão "Como chegar", amenities com ícones (vestiário, estacionamento, bar, aluguel de raquete), CTA fixo "Reservar horário" (abre ARE-02 em leitura), selo verificado (ARE-16), fotos com lightbox (existente).

### ARE-13 — Responder avaliações (P2 · B)
**Proposta:** dono responde publicamente cada avaliação (campo `owner_reply`); moderação existente mantida. Resposta pública é ferramenta de reputação padrão de marketplace.

### ARE-14 — Integração arena × torneio (P2 · A)
**Proposta:** organizador solicita bloco de quadras/horários para torneio direto da página da arena (tipo de reserva `tournament_block`); confirmado → agenda da arena mostra o evento e a página do torneio linka a arena (endereço/mapa automáticos).

### ARE-15 — Integração arena × professor (P3 · M)
**Proposta:** professor "residente" (vínculo PRO-15) com grade fixa reservada; página da arena lista professores que atendem lá.

### ARE-16 — Selo "arena verificada" (P3 · B)
**Proposta:** verificação pelo platform admin (telefone confirmado + endereço + fotos reais) → badge no diretório e na página; critério documentado. Confiança para reservar sem conhecer.

### ARE-17 — Multi-unidade (rede de arenas) (P3 · M)
**Proposta:** para donos com N arenas: seletor de arena no painel de gestão e visão agregada (ocupação/receita somadas). `arena_managers` já suporta múltiplos vínculos.

### ARE-18 — Termos de uso da arena na reserva (P3 · B)
**Proposta:** campo markdown "Regras da casa" exibido no pedido de reserva com aceite; reduz conflito presencial.

### ARE-19 — Exportação financeira (P2 · B)
**Proposta:** CSV de reservas por período (data, cliente, quadra, valor, status de pagamento) para conciliação externa/contador.

### ARE-20 — Onboarding do dono de arena (P2 · B)
**Proposta:** checklist pós-criação da arena ("Adicione fotos", "Configure preços", "Defina horários", "Compartilhe sua página" com o QR existente) com progresso — arena incompleta no diretório converte mal.
