/**
 * Seleções inferidas da planilha "Spoiler Bolão 2026.ods".
 * Como a planilha é uma projeção pré-sorteio, esta lista deve ser revisada
 * e ajustada pelo Admin Geral assim que o sorteio oficial da FIFA for publicado.
 *
 * 48 seleções em 12 grupos (A–L), 4 por grupo.
 */
export const SEED_TEAMS = [
  // Group A
  { code: 'MEX', name: 'México', group_code: 'A' },
  { code: 'KOR', name: 'Coreia do Sul', group_code: 'A' },
  { code: 'CZE', name: 'República Tcheca', group_code: 'A' },
  { code: 'RSA', name: 'África do Sul', group_code: 'A' },

  // Group B
  { code: 'CAN', name: 'Canadá', group_code: 'B' },
  { code: 'BIH', name: 'Bósnia', group_code: 'B' },
  { code: 'QAT', name: 'Catar', group_code: 'B' },
  { code: 'SUI', name: 'Suíça', group_code: 'B' },

  // Group C
  { code: 'BRA', name: 'Brasil', group_code: 'C' },
  { code: 'MAR', name: 'Marrocos', group_code: 'C' },
  { code: 'HAI', name: 'Haiti', group_code: 'C' },
  { code: 'SCO', name: 'Escócia', group_code: 'C' },

  // Group D
  { code: 'USA', name: 'Estados Unidos', group_code: 'D' },
  { code: 'PAR', name: 'Paraguai', group_code: 'D' },
  { code: 'AUS', name: 'Austrália', group_code: 'D' },
  { code: 'TUR', name: 'Turquia', group_code: 'D' },

  // Group E
  { code: 'GER', name: 'Alemanha', group_code: 'E' },
  { code: 'CUW', name: 'Curaçao', group_code: 'E' },
  { code: 'CIV', name: 'Costa do Marfim', group_code: 'E' },
  { code: 'ECU', name: 'Equador', group_code: 'E' },

  // Group F
  { code: 'NED', name: 'Holanda', group_code: 'F' },
  { code: 'JPN', name: 'Japão', group_code: 'F' },
  { code: 'SWE', name: 'Suécia', group_code: 'F' },
  { code: 'TUN', name: 'Tunísia', group_code: 'F' },

  // Group G
  { code: 'BEL', name: 'Bélgica', group_code: 'G' },
  { code: 'EGY', name: 'Egito', group_code: 'G' },
  { code: 'IRN', name: 'Irã', group_code: 'G' },
  { code: 'NZL', name: 'Nova Zelândia', group_code: 'G' },

  // Group H
  { code: 'ESP', name: 'Espanha', group_code: 'H' },
  { code: 'CPV', name: 'Cabo Verde', group_code: 'H' },
  { code: 'KSA', name: 'Arábia Saudita', group_code: 'H' },
  { code: 'URU', name: 'Uruguai', group_code: 'H' },

  // Group I
  { code: 'FRA', name: 'França', group_code: 'I' },
  { code: 'SEN', name: 'Senegal', group_code: 'I' },
  { code: 'IRQ', name: 'Iraque', group_code: 'I' },
  { code: 'NOR', name: 'Noruega', group_code: 'I' },

  // Group J
  { code: 'ARG', name: 'Argentina', group_code: 'J' },
  { code: 'ALG', name: 'Argélia', group_code: 'J' },
  { code: 'AUT', name: 'Áustria', group_code: 'J' },
  { code: 'JOR', name: 'Jordânia', group_code: 'J' },

  // Group K
  { code: 'POR', name: 'Portugal', group_code: 'K' },
  { code: 'COD', name: 'Congo', group_code: 'K' },
  { code: 'UZB', name: 'Uzbequistão', group_code: 'K' },
  { code: 'COL', name: 'Colômbia', group_code: 'K' },

  // Group L
  { code: 'ENG', name: 'Inglaterra', group_code: 'L' },
  { code: 'CRO', name: 'Croácia', group_code: 'L' },
  { code: 'GHA', name: 'Gana', group_code: 'L' },
  { code: 'PAN', name: 'Panamá', group_code: 'L' },
];

export const SEED_GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((code) => ({
  code,
}));
