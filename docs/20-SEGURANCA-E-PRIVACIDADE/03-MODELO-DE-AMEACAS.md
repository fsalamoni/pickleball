# 20.03 — Modelo de ameaças

> Método: STRIDE aplicado à arquitetura real (React + Firebase, sem backend
> próprio além de Cloud Functions). O objetivo não é catalogar tudo — é
> saber **onde a plataforma quebra primeiro**.

## 1. A característica que define o risco

O PickleRush é uma **aplicação client-side falando direto com o banco**.
Não há servidor intermediário que valide requisição. Isso significa:

> **As regras do Firestore e do Storage não são "uma camada de segurança".
> São A camada de segurança.**

Tudo que roda no navegador — validação de formulário, filtro de query,
verificação de papel na UI, `if (isAdmin)` no React — é **conveniência**,
não controle. O atacante não usa a sua interface: ele usa o SDK do Firebase
com o `projectId` que está no bundle público.

Corolário prático: **toda vez que uma regra delega a validação ao cliente,
a validação não existe.** É a raiz de P0-01, P0-02, P1-06, P1-07 e P2-01.

## 2. Atores de ameaça

| Ator | Motivação | Capacidade | Probabilidade |
|---|---|---|---|
| **A1 · Curioso logado** | ver dado de conhecido, do ex, do adversário | SDK no console do navegador | **alta** |
| **A2 · Raspador** | coletar base de e-mails para vender/spam | script + API REST, sem login | **alta** (P0-02 torna trivial) |
| **A3 · Usuário mal-intencionado** | fraudar ranking, sabotar torneio rival, assediar | conhece o produto | média |
| **A4 · Atacante oportunista** | qualquer coisa que dê valor | ferramentas automatizadas contra Firebase mal configurado | média |
| **A5 · Conta admin comprometida** | tudo | acesso total (P1-08) | baixa, impacto máximo |
| **A6 · Insider** (futuro: mais admins, moderadores) | curiosidade, vingança | acesso legítimo abusado | baixa hoje, cresce com a equipe |
| **A7 · Concorrente** | copiar base de arenas/atletas | raspagem | baixa |

**A1 e A2 são o risco real hoje**, porque não exigem habilidade nenhuma:
o `projectId` está no bundle, as coleções abertas estão documentadas, e o
SDK do Firebase é o mesmo que a página já carregou.

## 3. STRIDE

### S · Spoofing (falsificação de identidade)
| Ameaça | Estado | Achado |
|---|---|---|
| Fazer-se passar por outro usuário | Firebase Auth — sólido | ✅ |
| **Fazer-se passar por admin** | **quebrado** — basta escrever no próprio doc | **P0-01** |
| Forjar o ator numa notificação | possível | P1-06 |
| Forjar o ator na auditoria | possível | P1-07 |
| Conta descartável (e-mail não verificado) | possível | P2-13 |

### T · Tampering (adulteração)
| Ameaça | Estado |
|---|---|
| Alterar dado de outro usuário | bloqueado pelas regras ✅ (salvo via P0-01) |
| Alterar o próprio `role`/permissão | **possível** — P0-01 |
| Alterar rankings | só admin ✅ (mas P0-01 dá admin a qualquer um) |
| Adulterar `audit_logs` | impossível ✅ (`update, delete: if false`) |
| Adulterar contadores inflados | possível em coleções com `hasOnly` de contador — impacto baixo |
| Injetar HTML/script em campo de texto | React escapa por padrão ✅; verificar se há `dangerouslySetInnerHTML` (não há hoje) |

### R · Repudiation (repúdio)
| Ameaça | Estado |
|---|---|
| Negar ter feito uma ação | `audit_logs` imutável ✅ |
| Trilha atribuída a terceiro | **possível** — P1-07 |
| **Acesso do admin a dado pessoal sem rastro** | **hoje não há rastro nenhum** — resolvido por `05-ADMIN-SUPORTE.md` |

