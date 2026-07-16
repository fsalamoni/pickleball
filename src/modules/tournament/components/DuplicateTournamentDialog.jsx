import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Users } from 'lucide-react';
import { useModalities, useRegistrationsByTournament, useDuplicateTournament } from '@/modules/tournament/hooks/useTournament';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { copyableRegistrations, validateDuplicationPlan } from '@/modules/tournament/domain/duplication';

/**
 * Dialog de duplicação de torneio (criador/admin do torneio).
 *
 * Permite duplicar integralmente ou escolher item a item: definições do
 * torneio, cada modalidade e, por modalidade, o conjunto de inscritos.
 */
export default function DuplicateTournamentDialog({ tournament, open, onClose }) {
  const navigate = useNavigate();
  const { data: modalities = [] } = useModalities(tournament.id);
  const { data: registrations = [] } = useRegistrationsByTournament(tournament.id);
  const duplicateMutation = useDuplicateTournament();

  const [name, setName] = useState(`${tournament.name || 'Torneio'} (cópia)`);
  const [copyDefinitions, setCopyDefinitions] = useState(true);
  // { [modalityId]: { selected: boolean, copyRegistrations: boolean } }
  const [selections, setSelections] = useState({});

  // Contagem de inscritos copiáveis (exclui cancelados) por modalidade.
  const copyableCountByModality = useMemo(() => {
    const map = {};
    modalities.forEach((m) => {
      map[m.id] = copyableRegistrations(
        registrations.filter((r) => r.modality_id === m.id),
      ).length;
    });
    return map;
  }, [modalities, registrations]);

  function selectionFor(modalityId) {
    return selections[modalityId] || { selected: false, copyRegistrations: false };
  }

  function setModality(modalityId, patch) {
    setSelections((prev) => ({
      ...prev,
      [modalityId]: { ...selectionFor(modalityId), ...patch },
    }));
  }

  const isFullDuplication = copyDefinitions
    && modalities.length > 0
    && modalities.every((m) => {
      const s = selectionFor(m.id);
      return s.selected && s.copyRegistrations;
    });

  function toggleFull(checked) {
    if (checked) {
      setCopyDefinitions(true);
      const all = {};
      modalities.forEach((m) => { all[m.id] = { selected: true, copyRegistrations: true }; });
      setSelections(all);
    } else {
      setCopyDefinitions(false);
      setSelections({});
    }
  }

  function toggleModality(modalityId, checked) {
    // Ao desmarcar a modalidade, também desmarca "copiar inscritos".
    setModality(modalityId, checked
      ? { selected: true }
      : { selected: false, copyRegistrations: false });
  }

  async function handleSubmit() {
    const modalitySelections = modalities.map((m) => ({ selected: selectionFor(m.id).selected }));
    const error = validateDuplicationPlan({ copyDefinitions, modalitySelections });
    if (error) return toast.error(error);
    if (!name.trim()) return toast.error('Informe o nome do novo torneio.');

    const selectedModalities = modalities
      .filter((m) => selectionFor(m.id).selected)
      .map((m) => ({
        modality: m,
        copyRegistrations: selectionFor(m.id).copyRegistrations,
        registrations: registrations.filter((r) => r.modality_id === m.id),
      }));

    try {
      const result = await duplicateMutation.mutateAsync({
        source: tournament,
        copyDefinitions,
        name: name.trim(),
        modalities: selectedModalities,
      });
      toast.success(
        `Torneio duplicado: ${result.modalityCount} modalidade(s)`
        + `${result.registrationCount ? ` e ${result.registrationCount} inscrito(s)` : ''}.`,
      );
      onClose();
      navigate(`/torneios/${result.tournamentId}/admin`);
    } catch (err) {
      toast.error(err?.message || 'Falha ao duplicar o torneio.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar torneio</DialogTitle>
          <DialogDescription>
            Gera uma cópia como rascunho. O sorteio (grupos, jogos e ranking) nunca é copiado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-acid/40 bg-acid/10 p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ink"
              checked={isFullDuplication}
              onChange={(e) => toggleFull(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold text-ink">Duplicar integralmente</span>
              <span className="block text-xs text-gray-500">Definições, todas as modalidades e todos os inscritos.</span>
            </span>
          </label>

          <div className="space-y-2">
            <Label>Nome do novo torneio</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ink"
              checked={copyDefinitions}
              onChange={(e) => setCopyDefinitions(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-medium text-ink">Copiar definições</span>
              <span className="block text-xs text-gray-500">Descrição, local, regras, datas, acesso e capa.</span>
            </span>
          </label>

          <div>
            <div className="text-sm font-medium text-ink">Modalidades</div>
            {modalities.length === 0 ? (
              <p className="mt-1 text-xs text-gray-500">Este torneio não tem modalidades.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {modalities.map((m) => {
                  const s = selectionFor(m.id);
                  const count = copyableCountByModality[m.id] || 0;
                  return (
                    <div key={m.id} className="rounded-2xl border border-gray-100 p-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-ink"
                          checked={s.selected}
                          onChange={(e) => toggleModality(m.id, e.target.checked)}
                        />
                        <span className="min-w-0 text-sm">
                          <span className="font-medium text-ink">{m.name}</span>
                          <span className="block text-xs text-gray-500">
                            {MODALITY_FORMAT_LABELS[m.format]} · {count} inscrito(s)
                          </span>
                        </span>
                      </label>
                      {s.selected && (
                        <label className={`mt-2 ml-7 flex items-center gap-2 text-xs ${count === 0 ? 'text-gray-400' : 'text-gray-600 cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-ink"
                            checked={s.copyRegistrations && count > 0}
                            disabled={count === 0}
                            onChange={(e) => setModality(m.id, { copyRegistrations: e.target.checked })}
                          />
                          <Users className="h-3.5 w-3.5" />
                          {count === 0 ? 'Sem inscritos para copiar' : `Copiar os ${count} inscrito(s) desta modalidade`}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={duplicateMutation.isPending}>
            <Copy className="w-4 h-4 mr-1" />
            {duplicateMutation.isPending ? 'Duplicando…' : 'Duplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
