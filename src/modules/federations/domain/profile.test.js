import { describe, expect, it } from 'vitest';
import { PROFILE_TAB, profileTabs, resolveProfileTab, tabForAnchor, whatsappLink } from './profile';

const fed = (modules = {}, extra = {}) => ({ id: 'f', status: 'approved', published: true, modules, ...extra });
const ids = (tabs) => tabs.map((x) => x.id);

describe('profileTabs', () => {
  it('sem módulos: só visão geral e contato', () => {
    expect(ids(profileTabs(fed()))).toEqual([PROFILE_TAB.OVERVIEW, PROFILE_TAB.CONTACT]);
  });

  it('cada módulo traz a sua aba, na ordem', () => {
    const tudo = { news: true, calendar: true, tournaments: true, official_docs: true, courses: true, affiliations: true, discipline: true };
    expect(ids(profileTabs(fed(tudo), { member: true }))).toEqual(['inicio', 'minha', 'noticias', 'agenda', 'competicoes', 'documentos', 'cursos', 'clubes', 'contato']);
  });

  it('só o ranking já abre Competições; transparência preenchida abre Documentos', () => {
    expect(ids(profileTabs(fed({ ranking: true })))).toContain(PROFILE_TAB.COMPETITIONS);
    expect(ids(profileTabs(fed({}, { governance: { statute_url: 'https://x.org/estatuto.pdf' } })))).toContain(PROFILE_TAB.DOCUMENTS);
  });

  it('"Minha filiação" só para quem é filiado', () => {
    expect(ids(profileTabs(fed()))).not.toContain(PROFILE_TAB.MINE);
    expect(ids(profileTabs(fed(), { member: true }))).toContain(PROFILE_TAB.MINE);
  });

  it('a ouvidoria entra no nome da aba de contato', () => {
    expect(profileTabs(fed({ discipline: true })).at(-1).label).toBe('Contato e ouvidoria');
  });

  it('sem federação, nenhuma aba', () => {
    expect(profileTabs(null)).toEqual([]);
  });
});

describe('resolveProfileTab', () => {
  const tabs = profileTabs(fed({ news: true, courses: true, discipline: true }));

  it('a aba pedida vence', () => {
    expect(resolveProfileTab(tabs, { aba: 'cursos', hash: '#fed-ouvidoria' })).toBe('cursos');
  });

  it('os links antigos dos avisos abrem a aba da seção', () => {
    expect(resolveProfileTab(tabs, { hash: '#fed-cursos' })).toBe('cursos');
    expect(resolveProfileTab(tabs, { hash: 'fed-ouvidoria' })).toBe('contato');
    expect(resolveProfileTab(tabs, { noticia: 'n1' })).toBe('noticias');
  });

  it('aba que não existe cai na visão geral', () => {
    expect(resolveProfileTab(tabs, { aba: 'competicoes' })).toBe('inicio');
    expect(resolveProfileTab(tabs, { hash: '#fed-ranking' })).toBe('inicio');
    expect(resolveProfileTab(tabs, { aba: 'minha' })).toBe('inicio');
    expect(resolveProfileTab(tabs, {})).toBe('inicio');
  });
});

describe('tabForAnchor', () => {
  it('reconhece as seções e ignora o resto', () => {
    expect(tabForAnchor('#fed-planos')).toBe('inicio');
    expect(tabForAnchor('#fed-ranking')).toBe('competicoes');
    expect(tabForAnchor('#qualquer')).toBe(null);
    expect(tabForAnchor('')).toBe(null);
  });
});

describe('whatsappLink', () => {
  it('celular vira wa.me; fixo, curto e vazio não', () => {
    expect(whatsappLink('(51) 99876-5432')).toBe('https://wa.me/5551998765432');
    expect(whatsappLink('+55 51 99876-5432')).toBe('https://wa.me/5551998765432');
    expect(whatsappLink('(51) 3333-4444')).toBeNull();
    expect(whatsappLink('12345')).toBeNull();
    expect(whatsappLink('')).toBeNull();
  });
});
