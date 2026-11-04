# 21 — A vitrine pública da carreira (revisão de privacidade)

> **O que é este documento**: a revisão INTERNA de privacidade da vitrine
> pública da Minha carreira (PR 7, `docs/54-CARREIRA-DO-ATLETA.md` §2.8 e
> §4.13), escrita por quem construiu a funcionalidade, conferida contra o
> código. **Não é parecer jurídico** nem substitui a avaliação de um advogado
> ou do encarregado (DPO) de fora. Onde a defesa é fraca, ela diz.
>
> Data: 2026-11-04 · Flag: `athlete_career` (default OFF).

## 1. O que muda

Até o PR 6, tudo da Minha carreira era **só do dono** (e do professor ativo a
quem ele mandasse). O PR 7 deixa a pessoa **escolher, torneio a torneio**,
mostrar um torneio de fora no perfil público (`/atleta/:uid`, bloco
"Carreira"). É a primeira vez que dado da carreira sai do círculo privado.

| Peça | Onde | Quem grava | Quem lê |
|---|---|---|---|
| Item da vitrine | `career_public/{uid}_{evento}` | **só o servidor** (callable `career`, ações `publish`/`unpublish`/`public_consent`; gatilhos `careerEventWritten` e `careerPartnerWritten`) | quem tem **conta** (`allow read: if isAuthed()` — o perfil `/atleta/:uid` também só abre logado) |
| Foto pública | Storage `carreira-publica/{uid}/{evento}__{arquivo}` | **só o servidor** (cópia da foto privada) | quem tem conta (`get`; sem listagem) — e quem tiver o link com o token |
| "Sim" da dupla | `career_partner.public_ok_partner` (+ `public_fp`, `public_ok_at_ms`, `public_asked_at_ms`) | **só o servidor** (`public_consent`, pedido pela PRÓPRIA dupla) | o dono e a dupla (regra do PR 3) |

## 2. Base legal

**Consentimento** (LGPD art. 7º, I), dado de forma específica e destacada,
dentro da funcionalidade:

- **Do titular**: nada é publicado sem o toque em "Mostrar no meu perfil
  público", por torneio. A tela diz ANTES o que vai e o que nunca vai.
- **Da dupla (terceiro)**: o nome e a foto de outra pessoa só aparecem com o
  "sim" DELA ("Meu nome na vitrine de {quem}", nos pedidos das duplas). Sem o
  sim, o item diz só "com dupla". A dupla é avisada uma vez quando o torneio
  confirmado por ela é publicado (ou quando ela confirma um torneio que já está
  na vitrine); silêncio é "não".
- **O "sim" vale para o que a dupla viu**: junto com ele o servidor grava
  `public_fp`, a impressão do torneio naquele instante (datas, resultado das
  participações dela E nome, cidade, federação e etapa). Se o dono mudar
  qualquer um desses depois, o nome dela sai da vitrine, o "sim" é zerado e ela
  é avisada para decidir de novo (`perguntarDuplas`).

Decisão: a **Política de Privacidade não mudou de versão** (não força novo
aceite de todo mundo); ganhou um parágrafo em "Visibilidade e
compartilhamento" (pt/en/es) descrevendo a vitrine, porque o consentimento é
pedido na própria funcionalidade e nada é público por padrão. Se o jurídico
entender que a mudança exige novo aceite, o caminho é subir `version` de
`privacidade` em `legalDocuments.js` — nada no código depende disso.

## 3. Minimização

O servidor monta o item a partir de listas FECHADAS de campos
(`SHOWCASE_EVENT_FIELDS`/`SHOWCASE_ENTRY_FIELDS`, `functions/careerPublicPolicy.js`,
com paridade contra `src/modules/career/domain/careerPublic.js`):

- **Vai**: nome do torneio, datas (com a precisão), cidade/UF, federado e
  sigla/nome da federação, etapa, e por categoria o formato, gênero, idade,
  faixa de nível, colocação; o **selo**, recalculado pelo servidor (oficial →
  confirmado pela dupla → declarado; ninguém o digita); as fotos escolhidas
  (até 6 na vitrine toda, só com descrição).
- **Nunca vai**: anotações, link, custo, metas, plano, o balanço do torneio, a
  visão/crítica da dupla, o uid da dupla sem consentimento, o caminho da foto
  privada. O teste `functions/careerPublic.test.js` prova que crítica e
  anotação não chegam ao documento.
- **Limites**: 20 torneios e 5 parcerias no perfil.

## 4. Menores de idade

Menor de 18 (ou sem data de nascimento) **não publica**: o servidor devolve a
MESMA resposta de sucesso e não grava nada — a resposta não serve de sonda de
idade (mesmo desenho do convite de dupla do PR 3). A tela nem oferece o botão.
Menor também nunca aparece com nome na vitrine de outra pessoa (o "sim" exige
maioridade; quem ficou de fora vira "com dupla"). Se o dono deixar de ser
reconhecido como adulto, a reconstrução remove o item.

## 5. Imagem de terceiros

