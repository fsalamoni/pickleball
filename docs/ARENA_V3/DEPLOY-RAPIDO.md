# Deploy Rápido — Firestore Rules (Arena V3)

> Guia minimalista para fazer deploy das rules da Arena V3 no projeto
> `antonov-82411` (database `pickleball`) usando o Cloud Shell da Google.

## 1. Abrir Cloud Shell

https://shell.cloud.google.com (certifique-se que o projeto selecionado é
`antonov-82411`).

## 2. Login + setar projeto

```bash
firebase login --reauth
```

(Vai pedir para abrir um link, autorizar, e colar o código de volta.)

```bash
gcloud config set project antonov-82411
firebase use antonov-82411
```

## 3. Puxar o firestore.rules e aplicar o patch

Cole este bloco INTEIRO no terminal (vai demorar uns 5 segundos):

```bash
cd ~
rm -rf pickleball
git clone https://github.com/fsalamoni/pickleball.git
cd pickleball

# Pega o patch de uma URL pública raw do GitHub
# (caso a branch feature/arena-management-v3 não esteja acessível,
#  o patch está embutido no comando abaixo)

cat > /tmp/v3-patch.txt << 'PATCH_EOF'
match /arena_matches/{matchId} {
  allow read: if isAuthed();
  allow create: if isAuthed() && (
    request.resource.data.user_a == request.auth.uid ||
    request.resource.data.user_b == request.auth.uid
  );
  allow update, delete: if isAuthed() && (
    isArenaManager(request.resource.data.arena_id) ||
    resource.data.user_a == request.auth.uid ||
    resource.data.user_b == request.auth.uid
  );
}

match /arena_coaches/{coachId} {
  allow read: if isAuthed();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_classes/{classId} {
  allow read: if isAuthed();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_class_bookings/{bookingId} {
  allow read: if isAuthed() && (
    resource.data.user_id == request.auth.uid ||
    isArenaManager(resource.data.arena_id) ||
    isPlatformAdmin()
  );
  allow create: if isAuthed() && request.resource.data.user_id == request.auth.uid;
  allow update, delete: if isAuthed() && resource.data.user_id == request.auth.uid;
}

match /arena_internal_tournaments/{tournamentId} {
  allow read: if isAuthed();
  allow create, update: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
  allow delete: if isArenaManager(resource.data.arena_id) || isPlatformAdmin();
}

match /arena_ladders/{ladderId} {
  allow read: if isAuthed();
  allow write: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_coupons/{couponId} {
  allow read: if isAuthed();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_campaigns/{campaignId} {
  allow read: if isAuthed();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_nps_responses/{responseId} {
  allow read: if isArenaManager(resource.data.arena_id) || isPlatformAdmin();
  allow create: if isAuthed() && request.resource.data.user_id == request.auth.uid;
}

match /arena_referrals/{referralId} {
  allow read: if isAuthed() && (
    resource.data.referrer_id == request.auth.uid ||
    resource.data.referred_id == request.auth.uid ||
    isPlatformAdmin()
  );
  allow create: if isAuthed();
  allow update, delete: if isAuthed() && resource.data.referrer_id == request.auth.uid;
}

match /arena_checklists/{checklistId} {
  allow read: if isAuthed();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_maintenance_orders/{orderId} {
  allow read: if isArenaManager(resource.data.arena_id) || isPlatformAdmin();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_devices/{deviceId} {
  allow read: if isAuthed();
  allow create, update, delete: if isArenaManager(request.resource.data.arena_id) || isPlatformAdmin();
}

match /arena_networks/{networkId} {
  allow read: if isAuthed();
  allow create, update, delete: if isPlatformAdmin();
}

match /arena_network_memberships/{membershipId} {
  allow read: if isAuthed();
  allow create, update, delete: if isPlatformAdmin();
}

match /arena_tier_configs/{configId} {
  allow read: if isAuthed();
  allow write: if isPlatformAdmin();
}

match /arena_nps_daily/{docId} {
  allow read: if isAuthed();
  allow write: if false;
}
PATCH_EOF

echo "Patch salvo: $(wc -l < /tmp/v3-patch.txt) linhas"

# Faz merge: pega tudo do firestore.rules ATÉ as últimas 2 linhas
# (que são `  }` e `}`), cola o patch, depois cola `  }` e `}` de novo
head -n -2 firestore.rules > /tmp/firestore-merged.rules
cat /tmp/v3-patch.txt >> /tmp/firestore-merged.rules
echo "  }" >> /tmp/firestore-merged.rules
echo "}" >> /tmp/firestore-merged.rules

# Valida
OPEN=$(grep -c '{' /tmp/firestore-merged.rules)
CLOSE=$(grep -c '}' /tmp/firestore-merged.rules)
echo "Chaves: { = $OPEN, } = $CLOSE, diff = $((OPEN - CLOSE))"

if [ "$OPEN" -ne "$CLOSE" ]; then
  echo "ERRO: chaves desbalanceadas. Abortando."
  exit 1
fi

# Substitui o rules
cp /tmp/firestore-merged.rules firestore.rules
echo "firestore.rules atualizado: $(wc -l < firestore.rules) linhas"
```

## 4. Deploy

```bash
firebase deploy --only firestore:rules
```

Aguarde 30-60 segundos. Deve aparecer:

```
✔ firestore: rules released
```

## 5. Verificar

Abra https://console.firebase.google.com/project/antonov-82411/firestore/databases/pickleball/security/rules

Role até o final. Deve ter `match /arena_matches/...`, `match /arena_coaches/...`, etc. (16 novos `match /arena_` no total).

## 6. Próximo passo: Índices (opcional agora)

Os índices podem esperar. Eles só são necessários quando você USAR uma
query que precisa deles. O Firebase mostra um link direto no console
do navegador para criar índice sob demanda.

Para criar todos de uma vez (recomendado), abra o arquivo
`docs/ARENA_V3/firestore.indexes.json` e rode:

```bash
firebase deploy --only firestore:indexes
```

(Atenção: pode levar 5-30 min para todos ficarem "enabled".)

## 7. Próximo passo: Cloud Functions (opcional agora)

```bash
firebase deploy --only functions
```

(5-10 min, 4 funções novas + 1 antiga.)
