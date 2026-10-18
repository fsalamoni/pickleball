import { describe, it, expect } from 'vitest';
import {
  canCancelEnrollment, coursePriceFor, courseState, credentialState, credentialValidUntil, publicCourses, publicCredentialVerification, seatsLeft, sortCourses, validateCourseInput,
} from './courses.js';

const base = { name: 'Curso de arbitragem', kind: 'referee', starts_at: '2026-08-10', ends_at: '2026-08-11', price_cents: 20000, member_price_cents: 10000, seats: 20 };

describe('validateCourseInput', () => {
  it('aceita o curso completo e normaliza', () => {
    const r = validateCourseInput({ ...base, online: true, link: 'https://meet.example', credential_months: 24, issues_credential: true });
    expect(r.ok).toBe(true);
    expect(r.value.place).toBe('');
    expect(r.value.credential_months).toBe(24);
    expect(r.value.status).toBe('draft');
  });
  it('reprova fim antes do início, valor de filiado maior e link sem https', () => {
    expect(validateCourseInput({ ...base, ends_at: '2026-08-01' }).errors.ends_at).toBeTruthy();
    expect(validateCourseInput({ ...base, member_price_cents: 30000 }).errors.member_price_cents).toBeTruthy();
    expect(validateCourseInput({ ...base, online: true, link: 'http://x' }).errors.link).toBeTruthy();
    expect(validateCourseInput({ ...base, name: 'ab' }).errors.name).toBeTruthy();
  });
});

describe('preço, vagas e estado', () => {
  it('filiado paga o menor; sem valor de filiado paga o cheio', () => {
    expect(coursePriceFor(base, { isMember: true })).toBe(10000);
    expect(coursePriceFor(base)).toBe(20000);
    expect(coursePriceFor({ price_cents: 5000 }, { isMember: true })).toBe(5000);
  });
  it('vagas que restam; 0 = sem limite', () => {
    expect(seatsLeft({ seats: 20, enrolled_count: 18 })).toBe(2);
    expect(seatsLeft({ seats: 0, enrolled_count: 99 })).toBeNull();
  });
  it('aberto só com status open, no futuro e com vaga', () => {
    expect(courseState({ ...base, status: 'open' }, '2026-06-01').open).toBe(true);
    expect(courseState({ ...base, status: 'open', enrolled_count: 20 }, '2026-06-01')).toMatchObject({ open: false, full: true });
    expect(courseState({ ...base, status: 'open' }, '2026-09-01')).toMatchObject({ open: false, past: true });
    expect(courseState({ ...base, status: 'draft' }, '2026-06-01').open).toBe(false);
  });
  it('cancela a inscrição antes do curso e só se não foi avaliada', () => {
    expect(canCancelEnrollment({ status: 'confirmed' }, base, '2026-06-01')).toBe(true);
    expect(canCancelEnrollment({ status: 'confirmed' }, base, '2026-08-12')).toBe(false);
    expect(canCancelEnrollment({ status: 'passed' }, base, '2026-06-01')).toBe(false);
  });
});

describe('credencial', () => {
  it('validade pelos meses do curso; vencida pela data', () => {
    expect(credentialValidUntil({ credential_months: 24 }, '2026-08-11')).toBe('2028-08-11');
    expect(credentialValidUntil({ credential_months: 0 }, '2026-08-11')).toBe('');
    expect(credentialState({ status: 'active', valid_until: '2026-01-01' }, '2026-02-01').status).toBe('expired');
    expect(credentialState({ status: 'active', valid_until: '' }, '2026-02-01').valid).toBe(true);
    expect(credentialState({ status: 'revoked' }).valid).toBe(false);
  });
  it('a verificação pública devolve só o mínimo', () => {
    const r = publicCredentialVerification({ user_name: 'Ana', kind: 'referee', level: 'Nível 1', issued_at: '2026-08-11', valid_until: '2028-08-11', status: 'active', cpf: 'x' }, { name: 'FGP', acronym: 'FGP', slug: 'fgp' }, '2026-09-01');
    expect(r).toEqual({ found: true, kind: 'credential', name: 'Ana', photo_url: '', federation: { name: 'FGP', acronym: 'FGP', slug: 'fgp' }, credential_kind: 'referee', level: 'Nível 1', course_name: '', issued_at: '2026-08-11', valid_until: '2028-08-11', status: 'active' });
    expect(publicCredentialVerification(null, {})).toEqual({ found: false });
  });
});

describe('ordem e público', () => {
  it('futuros primeiro pela data, passados depois do mais recente', () => {
    const r = sortCourses([{ starts_at: '2026-01-01', ends_at: '2026-01-01' }, { starts_at: '2026-09-01', ends_at: '2026-09-01' }, { starts_at: '2026-07-01', ends_at: '2026-07-01' }, { starts_at: '2025-01-01', ends_at: '2025-01-01' }], '2026-06-01');
    expect(r.map((c) => c.starts_at)).toEqual(['2026-07-01', '2026-09-01', '2026-01-01', '2025-01-01']);
  });
  it('rascunho não é público', () => {
    expect(publicCourses([{ status: 'draft' }, { status: 'open' }]).length).toBe(1);
  });
});
