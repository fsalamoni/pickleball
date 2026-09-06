# 20.08 — Consentimento, direito de imagem e menores

## 1. O consentimento hoje

**Mecânica**: madura (ver `07-DOCUMENTOS-LEGAIS.md` §1) — 11 documentos
versionados, aceite registrado em `legal_consents/{uid}_{docKey}`, portão
bloqueante, segmentação por papel.

**Granularidade**: insuficiente. Aceitar a Política de Privacidade inteira
é um bloco só. A LGPD (art. 8º, §4º) exige consentimento para finalidades
**determinadas**; consentimento genérico para finalidades genéricas é nulo.

### O que precisa ser consentimento separado

| Finalidade | Hoje | Deve ser | Padrão |
|---|---|---|---|
| Usar a plataforma | aceite dos termos | execução de contrato (não precisa de consentimento) | — |
| Aparecer no diretório de atletas | ligado por padrão ⚠ | opt-out **eficaz** + aviso claro (ou opt-in) | ver `06-LGPD` §3 |
| Publicar telefone no perfil | opt-in ✅ | manter | desligado ✅ |
| Publicar e-mail no perfil | opt-in ✅ | manter | desligado ✅ |
| Publicar endereço no perfil | opt-in ✅ | manter | desligado ✅ |
| Receber push | opt-in ✅ | manter | desligado ✅ |
| Receber comunicação de **marketing** | **inexistente** | consentimento separado | desligado |
| **Uso de imagem** | **inexistente** | consentimento específico | desligado |
| Compartilhar dados com a arena/professor | implícito | aviso + base definida | — |
| Exportação para o DUPR | flag OFF | consentimento antes de ligar | desligado |
| Post automático de resultado (Feed, futuro) | n/a | opt-in, sempre | desligado |

**Proposta**: coleção `user_consents/{uid}` — um documento, um campo por
finalidade, com data e versão:
```js
{ user_id,
  marketing_email:  { granted:false, at:null, version:1 },
  image_use:        { granted:false, at:null, version:1, scope:[] },
  directory_listed: { granted:true,  at:<ts>, version:1 },
  dupr_export:      { granted:false, at:null, version:1 },
  updated_at }
```
Separada de `legal_consents` (que é aceite de **documento**); esta é
consentimento de **finalidade**. As duas coexistem sem conflito.

**Revogação**: cada finalidade tem que ser revogável com a mesma facilidade
com que foi concedida (art. 8º, §5º) — um toggle em `/configuracoes`, com
efeito imediato e registro.

## 2. Direito de imagem — a lacuna mais concreta

### O que a plataforma já faz hoje, sem autorização

| Uso | Onde | Exposição |
|---|---|---|
| Foto de perfil | `users.photo_url`, `athlete_profiles.photo_url` | 🌍 pública |
| Foto de torneio | `tournament_photos` | 🌍 **pública, `allow read: if true`** |
| Foto em inscrição | `tournament_registrations.player_a_photo` | 🌍 pública |
| Anexo de imagem em chat/fórum | Storage | 🔓 |
| Logo/foto de arena | `arenas.photos[]` | 🌍 |

O caso crítico é **`tournament_photos`**: fotos de evento, tiradas pelo
organizador, com **várias pessoas** — inclusive quem não é usuário da
plataforma e nunca concordou com nada. Publicadas sem login.

### O regime jurídico
- CF art. 5º, X e Código Civil art. 20: a imagem é protegida; o uso exige
  autorização, salvo exceções (interesse público, ordem pública,
  administração da justiça).
- **Evento esportivo aberto** tem alguma margem (pessoa em local público,
  em atividade coletiva), mas isso **não** cobre: foto individualizada,
  uso promocional, e — muito importante — **menores**.
- Uso comercial (divulgar a plataforma, vender patrocínio) **sempre**
  exige autorização.

### O que implementar

1. **Documento `uso-de-imagem`** (`07-DOCUMENTOS-LEGAIS.md` §3), com escopo:
   - `profile` — minha foto no meu perfil (na prática, decorrência de subir)
   - `event_photos` — posso aparecer em fotos de torneio publicadas
   - `promotional` — a plataforma pode usar minha imagem para divulgação
   - `third_party` — parceiros podem usar
   Cada escopo com toggle independente. Nenhum ligado por padrão, exceto
   `profile`.
