import { describe, expect, it } from 'vitest';
import {
  BENEFIT_KIND, benefitFitsPlan, benefitMetaLine, benefitState, liveBenefits, validateBenefit, validateClubNews, validateSponsor,
  visibleClubNews, visibleClubSponsors, NEWS_AUDIENCE, NEWS_STATUS,
} from './content.js';

describe('validateBenefit', () => {
  it('separa a vitrine do que é só do associado', () => {
    const r = validateBenefit({ title: '  Café com 10%  ', how_to: 'Mostre a carteirinha', code: 'CLUBE10', public: true });
    expect(r.ok).toBe(true);
    expect(r.value.title).toBe('Café com 10%');
    expect(r.value.has_secret).toBe(true);
    expect(r.value).not.toHaveProperty('code');
    expect(r.value).not.toHaveProperty('how_to');
    expect(r.secret).toEqual({ how_to: 'Mostre a carteirinha', code: 'CLUBE10' });
  });
  it('exige título e data válida; tipo desconhecido vira "outra vantagem"', () => {
    const r = validateBenefit({ title: 'ab', valid_until: '31/12/2026', kind: 'zzz' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['title', 'valid_until']);
    expect(r.value.kind).toBe(BENEFIT_KIND.OTHER);
  });
  it('sem "como usar" nem código não há segredo', () => {
    expect(validateBenefit({ title: 'Prioridade nas quadras' }).value.has_secret).toBe(false);
  });
  it('limita planos repetidos e vazios', () => {
    expect(validateBenefit({ title: 'Vantagem', plan_ids: ['a', 'a', '', 'b'] }).value.plan_ids).toEqual(['a', 'b']);
  });
});

describe('estado e filtro da vantagem', () => {
  const hoje = '2026-10-25';
  it('no ar, vencida ou pausada', () => {
    expect(benefitState({}, hoje)).toBe('live');
    expect(benefitState({ valid_until: '2026-10-25' }, hoje)).toBe('live');
    expect(benefitState({ valid_until: '2026-10-24' }, hoje)).toBe('expired');
    expect(benefitState({ active: false }, hoje)).toBe('paused');
  });
  it('sem planos escolhidos vale para todos', () => {
    expect(benefitFitsPlan({ plan_ids: [] }, 'x')).toBe(true);
    expect(benefitFitsPlan({}, undefined)).toBe(true);
    expect(benefitFitsPlan({ plan_ids: ['a'] }, 'b')).toBe(false);
    expect(benefitFitsPlan({ plan_ids: ['a'] }, 'a')).toBe(true);
  });
  it('a vitrine só leva as que estão no ar, na ordem', () => {
    const lista = [
      { id: '1', title: 'B', sort: 1 }, { id: '2', title: 'A', sort: 1 }, { id: '3', title: 'Z', sort: 0 },
      { id: '4', title: 'Velha', valid_until: '2020-01-01' }, { id: '5', title: 'Pausada', active: false }, { id: '6', title: 'Outro plano', plan_ids: ['q'] },
    ];
    expect(liveBenefits(lista, { hoje }).map((b) => b.id)).toEqual(['6', '3', '2', '1']);
    expect(liveBenefits(lista, { hoje, planId: 'p' }).map((b) => b.id)).toEqual(['3', '2', '1']);
  });
  it('a linha de apoio junta parceiro, validade e planos', () => {
    expect(benefitMetaLine({ partner: 'Café X', valid_until: '2026-12-31', plan_ids: ['a'] }, { a: 'Efetivo' })).toBe('Café X · até 31/12/2026 · Planos: Efetivo');
    expect(benefitMetaLine({})).toBe('');
  });
});

describe('comunicados', () => {
  const base = { title: 'Assembleia marcada', body: 'Todos os associados estão convidados.', audience: NEWS_AUDIENCE.PUBLIC };
  it('publicado e público é o que a regra deixa qualquer pessoa ler', () => {
    expect(validateClubNews({ ...base, status: NEWS_STATUS.PUBLISHED }).value.public).toBe(true);
    expect(validateClubNews({ ...base, status: NEWS_STATUS.PUBLISHED, audience: NEWS_AUDIENCE.MEMBERS }).value.public).toBe(false);
    expect(validateClubNews({ ...base, status: NEWS_STATUS.DRAFT }).value.public).toBe(false);
  });
  it('o clube não agenda: agendada vira rascunho', () => {
    const r = validateClubNews({ ...base, status: 'scheduled', publish_at: '2030-01-01T10:00' });
    expect(r.ok).toBe(true);
    expect(r.value.status).toBe(NEWS_STATUS.DRAFT);
    expect(r.value).not.toHaveProperty('publish_at_ms');
  });
  it('confere título e texto', () => {
    const r = validateClubNews({ title: 'a', body: 'curto' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['body', 'title']);
  });
  it('só membro do clube lê o "só associados"', () => {
    const lista = [
      { id: 'a', status: 'published', audience: 'public', published_at: '2026-10-01' },
      { id: 'b', status: 'published', audience: 'members', published_at: '2026-10-02' },
      { id: 'c', status: 'draft', audience: 'public' },
    ];
    expect(visibleClubNews(lista).map((n) => n.id)).toEqual(['a']);
    expect(visibleClubNews(lista, { member: true }).map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('patrocinadores', () => {
  it('valida um e leva os erros pelo nome do campo', () => {
    const r = validateSponsor({ name: 'X', url: 'http://sem-https', logo_url: 'ftp://x' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['logo_url', 'name', 'url']);
  });
  it('só sai o ativo e público, por faixa', () => {
    const lista = [
      { name: 'Apoio', tier: 'support' }, { name: 'Oficial', tier: 'main' }, { name: 'Pausado', tier: 'main', active: false },
      { name: 'Interno', tier: 'main', public: false },
    ];
    expect(visibleClubSponsors(lista).map((s) => s.name)).toEqual(['Oficial', 'Apoio']);
  });
  it('mantém o interruptor público/ativo no valor gravado', () => {
    const r = validateSponsor({ name: 'Loja Boa', url: 'https://boa.com', public: false });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ name: 'Loja Boa', public: false, active: true });
  });
});
