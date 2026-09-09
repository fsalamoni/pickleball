/**
 * P1-01 — guarda de regressão: o e-mail não pode voltar aos documentos de
 * LEITURA AMPLA.
 *
 * `club_members` e `tournament_admins` são `allow read: if isAuthed()`, ou
 * seja, qualquer conta da plataforma lê a lista de membros de qualquer clube e
 * de organizadores de qualquer torneio. Enquanto o e-mail morava neles, era um
 * diretório de contatos aberto a toda a base.
 *
 * Este teste lê o CÓDIGO-FONTE dos serviços em vez de rodá-los, de propósito:
 * o que importa é que ninguém reintroduza o campo numa refatoração distraída,
 * e isso é verificável sem Firebase.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const clubService = readFileSync('src/modules/clubs/services/clubService.js', 'utf8');
const tournamentService = readFileSync('src/modules/tournament/services/tournamentService.js', 'utf8');

/** Corpo da função/bloco que grava um documento, sem comentários. */
function blocoSemComentarios(fonte, marcador, linhas = 14) {
  const i = fonte.indexOf(marcador);
  if (i < 0) throw new Error(`marcador não encontrado: ${marcador}`);
  return fonte.slice(i).split('\n').slice(0, linhas)
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
}

describe('P1-01 · e-mail fora dos documentos de leitura ampla', () => {
  it('⭐ `club_members` (memberPayload) NÃO grava user_email', () => {
    const bloco = blocoSemComentarios(clubService, 'function memberPayload(');
    expect(bloco).toContain('user_name');
    expect(bloco).not.toContain('user_email');
  });

  it('⭐ aprovar um pedido NÃO copia o e-mail para o documento de membro', () => {
    // O pedido de entrada tem leitura restrita e pode guardar o e-mail; o
    // documento de membro, não. Copiar de um para o outro reabria o vazamento.
    const bloco = blocoSemComentarios(clubService, 'await setDoc(doc(db, COL.members, memberDocId(request.club_id');
    expect(bloco).toContain('user_name');
    expect(bloco).not.toContain('user_email');
  });

  it('⭐ `tournament_admins` NÃO grava user_email em nenhum dos dois pontos', () => {
    // Um grep simples basta: se o campo voltar em qualquer lugar do serviço,
    // este teste cai e obriga a olhar de novo.
    const semComentarios = tournamentService
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    expect(semComentarios).not.toContain('user_email');
  });

  it('as coleções de leitura RESTRITA seguem podendo guardar o contato', () => {
    // `club_join_requests` e `club_member_invites` são lidos só pelo próprio
    // usuário, pelo admin do clube e pelo admin da plataforma. Ali o e-mail é
    // legítimo: é como o admin do clube fala com quem pediu para entrar.
    expect(clubService).toContain("user_email: user.email || ''");
    expect(clubService).toContain("user_email: target.user_email || ''");
  });
});
