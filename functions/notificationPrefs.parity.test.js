/**
 * PARIDADE cliente × servidor das preferências de notificação.
 *
 * O sino (cliente) esconde o aviso de categoria silenciada; o push (servidor)
 * deixa de enviá-lo. São duas cópias da mesma regra — o pacote de Functions
 * não enxerga `src/` — e duas cópias divergem calado: a pessoa desliga
 * "Treino" e o celular continua tocando. Estes testes rodam as DUAS sobre os
 * mesmos avisos e preferências e exigem o mesmo resultado.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  NOTIFICATION_CATEGORIES, categoryOfType as clienteCategoria, isNotificationMuted as clienteSilenciado,
} from '@/modules/notifications/domain/preferences.js';
import { noticeArea as clienteArea } from '@/modules/notifications/domain/noticeFeed.js';
import { NOTIFICATION_TYPE } from '@/core/services/notificationService.js';

const require = createRequire(import.meta.url);
const servidor = require('./notificationPrefs.js');

const TIPOS_CONHECIDOS = NOTIFICATION_CATEGORIES.flatMap((c) => c.types);
const TIPOS = [
  ...TIPOS_CONHECIDOS,
  ...Object.values(NOTIFICATION_TYPE),
  'generic', 'profile_admin_edit', 'tipo_que_nao_existe', '', undefined, null,
];

// Todas as preferências de UMA categoria desligada, tudo ligado, tudo
// desligado, e as formas tortas que o banco pode ter.
const PREFS = [
  undefined,
  null,
  {},
  'texto',
  ...NOTIFICATION_CATEGORIES.map((c) => ({ [c.id]: false })),
  Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.id, false])),
  Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.id, true])),
  { training: 'false', social: 0, clubs: null },
  { categoria_inventada: false },
];

const LINKS = [
  undefined, null, '', '/', '//evil.com/x', 'https://x.com/treino',
  '/treino', '/treino/item/abc', '/treino?aba=recebidos', '/treino#hoje',
  '/arenas/a1', '/arenas/a1/gerir?aba=membros', '/arenas/a1/aulas', '/arenas/a1/campanhas/c1', '/arenas/a1/open-match',
  '/perfil', '/perfil/torneios', '/dia-de-jogo/x', '/minhas-reservas', '/promocoes', '/c/club',
  '/conquistas', '/configuracoes#pagina-inicial', '/rota-desconhecida',
];

describe('paridade: a categoria e o silêncio', () => {
  it('⭐ as duas cópias têm a MESMA tabela de categorias', () => {
    const cliente = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.id, [...c.types].sort()]));
    const doServidor = Object.fromEntries(Object.entries(servidor.CATEGORY_TYPES).map(([k, v]) => [k, [...v].sort()]));
    expect(doServidor).toEqual(cliente);
  });

  it('⭐ silenciado ou não: o mesmo resultado em todo tipo × toda preferência', () => {
    let casos = 0;
    TIPOS.forEach((tipo) => PREFS.forEach((prefs) => {
      casos += 1;
      expect(servidor.isNotificationMuted(prefs, tipo), `${tipo} × ${JSON.stringify(prefs)}`)
        .toBe(clienteSilenciado(prefs, tipo));
    }));
    expect(casos).toBeGreaterThan(300);
  });

  it('a categoria de cada tipo é a mesma', () => {
    TIPOS.forEach((tipo) => expect(servidor.categoryOfType(tipo), String(tipo)).toBe(clienteCategoria(tipo)));
  });

  it('⭐ os avisos do TREINO obedecem a "Treino" nos dois lados', () => {
    const treino = ['training_share', 'training_review', 'training_comment', 'training_question', 'training_answer'];
    treino.forEach((t) => {
      expect(servidor.isNotificationMuted({ training: false }, t)).toBe(true);
      expect(clienteSilenciado({ training: false }, t)).toBe(true);
      expect(servidor.isNotificationMuted({ social: false }, t)).toBe(false);
    });
  });

  it('aviso genérico nunca é silenciado (não há como a pessoa desligá-lo)', () => {
    PREFS.forEach((prefs) => expect(servidor.isNotificationMuted(prefs, 'generic')).toBe(false));
  });
});

describe('paridade: a área do aviso', () => {
  it('⭐ a mesma área em todo tipo × todo destino', () => {
    TIPOS.forEach((type) => LINKS.forEach((link) => {
      const aviso = { type, link };
      expect(servidor.noticeArea(aviso), `${type} → ${link}`).toBe(clienteArea(aviso));
    }));
    expect(servidor.noticeArea(null)).toBe(clienteArea(null));
  });
});
