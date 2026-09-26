/**
 * A divulgação DO PROFESSOR (Onda CG) — a seção "Divulgação" do painel do
 * professor (`/aulas?secao=divulgacao`), atrás da flag `coach_marketing`.
 *
 * O emissor é o próprio professor: os cupons e campanhas são DELE, a regra do
 * Firestore só deixa ele (com perfil de professor) escrever, e o aviso vai
 * para os alunos dele.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PromoMarketingConsole from './PromoMarketingConsole';
import { coachIssuer } from './promoUi';

export default function CoachPromoConsole({ coachId, coach }) {
  const issuer = useMemo(() => coachIssuer(coachId, coach), [coachId, coach]);
  if (!issuer) return null;
  return (
    <PromoMarketingConsole
      issuer={issuer}
      intro={(
        <p className="max-w-3xl text-sm text-gray-600">
          Cupons e campanhas <strong>seus</strong>, com as mesmas ferramentas das arenas. O cupom de desconto entra no
          pedido de aula e é contado quando você confirma; o banner aparece no{' '}
          <Link to={`/coaches/${coachId}`} className="font-bold text-ink underline">seu perfil</Link> e, se quiser, na tela
          inicial; o aviso vai para os seus alunos.
        </p>
      )}
    />
  );
}
