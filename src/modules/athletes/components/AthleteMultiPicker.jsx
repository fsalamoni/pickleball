/**
 * AthleteMultiPicker — vários atletas do diretório (convites de reserva
 * compartilhada, alunos etc.). É o seletor padrão da plataforma
 * (`PersonPicker`, modo vários) com o formato de valor que estas telas gravam.
 *
 * value: Array<{ athlete_id, name, photo }>
 * onChange: (next) => void
 * exclude: Array<uid> a ocultar (ex.: o próprio solicitante / já participantes)
 */

import React from 'react';
import PersonPicker from '@/v2/components/people/PersonPicker';

const paraValor = (p) => ({ athlete_id: p.athlete_id || p.id || p.uid, name: p.platform_name || p.full_name || p.name || 'Atleta', photo: p.photo_url || p.photo || '' });

export default function AthleteMultiPicker({ value = [], onChange, exclude = [], placeholder }) {
  return (
    <PersonPicker
      multiple
      ocultar={exclude}
      placeholder={placeholder}
      selecionados={value.map((v) => ({ id: v.athlete_id, name: v.name, photo: v.photo }))}
      onChange={(lista) => onChange(lista.map(paraValor))}
    />
  );
}