2. **Aviso ao organizador** no fluxo de upload de `tournament_photos`:
   "Você declara ter autorização das pessoas retratadas. Fotos com menores
   exigem autorização do responsável."
3. **Canal de remoção**: botão "Peço a remoção desta foto" em toda foto,
   levando ao encarregado, com SLA. Não pode depender de achar um e-mail.
4. **Marcar pessoas** (futuro, Feed): quem é marcado pode remover a marcação
   e pedir a remoção da mídia.
5. **Remoção de EXIF** em todo upload (hoje **não** é feito) — foto de
   celular carrega GPS; publicar isso é vazar a casa da pessoa.
   Ver `docs/FUTURO/FEED/08-MIDIA-FOTO-VIDEO.md` §4 — a implementação está
   desenhada lá, mas o problema **já existe hoje**, sem o Feed.
6. **Rever `tournament_photos: allow read: if true`** — no mínimo exigir
   login; idealmente, respeitar a visibilidade do torneio.

> ⚠ **Item de ação imediata, independente de tudo mais**: remover EXIF dos
> uploads. É pequeno (uma função em `storageService`), não quebra nada, e
> fecha um vazamento de localização que já está acontecendo.

## 3. Menores de idade

### Situação
- `users.birth_date` existe, mas **não há verificação de idade** em lugar
  nenhum.
- Perfil de menor entra no **diretório público por padrão**
  (`directory_listed: true`).
- Professores dão aula para crianças — `coach_students` pode conter menores.
- Torneios têm categorias infantis.
- Não há consentimento de responsável.

### O que a lei exige (art. 14)
- Tratamento de dado de criança (< 12) e adolescente (12-18): **melhor
  interesse** do menor.
- Dado de **criança**: consentimento **específico e destacado** de pelo
  menos um dos pais ou responsável (§1º).
- Não condicionar participação em jogo/aplicação ao fornecimento de dado
  além do necessário (§4º).
- Esforços razoáveis para verificar que o consentimento foi dado pelo
  responsável (§5º).

### Desenho proposto

```
Cadastro pede data de nascimento (já pede)
   ├─ ≥ 18  → fluxo normal
   ├─ 13-17 → conta de adolescente
   │      · perfil NÃO entra no diretório público por padrão
   │      · contato nunca publicável
   │      · chat só com pessoas do mesmo clube ou já conectadas
   │      · exige e-mail do responsável + aceite do termo
   │      · sem Mercado (venda), sem publicação pública no Feed
   └─ < 13  → conta de criança
          · só por convite do responsável, vinculada à conta dele
          · perfil não é público
          · sem chat aberto, sem feed público, sem mercado
          · consentimento destacado do responsável, registrado
```

**Verificação realista**: a plataforma não tem como provar a idade nem a
identidade do responsável. "Esforços razoáveis" (§5º) significa: pedir a
data, pedir o e-mail do responsável, enviar confirmação por e-mail, e
registrar o aceite. É o padrão do setor e é defensável — **desde que
exista**, o que hoje não é o caso.

**Sinalização de conta de menor**: não expor publicamente que é menor
(isso seria criar um alvo). O tratamento é interno.

**Menor que vira adulto**: no aniversário de 18, oferecer as opções que
estavam bloqueadas — nunca ligar sozinho.

## 4. Impacto no Feed e no Mercado (`docs/FUTURO/`)

Estes três temas — consentimento granular, imagem e menores — são
**pré-requisito** para as duas funcionalidades:

| Funcionalidade | Por quê |
|---|---|
| **Feed** | é uma máquina de publicar imagem de pessoas, inclusive menores. Sem regime de imagem e sem tratamento de menor, é passivo direto |
| **Mercado** | menor não pode contratar sozinho (Código Civil art. 3º e 4º); venda por menor precisa de representação |

Ambos já apontam para cá em seus documentos de risco.

## 5. Ordem de implementação

```
1. Remover EXIF nos uploads              (pequeno, imediato, sem risco)
2. Documento uso-de-imagem + toggles     (⚖️ advogado + 1 PR)
3. Canal de remoção de foto              (1 PR pequeno)
4. user_consents (finalidades granulares) (1 PR)
5. Regime de menores                     (⚖️ decisão + 1-2 PRs)
6. Revisar tournament_photos: if true    (1 linha + validação)
```
