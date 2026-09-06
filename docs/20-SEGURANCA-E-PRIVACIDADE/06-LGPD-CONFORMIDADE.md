# 20.06 — Conformidade com a LGPD

> Levantamento técnico-organizacional. **Não é parecer jurídico** — os
> itens marcados ⚖️ precisam de advogado antes de virar texto público.

## 1. Situação em uma tabela

| Exigência | Artigo | Situação | Ação |
|---|---|---|---|
| Base legal para cada tratamento | 7º, 11 | parcial (implícita) | mapear — `02-INVENTARIO` |
| Princípio da necessidade / minimização | 6º, III | **violado** (e-mail em coleção pública) | P0-02, P1-01, P1-02 |
| Princípio da segurança | 6º, VII | **violado** (P0-01) | patches P0/P1 |
| Princípio da transparência | 6º, VI | parcial (política existe) | atualizar (`07`) |
| Princípio da prevenção | 6º, VIII | fraco (sem backup, sem alerta) | P2-03, P3-04 |
| Direitos do titular operacionalizados | 18 | **prometidos, não implementados** | `09-DIREITOS` |
| Encarregado (DPO) indicado | 41 | **inexistente** | indicar e publicar |
| Registro das operações (ROPA) | 37 | **inexistente** | `02-INVENTARIO` é a v1 |
| Consentimento específico e destacado | 8º, §4º | genérico (doc inteiro) | `08-CONSENTIMENTO` |
| Consentimento de responsável (menor) | 14, §1º | **inexistente** | `08-CONSENTIMENTO` §4 |
| Comunicação de incidente | 48 | **sem plano** | `12-INCIDENTES` |
| Relatório de impacto (RIPD) | 38 | inexistente | fazer antes do Feed/Mercado |
| Transferência internacional | 33-36 | não declarada | `07` §2 + cláusula |
| Contrato com operador | 39 | inexistente | Google (adesão) + arenas/professores |
| Eliminação ao fim do tratamento | 15-16 | **inexistente** | `11-RETENCAO` |

## 2. Definições que precisam ser tomadas ⚖️

**Quem é o controlador?** Hoje é uma pessoa física operando a plataforma.
Isso significa responsabilidade pessoal e ilimitada por eventual sanção.
Constituir pessoa jurídica é decisão de negócio, mas tem efeito direto aqui.
Enquanto não houver PJ, os documentos legais precisam identificar o
controlador de forma verdadeira — não pode ficar vago.

**Arena e professor: operadores ou controladores?**
- Se **operadores**: agem sob instrução do PickleRush; exige contrato
  (art. 39) e o PickleRush responde solidariamente.
- Se **controladores independentes**: cada um responde pelo que faz com o
  dado do aluno/cliente; exige contrato de compartilhamento e aviso ao
  titular.
- **Recomendação**: controladores independentes para os dados que eles
  coletam por conta própria (aula, reserva, venda), com contrato de
  compartilhamento. É o que corresponde à realidade — a arena decide o que
  faz com a agenda dela.

**Quem é o encarregado?** Pode ser o próprio dono no início. O que a lei
exige é que exista, seja identificado publicamente e tenha canal de contato.

## 3. Bases legais por finalidade

| Finalidade | Base recomendada | Observação |
|---|---|---|
| Criar e manter conta | execução de contrato (7º, V) | não precisa de consentimento |
| Inscrição e organização de torneio | execução de contrato | idem |
| Ranking e histórico esportivo | legítimo interesse (7º, IX) | exige teste de proporcionalidade documentado |
| Diretório público de atletas | **consentimento** (7º, I) | é publicação de dado; hoje `directory_listed: true` por padrão ⚠ — opt-out não é consentimento |
| Publicar contato (telefone/e-mail) no perfil | **consentimento** | ✅ já é opt-in explícito |
| Notificações operacionais | execução de contrato | |
| Notificações de marketing | **consentimento** separado | não existe hoje |
| Push | consentimento | ✅ opt-in |
| Uso de imagem (foto/vídeo) | **consentimento** específico | ⚠ inexistente — P2-10 |
| Segurança e prevenção a fraude | legítimo interesse | logs, auditoria |
| Cumprimento de obrigação legal | 7º, II | guarda de registros |
| Exercício de direito em processo | 7º, VI | retenção de pedido/pagamento |

