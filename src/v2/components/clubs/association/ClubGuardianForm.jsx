/**
 * O responsável legal de um associado menor de idade (Bloco E2b): nome, parentesco, telefone, a
 * autorização para participar e o uso de imagem. O mesmo formulário serve ao próprio menor (em
 * "Minha filiação") e à disciplina/secretaria, que registram por ele. Quem grava é o servidor
 * (`clubSafeguarding`, ação `guardian_save`), que confere a idade e apaga o registro aos 18 anos.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useClubSafeguardingAction } from '@/modules/clubs/hooks/useClubSafeguarding';
import { GUARDIAN_LIMITS, GUARDIAN_RELATIONS, GUARDIAN_RELATION_LABELS, validateGuardian } from '@/modules/clubs/domain/safeguarding';
import { V2Button, V2Field, V2Input, V2Select, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function ClubGuardianForm({ clubId, userId = null, initial = null, onDone, onCancel }) {
  const [f, setF] = useState({
    name: initial?.name || '', relation: initial?.relation || '', phone: initial?.phone || '',
    consent: initial ? initial.consent === true : null, image_consent: initial?.image_consent === true, note: initial?.note || '',
  });
  const [erros, setErros] = useState({});
  const m = useClubSafeguardingAction(clubId);
  const set = (patch) => { setF((x) => ({ ...x, ...patch })); setErros({}); };
  const enviar = (e) => {
    e.preventDefault();
    const r = validateGuardian({ ...f, consent: f.consent === null ? undefined : f.consent });
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate({ action: 'guardian_save', ...(userId ? { userId } : {}), guardian: r.value }, {
      onSuccess: () => { toast.success(t('Responsável registrado.')); onDone?.(); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-dica="clube-responsavel-formulario">
      <div className="grid gap-4 sm:grid-cols-2">
        <V2Field label={t('Nome completo do responsável')} htmlFor="gd-nome" error={erros.name} required>
          <V2Input id="gd-nome" autoComplete="off" maxLength={GUARDIAN_LIMITS.NAME_MAX} value={f.name} onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label={t('Quem é')} htmlFor="gd-parentesco" error={erros.relation} required>
          <V2Select id="gd-parentesco" value={f.relation} onChange={(e) => set({ relation: e.target.value })}>
            <option value="">{t('Escolha')}</option>
            {GUARDIAN_RELATIONS.map((r) => <option key={r} value={r}>{t(GUARDIAN_RELATION_LABELS[r])}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label={t('Telefone com DDD')} htmlFor="gd-telefone" error={erros.phone} required hint={t('O clube liga para este número em caso de necessidade.')}>
          <V2Input id="gd-telefone" type="tel" inputMode="tel" autoComplete="off" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
        </V2Field>
      </div>
      <div className="space-y-3">
        <V2Toggle id="gd-autoriza" checked={f.consent === true} onChange={(v) => set({ consent: v })} label={t('O responsável autoriza a participação nas atividades do clube')} />
        {erros.consent && <p className="text-xs text-red-600">{erros.consent}</p>}
        <V2Toggle id="gd-imagem" checked={f.image_consent} onChange={(v) => set({ image_consent: v })} label={t('O responsável autoriza o uso de fotos e vídeos do menor em divulgações do clube')} />
      </div>
      <V2Field label={t('Observações de saúde ou de contato (opcional)')} htmlFor="gd-obs" hint={t('Alergias, medicamentos, outro telefone. Só a disciplina do clube lê.')}>
        <V2Textarea id="gd-obs" rows={2} maxLength={GUARDIAN_LIMITS.NOTE_MAX} value={f.note} onChange={(e) => set({ note: e.target.value })} />
      </V2Field>
      <div className="flex justify-end gap-2">
        {onCancel && <V2Button type="button" variant="ghost" onClick={onCancel}>{t('Voltar')}</V2Button>}
        <V2Button type="submit" disabled={m.isPending}><Save className="h-4 w-4" />{m.isPending ? t('Salvando…') : t('Salvar responsável')}</V2Button>
      </div>
    </form>
  );
}
