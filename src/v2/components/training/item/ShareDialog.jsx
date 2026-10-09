/**
 * Enviar / indicar um item.
 *  - Qualquer pessoa INDICA a outros atletas (busca pelo nome).
 *  - O professor também ENVIA aos seus alunos ATIVOS, com prazo e recado — a
 *    regra confere o vínculo, então a lista só oferece quem está ativo.
 *
 * Sem a lista de alunos na mão (carregando ou falhou), não há botão de enviar
 * para alunos: mandar "para todos" sobre uma lista que não carregou mandaria
 * para ninguém sem dizer.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Send, X } from 'lucide-react';
import { useShareTrainingItem } from '@/modules/training/hooks/useTrainingShares';
import { useCoachStudents } from '@/modules/coaches/hooks/useStudents';
import {
  MAX_RECIPIENTS, SHARE_KIND, SHARE_NOTE_MAX, canShareItem, needsSharedAccess,
} from '@/modules/training/domain/share';
import { todayLocal } from '@/modules/training/domain/dates';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  V2Button, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Skeleton, V2Textarea,
} from '@/v2/ui/primitives';
import { AthletePicker } from '@/v2/components/arenas/marketing/coupons/VoucherReception';
import { shareResultText } from './contentView';

const nomeAtleta = (a) => a?.platform_name || a?.full_name || 'Atleta';

function erroDe(err) {
  return err?.name === 'TrainingItemError' && err.message ? err.message : 'Não foi possível enviar agora. Tente de novo.';
}

export default function ShareDialog({ open, onOpenChange, item, identity, settings }) {
  const professor = !!identity?.isCoach;
  // Escolha da pessoa; sem escolha, o padrão segue o papel (que pode chegar depois).
  const [escolhido, setModo] = useState(null);
  const modo = escolhido || (professor ? SHARE_KIND.ALUNO : SHARE_KIND.INDICACAO);
  const [alunos, setAlunos] = useState(() => new Set());
  const [pessoas, setPessoas] = useState([]);
  const [prazo, setPrazo] = useState('');
  const [recado, setRecado] = useState('');
  const [resultado, setResultado] = useState('');
  const [erro, setErro] = useState('');
  const enviar = useShareTrainingItem(identity, settings);
  const roster = useCoachStudents(open && professor ? identity.uid : null);

  const ativos = useMemo(
    () => (roster.data || []).filter((s) => s.status === 'active' && s.student_id && s.student_id !== identity?.uid),
    [roster.data, identity?.uid],
  );
  const paraAlunos = modo === SHARE_KIND.ALUNO;
  const pode = canShareItem(item || {}, { uid: identity?.uid });
  const pausado = settings?.allow_sharing === false;
  const destinos = paraAlunos ? [...alunos] : pessoas.map((p) => p.id);
  const cheio = destinos.length >= MAX_RECIPIENTS;

  const limpar = () => {
    setAlunos(new Set()); setPessoas([]); setPrazo(''); setRecado(''); setErro('');
  };
  const trocarModo = (m) => { setModo(m); setResultado(''); setErro(''); };

  const alternarAluno = (uid) => setAlunos((atual) => {
    const novo = new Set(atual);
    if (novo.has(uid)) novo.delete(uid);
    else if (novo.size < MAX_RECIPIENTS) novo.add(uid);
    return novo;
  });
  const todos = ativos.length > 0 && ativos.slice(0, MAX_RECIPIENTS).every((s) => alunos.has(s.student_id));
  const alternarTodos = () => setAlunos(todos ? new Set() : new Set(ativos.slice(0, MAX_RECIPIENTS).map((s) => s.student_id)));

  const adicionarPessoa = (a) => {
    if (!a?.id || a.id === identity?.uid) return;
    setPessoas((atual) => (atual.some((p) => p.id === a.id) || atual.length >= MAX_RECIPIENTS ? atual : [...atual, a]));
  };

  const confirmar = () => {
    setErro(''); setResultado('');
    enviar.mutate({
      item,
      toUids: destinos,
      kind: modo,
      note: recado,
      dueDate: paraAlunos ? prazo || null : null,
      activeStudentIds: ativos.map((s) => s.student_id),
    }, {
      onSuccess: (r) => {
        const texto = shareResultText(r, { kind: modo });
        setResultado(texto);
        if (r.sent > 0) { toast.success(texto); limpar(); } else toast(texto);
      },
      onError: (err) => setErro(erroDe(err)),
    });
  };

  const fechar = (aberto) => {
    if (!aberto) { limpar(); setResultado(''); }
    onOpenChange(aberto);
  };

  let corpo;
  if (pausado) {
    corpo = <p className="text-sm text-gray-600">O compartilhamento de treinos está pausado pela equipe no momento.</p>;
  } else if (!pode.ok) {
    corpo = <p className="text-sm text-gray-600">{pode.reason}</p>;
  } else {
    corpo = (
      <div className="space-y-5">
        {professor && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Para quem">
            <V2FilterChip active={paraAlunos} aria-pressed={paraAlunos} onClick={() => trocarModo(SHARE_KIND.ALUNO)}>Para meus alunos</V2FilterChip>
            <V2FilterChip active={!paraAlunos} aria-pressed={!paraAlunos} onClick={() => trocarModo(SHARE_KIND.INDICACAO)}>Indicar a alguém</V2FilterChip>
          </div>
        )}

        {paraAlunos ? (
          <div className="space-y-3">
            {roster.isPending && <V2Skeleton lines={3} />}
            {roster.isError && (
              <V2ErrorState inline title="Não foi possível carregar seus alunos" onRetry={() => roster.refetch()} />
            )}
            {roster.isSuccess && ativos.length === 0 && (
              <p className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
                Você não tem alunos ativos agora. Quem está convidado ou pausado não recebe — use “Indicar a alguém”.
              </p>
            )}
            {roster.isSuccess && ativos.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-ink">Alunos ativos</legend>
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 text-sm font-semibold text-ink">
                  <input type="checkbox" checked={todos} onChange={alternarTodos} className="h-4 w-4" />
                  Todos os alunos ativos ({ativos.length})
                </label>
                <ul className="max-h-60 space-y-1 overflow-y-auto">
                  {ativos.map((s) => {
                    const marcado = alunos.has(s.student_id);
                    return (
                      <li key={s.student_id}>
                        <label className="flex items-center gap-3 rounded-2xl p-2 text-sm text-ink hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={!marcado && cheio}
                            onChange={() => alternarAluno(s.student_id)}
                            className="h-4 w-4"
                          />
                          <span className="min-w-0 truncate">{s.student_name || 'Aluno'}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {ativos.length > MAX_RECIPIENTS && (
                  <p className="text-xs text-gray-500">Até {MAX_RECIPIENTS} por envio. Mande de novo para os outros.</p>
                )}
              </fieldset>
            )}
            <V2Field label="Para fazer até (opcional)" htmlFor="envio-prazo">
              <V2Input id="envio-prazo" type="date" min={todayLocal()} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </V2Field>
          </div>
        ) : (
          <div className="space-y-3">
            <V2Field label="Indicar para" htmlFor="envio-pessoa" hint={`Até ${MAX_RECIPIENTS} pessoas.`}>
              {cheio ? (
                <p className="text-sm text-gray-600">Chegou ao limite de {MAX_RECIPIENTS} pessoas.</p>
              ) : (
                <AthletePicker value={null} onChange={adicionarPessoa} inputId="envio-pessoa" />
              )}
            </V2Field>
            {pessoas.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Quem vai receber">
                {pessoas.map((p) => (
                  <li key={p.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm text-ink">
                    {nomeAtleta(p)}
                    <button
                      type="button"
                      aria-label={`Tirar ${nomeAtleta(p)}`}
                      onClick={() => setPessoas((atual) => atual.filter((x) => x.id !== p.id))}
                      className="rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <V2Field label="Recado (opcional)" htmlFor="envio-recado">
          <V2Textarea id="envio-recado" rows={3} maxLength={SHARE_NOTE_MAX} value={recado} onChange={(e) => setRecado(e.target.value)} />
        </V2Field>

        {needsSharedAccess(item, { kind: modo }) && (
          <p className="text-xs text-gray-500">Este item não está na biblioteca: quem receber passa a poder abri-lo (só este item).</p>
        )}
        {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}
        {resultado && <p role="status" className="rounded-2xl bg-gray-50 p-3 text-sm text-ink">{resultado}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <V2Button variant="ghost" onClick={() => fechar(false)}>Fechar</V2Button>
          {!(paraAlunos && !roster.isSuccess) && (
            <V2Button onClick={confirmar} disabled={destinos.length === 0 || enviar.isPending}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {enviar.isPending ? 'Enviando…' : paraAlunos ? `Enviar${destinos.length ? ` (${destinos.length})` : ''}` : `Indicar${destinos.length ? ` (${destinos.length})` : ''}`}
            </V2Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{professor ? 'Enviar ou indicar' : 'Indicar a alguém'}</DialogTitle>
          <DialogDescription>
            {item?.title ? `"${item.title}" vai para Recebidos de quem você escolher, com um aviso.` : 'Quem receber é avisado.'}
          </DialogDescription>
        </DialogHeader>
        {corpo}
      </DialogContent>
    </Dialog>
  );
}