⚠ **O ponto mais frágil**: o diretório público de atletas entra ligado por
padrão (`directory_listed: true` em `FirebaseAuthContext.jsx:169`). Se a
base for consentimento, o padrão deveria ser **desligado**. Duas saídas:
(a) mudar o padrão para opt-in — mais correto, custa visibilidade do
diretório; (b) manter em legítimo interesse, com teste de proporcionalidade
documentado, aviso claro no cadastro e opt-out fácil e **eficaz** (o que
hoje não é — P2-01). **Recomendação**: (b) para nome/cidade/nível, com o
opt-out passando a valer de verdade no servidor; (a) para qualquer coisa
além disso.

## 4. Direitos do titular (art. 18) — o que falta

| Direito | Hoje | Ver |
|---|---|---|
| Confirmação de tratamento | ❌ | `09` |
| Acesso aos dados | parcial (vê o próprio perfil) | `09` |
| Correção | parcial (edita o perfil) | `09` |
| Anonimização / bloqueio / eliminação | ❌ | `09`, `11` |
| Portabilidade | ❌ | `09` |
| Informação sobre compartilhamento | ❌ | `09` |
| Informação sobre negar consentimento | ❌ | `08` |
| Revogação do consentimento | ❌ | `08` |
| Revisão de decisão automatizada (art. 20) | n/a hoje | ⚠ passa a existir com o ranking do Feed |

**Prazo legal de resposta: 15 dias** (art. 19, II). Sem processo definido,
o prazo é descumprido por omissão.

## 5. Relatório de Impacto (RIPD)

Obrigatório quando o tratamento pode gerar risco às liberdades civis
(art. 38). **Recomendado antes de**: o Feed (imagem, menores, conteúdo em
massa), o Mercado (endereço, financeiro) e qualquer decisão automatizada
(ranking do feed).

Conteúdo mínimo: descrição do tratamento, necessidade e proporcionalidade,
riscos identificados, salvaguardas adotadas, risco residual.
Os documentos `02` e `03` já fornecem 70% do insumo.

## 6. Transferência internacional (art. 33)

Firebase/Google armazena fora do Brasil (as Cloud Functions estão em
`southamerica-east1`, mas Firestore, Auth e Storage dependem da
configuração do projeto — **verificar a região real do banco**).

Necessário:
1. Verificar e registrar a localização real dos dados.
2. Declarar a transferência na Política de Privacidade.
3. Apoiar-se nas cláusulas-padrão do Google (o DPA do Google Cloud já
   contempla) — anexar o aceite ao registro.

## 7. Sanções (por que isto importa)

ANPD pode aplicar: advertência · multa de até **2% do faturamento,
limitada a R$ 50 milhões por infração** · publicização da infração ·
bloqueio ou **eliminação dos dados**.

Para uma plataforma pequena, o risco realista não é a multa máxima — é
(a) a publicização, que destrói a confiança da comunidade, e (b) o bloqueio
dos dados, que é a morte do produto. Ambos são desproporcionalmente caros
frente ao custo de fechar os P0/P1, que é de **dias de trabalho**.

## 8. Ordem prática de conformidade

```
1. Fechar P0-01 e P0-02              (segurança — art. 6º, VII)
2. Indicar encarregado + canal        (art. 41)
3. Atualizar Política de Privacidade  (art. 9º)
4. Implementar direitos do titular    (art. 18)
5. Definir e aplicar retenção         (art. 15-16)
6. Consentimento granular + imagem    (art. 8º)
7. Menores                            (art. 14)
8. RIPD antes de Feed/Mercado         (art. 38)
9. Contratos com arenas/professores   (art. 39)
```
