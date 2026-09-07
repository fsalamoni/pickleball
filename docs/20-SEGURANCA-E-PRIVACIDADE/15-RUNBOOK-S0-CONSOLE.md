# 20.15 — Runbook S0: rede de proteção (console do Firebase)

> **Quem executa: você.** Tudo aqui é console do Firebase / Google Cloud e
> exige credenciais que o agente não tem. São ~30-40 minutos, **sem tocar em
> uma linha de código**, e é pré-requisito do P0-02 (que apaga dados) e de
> qualquer trabalho de retenção.
>
> Marque cada item ao concluir. Ao final, avise — o P0-02 fica desbloqueado.

Projeto: `picklerush` · banco Firestore: **`pickleball`** (banco nomeado, não
o `(default)` — atenção nos comandos).

---

## S0.1 · Verificar se alguém já explorou o P0-01 ⚠️ FAÇA PRIMEIRO

A correção do P0-01 já está no código, mas ela **não desfaz** uma promoção
que tenha acontecido antes. Antes de tudo, confira quem é admin hoje.

**Console** → Firestore → banco `pickleball` → coleção `users` →
filtro `role == platform_admin`.

Ou, no Cloud Shell (já autenticado):
```bash
gcloud firestore databases list --project=picklerush

# lista os admins atuais
gcloud alpha firestore documents list users \
  --database=pickleball --project=picklerush \
  --format="table(name, fields.role.stringValue, fields.email.stringValue)" \
  2>/dev/null | grep platform_admin
```

- [ ] Executado
- [ ] **Resultado esperado**: só `fsalamoni@gmail.com`

> 🔴 **Se aparecer qualquer outro uid**: é incidente, não bug. Não apague
> nada ainda — siga `12-INCIDENTES.md` §3 (contenção primeiro, evidência
> preservada). Rebaixe a conta, revogue os tokens dela
> (`gcloud`/Admin SDK `revokeRefreshTokens`), e cruze com `audit_logs`
> para ver o que ela fez.

---

## S0.2 · PITR — recuperação em ponto no tempo

Sem isto, um `delete` acidental é permanente. É o item de maior retorno de
todo o plano.

**Console** → Firestore → banco `pickleball` → aba **Backups** (ou
**Recuperação de desastres**) → **Point-in-time recovery** → ativar.

Ou:
```bash
gcloud firestore databases update \
  --database=pickleball --project=picklerush \
  --enable-pitr
```

- [ ] PITR ativado (retenção padrão: 7 dias)
- [ ] Confirmado: `gcloud firestore databases describe --database=pickleball --project=picklerush` mostra `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED`

**Custo**: proporcional ao tamanho do banco. Para esta base, poucos dólares
por mês.

---

## S0.3 · Backup agendado

PITR cobre 7 dias. O backup agendado cobre o resto e sobrevive a um
comprometimento da conta.

```bash
# backup diário, retenção de 14 semanas
gcloud firestore backups schedules create \
  --database=pickleball --project=picklerush \
  --recurrence=daily --retention=14w
```

- [ ] Agendamento criado
- [ ] Verificado: `gcloud firestore backups schedules list --database=pickleball --project=picklerush`

**Reforço recomendado** (protege contra "admin comprometido apaga base e
backups"): export periódico para um bucket em **outro projeto/conta**, com
IAM separado do projeto principal.
```bash
gcloud firestore export gs://SEU-BUCKET-DE-BACKUP \
  --database=pickleball --project=picklerush
```
- [ ] Bucket de backup em conta separada (opcional, mas é o que protege no pior caso)

---

## S0.4 · TESTAR uma restauração ⚠️ não pule

Backup que nunca foi restaurado é esperança, não backup.

```bash
# restaura para um banco NOVO — nunca por cima do de produção
gcloud firestore databases restore \
  --source-backup=projects/picklerush/locations/LOCAL/backups/ID_DO_BACKUP \
  --destination-database=pickleball-restore-teste \
  --project=picklerush
```

- [ ] Restauração concluída num banco de teste
- [ ] Conferido que os dados estão lá (abrir 2-3 coleções no console)
- [ ] **Banco de teste apagado depois** (custa dinheiro parado)

---

## S0.5 · Alertas de orçamento

Abuso vira fatura antes de virar aviso. Hoje não há alerta nenhum.

**Console Google Cloud** → Faturamento → Orçamentos e alertas → Criar.

- [ ] Orçamento criado com alertas em **US$ 50**, **US$ 100** e **US$ 200**
- [ ] E-mail de alerta confirmado (o seu, e de preferência um segundo)

---

## S0.6 · Endurecer o Firebase Auth

**Console** → Authentication → Configurações.

- [ ] **Proteção contra enumeração de e-mail**: ATIVADA
      (sem isso, dá para descobrir quais e-mails têm conta na plataforma)
- [ ] **Política de senha**: exigir senha forte
- [ ] Verificar se **"uma conta por endereço de e-mail"** está ativo
      (importante: `isPlatformOwnerEmail()` confia no e-mail do token)
- [ ] Domínios autorizados: conferir que só os seus estão na lista

---

## S0.7 · MFA na sua conta de admin ⚠️ o item mais importante desta lista

Hoje a sua conta tem poder total sobre os dados pessoais de toda a base e
**não tem segundo fator**. Phishing ou senha reusada = plataforma inteira.

**Como admin do projeto Google Cloud/Firebase:**
- [ ] Verificação em duas etapas ativada na Conta Google
      (https://myaccount.google.com/signinoptions/two-step-verification)
- [ ] Chave de segurança física ou app autenticador (evite SMS)
- [ ] Códigos de recuperação guardados **fora** da plataforma

**Como usuário `platform_admin` da aplicação:**
- [ ] Console → Authentication → Configurações → **Multi-factor
      authentication**: habilitar (SMS ou TOTP)

> Isto também é pré-requisito do console de suporte
> (`05-ADMIN-SUPORTE.md`), cuja sessão exige reautenticação com 2º fator.

---

## S0.8 · Conferir a região dos dados (LGPD)

Para declarar a transferência internacional na Política de Privacidade
(`06-LGPD-CONFORMIDADE.md` §6) é preciso saber onde o dado está de fato.

```bash
gcloud firestore databases describe --database=pickleball --project=picklerush \
  --format="value(locationId)"
gsutil ls -L -b gs://picklerush.appspot.com | grep -i "location"
```

- [ ] Região do Firestore anotada: ______________
- [ ] Região do Storage anotada: ______________
- [ ] Anotadas em `02-INVENTARIO-DE-DADOS.md` §3

---

## Ao concluir

- [ ] Todos os itens acima marcados
- [ ] S0.1 sem surpresa (só você é admin)
- [ ] S0.4 realmente executado (restauração testada)

**Aí sim o P0-02 fica desbloqueado** — a correção que tira os e-mails dos
inscritos de dentro do documento público, que envolve migração e exclusão de
campos e por isso não pode acontecer sem rede de proteção.

Marque também em `13-PLANO-DE-DESENVOLVIMENTO.md` § S0.
