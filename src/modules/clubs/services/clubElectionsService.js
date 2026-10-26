/**
 * ELEIÇÕES DO CLUBE-ASSOCIAÇÃO (Bloco F2) — a chamada ao servidor (`clubElections`).
 * Tudo passa por ele: o voto é secreto (a cédula vive em `club_ballots`, sem regra e sem
 * leitura) e as leituras das demais espécies saem de `overview`, já recortadas pelo que a
 * pessoa pode ver (público, comissão, administração). `overview`, `preview`, `create`,
 * `update`, `commission`, `publish`, `cancel`, `candidacy_*`, `endorse`, `challenge`,
 * `defend`, `judge`, `open_voting`, `vote`, `close_voting`, `count`, `record_presential`,
 * `publish_result`, `apply_governance`.
 */
import { chamar } from './associationService.js';

export const clubElectionsAction = (payload) => chamar('clubElections', payload);