### I · Information disclosure (vazamento) — **o eixo mais grave**
| Ameaça | Estado | Achado |
|---|---|---|
| **Base de e-mails de inscritos, sem login** | **exposta** | **P0-02** |
| E-mail de organizadores | exposto a qualquer logado | P1-01 |
| E-mail como nome público | exposto | P1-02 |
| Toda a base de `users` (nascimento, telefone, endereço) | exposta **via P0-01** | P0-01 |
| Arquivo de outro usuário no Storage | exposto | P1-05 |
| Perfil de quem optou por sair do diretório | exposto | P2-01 |
| Dados operacionais de arenas (cupons, campanhas, dispositivos) | expostos a qualquer logado | P2-02 |
| Conversa privada | protegida ✅ |
| Senha | não existe no banco ✅ |

### D · Denial of service
| Ameaça | Estado |
|---|---|
| Esgotar cota de leitura (custo) | **sem App Check e sem alerta de orçamento** — P1-03, P3-05 |
| Flood de escrita | sem rate limit; regras não fazem rate limit |
| Flood de notificação/spam | P1-06 |
| Indisponibilidade da infra | responsabilidade do Firebase ✅ |
| **Perda de dados sem backup** | **P2-03** — não há recuperação hoje |

### E · Elevation of privilege
| Ameaça | Estado |
|---|---|
| Usuário → admin da plataforma | **trivial** — **P0-01** |
| Usuário → gestor de arena | protegido por `arena_managers` ✅ |
| Usuário → admin de torneio/clube | protegido ✅ |
| Admin → mais do que admin | n/a (é o topo) |

## 4. Os cinco caminhos de ataque mais prováveis

Em ordem de facilidade:

**AT-1 · Raspar a base de e-mails** (5 minutos, sem login)
`projectId` do bundle → REST do Firestore → `tournament_registrations` →
todos os e-mails e gêneros. **Nenhuma barreira.**
→ Fecha com: P0-02 + P1-03 (App Check).

**AT-2 · Virar admin** (1 minuto, com conta comum)
Criar conta → console do navegador → `updateDoc(users/{meuUid},
{role:'platform_admin'})` → acesso a tudo.
→ Fecha com: P0-01.

**AT-3 · Dump da base de usuários** (após AT-2)
Já como admin, ler `users` inteiro: nome, e-mail, telefone, **data de
nascimento**, endereço. Incidente notificável à ANPD.
→ Fecha com: P0-01 + custom claims + `05-ADMIN-SUPORTE` (o admin passa a
não ter leitura ampla no banco; lê por Function auditada).

**AT-4 · Phishing interno** (com conta comum)
Criar notificação no sino de milhares de usuários, com link externo e a
credibilidade da interface oficial.
→ Fecha com: P1-06.

**AT-5 · Comprometer a conta do dono** (phishing/senha reusada)
Sem MFA, sem alerta de acesso anômalo, sem limite de sessão → acesso total
e indefinido.
→ Fecha com: P1-08 (MFA) + `05-ADMIN-SUPORTE` (sessão curta, alertas).

## 5. Como o Mercado e o Feed mudam este quadro

Se as funcionalidades de `docs/FUTURO/` entrarem antes de os P0/P1 serem
fechados, **cada ameaça acima ganha um alvo mais valioso**:

| Novo dado | Nova ameaça |
|---|---|
| Endereço de entrega (Mercado) | dump de endereços residenciais |
| Chave Pix e comprovante | fraude financeira direcionada |
| Foto e vídeo de pessoas (Feed) | uso indevido de imagem, deepfake, conteúdo de menor |
| GPS no EXIF | localização residencial de menores |
| Conteúdo gerado em massa | vetor de spam, golpe e assédio |
| Mais moderadores | ampliação da superfície de insider (A6) |

**Conclusão do modelo**: a ordem correta é
`segurança (P0/P1) → moderação → Feed → Mercado`. Inverter é acumular
risco sobre risco.

## 6. O que este modelo NÃO cobre

Honestidade sobre os limites:
- Segurança física dos dispositivos do admin.
- Comprometimento do Google/Firebase (fora do controle).
- Ataque de cadeia de suprimentos via dependência npm (mitigável com
  P3-01/P3-02, não eliminável).
- Engenharia social contra usuários (mitigável com educação, não com código).
- Ordem judicial / requisição de autoridade (é processo, não ameaça —
  ver `12-INCIDENTES.md` §6).
