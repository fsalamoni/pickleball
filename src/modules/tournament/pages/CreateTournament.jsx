import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCreateTournament } from '@/modules/tournament/hooks/useTournament';
import { RULESET, RULESET_LABELS, TARGET_SCORE } from '@/modules/tournament/domain/constants';

export default function CreateTournament() {
  const navigate = useNavigate();
  const createMutation = useCreateTournament();
  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    state: '',
    venue: '',
    ruleset: RULESET.CBP,
    target_score: TARGET_SCORE.ELEVEN,
    sets_per_match: 1,
    match_win_points: 3,
    per_set_won_points: 0,
    starts_at: '',
    ends_at: '',
    registration_deadline: '',
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome do torneio.');
    try {
      const id = await createMutation.mutateAsync({
        name: form.name,
        description: form.description,
        city: form.city,
        state: form.state,
        venue: form.venue,
        ruleset: form.ruleset,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        registration_deadline: form.registration_deadline || null,
        scoring: {
          ruleset: form.ruleset,
          target_score: Number(form.target_score),
          sets_per_match: Number(form.sets_per_match),
          win_by_two: true,
          points: {
            match_win: Number(form.match_win_points),
            match_loss: 0,
            match_draw: 0,
            walkover_win: Number(form.match_win_points),
            walkover_loss: 0,
            per_set_won: Number(form.per_set_won_points),
          },
        },
      });
      toast.success('Torneio criado!');
      navigate(`/torneios/${id}`);
    } catch (err) {
      toast.error(err.message || 'Falha ao criar torneio.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Criar torneio</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Identificação</h3>
              <div>
                <Label>Nome do torneio</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Open de Pickleball de Floripa" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Apresentação do torneio" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} />
                </div>
                <div>
                  <Label>Local (quadra/clube)</Label>
                  <Input value={form.venue} onChange={(e) => set('venue', e.target.value)} />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Regras de pontuação (padrão do torneio)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Conjunto de regras</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.ruleset}
                    onChange={(e) => set('ruleset', e.target.value)}
                  >
                    {Object.values(RULESET).map((r) => (
                      <option key={r} value={r}>{RULESET_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Pontos por game</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.target_score}
                    onChange={(e) => set('target_score', e.target.value)}
                  >
                    {Object.values(TARGET_SCORE).map((s) => (
                      <option key={s} value={s}>{s} pontos (com vantagem de 2)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Sets por partida</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.sets_per_match}
                    onChange={(e) => set('sets_per_match', e.target.value)}
                  >
                    <option value={1}>1 set</option>
                    <option value={3}>Melhor de 3</option>
                    <option value={5}>Melhor de 5</option>
                  </select>
                </div>
                <div>
                  <Label>Pontos por vitória</Label>
                  <Input type="number" min={0} value={form.match_win_points} onChange={(e) => set('match_win_points', e.target.value)} />
                </div>
                <div>
                  <Label>Pontos por set vencido</Label>
                  <Input type="number" min={0} value={form.per_set_won_points} onChange={(e) => set('per_set_won_points', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Esses valores podem ser sobrescritos em cada modalidade depois de criar o torneio.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Datas (opcional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="date" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
                </div>
                <div>
                  <Label>Fim das inscrições</Label>
                  <Input type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} />
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/inicio')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando…' : 'Criar torneio'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
