import { describe, expect, it } from 'vitest';
import { POSES } from './catalog.js';
import { MOTIONS, POSE_JOINTS, POSE_MOTION, poseAt, poseJoints } from './poses.js';

describe('poses do avatar', () => {
  it('toda pose do catálogo tem juntas e um movimento ao toque', () => {
    for (const { id } of POSES) {
      expect(POSE_JOINTS[id], id).toBeTruthy();
      expect(MOTIONS[POSE_MOTION[id]], id).toBeTruthy();
    }
  });

  it('todas as poses têm as mesmas juntas, com números finitos', () => {
    const chaves = Object.keys(POSE_JOINTS.ready).sort();
    for (const [id, pose] of Object.entries(POSE_JOINTS)) {
      expect(Object.keys(pose).sort(), id).toEqual(chaves);
      for (const [k, v] of Object.entries(pose)) {
        if (k !== 'ball') expect(Number.isFinite(v), `${id}.${k}`).toBe(true);
      }
    }
  });

  it('pose desconhecida cai na posição de espera', () => {
    expect(poseJoints('voando')).toBe(POSE_JOINTS.ready);
  });
});

describe('movimentos', () => {
  it('os quadros andam de 0 a 1, em ordem', () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      expect(m.duration, id).toBeGreaterThan(300);
      expect(POSE_JOINTS[m.from], id).toBeTruthy();
      expect(m.frames[0].at, id).toBe(0);
      expect(m.frames[m.frames.length - 1].at, id).toBe(1);
      for (let i = 1; i < m.frames.length; i += 1) expect(m.frames[i].at, `${id}[${i}]`).toBeGreaterThan(m.frames[i - 1].at);
    }
  });

  it('começa e termina na pose de partida', () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      const inicio = poseJoints(m.from);
      for (const p of [0, 1, -3, 7]) {
        const pose = poseAt(id, p);
        for (const k of Object.keys(inicio)) {
          if (k === 'ball') expect(pose.ball, `${id} ${p}`).toBe(inicio.ball);
          else expect(pose[k], `${id} ${p} ${k}`).toBeCloseTo(inicio[k], 6);
        }
      }
    }
  });

  it('nunca devolve número quebrado no meio do caminho', () => {
    for (const id of Object.keys(MOTIONS)) {
      for (let p = 0; p <= 1; p += 0.05) {
        for (const [k, v] of Object.entries(poseAt(id, p))) {
          if (k !== 'ball') expect(Number.isFinite(v), `${id} ${p} ${k}`).toBe(true);
        }
      }
    }
  });

  // 🐞 Quadro que só dizia `ball: false` herdava a pose de partida: o braço voltava de um salto no meio do saque.
  it('no saque o braço não volta de um salto entre o contato e a terminação', () => {
    let antes = poseAt('serve', 0.5).rF;
    for (let p = 0.52; p <= 0.9; p += 0.02) {
      const agora = poseAt('serve', p).rF;
      expect(agora, `p=${p.toFixed(2)}`).toBeGreaterThanOrEqual(antes - 0.001);
      antes = agora;
    }
  });

  it('no saque a bola sai da mão no contato e volta no fim', () => {
    expect(poseAt('serve', 0.1).ball).toBe(true);
    expect(poseAt('serve', 0.7).ball).toBe(false);
    expect(poseAt('serve', 1).ball).toBe(true);
  });

  it('o golpe parte da pose em que a pessoa está, não da de espera', () => {
    expect(poseAt('swing', 0, 'shoulder').rA).toBe(POSE_JOINTS.shoulder.rA);
    expect(poseAt('swing', 1, 'shoulder').rA).toBeCloseTo(POSE_JOINTS.shoulder.rA, 6);
  });

  it('movimento desconhecido devolve a pose parada', () => {
    expect(poseAt('mortal', 0.5, 'wave')).toBe(POSE_JOINTS.wave);
  });
});
