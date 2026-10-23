import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { FUNCOES, criarConta, gravar, ler } from './emulador.js';

/**
 * ⭐ As funções de servidor de verdade, no emulador de funções (`npm run e2e`).
 * Os testes de unidade rodam cada função contra um banco falso; aqui o código
 * carrega como no Google, com o Firestore e as regras de verdade, e o ciclo
 * da filiação passa por três contas: pedir, aprovar, declarar o pagamento
 * (pela regra, como no aplicativo), confirmar e conferir a carteirinha na
 * verificação pública. Do #315 ao #321 as funções ficaram sem publicar e nada
 * avisou: este teste é a parte "o código das funções funciona" dessa vigia (a
 * outra é o cartão "Funções no ar" do painel admin).
 *
 * Não abre tela: roda uma vez só, fora do projeto de celular.
 */
test.skip(({ isMobile }) => isMobile, 'sem tela: uma vez basta');

async function chamar(nome, data, token) {
  const r = await fetch(`${FUNCOES}/${nome}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }),
  });
  const corpo = await r.json();
  if (corpo.error) throw new Error(`${nome}: ${corpo.error.status} ${corpo.error.message}`);
  return corpo.result;
}

async function semear(caminho, dados, opcoes) {
  const r = await gravar(caminho, dados, opcoes);
  expect(r.ok, `semear ${caminho}`).toBe(true);
}

test('@emuladores o emulador carrega todas as funções que o código exporta', async () => {
  const esperadas = [...readFileSync('functions/index.js', 'utf8').matchAll(/^exports\.(\w+)\s*=/gm)].map((m) => m[1]).sort();
  const { backends } = await fetch('http://127.0.0.1:5001/backends').then((r) => r.json());
  const carregadas = backends.flatMap((b) => b.functionTriggers)
    .filter((f) => f.codebase === 'picklerush' && f.region === 'southamerica-east1')
    .map((f) => f.name).sort();
  expect(carregadas).toEqual(esperadas);
});

test('@emuladores filiação de ponta a ponta: pedir, aprovar, pagar, confirmar e verificar', async () => {
  test.setTimeout(90_000); // a primeira chamada acorda o processo das funções
  const [ana, sec, tes] = await Promise.all([criarConta('ana'), criarConta('sec'), criarConta('tes')]);
  const fid = `e2e${Date.now()}`;
  const plano = `${fid}_anual`;
  await semear('platform_settings/global', { feature_flags: { federations: true } }, { campos: ['feature_flags.federations'] });
  await semear(`federations/${fid}`, {
    name: 'Federação de Teste', acronym: 'FTE', slug: fid, status: 'approved', published: true, member_counter: 0, created_by: sec.uid,
  });
  await semear(`federation_staff/${fid}_${sec.uid}`, { federation_id: fid, user_id: sec.uid, role: 'secretary' });
  await semear(`federation_staff/${fid}_${tes.uid}`, { federation_id: fid, user_id: tes.uid, role: 'treasurer' });
  await semear(`federation_plans/${plano}`, {
    federation_id: fid, name: 'Atleta federado', person_type: 'athlete', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 12000, active: true,
  });
  await semear(`users/${ana.uid}`, { full_name: 'Ana de Teste', birth_date: '1990-05-01' });

  // Sem conta, a função recusa.
  await expect(chamar('federationMembership', { federationId: fid, action: 'request', planId: plano })).rejects.toThrow(/UNAUTHENTICATED/);

  const pedido = await chamar('federationMembership', { federationId: fid, action: 'request', planId: plano }, ana.token);
  expect(pedido.memberId).toBe(`${fid}_${ana.uid}`);
  expect((await ler(`federation_members/${pedido.memberId}`)).status).toBe('pending');

  // O financeiro não aprova filiação; a secretaria aprova e nasce a cobrança.
  await expect(chamar('federationMembership', { federationId: fid, action: 'approve', userId: ana.uid }, tes.token)).rejects.toThrow(/PERMISSION_DENIED/);
  const aprovado = await chamar('federationMembership', { federationId: fid, action: 'approve', userId: ana.uid }, sec.token);
  expect(aprovado.chargeId).toBeTruthy();

  // "Já paguei" é escrita da própria pessoa, conferida pela regra; confirmar não.
  const cobranca = `federation_charges/${aprovado.chargeId}`;
  const declarou = await gravar(cobranca, { status: 'declared', declared_at: new Date(), declared_note: 'Pix enviado' }, { token: ana.token });
  expect(declarou.ok, 'a regra deixa o pagador declarar').toBe(true);
  const confirmouSozinha = await gravar(cobranca, { status: 'paid' }, { token: ana.token });
  expect(confirmouSozinha.status, 'a regra não deixa o pagador confirmar').toBe(403);

  await expect(chamar('federationChargeConfirm', { chargeId: aprovado.chargeId, action: 'confirm' }, sec.token)).rejects.toThrow(/PERMISSION_DENIED/);
  await chamar('federationChargeConfirm', { chargeId: aprovado.chargeId, action: 'confirm' }, tes.token);
  const membro = await ler(`federation_members/${pedido.memberId}`);
  expect(membro.status).toBe('active');
  expect(membro.member_number).toMatch(/^FTE-\d{4}-000001$/);

  // Verificação pública, sem login: o mínimo.
  const v = await chamar('federationVerify', { code: membro.card_code });
  expect(v).toMatchObject({ found: true, name: 'Ana de Teste', status: 'active', federation: { acronym: 'FTE' } });
  expect(await chamar('federationVerify', { code: 'NAOEXISTE1' })).toEqual({ found: false });
});
