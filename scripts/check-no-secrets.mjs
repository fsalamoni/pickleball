#!/usr/bin/env node
/**
 * Varredura local/CI de segredos de alta confiança em arquivos versionados.
 *
 * Não substitui GitHub Secret Scanning, Gitleaks ou revisão humana. O objetivo
 * é bloquear o acidente mais perigoso antes do push: chave privada, token real
 * ou dump de credencial entrando no Git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const SKIP_EXT = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.pdf', '.png', '.webp', '.zip',
  '.gz', '.tgz', '.tar', '.woff', '.woff2',
]);

const PATTERNS = [
  {
    name: 'private-key-block',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/,
  },
  {
    name: 'service-account-private-key-json',
    re: /"private_key"\s*:\s*"-----BEGIN (?:RSA |EC |)?PRIVATE KEY-----/,
  },
  {
    name: 'google-api-key',
    re: /AIza[0-9A-Za-z_-]{35}/,
  },
  {
    name: 'github-token',
    re: /(?:gh[pousr]_|github_pat_)[0-9A-Za-z_]{36,}/,
  },
  {
    name: 'aws-access-key',
    re: /AKIA[0-9A-Z]{16}/,
  },
  {
    name: 'slack-token',
    re: /xox[baprs]-[0-9A-Za-z-]{20,}/,
  },
  {
    name: 'stripe-live-secret-key',
    re: /sk_live_[0-9A-Za-z]{20,}/,
  },
];

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function extOf(file) {
  const dot = file.lastIndexOf('.');
  return dot >= 0 ? file.slice(dot).toLowerCase() : '';
}

function shouldSkip(file) {
  if (!existsSync(file)) return true;
  if (SKIP_EXT.has(extOf(file))) return true;
  const st = statSync(file);
  return !st.isFile() || st.size > MAX_FILE_BYTES;
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

const findings = [];
for (const file of trackedFiles()) {
  if (shouldSkip(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(content);
    if (match) {
      findings.push({
        file,
        line: lineOf(content, match.index),
        pattern: pattern.name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error('Segredo ou credencial provável encontrado em arquivo versionado:');
  findings.forEach((f) => {
    console.error(`- ${f.file}:${f.line} (${f.pattern})`);
  });
  console.error('\nRemova o segredo do arquivo. Não faça commit de dumps/exports de banco.');
  process.exit(1);
}

console.log('Nenhum segredo de alta confiança encontrado em arquivos versionados.');
