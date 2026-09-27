/**
 * O aviso chegou com `?ancora=secao` (a regra de `notifications` não aceita
 * `#`, ver `linkDeAviso`): troca o parâmetro pelo `#secao` na URL, sem criar
 * entrada no histórico. Daí em diante vale a rolagem que cada página já tem
 * (`useHashScroll`, o índice da página da arena, a Central da arena).
 *
 * Montado UMA vez, no layout — assim toda tela ganha, e nenhuma precisa
 * conhecer o parâmetro.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hashDaAncora } from '@/core/domain/internalLink';

export function useAncoraDoAviso() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const destino = hashDaAncora({ pathname, search });
    if (destino) navigate(destino, { replace: true });
  }, [pathname, search, navigate]);
}
