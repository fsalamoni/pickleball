/**
 * Guarda: a limpeza de e-mails legados é destrutiva e só pode mirar o banco
 * pickleball, com dry-run por padrão e confirmação explícita para escrita.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SCRIPT = readFileSync('scripts/privacy-legacy-email-cleanup.mjs', 'utf8');
const WORKFLOW = readFileSync('.github/workflows/privacy-legacy-email-cleanup.yml', 'utf8');

describe('limpeza de e-mails legados', () => {
  it('⭐ abre explicitamente o banco pickleball, nunca o banco default', () => {
    expect(SCRIPT).toMatch(/const DATABASE_ID = process\.env\.FIRESTORE_DATABASE_ID \|\| 'pickleball'/);
    expect(SCRIPT).toMatch(/getFirestore\(app, DATABASE_ID\)/);
    expect(SCRIPT).not.toMatch(/getFirestore\(\)/);
    expect(WORKFLOW).toMatch(/FIRESTORE_DATABASE_ID: pickleball/);
  });

  it('⭐ escrita exige APPLY e confirmação exata por comando', () => {
    expect(SCRIPT).toMatch(/const APPLY = process\.env\.APPLY === '1'/);
    expect(SCRIPT).toMatch(/CRIAR_CONTATOS_PRIVADOS/);
    expect(SCRIPT).toMatch(/APAGAR_EMAILS_PUBLICOS_LEGADOS/);
    expect(SCRIPT).toMatch(/APAGAR_USER_EMAIL_LEGADO/);

    expect(WORKFLOW).toMatch(/APPLY: \$\{\{ inputs\.apply && '1' \|\| '0' \}\}/);
    expect(WORKFLOW).toMatch(/backfill-registration-contacts:1:CRIAR_CONTATOS_PRIVADOS/);
    expect(WORKFLOW).toMatch(/delete-registration-public-emails:1:APAGAR_EMAILS_PUBLICOS_LEGADOS/);
    expect(WORKFLOW).toMatch(/delete-wide-user-emails:1:APAGAR_USER_EMAIL_LEGADO/);
    expect(WORKFLOW).toMatch(/report:0:\*/);
  });
});
