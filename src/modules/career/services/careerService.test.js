/**
 * Serviço da carreira — o que não pode regredir:
 *  - leitura SEMPRE do servidor: sem rede a consulta FALHA, nunca devolve o
 *    cache vazio (docs/27 — a tela afirmaria "sua carreira começa aqui");
 *  - "Mandar ao meu professor" é atômico (torneio + balanço num lote) e avisa
 *    o professor só quando ele PASSA a ver;
 *  - excluir não espera o Storage; a foto tem prazo de envio.
 */
import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { textoDoAviso } from '@/core/i18n/avisos';

const fs = vi.hoisted(() => ({
  getDocsFromServer: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  lote: [],
  notify: vi.fn(async () => 1),
  deleteObject: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/core/config/firebase', () => ({ db: {}, storage: {}, functions: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: (...a) => fs.notify(...a),
  NOTIFICATION_TYPE: { TRAINING_COMMENT: 'training_comment' },
}));
vi.mock('firebase/functions', () => ({ httpsCallable: () => async () => ({ data: {} }) }));
vi.mock('firebase/storage', () => ({
  ref: (s, path) => ({ path }),
  deleteObject: (...a) => fs.deleteObject(...a),
  getDownloadURL: async () => 'https://x/foto',
  listAll: async () => ({ items: [] }),
  uploadBytesResumable: (...a) => fs.upload(...a),
}));
vi.mock('firebase/firestore', () => ({
  collection: (db, col) => ({ col }),
  query: (c) => c,
  where: () => ({}),
  doc: (db, col, id) => ({ col, id }),
  getDoc: (...a) => fs.getDoc(...a),
  // De propósito NÃO há `getDocs`: leitura comum no serviço quebra estes testes.
  getDocsFromServer: (...a) => fs.getDocsFromServer(...a),
  setDoc: (...a) => fs.setDoc(...a),
  deleteDoc: (...a) => fs.deleteDoc(...a),
  deleteField: () => ({ _delete: true }),
  writeBatch: () => ({
    set: (ref, data) => fs.lote.push({ op: 'set', ref, data }),
    update: (ref, data) => fs.lote.push({ op: 'update', ref, data }),
    commit: () => fs.commit(),
  }),
}));

const {
  CAREER_PHOTO_TIMEOUT_MS, CareerError, deleteCareerEvent, listCareerEvents, listCareerRanks,
  listMyCareerPartnerDocs, saveCareerEvent, shareCareerWithCoach, uploadCareerPhoto,
} = await import('./careerService.js');

const semRede = () => Object.assign(new Error('offline'), { code: 'unavailable' });
const negado = () => Object.assign(new Error('negado'), { code: 'permission-denied' });
const evento = (extra = {}) => ({ name: 'Open de Verão', start_date: '2020-03-01', entries: [{ format: 'doubles', gender: 'mixed' }], ...extra });

beforeEach(() => {
  Object.values(fs).forEach((m) => m.mockReset?.());
  fs.lote.length = 0;
  fs.setDoc.mockResolvedValue();
  fs.deleteDoc.mockResolvedValue();
  fs.commit.mockResolvedValue();
  fs.notify.mockResolvedValue(1);
  fs.getDocsFromServer.mockResolvedValue({ docs: [] });
  fs.getDoc.mockResolvedValue({ exists: () => false });
});
afterEach(() => { vi.useRealTimers(); });

