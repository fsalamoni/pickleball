# 08 — Professor

Contexto: hoje o "produto professor" é apenas o opt-in de diretório (flag `COACH_DIRECTORY`): 4 campos no editor de perfil (`is_coach`, `coach_bio`, `coach_price`, `coach_regions` — `V2ProfileEdit.jsx`), badge/filtro no diretório de atletas e contato via chat. **Não existe** aula, aluno, agenda, pacote, presença ou pagamento. É a maior área greenfield da plataforma — proposta em 4 fases incrementais, cada uma com valor próprio.

---

## Fase 1 — Vitrine (descoberta e credibilidade)

### PRO-01 — Página pública do professor (P1 · M)
**Proposta:** rota `/professor/:uid`: foto/bio, certificações (texto + selo se verificada), regiões/arenas onde atende, tipos de aula com faixa de preço estruturada (hoje `coach_price` é texto livre), vídeo de apresentação (link YouTube), avaliações (PRO-04), CTA "Solicitar aula" (fase 2) e chat/wa.me.
**Flag:** `COACH_PROFILE_PAGE`.

### PRO-02 — Diretório /professores dedicado (P1 · M)
**Problema:** professores são um filtro escondido no diretório de atletas.
**Proposta:** rota própria com cards ricos (foto, preço/hora "a partir de", cidade, nota média, selo "aula experimental"), filtros (cidade/UF, preço, tipo de aula, nível que atende), entrada no menu "Descobrir".

### PRO-03 — Campos estruturados do professor (P1 · B)
**Proposta:** substituir `coach_price`/`coach_regions` texto-livre por: tipos de aula (individual/dupla/grupo/clínica) com preço numérico cada, cidades (chips), arenas onde atende (vínculo), níveis que atende, aula experimental (bool + preço). Migração: manter os campos antigos exibidos até o professor editar.

### PRO-04 — Avaliações de professor (P2 · M)
**Proposta:** aluno com ≥1 aula concluída (fase 2) avalia 1–5 + comentário; média no card do diretório. Fase 1 (sem aulas): avaliação liberada por link enviado pelo professor a alunos externos, com moderação.

## Fase 2 — Agenda e solicitação de aula

### PRO-05 — Disponibilidade semanal do professor (P1 · M)
**Proposta:** grade semanal de janelas disponíveis (dia × horário × local/arena), com exceções por data (férias). Modelo espelha `price_rules` das arenas (padrão + override) — mesmo desenho de domínio.
**Flag:** `COACH_SCHEDULING` (fases 2–3).

### PRO-06 — Solicitação e confirmação de aula (P1 · A)
**Proposta:** aluno escolhe tipo de aula + slot livre → pedido → professor aceita/propõe outro horário (espelho do fluxo de reserva de arena: REQUESTED→CONFIRMED, `booking.js` como referência de domínio); aula entra na agenda de ambos; cancelamento com política (prazo configurável).

### PRO-07 — Aula recorrente (P2 · M)
**Proposta:** "toda terça 19h" — reusar o conceito `expandRecurring` do domínio de arenas; pausar/encerrar recorrência; visão de agenda semanal do professor com todas as aulas.

### PRO-08 — Aula em grupo com vagas (P2 · M)
**Proposta:** professor publica turma (dia/hora, nível, máx. alunos, preço por aluno); alunos entram até lotar (mesma mecânica de capacidade das modalidades de torneio — `capacity.js`).

### PRO-09 — Agenda unificada do professor (P1 · M)
**Proposta:** rota `/aulas` (modo professor): dia/semana com aulas confirmadas e pendentes, ações rápidas (confirmar, remarcar, cancelar), atalho para grade de disponibilidade. Aluno vê as suas em "Minhas aulas" (dashboard + ATL-01).

## Fase 3 — Gestão de alunos e cobrança

### PRO-10 — Roster de alunos (P1 · M)
**Proposta:** vínculo aluno-professor (convite + aceite, como ATL-04): lista com foto, nível, frequência, última aula, botão chat. Coleção `coach_students/{coachId_studentId}`.
**Flag:** `COACH_STUDENTS` (fase 3).

### PRO-11 — Ficha de evolução do aluno (P2 · M)
**Proposta:** por aluno: nível atual, pontos fortes/fracos (tags: saque, voleio, dink, posicionamento…), anotações privadas por aula (visíveis só ao professor), marcos ("primeiro torneio"). Diferencial de retenção do professor na plataforma.

### PRO-12 — Presença e histórico de aulas (P2 · B)
**Proposta:** check de presença por aula (presente/falta/remarcada); contadores no roster; base para pacotes (PRO-13).

### PRO-13 — Pacotes e créditos (P1 · A)
**Proposta:** professor define pacotes (ex. 10 aulas, validade 90 dias, preço); venda registra créditos no vínculo aluno-professor; cada aula concluída debita 1; aluno vê saldo ("3 de 10 aulas restantes") e recebe alerta de saldo baixo/validade. Cobrança manual (registro) na fase 3; PIX automático com TRV-05.

### PRO-14 — Financeiro do professor (P2 · M)
**Proposta:** receita por mês (aulas avulsas + pacotes), inadimplência, alunos ativos/churn; exportação CSV.

## Fase 4 — Diferenciação e ecossistema

### PRO-15 — Vínculo professor × arena (P3 · M)
**Proposta:** professor "atende na arena X" com confirmação da arena (evita uso indevido de marca); páginas cruzadas (ARE-15); aula confirmada pode gerar reserva de quadra automática.

### PRO-16 — Clínicas e workshops como eventos (P2 · M)
**Proposta:** professor publica clínica (data, vagas, preço, local) inscritível por qualquer atleta — reusa a infraestrutura de eventos de clube (`club_events` com RSVP/participantes) com dono professor; divulgação no feed.

### PRO-17 — Nivelamento validado por professor (P2 · M)
**Proposta:** professor habilitado aplica avaliação oficial de nível (fluxo do módulo `leveling` com assinatura do professor); atleta ganha selo "nível validado" no perfil/ranking — combate autoavaliação inflada, dor conhecida de torneios por nível.

### PRO-18 — Biblioteca de conteúdo do professor (P3 · A)
**Proposta:** professor publica drills/dicas (markdown + vídeo link) no seu perfil; opcionalmente reserva conteúdo a alunos vinculados. Semente de creator economy na plataforma.
