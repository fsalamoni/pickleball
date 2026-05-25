/**
 * Tabela de nivelamento CBPE/USAP — referência usada em todo o app.
 * Baseada no repositório fsalamoni/pickleball-nivelamento.
 */

export const LEVEL_TABLE = [
  {
    code: 'beginner',
    name: 'Iniciante',
    usap_range: [2.0, 2.5],
    color: 'bg-sky-100 text-sky-900 border-sky-200',
    summary:
      'Está aprendendo as regras básicas e os fundamentos. Consegue colocar a bola em jogo no saque e mantém ralis curtos.',
    abilities: [
      'Conhece a regra do duplo quique e a posição da NVZ (kitchen).',
      'Saque por baixo razoavelmente consistente, mas com pouca profundidade.',
      'Forehand básico funcional; backhand inconsistente.',
      'Posicionamento próximo da linha de fundo durante a maior parte do ponto.',
      'Pouca noção tática — geralmente joga para a bola, não para o espaço.',
    ],
  },
  {
    code: 'intermediate',
    name: 'Intermediário',
    usap_range: [3.0, 3.0],
    color: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    summary:
      'Já consegue chegar à NVZ com regularidade, executa dinks simples e mantém ralis com adversários do mesmo nível.',
    abilities: [
      'Saque com mais profundidade e algum controle de direção.',
      'Retorno de saque profundo e segue para a NVZ.',
      'Forehand e backhand consistentes em bolas médias.',
      'Inicia dinks com alguma consistência; falha em sequências longas.',
      'Conhece estratégias básicas de duplas (stacking simples não dominado).',
    ],
  },
  {
    code: 'intermediate_plus',
    name: 'Intermediário Plus',
    usap_range: [3.5, 4.0],
    color: 'bg-amber-100 text-amber-900 border-amber-200',
    summary:
      'Joga com intencionalidade, escolhe golpes em função da situação tática e sustenta ralis longos com poucos erros não forçados.',
    abilities: [
      'Saques e devoluções com variação de profundidade e rotação.',
      'Dinks consistentes em ralis longos; identifica oportunidades de ataque.',
      'Drive controlado; transição entre fundo e NVZ fluida.',
      'Aplica stacking, switches e poaching em duplas.',
      'Conhece regras atualizadas (incluindo alterações 2024–2026).',
    ],
  },
  {
    code: 'pro',
    name: 'PRO',
    usap_range: [4.5, 4.5],
    color: 'bg-orange-100 text-orange-900 border-orange-200',
    summary:
      'Atleta competitivo. Executa todos os golpes com confiança e neutraliza ataques sob pressão. Joga torneios estaduais e nacionais.',
    abilities: [
      'Variedade ampla de saques (slice, topspin, lift) com colocação intencional.',
      'Dinks ofensivos e defensivos, com leitura precisa de oportunidades.',
      'Reset consistente sob pressão.',
      'Comunicação fluida em duplas; estratégias adaptadas ao adversário.',
      'Erros não forçados raros; tempo de reação alto.',
    ],
  },
  {
    code: 'open',
    name: 'Open',
    usap_range: [5.0, 6.0],
    color: 'bg-rose-100 text-rose-900 border-rose-200',
    summary:
      'Nível elite. Compete em torneios nacionais e internacionais. Domínio técnico e tático completo.',
    abilities: [
      'Execução técnica próxima da perfeição em todos os golpes.',
      'Capacidade de impor o ritmo do jogo e ler intenções do adversário.',
      'Domínio total do erne, ATP, around-the-post.',
      'Preparo físico de alto rendimento.',
      'Histórico em torneios regionais/nacionais com bons resultados.',
    ],
  },
];

export function getLevelByCode(code) {
  return LEVEL_TABLE.find((l) => l.code === code) || null;
}
