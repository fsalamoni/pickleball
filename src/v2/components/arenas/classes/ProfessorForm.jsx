/**
 * Cadastro de professor das AULAS da arena (`arena_coaches`).
 *
 * Mora aqui (e não na página de aulas) porque é usado em dois lugares: na
 * Central, aba Aulas → Professores, e na página de aulas.
 *
 * ## Parceiro primeiro
 *
 * A arena já pode ter o professor como PARCEIRO da plataforma (perfil de
 * professor + parceria). O formulário antigo buscava só no diretório de
 * atletas — e o mesmo professor virava dois cadastros sem ligação. Agora, ao
 * cadastrar, os parceiros que ainda não dão aula aqui aparecem primeiro, e um
 * toque preenche tudo (nome, foto, valor, conta vinculada, "paga comissão").
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useCreateCoach, useUpdateArenaCoach } from '@/modules/arenas/hooks/useArenaV3';
import { COACH_LEVEL, COACH_LEVEL_META } from '@/modules/arenas/domain/classes';
import { arenaCoachFromPartner } from '@/modules/arenas/domain/coachRoster';
import {
  V2Avatar, V2Button, V2Field, V2Input, V2Textarea,
} from '@/v2/ui/primitives';

/**
 * @param {{
 *   arenaId: string,
 *   coach?: object|null,          cadastro existente (edição)
 *   partners?: Array<object>,     parceiros da plataforma que ainda NÃO dão aula aqui
 *   onClose: () => void,
 * }} props
 */
export default function ProfessorForm({ arenaId, coach, partners = [], onClose }) {
  const { data: atletas = [] } = useAthletes();
  const [form, setForm] = useState(() => ({
    name: coach?.name || '',
    level: coach?.level || COACH_LEVEL.INTERMEDIATE,
    price_per_hour: coach?.price_per_hour ?? 120,
    bio: coach?.bio || '',
    photo_url: coach?.photo_url || '',
    user_id: coach?.user_id || '',
    partner: Boolean(coach?.partner),
    active: coach?.active !== false,
  }));
  const [busca, setBusca] = useState('');
  const criar = useCreateCoach();
  const editar = useUpdateArenaCoach();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const vinculado = atletas.find((a) => a.id === form.user_id)
    || (form.user_id ? partners.find((p) => p.id === form.user_id) : null);
  const nomeVinculado = vinculado?.platform_name || vinculado?.full_name || vinculado?.display_name || form.name;
  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return atletas
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(termo))
      .slice(0, 5);
  }, [atletas, busca]);

  const usarParceiro = (p) => {
    const base = arenaCoachFromPartner(p);
    set({
      name: base.name, photo_url: base.photo_url, user_id: base.user_id,
      partner: true, bio: base.bio || form.bio,
      price_per_hour: base.price_per_hour || form.price_per_hour,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const input = { ...form, price_per_hour: Number(form.price_per_hour) };
    try {
      if (coach) await editar.mutateAsync({ arenaId, coachId: coach.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(coach ? 'Professor atualizado.' : 'Professor cadastrado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {coach ? `Editar ${coach.name}` : 'Novo professor'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!coach && !form.user_id && partners.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Parceiros da plataforma</p>
          <p className="mt-0.5 text-xs text-gray-500">Já trabalham com a arena. Um toque preenche o cadastro.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {partners.map((p) => (
              <button key={p.id} type="button" onClick={() => usarParceiro(p)}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure py-1 pl-1 pr-3 text-sm text-ink hover:border-ink">
                <V2Avatar photoUrl={p.photo_url} name={p.display_name} size="xs" />
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Nome" htmlFor="pf-nome">
          <V2Input id="pf-nome" required maxLength={80} value={form.name}
            onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label="Nível que atende" htmlFor="pf-nivel">
          <select id="pf-nivel" value={form.level} onChange={(e) => set({ level: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(COACH_LEVEL_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </V2Field>
        <V2Field label="Preço por hora (R$)" htmlFor="pf-preco">
          <V2Input id="pf-preco" type="number" min="0" step="0.01" value={form.price_per_hour}
            onChange={(e) => set({ price_per_hour: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Sobre" htmlFor="pf-bio" className="mt-3">
        <V2Textarea id="pf-bio" rows={2} maxLength={1000}
          placeholder="Experiência, método, com quem trabalha melhor…"
          value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
      </V2Field>

      {/* O vínculo é o que faz o professor ver a própria agenda e os alunos.
          Sem ele o cadastro é um nome solto — que era o estado anterior. */}
      <V2Field
        label="Conta na plataforma"
        htmlFor="pf-conta"
        className="mt-3"
        hint="Vinculando, o professor passa a ver a agenda dele e os alunos de cada aula."
      >
        {form.user_id ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-paper-pure p-2.5">
            <div className="flex items-center gap-2">
              <V2Avatar photoUrl={vinculado?.photo_url || form.photo_url} name={nomeVinculado} size="sm" />
              <span className="text-sm font-bold text-ink">{nomeVinculado}</span>
            </div>
            <button type="button" onClick={() => set({ user_id: '' })} aria-label="Desvincular"
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <V2Input id="pf-conta" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome… (opcional)" />
        )}
      </V2Field>
      {!form.user_id && resultados.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {resultados.map((a) => (
            <button key={a.id} type="button" onClick={() => { set({ user_id: a.id }); setBusca(''); }}
              className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-paper-pure p-2.5 text-left hover:border-gray-300">
              <V2Avatar photoUrl={a.photo_url} name={a.platform_name || a.full_name} size="sm" />
              <span className="text-sm text-ink">{a.platform_name || a.full_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.partner} className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => set({ partner: e.target.checked })} />
          Professor parceiro (paga comissão à arena)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.active} className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => set({ active: e.target.checked })} />
          Ativo
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {coach ? 'Salvar' : 'Cadastrar'}
        </V2Button>
      </div>
    </form>
  );
}
