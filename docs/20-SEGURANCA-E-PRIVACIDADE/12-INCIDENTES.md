# 20.12 — Plano de resposta a incidentes

> LGPD art. 48: o controlador deve comunicar à ANPD e ao titular a
> ocorrência de incidente de segurança que possa acarretar risco ou dano
> relevante. **Hoje não existe plano.** Improvisar no meio de um incidente
> é como a resposta piora o dano.

## 1. O que é incidente

Qualquer evento que comprometa **confidencialidade**, **integridade** ou
**disponibilidade** de dado pessoal:

| Tipo | Exemplo concreto nesta plataforma |
|---|---|
| Vazamento | raspagem dos e-mails via P0-02; dump da base via P0-01 |
| Acesso indevido | conta admin comprometida; suporte acessando sem motivo |
| Alteração indevida | dado de usuário alterado por terceiro |
| Perda | exclusão sem backup (P2-03) |
| Indisponibilidade | perda prolongada de acesso |
| Vazamento por terceiro | incidente no Google, numa arena parceira |

## 2. Classificação (define a resposta)

| Nível | Critério | Prazo interno |
|---|---|---|
| 🔴 **Grave** | dado sensível, muitos titulares, ou risco de dano concreto (fraude, discriminação, dano físico) | **contenção em 2h** |
| 🟠 **Relevante** | dado comum, muitos titulares, ou risco moderado | contenção em 12h |
| 🟡 **Menor** | poucos titulares, dado já público, sem risco relevante | 72h |
| 🟢 **Sem risco** | tentativa bloqueada, sem acesso efetivo | registrar apenas |

Os dois achados P0 atuais, **se explorados**, seriam 🔴 (P0-01: base
inteira, dado de contato e nascimento) e 🔴/🟠 (P0-02: e-mails em massa).

## 3. Fluxo de resposta

```
0. DETECÇÃO — alerta automático, denúncia de usuário, achado próprio,
   aviso de terceiro

1. CONTENÇÃO (primeiro, sempre)
   · fechar a brecha (regra, flag, revogar token, desabilitar conta)
   · NÃO apagar evidência — logs são a prova
   · congelar o estado: export do Firestore, cópia dos audit_logs
   · anotar horário de tudo (a linha do tempo é exigida depois)

2. AVALIAÇÃO (em paralelo)
   · que dado? de quantos titulares? por quanto tempo exposto?
   · houve acesso efetivo ou só possibilidade?
   · o dado ainda está fora?
   · classificar (§2)

3. ERRADICAÇÃO E RECUPERAÇÃO
   · corrigir a causa raiz, não só o sintoma
   · restaurar de backup, se preciso
   · rotacionar credenciais expostas
   · validar que a brecha fechou (testar a exploração)

4. COMUNICAÇÃO (§4)

5. PÓS-INCIDENTE (até 7 dias)
   · relatório: o que houve, por quê, o que mudou
   · o teste automatizado que impede a repetição ← obrigatório
   · atualizar este plano com o que se aprendeu
```

**O passo 1 é o único com prazo em horas.** Tudo mais pode esperar a
contenção. O erro mais comum é começar a investigar antes de fechar.

## 4. Comunicação

### À ANPD
- **Prazo**: a LGPD diz "prazo razoável"; o Regulamento de Comunicação de
  Incidente da ANPD (Resolução CD/ANPD nº 15/2024) estabelece **3 dias
  úteis** da ciência. ⚖️ **confirmar o prazo vigente com advogado** — a
  norma mudou desde a lei.
- Canal: formulário no site da ANPD.
- Conteúdo: natureza dos dados, titulares afetados (nº), medidas técnicas
  usadas, riscos, medidas adotadas ou a adotar, motivo de eventual demora.

### Ao titular
Quando houver risco ou dano relevante. Em linguagem simples:
```
O que aconteceu · Que dado seu foi afetado · Quando · O que já fizemos ·
O que você deve fazer (trocar senha, desconfiar de e-mail sobre X) ·
Como falar conosco
```
Sem jargão, sem minimizar, sem culpar terceiro. Comunicação ruim de
incidente causa mais dano reputacional que o incidente.

### Público
Se muitos titulares e não houver como contatar todos: aviso na plataforma
e no site. Nunca esconder.

## 5. Papéis (com um operador só)

| Papel | Quem | Faz |
|---|---|---|
| Coordenador | dono da plataforma | decide, classifica, comunica |
| Técnico | dono / desenvolvedor | contém, corrige, restaura |
| Encarregado | a indicar | ANPD e titulares |
| Jurídico | ⚖️ advogado de plantão | valida a comunicação |

**Preparação mínima antes de precisar**: ter o contato do advogado
guardado **fora** da plataforma, e um documento de uma página com este
fluxo, impresso ou em outro serviço. Num incidente sério, o acesso pode
estar comprometido.

## 6. Requisição de autoridade (não é incidente, mas é o mesmo balcão)

Ordem judicial, requisição de polícia ou do Ministério Público:
1. **Não responder de imediato.** Verificar autenticidade.
2. Encaminhar ao advogado antes de qualquer entrega.
3. Fornecer o **mínimo** que a ordem determina — não mais.
4. Registrar em `admin_access_logs` com categoria `ordem_judicial`.
5. Notificar o titular, **salvo** se a ordem vedar. Se vedar, registrar a
   notificação como pendente e liberá-la quando puder.
6. Guardar cópia da ordem.

## 7. Registro

`security_incidents/{id}` — acesso restrito ao dono e ao encarregado:
```js
{ detected_at, detected_by, source,
  classification:'grave'|'relevante'|'menor'|'sem_risco',
  data_categories:[], affected_count, exposure_window,
  description, root_cause,
  contained_at, resolved_at,
  anpd_notified_at, anpd_protocol,
  subjects_notified_at, notification_text,
  actions_taken:[], preventive_measures:[],
  test_added:'',            // o teste que impede a repetição
  created_at, updated_at }
```

## 8. Simulado

Uma vez por ano, rodar um exercício de mesa: "descobrimos que a base de
e-mails vazou há 3 dias". Cronometrar até a contenção e até a comunicação.
O simulado revela o que falta (contato do advogado, acesso ao backup,
texto do comunicado) **antes** de custar caro.

## 9. Pré-requisitos que hoje faltam

| Item | Estado |
|---|---|
| Backup para restaurar | ❌ P2-03 |
| Alerta que detecte | ❌ P3-04 |
| Encarregado indicado | ❌ |
| Advogado de plantão | ❌ |
| `audit_logs` como prova | ✅ imutável (mas forjável na entrada — P1-07) |
| Log de acesso do admin | ❌ (vem com `05-ADMIN-SUPORTE`) |
| Canal de contato com titulares | parcial (e-mail do cadastro) |

**Sem backup e sem alerta, o plano de resposta é teórico.** É por isso que
P2-03 e P3-04/P3-05 estão no início do plano de desenvolvimento.
