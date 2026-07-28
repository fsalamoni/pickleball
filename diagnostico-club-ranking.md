# Diagnóstico do ranking interno do clube

**Última atualização: 2026-07-28, 20:50 GMT-3** — investigação em curso.

Cole este script no **Console do navegador** (F12 → Console) **enquanto
está logado no app** (`picklerush.web.app`). O script vai listar o que
está no Firestore para o clube `hyu7TxcWtkUQy382nm2o` (Pickleholics)
e para o seu uid `Kx7CC0NVgogh8cCF4wIRmpOvo7r2`.

```js
(async () => {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
  const { getFirestore, collection, getDocs, query, where, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

  // As credenciais vêm do app já logado, via localStorage.
  // Se não achar, vamos usar a do build:
  const cfg = JSON.parse(localStorage.getItem('firebase:config') || 'null');
  if (!cfg) {
    console.log('❌ Firebase config não encontrada. Abra o app primeiro.');
    return;
  }
  const app = initializeApp(cfg, 'diag');
  const db = getFirestore(app);

  const clubId = 'hyu7TxcWtkUQy382nm2o';
  const myUid = 'Kx7CC0NVgogh8cCF4wIRmpOvo7r2';

  console.log('=== 1) Membros do clube ===');
  const memSnap = await getDocs(query(collection(db, 'club_members'), where('club_id', '==', clubId)));
  const memberUids = memSnap.docs.map((d) => d.data().user_id).filter(Boolean);
  console.log(`Membros: ${memSnap.size} docs, ${memberUids.length} com user_id`);
  console.log('UIDs:', memberUids.slice(0, 5), '...');

  console.log();
  console.log('=== 2) Perfis com club_ids incluindo o clube ===');
  const profSnap = await getDocs(query(collection(db, 'athlete_profiles'), where('club_ids', 'array-contains', clubId)));
  console.log(`Perfis: ${profSnap.size}`);

  console.log();
  console.log('=== 3) Eventos do clube ===');
  const evSnap = await getDocs(query(collection(db, 'club_events'), where('club_id', '==', clubId)));
  console.log(`Eventos: ${evSnap.size}`);
  for (const ev of evSnap.docs) {
    console.log(`  - ${ev.id}: ${ev.data().title || '(sem título)'}`);
  }

  console.log();
  console.log('=== 4) Games de cada evento (subcoleção) ===');
  let totalGames = 0;
  let totalDecided = 0;
  let sampleGame = null;
  for (const ev of evSnap.docs) {
    const gamesSnap = await getDocs(collection(db, 'club_events', ev.id, 'games'));
    for (const g of gamesSnap.docs) {
      totalGames += 1;
      const gd = g.data();
      if (gd.score_a != null && gd.score_b != null && gd.score_a !== gd.score_b) {
        totalDecided += 1;
        if (!sampleGame) sampleGame = { id: g.id, eventId: ev.id, ...gd };
      }
    }
  }
  console.log(`Games: ${totalGames} total, ${totalDecided} decididos`);
  if (sampleGame) {
    console.log('Exemplo de game decidido:');
    console.log('  id:', sampleGame.id);
    console.log('  score:', sampleGame.score_a, 'x', sampleGame.score_b);
    console.log('  side_a:', JSON.stringify(sampleGame.side_a));
    console.log('  side_b:', JSON.stringify(sampleGame.side_b));
  }

  console.log();
  console.log('=== 5) Participants do evento (do 1º evento com games) ===');
  for (const ev of evSnap.docs) {
    const gamesSnap = await getDocs(collection(db, 'club_events', ev.id, 'games'));
    if (gamesSnap.size > 0) {
      const partSnap = await getDocs(collection(db, 'club_events', ev.id, 'participants'));
      console.log(`Evento ${ev.id}: ${partSnap.size} participants`);
      for (const p of partSnap.docs) {
        const pd = p.data();
        console.log(`  - doc_id=${p.id}, user_id=${pd.user_id || 'NULL'}, name="${pd.name}"`);
      }
      break; // só 1 evento pra não explodir
    }
  }

  console.log();
  console.log('=== 6) Materializado ATUAL do clube ===');
  const matIndividual = await getDocs(query(collection(db, 'club_internal_ratings'), where('club_id', '==', clubId)));
  const matExt = await getDocs(query(collection(db, 'club_internal_ratings_ext'), where('club_id', '==', clubId)));
  console.log(`club_internal_ratings: ${matIndividual.size} docs`);
  console.log(`club_internal_ratings_ext: ${matExt.size} docs`);
  if (matIndividual.size > 0) {
    const sample = matIndividual.docs[0].data();
    console.log('Exemplo:', JSON.stringify(sample, null, 2));
  }

  console.log();
  console.log('=== 7) club_event_games (espelho Wave C) ===');
  const cegSnap = await getDocs(query(collection(db, 'club_event_games'), where('club_id', '==', clubId)));
  console.log(`club_event_games: ${cegSnap.size} docs`);
})();
```

## O que vou descobrir

| Cenário | O que significa | Fix |
|---|---|---|
| 0 games decididos | Não há placar lançado | Não é bug — apenas jogue |
| Games decididos, mas `side_a` é só `id` (sem `user_id`) | É o schema legado, o server **deveria** estar resolvendo via participants | Server tem o fix. Conferir se Cloud Function foi deployada |
| Participants sem `user_id` (convidados) | Normal, são pulados | OK |
| Materializado tem docs, mas `user_id` é `undefined` ou `EP_xxx` | Bug do server | Confirmar se Cloud Function foi deployada |
| 0 eventos no clube | Não há game day | Não é bug — criar evento |

Por favor **cole o output do script no chat**. Com isso vou saber **exatamente** o que está acontecendo.
