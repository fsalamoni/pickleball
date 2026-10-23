/**
 * "Planilha DUPR" do torneio chancelado (rodada 3, Bloco 6c): a equipe de
 * competições baixa o CSV de importação de partidas do DUPR — o mesmo formato
 * da exportação da plataforma (`duprMatchExport`) — e sobe na conta DUPR da
 * federação. Vão só as partidas com o ID DUPR de todos os jogadores; quem
 * falta é dito na hora. A exportação geral do admin deixa estas partidas de
 * fora (`sentByFederation`), para o mesmo jogo não entrar duas vezes.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { loadTournamentDuprExport } from '@/modules/rating/services/duprExportService';
import { buildDuprCsv } from '@/modules/rating/domain/duprMatchExport';
import { V2Button } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';

/** Sem BOM: o BOM quebra a leitura da primeira coluna no DUPR. */
function baixar(texto, nome) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function DuprSheetButton({ tournament }) {
  const [busy, setBusy] = useState(false);
  const [faltam, setFaltam] = useState(null);

  async function gerar() {
    setBusy(true);
    try {
      const r = await loadTournamentDuprExport(tournament.id);
      setFaltam(r.missing);
      if (!r.summary.total) { toast.message(t('Ainda não há partida com placar neste torneio.')); return; }
      if (!r.rows.length) { toast.error(t('Nenhuma partida pronta: falta o ID DUPR de algum jogador em todas.')); return; }
      const nome = `dupr-${String(tournament.name || tournament.id).toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.csv`;
      baixar(buildDuprCsv(r.rows), nome);
      toast.success(tn(r.rows.length, '{n} partida na planilha.', '{n} partidas na planilha.'));
    } catch {
      toast.error(t('Não foi possível montar a planilha. Tente de novo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <V2Button type="button" size="sm" variant="ghost" disabled={busy} onClick={gerar} data-dica="federacao-planilha-dupr">
        <FileSpreadsheet className="h-4 w-4" />{busy ? t('Montando…') : t('Planilha DUPR')}
      </V2Button>
      {faltam?.length > 0 && (
        <p className="basis-full text-xs text-amber-800">
          {t('Sem ID DUPR no perfil (as partidas deles ficaram de fora): {nomes}.', { nomes: faltam.join(', ') })}
        </p>
      )}
    </>
  );
}
