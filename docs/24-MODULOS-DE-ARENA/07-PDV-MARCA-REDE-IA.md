# Onda 6 — PDV, marca, rede e inteligência

> **Módulos**: `pdv` (+ catálogo, Pix, divisão) · `white_label` (+ branding) ·
> `multi_unit` (+ rede, BI, cross booking) · `ai` (+ preço, previsão) ·
> `iot` (+ totem)
> **Chave-mestra**: flag `arena_modules` (default OFF).
> **Banco**: zero coleção nova, zero índice novo. **Uma regra ampliada** (rede).

---

## 1. 🐞 PDV: três defeitos, e o atleta não conseguia comprar

### 1.1 A compra era recusada pela regra

```js
// createSale, depois de gravar a venda:
await updateDoc(doc(db, 'arena_products', item.product_id), {
  stock: increment(-(item.quantity || 1)),   // ← o ATLETA escrevendo aqui
  …
});
```

```
match /arena_products/{prodId} {
  allow create, update: if isAuthed() && (isArenaManager(...) || isPlatformAdmin());
```

A venda era gravada (essa o comprador pode gravar, pela regra de
`arena_sales`) e a escrita seguinte era **recusada**. Resultado: uma venda
fantasma no banco e um erro na tela do atleta.

**A correção não é afrouxar a regra.** O estoque sai na **entrega pela
arena** — a mesma decisão das horas de pacote (Onda AI): reservar o que a
arena ainda não entregou conta uma venda que pode não acontecer.

```
atleta compra   → venda PENDENTE, estoque intacto, conferência é AVISO
arena entrega   → confere de novo e baixa o estoque, num lote
arena cancela   → devolve o estoque se ele já tinha saído
```

A reconferência na entrega existe porque entre a compra e a retirada outra
pessoa pode ter levado a última unidade.

### 1.2 Dividir a conta não funcionava

O comprador criava um documento de pagamento **para cada participante**, com
`payer_id` de outra pessoa. A regra exige `payer_id == request.auth.uid`, e
como era um `writeBatch` (atômico), a recusa de um derrubava todos —
**inclusive o do próprio comprador**.

Agora o comprador grava só o pagamento dele; a divisão fica no documento da
venda (`split_details`), e **cada participante grava o próprio** quando paga
(`payMyShare`, idempotente). Quem entra na divisão **é avisado** — sem o aviso,
"dividir a conta" seria o comprador cobrando os amigos por fora, que é
exatamente o que a funcionalidade promete resolver.

E o comprador sempre entra na divisão: uma conta dividida em que quem comprou
não paga nada é o começo de uma discussão no vestiário.

### 1.3 A lista de vendas não ordenava

```js
.sort((a, b) => Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0))
```

`created_at_ms` **nunca era gravado**. A subtração dava sempre zero e o caixa
saía em ordem arbitrária. Agora o campo é gravado, e a ordenação tem fallback
para o `created_at` do servidor — sem ele, tudo o que existia antes iria para o
fim da lista de uma vez.

De quebra: `updateArenaProduct` gravava o objeto cru, sem normalizar — preço
negativo e categoria inventada entravam em silêncio.

---

## 2. 🐞 A marca era gravada onde o atleta não pode ler

```js
// updateBranding
const ref = doc(db, 'arena_settings', arenaId);
```

```
match /arena_settings/{arenaId} {
  allow read: if isAuthed() && (isArenaManager(arenaId) || isPlatformAdmin());
```

**Só o gestor lê.** A cor e o logo da arena nunca teriam como chegar à página
pública nem ao telão, por mais código de exibição que se escrevesse — e não
havia nenhum: o campo era gravado e **nunca lido por nada**.

A marca agora mora em `arenas/{id}.branding` — campo opcional do documento da
arena, que é `allow read: if true`. **O que é público tem de estar onde o
público lê.**

E ela é usada: o cabeçalho da página da arena sai com a cor, o logo e a
assinatura. A tela de gestão mostra a prévia, porque escolher cor sem ver o
resultado é escolher no escuro.

### Contraste não é detalhe

Uma arena escolhe amarelo-limão e o texto branco por cima some. `readableInk`
decide preto ou branco pela **luminância relativa** (a conta da WCAG), então a
tela continua legível com qualquer cor — inclusive as escolhidas errado.

O que já estava salvo no lugar antigo não é perdido: a tela de gestão
pré-preenche o formulário com ele (só o gestor abre aquela tela, e só ele
conseguia ler aquele campo mesmo).

---

## 3. 🐞 A previsão era calculada sobre lista vazia

```js
export async function getHistoricalBookings(arenaId, days = 30) {
  // Simplificado: retorna array vazio (real viria de arena_bookings)
  // Aqui só para satisfazer a interface
  return [];
}
```

A previsão da IA era **sempre zero**, e o preço sugerido não tinha histórico
nenhum em que se basear. O painel mostrava um número inventado com cara de
análise.

