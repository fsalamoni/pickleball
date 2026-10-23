/**
 * EQUIPAMENTOS HOMOLOGADOS (Central → Jogo limpo → Equipamentos): a equipe de
 * competições e o admin cadastram raquetes, bolas e redes e mudam a situação
 * (homologado, reprovado, descertificado) com data e motivo. Toda escrita é
 * do servidor (`federationIntegrity`); apagar só o admin — o caminho normal
 * de tirar um modelo de circulação é descertificar, que fica na lista pública.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isoDate } from '@/modules/federations/domain/membership';
import { nationalBodyOf } from '@/modules/federations/domain/national';
import {
  EQUIPMENT_KINDS, EQUIPMENT_KIND_LABELS, EQUIPMENT_STATUS, EQUIPMENT_STATUS_LABELS, equipmentCounts, equipmentList, searchEquipment, statusNeedsReason, validateEquipment, validateStatusChange,
} from '@/modules/federations/domain/integrity';
import { useEquipment, useIntegrityAction } from '@/modules/federations/hooks/useIntegrity';
import { V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { EquipmentFilters, EquipmentRow } from './IntegrityPublic';

const ok = (msg, depois) => ({ onSuccess: () => { toast.success(msg); depois?.(); }, onError: (e) => toast.error(e.message) });
const opcoesSituacao = (atual) => Object.values(EQUIPMENT_STATUS).filter((s) => s !== atual).map((s) => ({ value: s, label: t(EQUIPMENT_STATUS_LABELS[s]) }));

function EquipmentEditor({ federation, item, onClose }) {
  const hoje = isoDate();
  const [f, setF] = useState(() => ({
    kind: item?.kind || 'paddle', brand: item?.brand || '', model: item?.model || '', reference: item?.reference || '', source: item?.source || '', notes: item?.notes || '',
    status: 'approved', date: hoje, reason: '',
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const m = useIntegrityAction(federation.id);
  const r = validateEquipment(f);
  const s = item ? { ok: true, errors: {} } : validateStatusChange(null, f, hoje);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? t('Editar equipamento') : t('Cadastrar equipamento')}</DialogTitle>
          <DialogDescription>{item ? t('A situação muda em "Mudar situação", com data e motivo.') : t('Aparece na lista pública da federação na hora.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
            <V2Field label={t('Tipo')} htmlFor="eq-tipo"><V2Select id="eq-tipo" value={f.kind} onChange={set('kind')} options={EQUIPMENT_KINDS.map((k) => ({ value: k, label: t(EQUIPMENT_KIND_LABELS[k]) }))} /></V2Field>
            <V2Field label={t('Marca')} htmlFor="eq-marca" error={r.errors.brand}><V2Input id="eq-marca" value={f.brand} maxLength={60} onChange={set('brand')} /></V2Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Modelo')} htmlFor="eq-modelo" error={r.errors.model}><V2Input id="eq-modelo" value={f.model} maxLength={80} onChange={set('model')} /></V2Field>
            <V2Field label={t('Referência do fabricante (opcional)')} htmlFor="eq-ref"><V2Input id="eq-ref" value={f.reference} maxLength={60} onChange={set('reference')} /></V2Field>
          </div>
          <V2Field label={t('Ensaio ou certificação de origem (opcional)')} htmlFor="eq-fonte" hint={t('Ex.: USA Pickleball, laboratório, ensaio próprio.')}><V2Input id="eq-fonte" value={f.source} maxLength={120} onChange={set('source')} /></V2Field>
          <V2Field label={t('Observações internas (opcional)')} htmlFor="eq-obs"><V2Textarea id="eq-obs" rows={2} maxLength={500} value={f.notes} onChange={set('notes')} /></V2Field>
          {!item && (
            <div className="grid gap-3 sm:grid-cols-2">
              <V2Field label={t('Situação')} htmlFor="eq-sit"><V2Select id="eq-sit" value={f.status} onChange={set('status')} options={Object.values(EQUIPMENT_STATUS).filter((x) => x !== 'decertified').map((x) => ({ value: x, label: t(EQUIPMENT_STATUS_LABELS[x]) }))} /></V2Field>
              <V2Field label={t('Desde')} htmlFor="eq-data" error={s.errors.date}><V2Input id="eq-data" type="date" max={hoje} value={f.date} onChange={set('date')} /></V2Field>
            </div>
          )}
          {!item && statusNeedsReason(null, f.status) && (
            <V2Field label={t('Motivo da reprovação')} htmlFor="eq-motivo" error={s.errors.reason} hint={t('Aparece na lista pública.')}><V2Input id="eq-motivo" value={f.reason} maxLength={300} onChange={set('reason')} /></V2Field>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || !s.ok || m.isPending} onClick={() => m.mutate({ action: 'equipment_save', equipmentId: item?.id, item: f }, ok(t('Equipamento salvo.'), onClose))}>{t('Salvar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ federation, item, onClose }) {
  const hoje = isoDate();
  const [f, setF] = useState(() => ({ status: opcoesSituacao(item.status)[0].value, date: hoje, reason: '' }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const m = useIntegrityAction(federation.id);
  const r = validateStatusChange(item, f, hoje);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Mudar a situação de {item}', { item: `${item.brand} ${item.model}` })}</DialogTitle>
          <DialogDescription>{t('Hoje: {situacao}. A mudança fica no histórico e a lista pública mostra a data.', { situacao: t(EQUIPMENT_STATUS_LABELS[item.status] || item.status) })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Nova situação')} htmlFor="eqs-sit" error={r.errors.status}><V2Select id="eqs-sit" value={f.status} onChange={set('status')} options={opcoesSituacao(item.status)} /></V2Field>
            <V2Field label={t('A partir de')} htmlFor="eqs-data" error={r.errors.date}><V2Input id="eqs-data" type="date" max={hoje} value={f.date} onChange={set('date')} /></V2Field>
          </div>
          {statusNeedsReason(item.status, f.status) && (
            <V2Field label={t('Motivo')} htmlFor="eqs-motivo" error={r.errors.reason} hint={t('Aparece na lista pública.')}><V2Input id="eqs-motivo" value={f.reason} maxLength={300} onChange={set('reason')} /></V2Field>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <V2Button type="button" variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
          <V2Button type="button" disabled={!r.ok || m.isPending} onClick={() => m.mutate({ action: 'equipment_status', equipmentId: item.id, ...f }, ok(t('Situação atualizada.'), onClose))}>{t('Confirmar')}</V2Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EquipmentManager({ federation, admin = false }) {
  const q = useEquipment(federation.id);
  const m = useIntegrityAction(federation.id);
  const [filtro, setFiltro] = useState({ query: '', kind: '', status: '' });
  const [editando, setEditando] = useState(null);
  const [mudando, setMudando] = useState(null);
  const [apagando, setApagando] = useState(null);
  const todos = useMemo(() => equipmentList(q.data || []), [q.data]);
  const achados = useMemo(() => searchEquipment(todos, filtro), [todos, filtro]);
  const nb = nationalBodyOf(federation);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm text-gray-600">
          {t('A lista pública de equipamentos que valem nos torneios chancelados. Para tirar um modelo de circulação, descertifique: ele continua na lista com a data.')}
          {nb ? ` ${t('A lista da {conf} aparece junto na sua página.', { conf: nb.acronym || nb.name })}` : ''}
        </p>
        {q.isSuccess && <V2Button type="button" onClick={() => setEditando({})}><Plus className="h-4 w-4" />{t('Cadastrar equipamento')}</V2Button>}
      </div>
      {q.isError && <V2ErrorState title={t('Não carregou a lista de equipamentos')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={4} />}
      {q.isSuccess && todos.length === 0 && <V2EmptyState title={t('Nenhum equipamento na lista')} description={t('Cadastre as raquetes, bolas e redes que a federação homologou.')} />}
      {q.isSuccess && todos.length > 0 && (
        <>
          <EquipmentFilters value={filtro} onChange={setFiltro} counts={equipmentCounts(todos)} idPrefix="ger-equip" />
          {achados.length === 0 && <p className="text-sm text-gray-500">{t('Nada encontrado com essa busca.')}</p>}
          <ul className="grid gap-2 lg:grid-cols-2">
            {achados.map((x) => (
              <li key={x.id}>
                <EquipmentRow item={x}>
                  <div className="flex flex-wrap justify-end gap-1">
                    <V2Button type="button" size="sm" variant="ghost" aria-label={t('Editar')} onClick={() => setEditando(x)}><Pencil className="h-4 w-4" /></V2Button>
                    <V2Button type="button" size="sm" variant="secondary" onClick={() => setMudando(x)}><RefreshCw className="h-4 w-4" />{t('Mudar situação')}</V2Button>
                    {admin && <V2Button type="button" size="sm" variant="ghost" aria-label={t('Apagar')} onClick={() => setApagando(x)}><Trash2 className="h-4 w-4" /></V2Button>}
                  </div>
                </EquipmentRow>
              </li>
            ))}
          </ul>
        </>
      )}
      {editando && <EquipmentEditor federation={federation} item={editando.id ? editando : null} onClose={() => setEditando(null)} />}
      {mudando && <StatusDialog federation={federation} item={mudando} onClose={() => setMudando(null)} />}
      <ConfirmDialog
        open={Boolean(apagando)}
        onOpenChange={(o) => { if (!o) setApagando(null); }}
        loading={m.isPending}
        title={t('Apagar {item} da lista?', { item: apagando ? `${apagando.brand} ${apagando.model}` : '' })}
        description={t('Some da lista pública sem deixar registro. Se o modelo deixou de valer, descertifique em vez de apagar. Não dá para desfazer.')}
        confirmLabel={t('Apagar')}
        onConfirm={() => m.mutate({ action: 'equipment_delete', equipmentId: apagando.id }, ok(t('Equipamento apagado.'), () => setApagando(null)))}
      />
    </div>
  );
}
