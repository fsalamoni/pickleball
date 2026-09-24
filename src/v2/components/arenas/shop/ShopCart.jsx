/**
 * O carrinho da loja do app — com a divisão da conta (módulo `pdv_split`).
 *
 * A tela ESTIMA o total com os preços que mostrou; quem grava refaz a conta
 * com o preço do Mercado naquele instante (`createSale`). Se a arena mudou um
 * preço no meio do caminho, vale o do banco — e o aviso abaixo do botão diz
 * isso antes do clique.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ShoppingBag, Users, X } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { useCreateSale } from '@/modules/arenas/hooks/useArenaV3';
import { splitAmount } from '@/modules/arenas/domain/pdv';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Avatar, V2Button, V2Input, V2Surface } from '@/v2/ui/primitives';

const nomeDe = (a) => a?.platform_name || a?.full_name || 'Atleta';

export default function ShopCart({ arena, itens, temSplit, onLimpar, onPedido }) {
  const { user } = useAuth();
  const { data: atletas = [] } = useAthletes(Boolean(temSplit));
  const comprar = useCreateSale();
  const [dividirCom, setDividirCom] = useState([]);
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => Object.values(itens).filter((i) => i.quantity > 0), [itens]);
  const total = Math.round(lista.reduce((a, i) => a + i.price * i.quantity, 0) * 100) / 100;

  // O comprador SEMPRE entra na divisão: dividir uma conta em que quem comprou
  // não paga nada é o começo de uma discussão no vestiário.
  const participantes = useMemo(() => [user?.uid, ...dividirCom].filter(Boolean), [user?.uid, dividirCom]);
  const partes = participantes.length > 1 ? splitAmount(total, participantes) : null;
  const minhaParte = partes ? partes.find((p) => p.user_id === user?.uid)?.amount : total;

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return atletas
      .filter((a) => a.id !== user?.uid && !dividirCom.includes(a.id))
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(termo))
      .slice(0, 5);
  }, [atletas, busca, dividirCom, user?.uid]);

  const finalizar = async () => {
    try {
      await comprar.mutateAsync({
        arenaId: arena.id,
        // Só produto e quantidade: o preço quem define é o Mercado.
        items: lista.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        paymentMethod: 'pix',
        splitWith: participantes.length > 1 ? participantes : [],
      });
      toast.success(participantes.length > 1
        ? 'Pedido feito! A arena já foi avisada, e a turma recebeu a parte dela.'
        : 'Pedido feito! A arena já foi avisada — é só retirar no balcão.');
      setDividirCom([]);
      onPedido?.();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível fazer o pedido.');
    }
  };

  if (lista.length === 0) return null;

  return (
    <V2Surface className="sticky bottom-4 z-10 border-ink/20 shadow-organic">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <ShoppingBag className="h-4 w-4" /> Seu pedido
        </h2>
        <V2Button size="sm" variant="ghost" onClick={onLimpar}>Limpar</V2Button>
      </div>

      <ul className="space-y-1">
        {lista.map((i) => (
          <li key={i.product_id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-gray-600">{i.quantity}× {i.name}</span>
            <span className="shrink-0 font-bold text-ink">{formatPrice(i.price * i.quantity)}</span>
          </li>
        ))}
      </ul>

      {temSplit && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">
            <Users className="h-3.5 w-3.5" /> Dividir com
          </p>
          {dividirCom.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {dividirCom.map((uid) => {
                const a = atletas.find((x) => x.id === uid);
                return (
                  <span key={uid} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper py-0.5 pl-0.5 pr-1 text-xs text-ink">
                    <V2Avatar photoUrl={a?.photo_url} name={nomeDe(a)} size="xs" />
                    {nomeDe(a)}
                    <button type="button" aria-label={`Tirar ${nomeDe(a)} da divisão`}
                      onClick={() => setDividirCom((d) => d.filter((x) => x !== uid))}
                      className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <V2Input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar quem divide a conta…" aria-label="Buscar quem divide a conta" />
          {resultados.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {resultados.map((a) => (
                <button key={a.id} type="button"
                  onClick={() => { setDividirCom((d) => [...d, a.id]); setBusca(''); }}
                  className="flex w-full items-center gap-2 rounded-xl border border-gray-100 bg-paper p-2 text-left text-sm hover:border-gray-300">
                  <V2Avatar photoUrl={a.photo_url} name={nomeDe(a)} size="xs" />
                  {nomeDe(a)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-xs text-gray-500">
            {partes ? `Total ${formatPrice(total)} entre ${partes.length} pessoas` : 'Total'}
          </p>
          <p className="font-display text-2xl font-bold text-ink">
            {formatPrice(minhaParte)}
            {partes && <span className="ml-1 text-sm font-medium text-gray-500">a sua parte</span>}
          </p>
        </div>
        <V2Button disabled={comprar.isPending} onClick={finalizar}>
          {comprar.isPending ? 'Enviando…' : 'Fazer o pedido'}
        </V2Button>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        A arena é avisada na hora e entrega no balcão. Vale o preço da arena no momento do pedido.
      </p>
    </V2Surface>
  );
}
