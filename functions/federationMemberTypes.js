/**
 * Cópia, no servidor, da resolução do TIPO de filiação
 * (`src/modules/federations/domain/memberTypes.js`). O pedido de filiação
 * confere pelo catálogo da plataforma (`platform_settings/federations`) se o
 * plano é de pessoa, de clube ou de arena — o navegador não decide isso.
 * Paridade em `federationMemberTypes.parity.test.js`.
 */
'use strict';

const ENTITIES = ['person', 'club', 'arena'];
const PERSON_CATEGORIES = ['athlete', 'coach', 'referee', 'none'];
const ID_RE = /^[a-z][a-z0-9_]{1,23}$/;
const BUILTIN = {
  athlete: { label: 'Atleta', entity: 'person', category: 'athlete' },
  coach: { label: 'Professor(a)', entity: 'person', category: 'coach' },
  referee: { label: 'Árbitro(a)', entity: 'person', category: 'referee' },
  club: { label: 'Clube', entity: 'club', category: 'club' },
  arena: { label: 'Arena', entity: 'arena', category: 'arena' },
};
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function categoryFor(entity, category) {
  if (entity === 'club' || entity === 'arena') return entity;
  return PERSON_CATEGORIES.includes(category) ? category : 'none';
}

/**
 * O tipo de um plano: `{ id, label, entity, category, active }`. Vale o
 * catálogo; o tipo que saiu dele usa o que o plano gravou; id pronto sem
 * catálogo vira o pronto.
 */
function resolveMemberType(settings, plan) {
  const id = (plan && plan.person_type) || 'athlete';
  const gravados = settings && Array.isArray(settings.member_types) ? settings.member_types : [];
  const g = gravados.find((x) => x && x.id === id && ID_RE.test(String(x.id)));
  const pronto = BUILTIN[id];
  if (pronto) {
    return { id, label: (g && texto(g.label, 40)) || pronto.label, entity: pronto.entity, category: pronto.category, active: !g || g.active !== false };
  }
  if (g) {
    const entity = ENTITIES.includes(g.entity) ? g.entity : 'person';
    return { id, label: texto(g.label, 40) || id, entity, category: categoryFor(entity, g.category), active: g.active !== false };
  }
  const entity = ENTITIES.includes(plan && plan.entity) ? plan.entity : 'person';
  return { id, label: texto(plan && plan.person_type_label, 40) || id, entity, category: categoryFor(entity, plan && plan.person_category), active: false };
}

module.exports = { resolveMemberType, categoryFor, BUILTIN, ENTITIES, PERSON_CATEGORIES };
