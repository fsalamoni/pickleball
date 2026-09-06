# 20.14 — Runbook e governança contínua

> Segurança não é um projeto que termina — é um hábito. Este documento é o
> que se faz **depois** que o plano de `13-PLANO-DE-DESENVOLVIMENTO.md`
> acabar, para não voltar ao ponto de partida em seis meses.

## 1. Ritmo

### Toda semana (15 min)
- [ ] Fila de requisições do titular — algo vencendo em 15 dias?
- [ ] Alertas de acesso administrativo — algum acesso sem motivo claro?
- [ ] Custo do Firebase — pico inexplicado é sinal de raspagem
- [ ] `npm audit` / Dependabot — vulnerabilidade `high`+ aberta?

### Todo mês (1h)
- [ ] Revisar `admin_access_logs`: quantos acessos, a quantos titulares,
      por quais motivos. **Algum que eu não reconheço?**
- [ ] Revisar quem tem papel administrativo — ainda precisa?
- [ ] Revisar coleções novas criadas no mês: alguma com dado pessoal sem
      entrar no `02-INVENTARIO-DE-DADOS.md`?
- [ ] Conferir que o backup rodou (e não só que está "configurado")
- [ ] Incidentes do mês: algum padrão?

### Todo trimestre (meio dia)
- [ ] **Testar uma restauração de backup de verdade**
- [ ] Reler `01-AUDITORIA-ACHADOS.md`: o que foi fechado, o que sobrou
- [ ] Rodar a suíte de regras contra produção (em modo leitura)
- [ ] Revisar as coleções com leitura irrestrita — mudou alguma?
- [ ] Rotacionar a service account de deploy
- [ ] Revisar consentimentos: alguma finalidade nova entrou sem base?

### Todo ano (1-2 dias)
- [ ] **Auditoria completa** — repetir o que gerou o `01`
- [ ] **Simulado de incidente** (`12-INCIDENTES.md` §8)
- [ ] Revisão jurídica dos documentos legais ⚖️
- [ ] Revisar o RIPD das funcionalidades de maior risco
- [ ] Revisar retenção: os prazos ainda fazem sentido?

## 2. Checklist de segurança em todo PR

Acrescentar ao checklist de entrega do `CLAUDE.md` §7:

```
SEGURANÇA E PRIVACIDADE
[ ] Coleção ou campo novo com dado pessoal? → atualizei 02-INVENTARIO
[ ] Regra nova: quem precisa ler é EXATAMENTE quem consegue ler?
[ ] A regra delega validação ao cliente? (se sim, não é validação)
[ ] Preferência de privacidade é aplicada no SERVIDOR?
[ ] Dado pessoal em coleção de leitura ampla? (e-mail, telefone, endereço,
    nascimento — NUNCA)
[ ] Admin precisa ler? → por Cloud Function auditada, não por regra
[ ] Escrita relevante grava audit_logs com actor_id correto?
[ ] Upload de imagem? → EXIF removido
[ ] Retenção definida?
[ ] Teste de regra correspondente foi escrito?
[ ] Consegue explicar o que um atacante faria com isto?
```

As três perguntas que teriam evitado os dois P0:
1. *"Este campo pode ser escrito por quem ele controla?"* (P0-01)
2. *"Este dado precisa estar no mesmo documento do que é público?"* (P0-02)
3. *"Se eu chamar isto pelo SDK, fora da minha interface, o que acontece?"*

## 3. Sinais de alerta (o que investigar sem esperar a revisão)

| Sinal | Provável causa |
|---|---|
| Pico de leitura sem pico de usuários | raspagem |
| Muitos `permission-denied` de um mesmo uid | tentativa de exploração |
| Conta nova fazendo muitas ações rápido | bot ou abuso |
| Acesso administrativo fora do horário | conta comprometida |
| Custo subindo sem produto novo | abuso ou consulta ineficiente |
| Usuário relatando "recebi notificação estranha" | P1-06 sendo explorado |
| Usuário relatando "meu dado mudou sozinho" | 🔴 investigar imediatamente |

## 4. Quando chamar um profissional

Este estudo foi feito lendo o código. Ele **não substitui**:

| Situação | Quem |
|---|---|
| Redigir/revisar documentos legais | ⚖️ advogado de proteção de dados |
| Definir controlador, operador, contratos | ⚖️ advogado |
| Responder à ANPD | ⚖️ advogado |
| Teste de invasão | pentester |
| Volume relevante de dado sensível | encarregado dedicado |
| Auditoria para parceiro/investidor | auditoria externa |

**Prioridade de contratação**: o advogado vem primeiro, e antes do Feed —
imagem e menores são o terreno onde um erro custa mais caro e é mais
difícil de desfazer.

## 5. Métricas de saúde

| Métrica | Alvo |
|---|---|
| Achados P0/P1 abertos | **0** |
| Cobertura de teste das regras | > 80% das coleções com PII |
| Tempo médio de resposta ao titular | < 7 dias (legal: 15) |
| Requisições vencidas | 0 |
| Acessos administrativos sem motivo registrado | 0 |
| Backup testado nos últimos 90 dias | sim |
| Coleções com PII em leitura irrestrita | 0 |
| Dependências com vulnerabilidade `high`+ | 0 |
| Incidentes não comunicados no prazo | 0 |

## 6. Onde este estudo desatualiza primeiro

Ordem provável:
1. `02-INVENTARIO-DE-DADOS.md` — a cada feature nova
2. `01-AUDITORIA-ACHADOS.md` — à medida que os achados são fechados
3. `04-CONTROLE-DE-ACESSO.md` — quando surgirem papéis novos
4. `07-DOCUMENTOS-LEGAIS.md` — a cada revisão jurídica

**Regra**: quem fecha um achado marca em `01` como ✅ com a data e o PR.
Um documento de auditoria que não registra o que foi resolvido vira ficção
em três meses — e pior: leva alguém a "corrigir" de novo o que já está
corrigido, ou a achar que está corrigido o que não está.

## 7. Uma frase para lembrar

> Nesta arquitetura, **tudo que roda no navegador é sugestão**. A regra do
> Firestore, a Cloud Function e o App Check são os únicos lugares onde
> "não pode" significa alguma coisa.

Os dois achados críticos deste estudo — e a maioria dos altos — nasceram de
esquecer isso em um ponto específico. Não de descuido geral: o resto da
plataforma demonstra cuidado real e consistente.
