/**
 * Campanhas com BANNER (Onda CC) — publicar, editar, pausar e ler.
 *
 * Tudo mora em `arena_campaigns` (campos opcionais: `banner`, `destination`,
 * `show_on_arena`, `show_home`, `banner_until`, `banner_active`) e nos
 * modelos da arena em `arena_settings.banner_templates`. Zero coleção nova e
 * zero regra nova: a arena já escreve as campanhas dela (com a trava de não
 * trocar de arena, Onda BX) e as configurações dela; qualquer conta logada
 * já lê campanhas — o banner é para ser visto.
 *
 * O serviço REFAZ toda a validação do domínio antes de gravar: a tela ajuda,
 * quem grava confere.
 */
import {
  collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { CAMPAIGN_STATUS } from '../domain/marketing.js';
import {
  destinationLink, normalizeBannerPlacement, normalizeCampaignBanner, normalizeDestination,
} from '../domain/campaignBanner.js';
import { ARENA_TEMPLATES_MAX, arenaTemplatesFrom } from '../domain/bannerArt.js';
import { todayISO } from '../domain/subscription.js';
import { getOrCreateArenaSettings } from './v3SettingsService.js';

const COL_CAMPAIGNS = 'arena_campaigns';
const COL_SETTINGS = 'arena_settings';

function str(v) {
  return String(v ?? '').trim();
}

function primeiroErro(errors = {}) {
  return Object.values(errors).find(Boolean) || null;
}

/**
 * O link que vai no AVISO da campanha.
 *
 * 🐞 Os destinos que rolam até uma seção da página da arena
 * (`/arenas/X#arena-reservar`, `#arena-aulas`, `#arena-planos`…) têm `#`, e a
 * regra de `notifications` recusa `#` — o lote inteiro de avisos caía em
 * silêncio e a campanha registrava "enviada" sem ninguém receber. No aviso,
 * esses destinos levam à PÁGINA DA CAMPANHA, que mostra o banner, a mensagem
 * e o botão para o destino certo (o clique no banner segue indo direto).
 */
export function linkDoAviso(link, { arenaId, campaignId } = {}) {
  if (typeof link === 'string' && !link.includes('#')) return link;
  return destinationLink({ type: 'details' }, { arenaId, campaignId });
}

/**
 * Publica uma campanha: banner (na página da arena e/ou na tela inicial) e/ou
 * aviso ao público escolhido. Pelo menos um dos dois — campanha que não
 * aparece em lugar nenhum não é campanha.
 *
 * @param {string} arenaId
 * @param {{
 *   name: string, message?: string, audience?: string, notify?: boolean,
 *   banner?: object|null, destination?: object,
 *   show_on_arena?: boolean, show_home?: boolean, banner_until?: string,
 * }} input
 * @param {string[]} recipients uids (calculados por `campaignRecipients`)
 * @param {object|null} actor
 * @param {{ today?: string }} [ctx]
 * @returns {Promise<{ id: string, sent: number, link: string }>}
 */
export async function publishCampaign(arenaId, input = {}, recipients = [], actor = null, { today = todayISO() } = {}) {
  if (!db || !arenaId) throw new Error('arenaId é obrigatório.');
  const nome = str(input.name).slice(0, 120);
  const mensagem = str(input.message).slice(0, 1000);
  const avisar = input.notify !== false;
  if (!nome) throw new Error('Dê um nome à campanha.');
  if (avisar && !mensagem) throw new Error('Escreva a mensagem do aviso.');

  const banner = normalizeCampaignBanner(input.banner || null);
  if (!banner.valid) throw new Error(primeiroErro(banner.errors) || 'Confira o banner.');
  const destino = normalizeDestination(input.destination || {});
  if (!destino.valid) throw new Error(primeiroErro(destino.errors));
  const lugar = banner.value ? normalizeBannerPlacement(input, { today }) : null;
  if (lugar && !lugar.valid) throw new Error(primeiroErro(lugar.errors));

  const destinatarios = avisar ? [...new Set((recipients || []).filter(Boolean))] : [];
  if (avisar && destinatarios.length === 0) throw new Error('Não há ninguém neste público.');
  if (!avisar && !banner.value) {
    throw new Error('Escolha um banner ou um aviso — a campanha precisa aparecer em algum lugar.');
  }

  const id = doc(collection(db, COL_CAMPAIGNS)).id;
  const link = destinationLink(destino.value, { arenaId, campaignId: id });
  await setDoc(doc(db, COL_CAMPAIGNS, id), {
    id,
    arena_id: arenaId,
    name: nome,
    message: mensagem,
    channel: avisar ? 'in_app' : 'banner',
    target_audience: avisar ? str(input.audience).slice(0, 60) : '',
    status: CAMPAIGN_STATUS.SENT,
    sent_count: destinatarios.length,
    sent_at: serverTimestamp(),
    destination: destino.value,
    ...(banner.value ? {
      banner: banner.value,
      show_on_arena: lugar.value.show_on_arena,
      show_home: lugar.value.show_home,
      banner_until: lugar.value.banner_until,
      banner_active: true,
    } : {}),
    created_by: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  if (avisar) {
    // A entrega não derruba o registro da campanha: se algum aviso falhar, a
    // campanha continua gravada e a arena vê quantos foram.
    try {
      await notifyUsers(destinatarios, {
        title: nome.slice(0, 80),
        message: mensagem,
        type: NOTIFICATION_TYPE.GENERIC,
        link: linkDoAviso(link, { arenaId, campaignId: id }),
        actor,
      });
    } catch (err) {
      logger.info('Falha ao entregar parte da campanha', { err: err?.code });
    }
  }

  await createAuditLog({
    action: 'arena_campaign_sent',
    actor,
    details: {
      arena_id: arenaId,
      campaign_id: id,
      audience: avisar ? input.audience : null,
      count: destinatarios.length,
      banner: banner.value ? banner.value.source : null,
      destination: destino.value.type,
    },
  });
  return { id, sent: destinatarios.length, link };
}

/** Uma campanha pelo id (`null` se não existe). */
export async function getCampaign(campaignId) {
  if (!db || !campaignId) return null;
  const snap = await getDoc(doc(db, COL_CAMPAIGNS, campaignId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Edita o banner de uma campanha já publicada: o desenho/imagem, o destino,
 * onde aparece e até quando — ou só pausa/retoma. O AVISO já enviado não é
 * tocado (não há como "desenviar" uma notificação).
 */
export async function updateCampaignBanner(campaignId, patch = {}, actor = null, { today = todayISO() } = {}) {
  if (!db || !campaignId) throw new Error('Campanha inválida.');
  const atual = await getCampaign(campaignId);
  if (!atual) throw new Error('Campanha não encontrada.');

  const mudancas = {};
  if ('banner' in patch) {
    const banner = normalizeCampaignBanner(patch.banner || null);
    if (!banner.valid) throw new Error(primeiroErro(banner.errors) || 'Confira o banner.');
    mudancas.banner = banner.value;
  }
  if ('destination' in patch) {
    const destino = normalizeDestination(patch.destination || {});
    if (!destino.valid) throw new Error(primeiroErro(destino.errors));
    mudancas.destination = destino.value;
  }
  const mexeNoLugar = ['show_on_arena', 'show_home', 'banner_until'].some((k) => k in patch);
  if (mexeNoLugar) {
    const lugar = normalizeBannerPlacement({
      show_on_arena: 'show_on_arena' in patch ? patch.show_on_arena : atual.show_on_arena,
      show_home: 'show_home' in patch ? patch.show_home : atual.show_home,
      banner_until: 'banner_until' in patch ? patch.banner_until : atual.banner_until,
    }, { today });
    if (!lugar.valid) throw new Error(primeiroErro(lugar.errors));
    Object.assign(mudancas, lugar.value);
  }
  if ('banner_active' in patch) mudancas.banner_active = patch.banner_active !== false;
  if (Object.keys(mudancas).length === 0) return atual;

  // Banner novo numa campanha que só tinha aviso: nasce no ar, na página da arena.
  const ganhouBanner = mudancas.banner && !atual.banner;
  if (ganhouBanner) {
    if (!('banner_active' in mudancas)) mudancas.banner_active = true;
    if (!mexeNoLugar) {
      Object.assign(mudancas, normalizeBannerPlacement({}, { today }).value);
    }
  }

  await updateDoc(doc(db, COL_CAMPAIGNS, campaignId), { ...mudancas, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_campaign_banner_updated',
    actor,
    details: { arena_id: atual.arena_id, campaign_id: campaignId, fields: Object.keys(mudancas) },
  });
  return { ...atual, ...mudancas };
}

/**
 * As campanhas com banner na página da arena. Duas igualdades (`arena_id` e
 * `show_on_arena`), sem índice composto; o "no ar" (ativo, dentro da data) é
 * conferido no domínio.
 */
export async function listArenaCampaignBanners(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(
    collection(db, COL_CAMPAIGNS),
    where('arena_id', '==', arenaId),
    where('show_on_arena', '==', true),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * As campanhas com banner na tela inicial, de todas as arenas. Igualdades só
 * (`show_home` e `banner_active`): `banner_active` entra para o banner
 * pausado não ocupar as vagas do `limit`.
 */
export async function listHomeCampaignBanners({ lim = 60 } = {}) {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, COL_CAMPAIGNS),
    where('show_home', '==', true),
    where('banner_active', '==', true),
    limit(lim),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ------------------------------------------------------------------ */
/*  Os modelos da arena                                               */
/* ------------------------------------------------------------------ */

/**
 * Os modelos de banner da arena (`arena_settings.banner_templates`). Só a
 * arena lê `arena_settings` — os modelos são ferramenta dela, não conteúdo.
 */
export async function getArenaBannerTemplates(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDoc(doc(db, COL_SETTINGS, arenaId));
  return snap.exists() ? arenaTemplatesFrom(snap.data()) : [];
}

/**
 * Grava a lista de modelos da arena (já montada por `saveArenaTemplate` /
 * `removeArenaTemplate`). A lista é conferida de novo aqui.
 */
export async function saveArenaBannerTemplates(arenaId, lista = [], actor = null) {
  if (!db || !arenaId) throw new Error('arenaId é obrigatório.');
  const limpa = arenaTemplatesFrom({ banner_templates: lista }).slice(0, ARENA_TEMPLATES_MAX).map((t) => ({
    id: t.id,
    name: str(t.name).slice(0, 40),
    design: t.design,
    created_at_ms: Number(t.created_at_ms) || Date.now(),
    updated_at_ms: Number(t.updated_at_ms) || Date.now(),
  }));
  // O documento de configurações pode não existir ainda: nasce com os padrões.
  await getOrCreateArenaSettings(arenaId);
  await updateDoc(doc(db, COL_SETTINGS, arenaId), { banner_templates: limpa, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_banner_templates_saved', actor, details: { arena_id: arenaId, count: limpa.length },
  });
  return limpa;
}