A foto é escolhida pelo dono, que declara a descrição. A plataforma **não
reconhece rostos** nem sabe quem aparece na foto: quem mais estiver nela não
consentiu de forma registrada. Mitigação: só fotos que o próprio dono enviou à
pasta dele (`carreira/{uid}/` — caminho de outra pessoa é recusado), aviso na
tela ("Mostre só fotos em que as outras pessoas concordam em aparecer — e
evite rostos de crianças") e "Tirar do perfil" a qualquer hora. ⚠️ **Defesa fraca**: não há denúncia
de foto da vitrine por terceiros nesta entrega; quem aparecer numa foto e quiser
tirá-la precisa pedir ao encarregado (o e-mail de `LEGAL_CONTACT_EMAIL`, na Política),
que remove pelo console. É o primeiro item a reforçar (ver §10).

## 6. Metadados da foto

A cópia pública sai **sem metadados**: JPEG tem retirados os segmentos de
EXIF/XMP (APP1) e IPTC (APP13); PNG/WebP com blocos de metadado (eXIf, tEXt, iTXt, zTXt,
EXIF, XMP) são **recusados** em vez de publicados (`cleanPhotoBytes`). A foto
privada já nasce limpa pelo `prepareUpload` (PR 1); a limpeza no servidor é a
segunda camada, porque o arquivo privado pode ter chegado por outro caminho.
E ela **falha fechada**: depois do percurso, se ainda houver assinatura de
EXIF, XMP (inclusive o estendido) ou IPTC em QUALQUER ponto do arquivo
(segmento que o percurso não reconheceu, imagem extra depois do fim, como o
MPF de algumas câmeras), a foto é recusada — nunca publicada como veio.

## 7. Revogação, retenção e exclusão

- **Tirar do perfil** (`unpublish`) apaga o item e as fotos públicas na hora
  (funciona mesmo com a flag desligada, para nunca prender dado no ar).
- **Editar ou apagar o torneio** reconstrói ou remove o item pelo gatilho
  `careerEventWritten`; a foto tirada da ficha sai também da vitrine.
- **A dupla retira o sim** (`public_consent` com `ok: false`) ou o pedido de
  dupla é apagado/desfeito ⇒ o gatilho `careerPartnerWritten` reconstrói e o
  nome some.
- **Excluir a conta da DUPLA** tira o nome, o uid e a foto dela das vitrines de
  outras pessoas NA HORA, pela própria exclusão (o item guarda `named_uids`,
  só com quem aparece com nome; `patchCareerPublicPartner`). O gatilho refaz
  depois, mas não é a única defesa — gatilho perdido não deixa o nome no ar.
- **Excluir a conta** apaga `career_public` por `uid` e o prefixo
  `carreira-publica/{uid}/` do Storage (`functions/accountDeletion.js`; guarda
  `exclusaoCobreColecoes.test.js`).
- **Retenção**: enquanto o dono mantiver publicado; não há prazo automático.
- **Cache**: a cópia pública é servida com `Cache-Control: private,
  max-age=300` (nenhuma CDN no meio guarda a foto; o navegador de quem já a
  abriu, por até 5 minutos). Quem salvou a página ou a foto tem a cópia dele —
  apagar no servidor não alcança cópias de terceiros.

## 8. Exportação

A exportação da conta inclui a vitrine ("Vitrine pública (Minha carreira)",
`careerExportService.js` → `listCareerPublic`).

## 9. Riscos e mitigação

| Risco | Mitigação | Resíduo |
|---|---|---|
| Publicar dado que a pessoa não quis | só por ação explícita por torneio; lista fechada de campos | — |
| Expor o nome da dupla sem ela querer | só com o "sim" dela, revogável, gravado pelo servidor | — |
| Menor exposto | servidor recusa calado; dupla menor vira "com dupla" | data de nascimento declarada pode estar errada |
| Foto com localização | metadados retirados ou foto recusada | — |
| Foto de outra pessoa / alheia | só da pasta do dono; caminho alheio recusado | terceiros na imagem sem registro de consentimento (§5) |
| Resultado inventado parecer oficial | selo calculado no servidor, "Declarado" à vista; nunca pontua (guarda `carreiraNaoPontua`) | — |
| Escrita forjada pelo cliente | `career_public` e `carreira-publica/` sem escrita do cliente (provado no emulador: `tests/rules/career.rules.test.js`, `tests/rules/storage.rules.test.js`) | — |
| Varredura do acervo público | leitura só com conta; Storage sem listagem | uma conta logada consegue listar a coleção (a regra não exige o filtro por `uid`) — é o mesmo que a vitrine mostra a qualquer conta |
| O dono troca o nome/cidade de um torneio que a dupla autorizou | `public_fp`: o nome da dupla sai e ela decide de novo | o selo "Confirmado pela dupla" segue a régua do PR 3 (datas e resultado), não o nome do torneio |
| Conta suspensa ou perfil oculto pela moderação | — | a vitrine segue legível até o admin (console) ou o dono tirá-la |

## 10. O que fica para depois

- Denúncia de item/foto da vitrine por terceiros (fila do admin, como a da
  dupla no PR 3).
- Esconder sozinha a vitrine de conta suspensa ou de perfil oculto.
- Revisão por advogado de fora antes de ligar a flag para todos.
