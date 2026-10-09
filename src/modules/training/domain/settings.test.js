import { describe, it, expect } from 'vitest';
import { DEFAULT_TRAINING_SETTINGS, normalizeTrainingSettings, settingsPatch } from './settings.js';

describe('normalizeTrainingSettings', () => {
  it('documento ausente ⇒ todos os padrões', () => {
    const s = normalizeTrainingSettings(null);
    expect(s).toMatchObject(DEFAULT_TRAINING_SETTINGS);
    expect(s.seed_installed_version).toBeNull();
    expect(normalizeTrainingSettings('lixo')).toMatchObject(DEFAULT_TRAINING_SETTINGS);
  });

  it('padrões batem com os da regra: atleta e professor revisados', () => {
    expect(DEFAULT_TRAINING_SETTINGS.public_review_atleta).toBe(true);
    expect(DEFAULT_TRAINING_SETTINGS.public_review_professor).toBe(true);
  });

  it('professores verificados: só textos, e fora do que o "Salvar" grava', () => {
    expect(normalizeTrainingSettings(null).verified_professors).toEqual([]);
    expect(normalizeTrainingSettings({ verified_professors: ['a', 3, null, 'b'] }).verified_professors).toEqual(['a', 'b']);
    expect(normalizeTrainingSettings({ verified_professors: 'a' }).verified_professors).toEqual([]);
    expect(settingsPatch({ verified_professors: ['a'] })).not.toHaveProperty('verified_professors');
  });

  it('booleano só se for booleano', () => {
    const s = normalizeTrainingSettings({ allow_uploads: 'false', allow_sharing: false });
    expect(s.allow_uploads).toBe(true);
    expect(s.allow_sharing).toBe(false);
  });

  it('números presos às faixas', () => {
    const s = normalizeTrainingSettings({
      max_image_mb: 10, max_video_mb: 1, max_video_seconds: 999, max_uploads_per_user: -3, max_pending_per_user: 100,
    });
    expect(s).toMatchObject({
      max_image_mb: 3, max_video_mb: 5, max_video_seconds: 120, max_uploads_per_user: 0, max_pending_per_user: 50,
    });
    expect(normalizeTrainingSettings({ max_pending_per_user: 0 }).max_pending_per_user).toBe(1);
    expect(normalizeTrainingSettings({ max_image_mb: '1.5' }).max_image_mb).toBe(1.5);
  });

  it('campo apagado (null ou "") vale o padrão, não o mínimo', () => {
    const s = normalizeTrainingSettings({ max_image_mb: null, max_uploads_per_user: '', max_video_seconds: 'abc' });
    expect(s.max_image_mb).toBe(3);
    expect(s.max_uploads_per_user).toBe(40);
    expect(s.max_video_seconds).toBe(60);
  });
});

describe('settingsPatch', () => {
  it('só as chaves que o admin edita, normalizadas', () => {
    const p = settingsPatch({ max_image_mb: 9, seed_installed_version: 3, updated_by: 'x', estranho: 1 });
    expect(Object.keys(p).sort()).toEqual(Object.keys(DEFAULT_TRAINING_SETTINGS).sort());
    expect(p.max_image_mb).toBe(3);
  });
});
