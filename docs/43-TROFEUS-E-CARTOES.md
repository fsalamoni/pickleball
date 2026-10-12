# 43 — Troféus e cartões de campeões

> Pedido do dono (2026-10-12): *"quando uma modalidade se encerra, tenha um
> cartão dos medalhistas e campeões, em conjunto e separado, de divulgação,
> com o logo do PickleRush… opção de inserir a foto ou só o nome… dentro de
> Minha área, um espaço para coleção de troféus, com separação entre torneios
> e dia de jogo… divulgável e imprimível, inclusive em PDF… os admins podem
> imprimir e compartilhar… outros atletas podem parabenizar e ganhar pontos
> em gamificação… divulgação do torneio, da plataforma, da arena e dos
> medalhistas."*

**Banco: zero.** Nenhuma coleção, campo, índice, regra ou função nova. Tudo
é DERIVADO do que já está gravado, e o parabéns é o kudo de sempre.

## 1. O que existe

| Onde | O quê |
|---|---|
| Gestão do torneio → Resultados · aba Jogos do atleta · `/p/:id` (público) | **Pódio** de cada categoria ENCERRADA: os três degraus, "Cartão" por degrau, "Cartão do pódio" e **Parabenizar** |
| Minha área → **Troféus** (`/perfil?secao=trofeus`) | A estante da pessoa: Torneios × Dias de jogo, contagem por metal, cada troféu abre o cartão |
| Perfil público do atleta (`/atletas/:uid`) | A mesma estante, compacta, com **Parabenizar** em cada troféu |

O cartão (`MedalCard`) é arte da marca: fundo ink com a quadra riscada em
acid, o degrau em Outfit preto, as pessoas com foto (ou as iniciais num anel
do metal), o evento, a data por extenso, quem sediou (nome e logo da arena,
só do Storage do projeto), o logo do PickleRush e o QR para a página pública.
O texto é em `cqw`: a mesma arte serve à prévia no celular, ao PNG em 3× e à
folha A4.

**Sair com ele**: Compartilhar (Web Share com a imagem → WhatsApp → copiar),
Imagem (PNG 3×, `html-to-image`), **Imprimir / PDF** (`window.print()` com
`@media print` — só o cartão vai para a folha, A4, "Salvar como PDF" do
navegador) e Link. Com as fotos ou só com os nomes é escolha de quem gera.
Quem gera é **qualquer pessoa que vê o pódio**: organização, medalhistas e
torcida — o cartão divulga o torneio, a arena e a plataforma, não só quem
ganhou.

## 2. De onde vem

- **Pódio** — `tournament/domain/podium.js` (`modalityPodium`): fonte única,
  usada também pelo ranking da casa (`houseRanking.js` importa dela). Mata-mata:
  final decide 1º e 2º; 3º lugar pela disputa de 3º ou, sem ela, os dois
  semifinalistas; outros formatos pela classificação da última fase. **Só
  com a categoria completa** (`isModalityComplete`) — pódio parcial anunciaria
  um campeão que ainda está jogando.
- **Troféus** — `modules/trophies/domain/trophies.js`: de torneio
  (inscrições da pessoa × torneios ENCERRADOS e não arquivados, conferindo a
  CONTA na inscrição) e de dia de jogo (o espelho público `club_event_games`
  por `event_id`, colocação no ranking do dia por tipo de jogo, só 1º–3º).
  `groupTrophies` separa, conta por metal e diz o que **ficou de fora** quando
  uma fonte falhou (nunca zero). Serviço em `trophyService.js`
  (`Promise.allSettled`), hooks em `useTrophies.js`.
- **Cartão** — `modules/trophies/domain/medalCard.js` (`buildMedalCard`):
  degrau ou pódio inteiro, frase por colocação (estável pelo evento), texto de
  compartilhamento, nome do arquivo.

## 3. Parabenizar = kudo

`CongratulateButton` dá um kudo `positive` (escopo `tournament` ou
`universal`) a cada medalhista com conta, com `contextId = trofeu:…`
(`trophyContextId`). É a MESMA máquina dos kudos: XP para quem dá, missões,
antifarm, limite diário. Quem recebe ganha o aviso no sino (tipo
`gamification`, link para a estante). Para si mesmo o botão não aparece;
deslogado vira "Entre para parabenizar"; "já parabenizei" fica no navegador
por pessoa e conquista.

## 4. O que saiu

`CertificateButton`/`CertificateDialog` (o certificado em que qualquer um
digitava um nome de campeão). O cartão só nasce do pódio REAL.
"Pickleholics" nos textos de compartilhamento virou "PickleRush".

## 5. O que não pode regredir

1. Pódio nunca de categoria incompleta.
2. O elemento capturado pelo `toPng` leva `tema-claro` (guarda `modoEscuro`).
3. Logo da arena no cartão só com `isAllowedImageUrl`.
4. Foto de outro domínio que derruba a captura ⇒ o cartão sai sem fotos, e
   a pessoa é avisada (nunca "falhou" sem imagem nenhuma).
5. Fonte de troféus que falhou é dita; a estante não afirma vazio.