Agora lê as reservas de verdade: só **confirmadas e concluídas** (pedido
recusado não é demanda; contá-lo inflaria a previsão com o que a arena nem
aceitou), agrupadas por dia, com horas-quadra e receita. A data mora dentro de
`slots` (vetor), o que impede recortar no servidor — o recorte é em memória,
como no resto do módulo.

Sem histórico, a tela **não inventa**: diz que falta movimento.

### O preço é sugestão

Três cenários (manhã de semana, pico, sábado), com a variação em percentual ao
lado. **Nada muda de preço sozinho** — quem aplica é a arena, nas faixas da
quadra. Um sistema que muda o preço sem a arena ver é o tipo de automação que
se descobre pelo cliente reclamando. Está escrito na tela.

> ⚠️ `resolveArenaPrice` devolve um **objeto** `{ price, … }`, não um número.
> Usar o retorno cru fazia `base > 0` ser sempre falso e o bloco de preço nunca
> aparecer — aconteceu na primeira versão desta tela e há teste travando.

---

## 4. 🐞 A rede não podia ser criada — e listava a dos outros

```
match /arena_networks/{networkId} {
  allow create, update, delete: if isPlatformAdmin();
```

O módulo `multi_unit` é oferecido **à arena**, em Gestão → Configurações →
Módulos. Ela ligava, abria a tela, clicava em "Criar rede" e recebia permissão
negada. E `listNetworks()` mostrava **todas as redes da plataforma** para
qualquer conta autenticada.

### A regra ampliada, e por que ela é conservadora

Esta é a **única regra ampliada** em seis ondas — e ela continua fechando o
caso perigoso:

| Operação | Quem pode |
|---|---|
| Criar rede | quem gere a **arena fundadora**, declarando-se dono |
| Editar | o dono — e **editar não transfere** a rede para outra pessoa |
| Apagar | o dono |
| **Incluir unidade** | quem gere **a unidade** *e* é **dono da rede** |
| Sair da rede | quem gere a unidade, ou o dono da rede |

As duas condições da inclusão são as duas necessárias:

- **só a arena que eu administro** — senão eu colocaria a sua unidade na minha
  rede e passaria a ver os números dela no BI consolidado;
- **só na rede que eu sou dono** — senão eu poluiria a rede alheia com uma
  unidade que ninguém convidou.

Rede entre donos diferentes continua sendo caso do admin da plataforma: é uma
decisão comercial, não uma operação de tela.

**14 asserções novas no emulador** (212 no total), metade provando o que passou
a funcionar e metade provando o que continua barrado.

---

## 5. IoT: honesto sobre o limite

O cadastro de equipamentos funciona e diz o que a plataforma **não** faz:
iluminação, sensor e câmera são serviços de terceiro; guardamos o registro e o
vínculo com a quadra, o comando depende de integração do fabricante. É a mesma
coisa que o catálogo de módulos diz (`status: external`) — não é promessa por
fazer, é o limite.

---

## 6. O que foi tocado

**Domínio novo** (`domain/whiteLabel.js`, +18 asserções): `normalizeHex`,
`luminance`, `readableInk`, `normalizeBranding`, `brandingOf`.

**Serviços**: `pdvService` (compra sem baixa, `confirmSale`, `cancelSale`,
`payMyShare`, `myShareOf`, `created_at_ms`, ordenação com fallback,
`updateArenaProduct` normalizado); `advancedService` (`updateBranding` para
`arenas`, `getLegacyBranding`, `getHistoricalBookings` de verdade,
`listMyNetworks`, `getArenaNetwork`, `createNetwork` com arena fundadora,
`removeArenaFromNetwork`).

**Telas**: `V2ArenaPDV.jsx` e `V2ArenaAdvanced.jsx`, reescritas
(+17 e +18 asserções de runtime); `V2ArenaDetail.jsx` usa a marca.

**Regras**: `arena_networks` e `arena_network_memberships` ampliadas
(+14 asserções no emulador).

**Banco**: nenhuma coleção, nenhum índice. Campos opcionais em `arenas`
(`branding`), `arena_sales` (`stock_applied`, `created_at_ms`,
`cancel_reason`, `delivered_at`), `arena_payments` (`created_at_ms`) e
`arena_networks` (`owner_arena_id`).

---

## 7. O que NÃO pode regredir

1. **O estoque baixa na ENTREGA**, nunca na compra — a regra não deixaria, e o
   modelo não deveria.
2. **Cada pessoa grava o próprio pagamento.** Escrever `payer_id` de outra
   pessoa é recusado, e num lote atômico derruba tudo.
3. **`created_at_ms` é gravado**, e a ordenação tem fallback.
4. **A marca mora em `arenas.branding`** — `arena_settings` é do gestor.
5. **O texto sobre a cor da marca é escolhido por contraste.**
6. **A previsão não é exibida sem histórico**, e o preço é sugestão.
7. **`resolveArenaPrice` devolve objeto** — use `.price`.
8. **Incluir unidade exige as DUAS condições** (gerir a unidade e ser dono da
   rede).
