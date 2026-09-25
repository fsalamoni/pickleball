/**
 * "Foi indicado por alguém?" — o campo de indicação no pedido de reserva
 * (Onda BY).
 *
 * Só aparece quando a arena tem um programa de indicação valendo e, se ele
 * vale só para quem nunca reservou ali, só na primeira reserva (quem decide é
 * `shouldOfferReferral`). O código é conferido pela ARENA na confirmação — o
 * atleta não lê os códigos dos outros —, e o texto diz isso, em vez de
 * prometer um prêmio que ainda não foi conferido.
 */
import React from 'react';

export default function BookingReferralField({ value, onChange, problem, friendReward }) {
  return (
    <div className="rounded-lg border border-dashed border-ink/20 bg-paper-pure p-3 text-sm">
      <label htmlFor="indicacao-reserva" className="text-xs font-bold uppercase tracking-wider text-ink/60">
        Foi indicado por alguém?
      </label>
      <input
        id="indicacao-reserva"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s+/g, ''))}
        placeholder="CÓDIGO DE QUEM INDICOU"
        maxLength={20}
        aria-invalid={Boolean(problem)}
        aria-describedby="indicacao-reserva-ajuda"
        className="mt-1 h-9 w-full rounded-xl border border-ink/15 bg-paper-pure px-3 text-sm uppercase"
      />
      {problem ? (
        <p id="indicacao-reserva-ajuda" className="mt-1 text-xs text-red-700">{problem}</p>
      ) : (
        <p id="indicacao-reserva-ajuda" className="mt-1 text-xs text-ink/60">
          {friendReward ? `Quem chega por indicação ganha ${friendReward}. ` : ''}
          A arena confere o código quando confirmar a sua reserva.
        </p>
      )}
    </div>
  );
}
