/**
 * As notificações da pessoa logada, em tempo real.
 *
 * UMA assinatura por usuário, compartilhada: o sino (no layout, sempre
 * montado), o início e a central de notificações leem a mesma lista. Antes
 * cada componente abria a SUA escuta — com o sino e o início na tela, a mesma
 * lista era lida duas vezes do banco a cada abertura do aplicativo, e a
 * central seria a terceira. Agora a escuta nasce com o primeiro que pede e é
 * encerrada pouco depois de o último sair (a espera evita desligar e religar
 * ao trocar de tela).
 *
 * A consulta é a de sempre — `user_id == uid`, sem `orderBy` (que exigiria
 * índice composto) — e a ordem é feita em memória, por `sortNotices`.
 *
 * Falha não é "nenhuma notificação" (docs/27-FALHA-NAO-E-VAZIO.md): uma
 * assinatura que falhou está encerrada, e `retry` assina de novo.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { isNotificationMuted, mutedNotificationsSummary } from '@/modules/notifications/domain/preferences';
import { sortNotices } from '@/modules/notifications/domain/noticeFeed';

/** Quanto esperar, depois que o último leitor sai, para encerrar a escuta. */
const ESPERA_PARA_DESLIGAR_MS = 2000;

const SEM_USUARIO = Object.freeze({ lista: Object.freeze([]), isLoading: false, isError: false });

/** uid → { estado, ouvintes, parar, desligar } */
const assinaturas = new Map();

function obter(uid) {
  let s = assinaturas.get(uid);
  if (!s) {
    s = {
      uid,
      estado: { lista: [], isLoading: true, isError: false },
      ouvintes: new Set(),
      parar: null,
      desligar: null,
    };
    assinaturas.set(uid, s);
  }
  return s;
}

function emitir(s, estado) {
  s.estado = estado;
  s.ouvintes.forEach((avisar) => avisar());
}

function ligar(s) {
  if (s.parar) return;
  if (!s.estado.isLoading) emitir(s, { lista: s.estado.lista, isLoading: true, isError: false });
  const q = query(collection(db, 'notifications'), where('user_id', '==', s.uid));
  s.parar = onSnapshot(
    q,
    (snap) => {
      emitir(s, {
        lista: sortNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        isLoading: false,
        isError: false,
      });
    },
    (err) => {
      s.parar = null;
      // Ninguém mais lendo (ex.: a pessoa acabou de sair da conta e a escuta
      // ainda esperava para ser encerrada): não é falha de ninguém.
      if (s.ouvintes.size === 0) {
        if (s.desligar) clearTimeout(s.desligar);
        s.desligar = null;
        assinaturas.delete(s.uid);
        return;
      }
      // Falha (ex.: regra de leitura, rede) não pode quebrar a aplicação nem
      // travar em "carregando": a escuta acabou, e a tela oferece tentar de novo.
      logger.error('Falha ao escutar notificações:', err);
      emitir(s, { lista: [], isLoading: false, isError: true });
    },
  );
}

function inscrever(uid, avisar) {
  const s = obter(uid);
  s.ouvintes.add(avisar);
  if (s.desligar) {
    clearTimeout(s.desligar);
    s.desligar = null;
  }
  if (!s.parar && !s.estado.isError) ligar(s);
  return () => {
    s.ouvintes.delete(avisar);
    if (s.ouvintes.size > 0 || s.desligar) return;
    s.desligar = setTimeout(() => {
      s.desligar = null;
      if (s.ouvintes.size > 0) return;
      if (s.parar) s.parar();
      s.parar = null;
      assinaturas.delete(uid);
    }, ESPERA_PARA_DESLIGAR_MS);
  };
}

const marcar = (lida) => ({ read: lida, read_at: lida ? serverTimestamp() : null });

export function useNotifications() {
  const { user, userProfile } = useAuth();
  const uid = user?.uid || null;

  const subscribe = useCallback((avisar) => (uid ? inscrever(uid, avisar) : () => {}), [uid]);
  const getSnapshot = useCallback(() => (uid ? obter(uid).estado : SEM_USUARIO), [uid]);
  const estado = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Imposição das preferências na leitura: esconde as notificações de
  // categorias que o usuário silenciou (do sino, do selo e da central).
  const prefs = userProfile?.notification_prefs;
  const notifications = useMemo(
    () => estado.lista.filter((n) => !isNotificationMuted(prefs, n.type)),
    [estado.lista, prefs],
  );
  const muted = useMemo(() => mutedNotificationsSummary(estado.lista, prefs), [estado.lista, prefs]);

  const markAsRead = useCallback(async (notifId) => {
    await updateDoc(doc(db, 'notifications', notifId), marcar(true));
  }, []);

  // Desfazer: os mesmos campos de sempre (`read`, `read_at`), nada novo.
  const markAsUnread = useCallback(async (notifId) => {
    await updateDoc(doc(db, 'notifications', notifId), marcar(false));
  }, []);

  // Marca as não lidas de uma vez, em lotes (limite do Firestore é 500
  // operações por lote; 450 deixa folga). Sem lista, vale a do sino.
  const markAllAsRead = useCallback(async (lista) => {
    const unread = (lista || notifications).filter((n) => !n.read);
    if (unread.length === 0) return 0;
    for (let i = 0; i < unread.length; i += 450) {
      const batch = writeBatch(db);
      unread.slice(i, i + 450).forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), marcar(true));
      });
      await batch.commit();
    }
    return unread.length;
  }, [notifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const retry = useCallback(() => {
    if (!uid) return;
    const s = obter(uid);
    if (!s.parar) ligar(s);
  }, [uid]);

  return {
    notifications,
    allNotifications: estado.lista,
    muted,
    unreadCount,
    isLoading: estado.isLoading,
    isError: estado.isError,
    retry,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  };
}
