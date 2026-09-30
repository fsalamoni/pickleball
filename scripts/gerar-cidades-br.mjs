#!/usr/bin/env node
/**
 * Gera `src/core/geo/cidadesBR.data.js` — as coordenadas das cidades do Brasil
 * que a "Minha região" usa para medir distância (cidade + raio).
 *
 * Fonte: kelvins/municipios-brasileiros (licença MIT), montado a partir dos
 * dados públicos do IBGE — https://github.com/kelvins/municipios-brasileiros
 *   csv/municipios.csv  (codigo_ibge, nome, latitude, longitude, capital, codigo_uf, …)
 *   csv/estados.csv     (codigo_uf, uf, nome, latitude, longitude, regiao)
 *
 * Uso:
 *   node scripts/gerar-cidades-br.mjs <municipios.csv> <estados.csv>
 *
 * O arquivo gerado é um texto compacto por UF ("Nome|lat|lon;…"), com as
 * coordenadas em 2 casas (≈ 1 km) — mais que suficiente para "até 25 km" e
 * pequeno o bastante para baixar só quando a pessoa usa a distância. Nada
 * disso vai para o banco.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const [, , municipiosPath, estadosPath] = process.argv;
if (!municipiosPath || !estadosPath) {
  console.error('Uso: node scripts/gerar-cidades-br.mjs <municipios.csv> <estados.csv>');
  process.exit(1);
}

const linhas = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);

const ufPorCodigo = new Map();
for (const l of linhas(estadosPath).slice(1)) {
  const [codigo, uf] = l.split(',');
  ufPorCodigo.set(codigo, uf);
}

const porUf = new Map();
let total = 0;
for (const l of linhas(municipiosPath).slice(1)) {
  // nome pode ter vírgula? No arquivo não tem; ainda assim, lê pelas pontas.
  const partes = l.split(',');
  const [, nome, lat, lon] = partes;
  const codigoUf = partes[5];
  const uf = ufPorCodigo.get(codigoUf);
  if (!uf || !nome) throw new Error(`Linha inválida: ${l}`);
  if (nome.includes('|') || nome.includes(';')) throw new Error(`Nome com separador: ${nome}`);
  const f = (x) => String(Math.round(Number(x) * 100) / 100);
  if (!porUf.has(uf)) porUf.set(uf, []);
  porUf.get(uf).push(`${nome}|${f(lat)}|${f(lon)}`);
  total += 1;
}

const ufs = [...porUf.keys()].sort();
const corpo = ufs
  .map((uf) => `  ${uf}: '${porUf.get(uf).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(';').replace(/'/g, "\\'")}',`)
  .join('\n');

const saida = `/* eslint-disable */
/**
 * GERADO por \`scripts/gerar-cidades-br.mjs\` — não edite à mão.
 *
 * ${total} cidades do Brasil, por UF: "Nome|latitude|longitude;…" (2 casas).
 * Fonte: kelvins/municipios-brasileiros (MIT), a partir dos dados do IBGE.
 * Carregado SOB DEMANDA (import dinâmico) por \`cidadesBR.js\`.
 */
export default {
${corpo}
};
`;

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'core', 'geo', 'cidadesBR.data.js');
writeFileSync(destino, saida);
console.log(`${total} cidades em ${ufs.length} UFs → ${destino} (${(saida.length / 1024).toFixed(0)} kB)`);
