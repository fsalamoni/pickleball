/**
 * O banco da gamificação.
 *
 * 🐞 Todos os services da gamificação V2 chamavam `getFirestore()` sem
 * argumento — que devolve o banco `(default)`. O PickleRush NÃO usa o
 * `(default)`: o banco do app é o NOMEADO (`pickleball`, ver
 * `core/config/firebase.js`), e é nele que as regras e os índices são
 * publicados. Resultado: ligada a flag em produção, toda leitura e escrita da
 * gamificação iria para um banco que não é o do app. No emulador (que cria o
 * `(default)` sozinho) e nos testes (que mockam `getFirestore`) o defeito era
 * invisível — por isso há um guarda de fonte em
 * `src/core/guards/bancoNomeado.test.js`.
 *
 * `db` é um live binding: lê o valor de `core/config/firebase` no momento da
 * chamada, depois que o Firebase foi inicializado.
 */
import { db as bancoDoApp } from '@/core/config/firebase';

/** @returns {import('firebase/firestore').Firestore} */
export function gamificationDb() {
  return bancoDoApp;
}
