# PATCH P1-04 — Cabeçalhos de segurança HTTP

> **NÃO APLICADO.** Baixo risco de quebrar, alto ganho. Mas a CSP precisa
> ser validada em *report-only* antes de virar bloqueante — uma CSP mal
> calibrada quebra a aplicação inteira em branco.

## O achado
`firebase.json` → o array `headers` do site `picklerush` só define
`Cache-Control`. Nenhum cabeçalho de segurança.

## Patch — `firebase.json`, site `picklerush`

Acrescentar ao array `headers` (**sem remover** as entradas de cache):

```jsonc
{
  "source": "**",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy",
      "value": "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), accelerometer=()" },
    { "key": "Strict-Transport-Security",
      "value": "max-age=31536000; includeSubDomains" },
    { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
    { "key": "X-Permitted-Cross-Domain-Policies", "value": "none" }
  ]
}
```

### Notas por cabeçalho

| Cabeçalho | Efeito | Risco de quebrar |
|---|---|---|
| `X-Content-Type-Options: nosniff` | impede o navegador de adivinhar tipo | nenhum |
| `X-Frame-Options: DENY` | mata clickjacking | ⚠ quebra se alguém embute a plataforma em iframe legítimo. **Verificar antes**: o telão (`/dia-de-jogo/:id/telao`) é aberto em aba, não em iframe → seguro |
| `Referrer-Policy` | não vaza URL completa (que pode conter código de convite) para terceiros | nenhum |
| `Permissions-Policy` | desliga APIs não usadas | ⚠ `camera=(self)` mantido porque o upload de foto pode usar; `geolocation=(self)` porque "perto de mim" pode usar |
| `HSTS` | força HTTPS | ⚠ **irreversível na prática** pelo `max-age`. O Firebase Hosting já é HTTPS-only, então é seguro. Começar com `max-age=300`, subir para 1 ano depois de 1 semana |
| `COOP: same-origin` | isola a janela | ⚠ pode afetar `signInWithPopup` do Firebase Auth. **Testar login com Google antes.** Se quebrar, usar `same-origin-allow-popups` |

## CSP — em duas etapas, nunca direto

A CSP é o cabeçalho mais valioso e o mais perigoso. **Etapa 1: só relatar.**

```jsonc
{ "key": "Content-Security-Policy-Report-Only",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://*.googleusercontent.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://*.cloudfunctions.net; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" }
```

Procedimento:
1. Publicar em `Report-Only`. Rodar **2 semanas**.
2. Coletar as violações (console do navegador; sem endpoint de report,
   pedir a alguns usuários e testar todos os fluxos: login Google, upload de
   foto, chat, PWA, telão, admin).
3. Ajustar a lista até zero violação **legítima**.
4. Só então trocar a chave para `Content-Security-Policy`.
5. Meta de longo prazo: remover `'unsafe-inline'` de `script-src` (exige
   nonce/hash — o Vite gera scripts com hash, é viável, mas é outro PR).

⚠ **Não copie esta CSP e publique como bloqueante.** As origens acima são
uma estimativa a partir das dependências do projeto (Firebase, Google
Fonts, Google Auth). A lista real só aparece no modo relatório.

## Validação
```bash
npm run build
npx firebase hosting:channel:deploy csp-test --expires 3d
# testar no canal: login Google, upload de foto, chat, telão, PWA, admin
curl -sI https://<canal>.web.app | grep -iE "x-frame|content-security|strict-transport"
```

Publicar em canal de pré-visualização **antes** de `main` é obrigatório
aqui — é a única mudança deste estudo que pode deixar o site em branco.
