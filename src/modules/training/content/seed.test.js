import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SEED_VERSION, SEED_ITEMS } from './seed.js';
import { normalizeItemInput, itemQuality } from '../domain/trainingItem.js';
import { cueWarnings, positioningWarnings } from '../domain/aiTemplate.js';
import { VIEW_BOUNDS } from '../domain/diagram.js';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const inputOf = ({ slug: _s, version: _v, featured: _f, ...input }) => input;
const porTipo = (kind) => SEED_ITEMS.filter((i) => i.kind === kind);

describe('biblioteca inicial (semente)', () => {
  it('tem versão inteira', () => {
    expect(Number.isInteger(SEED_VERSION) && SEED_VERSION >= 1).toBe(true);
  });

  it('slugs únicos, em kebab-case, com versão', () => {
    const slugs = SEED_ITEMS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const it of SEED_ITEMS) {
      expect(it.slug, it.slug).toMatch(SLUG);
      expect(it.slug.length).toBeLessThanOrEqual(80);
      expect(Number.isInteger(it.version) && it.version >= 1, it.slug).toBe(true);
      expect('visibility' in it, it.slug).toBe(false);
    }
  });

  it('todo item é válido e nada é cortado na normalização', () => {
    for (const it of SEED_ITEMS) {
      const input = inputOf(it);
      const { valid, errors, value } = normalizeItemInput(input);
      expect({ slug: it.slug, valid, errors }).toEqual({ slug: it.slug, valid: true, errors: {} });
      for (const k of Object.keys(input)) expect(value[k], `${it.slug}.${k}`).toEqual(input[k]);
    }
  });

  it('qualidade de pelo menos 80% (menos estudo, que mede outra coisa)', () => {
    for (const it of SEED_ITEMS.filter((i) => i.kind !== 'estudo')) {
      const q = itemQuality(normalizeItemInput(inputOf(it)).value);
      expect(q.score / q.total, `${it.slug}: falta ${q.missing.join(', ')}`).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('dicas curtas, de foco externo, e certo ao lado do errado', () => {
    for (const it of SEED_ITEMS) {
      expect(cueWarnings(it.cues || []), it.slug).toEqual([]);
      expect(positioningWarnings(it.positioning || []), it.slug).toEqual([]);
      for (const c of it.cues || []) expect(c.split(/\s+/).length, `${it.slug}: ${c}`).toBeLessThanOrEqual(7);
      const certos = (it.positioning || []).filter((p) => p.type === 'certo').length;
      const errados = (it.positioning || []).filter((p) => p.type === 'errado').length;
      expect(certos >= errados, it.slug).toBe(true);
    }
  });

  it('nenhum link inventado: sem URL fora do campo link, sem mídia', () => {
    for (const it of SEED_ITEMS) {
      const { link, ...resto } = it;
      expect(JSON.stringify(resto), it.slug).not.toMatch(/https?:|www\./i);
      if (link) expect(link, it.slug).toBe('https://usapickleball.org/');
      expect(it.media || [], it.slug).toEqual([]);
    }
  });

  it('diagramas dentro da vista escolhida', () => {
    for (const it of SEED_ITEMS) {
      for (const d of it.diagrams || []) {
        const { y0, y1 } = VIEW_BOUNDS[d.court];
        for (const el of d.elements) {
          for (const y of [el.y, el.y2].filter((v) => v !== undefined)) {
            expect(y >= y0 && y <= y1, `${it.slug} / ${d.title}: y=${y}`).toBe(true);
          }
        }
      }
    }
  });

  it('quantidades por tipo e destaques', () => {
    const n = (k) => porTipo(k).length;
    expect(n('drill')).toBeGreaterThanOrEqual(26);
    expect(n('drill')).toBeLessThanOrEqual(34);
    expect(n('fisico')).toBeGreaterThanOrEqual(12);
    expect(n('fisico')).toBeLessThanOrEqual(18);
    expect(n('jogada')).toBeGreaterThanOrEqual(8);
    expect(n('jogada')).toBeLessThanOrEqual(12);
    expect(n('fundamento')).toBeGreaterThanOrEqual(8);
    expect(n('fundamento')).toBeLessThanOrEqual(12);
    expect(n('treino')).toBeGreaterThanOrEqual(6);
    expect(n('treino')).toBeLessThanOrEqual(10);
    expect(n('estudo')).toBeGreaterThanOrEqual(5);
    expect(n('estudo')).toBeLessThanOrEqual(9);
    expect(SEED_ITEMS.length).toBeGreaterThanOrEqual(70);
    expect(SEED_ITEMS.length).toBeLessThanOrEqual(90);
    const destaques = SEED_ITEMS.filter((i) => i.featured).length;
    expect(destaques).toBeGreaterThanOrEqual(6);
    expect(destaques).toBeLessThanOrEqual(10);
  });

  it('drill: passos, erros com correção, meta e critério', () => {
    for (const it of porTipo('drill')) {
      expect(it.steps.length >= 3 && it.steps.length <= 8, it.slug).toBe(true);
      expect(it.common_errors.length >= 2 && it.common_errors.length <= 4, it.slug).toBe(true);
      for (const e of it.common_errors) expect(e.fix, it.slug).toBeTruthy();
      expect(it.metric?.type && it.success_criteria, it.slug).toBeTruthy();
    }
  });

  it('jogada tem ao menos um diagrama', () => {
    for (const it of porTipo('jogada')) expect(it.diagrams?.length, it.slug).toBeGreaterThan(0);
  });

  it('físico tem séries, repetições, descanso e segurança', () => {
    for (const it of porTipo('fisico')) {
      expect(it.sets && it.reps && it.rest_sec !== undefined && it.safety, it.slug).toBeTruthy();
    }
  });

  it('treino: blocos sem item ligado, do aquecimento à volta à calma, somando a duração', () => {
    for (const it of porTipo('treino')) {
      expect(it.blocks.every((b) => b.item_id === null), it.slug).toBe(true);
      expect(it.blocks[0].type, it.slug).toBe('aquecimento');
      expect(it.blocks.at(-1).type, it.slug).toBe('volta_calma');
      const soma = it.blocks.reduce((s, b) => s + b.duration_min, 0);
      expect(soma, it.slug).toBe(it.duration_min);
      expect(it.duration_min >= 45 && it.duration_min <= 90, it.slug).toBe(true);
    }
  });

  it('estudo de regra cita a edição e não inventa número de seção', () => {
    for (const it of porTipo('estudo')) {
      expect(it.questions?.length, it.slug).toBeGreaterThan(0);
      if (it.study_type === 'regra') {
        expect(it.rules_edition, it.slug).toBeTruthy();
        expect(it.rules_section || '', it.slug).toBe('');
      }
    }
  });

  it('a semente só é importada de forma dinâmica (fora daqui)', () => {
    const src = join(process.cwd(), 'src');
    const proibido = /from\s+['"][^'"]*content\/seed(\.js)?['"]/;
    const achados = [];
    const varrer = (dir) => {
      for (const nome of readdirSync(dir)) {
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) varrer(p);
        else if (/\.jsx?$/.test(nome) && !/\.test\.jsx?$/.test(nome) && proibido.test(readFileSync(p, 'utf8'))) {
          achados.push(relative(src, p));
        }
      }
    };
    varrer(src);
    expect(achados).toEqual([]);
  });
});
