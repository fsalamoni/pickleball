/**
 * A CAMADA das dicas — tudo o que desenha, baixado sob demanda pelo
 * `DicasProvider` (só quando as dicas estão ligadas, um guia está em
 * andamento ou o painel foi aberto).
 *
 * Decide, a cada tela, uma coisa só por vez: com um guia em andamento, só o
 * guia; sem guia, o ponto aberto (se houver) ou os pontos pulsando. Nunca os
 * dois ao mesmo tempo — duas setas na tela é nenhuma.
 */
import React, { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { guiaPorId } from '@/modules/help/domain/guias';
import { pontoPorId, pontosDaTela } from '@/modules/help/domain/pontosDeDica';
import { useDicas } from './DicasContext';
import GuiaEmAndamento from './GuiaEmAndamento';
import PontosNaTela from './PontosNaTela';
import PontoAberto from './PontoAberto';
import PainelDeDicas from './PainelDeDicas';
import { useContextoDasDicas } from './useContextoDasDicas';

export default function DicasCamada() {
  const d = useDicas();
  const location = useLocation();
  const ctx = useContextoDasDicas();

  const guia = d.guia ? guiaPorId(d.guia.id) : null;
  // Guia de id desconhecido (versão antiga numa aba aberta): encerra quieto.
  useEffect(() => {
    if (d.guia && !guia) d.encerrarGuia();
  }, [d.guia, guia]); // eslint-disable-line react-hooks/exhaustive-deps

  const pontos = useMemo(() => pontosDaTela(location.pathname, ctx), [location.pathname, ctx]);
  const ponto = d.ponto ? pontoPorId(d.ponto) : null;
  const guiaDoPonto = ponto?.guide ? guiaPorId(ponto.guide) : null;

  return (
    <>
      {guia && <GuiaEmAndamento guia={guia} passoIdx={d.guia.passo} ctx={ctx} />}
      {!guia && ponto && (
        <PontoAberto
          ponto={ponto}
          guia={guiaDoPonto}
          onFechar={d.fecharPonto}
          onEntendi={() => { d.marcarVisto(ponto.id); d.fecharPonto(); }}
          onGuia={() => { d.marcarVisto(ponto.id); d.iniciarGuia(guiaDoPonto.id); }}
        />
      )}
      {!guia && !ponto && d.ligadas && !d.painelAberto && (
        <PontosNaTela pontos={pontos} vistos={d.vistos} onAbrir={d.abrirPonto} />
      )}
      <PainelDeDicas ctx={ctx} />
    </>
  );
}
