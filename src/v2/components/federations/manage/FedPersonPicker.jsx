/**
 * Escolher pessoas na LISTA DE USUÁRIOS da plataforma (todos os perfis), para
 * nomear na equipe ou convidar para filiar. É o seletor padrão da plataforma
 * (`PersonPicker`) com o diretório completo e o texto da federação.
 *
 * `multiple`: vários de uma vez (convite); sem ele, um só (equipe).
 * `excluir`: Map uid → motivo (ex.: "já na equipe", "já filiado").
 */
import React from 'react';
import PersonPicker from '@/v2/components/people/PersonPicker';
import { t } from '@/core/i18n';

export default function FedPersonPicker(props) {
  return (
    <PersonPicker
      diretorio="todos"
      rotulo={t('Usuários da plataforma')}
      tituloFalha={t('Não carregou a lista de usuários')}
      vazio={t('Ninguém com esse nome ou cidade. A pessoa precisa ter conta no PickleRush.')}
      {...props}
    />
  );
}