describe('leituras — falha não é vazio', () => {
  it('⭐ sem rede, a lista de torneios REJEITA (nunca devolve o cache vazio)', async () => {
    fs.getDocsFromServer.mockRejectedValue(semRede());
    await expect(listCareerEvents('u1')).rejects.toMatchObject({ code: 'unavailable' });
    await expect(listCareerRanks('u1')).rejects.toMatchObject({ code: 'unavailable' });
    await expect(listMyCareerPartnerDocs('u1')).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('com resposta do servidor, devolve os torneios do mais novo ao mais antigo', async () => {
    const d = (id, start_date) => ({ id, data: () => ({ uid: 'u1', name: id, start_date, status: 'played' }) });
    fs.getDocsFromServer.mockResolvedValue({ docs: [d('u1_a', '2019-01-01'), d('u1_b', '2021-01-01')] });
    expect((await listCareerEvents('u1')).map((e) => e.id)).toEqual(['u1_b', 'u1_a']);
  });
});

describe('saveCareerEvent', () => {
  it('registro novo, primeiro envio: não relê (uma ida ao servidor a menos com sinal ruim)', async () => {
    await saveCareerEvent('u1', evento({ id: 'u1_novo' }));
    expect(fs.getDoc).not.toHaveBeenCalled();
    expect(fs.setDoc.mock.calls[0][0].id).toBe('u1_novo');
  });

  it('⭐ reenvio da fila relê antes de gravar; rascunho que nunca chegou (regra recusa a leitura) grava assim mesmo', async () => {
    fs.getDoc.mockRejectedValue(negado());
    await saveCareerEvent('u1', evento({ id: 'u1_novo' }), { resend: true });
    expect(fs.getDoc).toHaveBeenCalledTimes(1);
    expect(fs.setDoc).toHaveBeenCalledTimes(1);
  });

  it('dado inválido: CareerError, nada gravado', async () => {
    await expect(saveCareerEvent('u1', { name: '' })).rejects.toBeInstanceOf(CareerError);
    expect(fs.setDoc).not.toHaveBeenCalled();
  });
});

describe('shareCareerWithCoach — "Mandar ao meu professor"', () => {
  const ev = { id: 'u1_e1', uid: 'u1', name: 'Open de Verão' };
  const actor = { uid: 'u1', name: 'Ana' };

  it('⭐ torneio e balanço vão num lote só', async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true });
    await shareCareerWithCoach(ev, 'prof', { actor });
    expect(fs.lote.map((x) => [x.ref.col, x.data.shared_coach_id])).toEqual([
      ['career_events', 'prof'], ['training_debriefs', 'prof'],
    ]);
    expect(fs.commit).toHaveBeenCalledTimes(1);
  });

  it('⭐ a leitura do balanço falhou: NADA é gravado (o professor não passa a ver só o torneio)', async () => {
    fs.getDoc.mockRejectedValue(semRede());
    await expect(shareCareerWithCoach(ev, 'prof', { actor })).rejects.toMatchObject({ code: 'unavailable' });
    expect(fs.commit).not.toHaveBeenCalled();
    expect(fs.notify).not.toHaveBeenCalled();
  });

  it('balanço que não existe (a regra recusa a leitura): só o torneio', async () => {
    fs.getDoc.mockRejectedValue(negado());
    await shareCareerWithCoach(ev, 'prof', { actor });
    expect(fs.lote).toHaveLength(1);
  });

  it('⭐ o professor é avisado quando PASSA a ver — e o lote falhando não avisa', async () => {
    await shareCareerWithCoach(ev, 'prof', { actor });
    expect(fs.notify.mock.calls[0][0]).toEqual(['prof']);
    const aviso = fs.notify.mock.calls[0][1];
    expect(aviso.type).toBe('training_comment');
    expect(aviso.link).toBe('/treino?aba=alunos');
    expect(textoDoAviso(aviso.title)).toBe('Um aluno mandou um torneio');
    expect(textoDoAviso(aviso.message)).toBe('Ana mandou "Open de Verão" da carreira.');

    fs.notify.mockClear();
    fs.commit.mockRejectedValue(negado());
    await expect(shareCareerWithCoach(ev, 'prof', { actor })).rejects.toBeTruthy();
    expect(fs.notify).not.toHaveBeenCalled();
  });

  it('retirar não avisa, nem mandar de novo ao mesmo professor; aviso que falha não derruba o envio', async () => {
    await shareCareerWithCoach({ ...ev, shared_coach_id: 'prof' }, null, { actor });
    expect(fs.lote[0].data.shared_coach_id).toEqual({ _delete: true });
    await shareCareerWithCoach({ ...ev, shared_coach_id: 'prof' }, 'prof', { actor });
    expect(fs.notify).not.toHaveBeenCalled();
    fs.notify.mockRejectedValue(new Error('x'));
    await expect(shareCareerWithCoach(ev, 'prof', { actor })).resolves.toBeUndefined();
  });
});

describe('deleteCareerEvent', () => {
  it('⭐ não espera o Storage: resolve com o documento apagado e a limpeza disparada', async () => {
    fs.deleteObject.mockReturnValue(new Promise(() => {})); // sinal ruim: nunca responde
    await deleteCareerEvent({ id: 'u1_e1', uid: 'u1', photos: [{ path: 'carreira/u1/a.webp' }] });
    expect(fs.deleteDoc.mock.calls.map((c) => c[0].col)).toEqual(['career_events', 'training_debriefs']);
    expect(fs.deleteObject).toHaveBeenCalledTimes(1);
  });

  it('o documento não apagou: sobe o erro e nada mais é tocado', async () => {
    fs.deleteDoc.mockRejectedValueOnce(semRede());
    await expect(deleteCareerEvent({ id: 'u1_e1', photos: [{ path: 'carreira/u1/a.webp' }] })).rejects.toBeTruthy();
    expect(fs.deleteObject).not.toHaveBeenCalled();
  });
});

describe('uploadCareerPhoto', () => {
  const foto = new File(['x'], 'f.webp', { type: 'image/webp' });

  it('⭐ envio que nunca termina é CANCELADO no prazo (não segura a ficha por 10 min)', async () => {
    vi.useFakeTimers();
    let rejeitar;
    const task = new Promise((_, rej) => { rejeitar = rej; });
    task.cancel = vi.fn(() => rejeitar(Object.assign(new Error('c'), { code: 'storage/canceled' })));
    fs.upload.mockReturnValue(task);
    const p = uploadCareerPhoto('u1', foto);
    const falhou = expect(p).rejects.toBeInstanceOf(CareerError);
    await vi.advanceTimersByTimeAsync(CAREER_PHOTO_TIMEOUT_MS + 10);
    await falhou;
    expect(task.cancel).toHaveBeenCalledTimes(1);
  });

  it('envio que termina devolve caminho e link, dentro da pasta da pessoa', async () => {
    const task = Promise.resolve({ ref: {} });
    task.cancel = vi.fn();
    fs.upload.mockReturnValue(task);
    const r = await uploadCareerPhoto('u1', foto);
    expect(r.url).toBe('https://x/foto');
    expect(r.path).toMatch(/^carreira\/u1\//);
    expect(task.cancel).not.toHaveBeenCalled();
  });
});
