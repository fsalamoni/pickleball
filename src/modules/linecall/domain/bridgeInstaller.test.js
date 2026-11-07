// O instalador de um comando (public/ponte) tem de criar a MESMA ponte mínima
// que a tela oferece para baixar (`go2rtcBaseConfig`) e baixar a go2rtc da
// página oficial — se um lado mudar sozinho, a tela promete uma ponte e o
// comando instala outra.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bridgeInstallCommand, go2rtcBaseConfig, BRIDGE_DOWNLOADS, bridgeDownloadUrl } from './ipCamera.js';

const ler = (f) => readFileSync(`public/ponte/${f}`, 'utf8');
const ps1 = ler('instalar.ps1');
const sh = ler('instalar.sh');

describe('instalador da ponte em um comando', () => {
  it('monta o comando do sistema, no mesmo site da página', () => {
    expect(bridgeInstallCommand('win', 'https://picklerush.web.app/')).toEqual({ shell: 'powershell', text: 'irm https://picklerush.web.app/ponte/instalar.ps1 | iex' });
    expect(bridgeInstallCommand('mac_arm', 'http://localhost:5173').text).toBe('curl -fsSL http://localhost:5173/ponte/instalar.sh | sh');
  });

  it('cria a mesma ponte mínima da tela (só este computador, origin liberado)', () => {
    const base = go2rtcBaseConfig();
    for (const linha of ["listen: '127.0.0.1:1984'", "origin: '*'"]) {
      expect(base).toContain(linha);
      expect(ps1).toContain(linha);
      expect(sh).toContain(linha);
    }
  });

  it('baixa da página oficial e não mexe em arquivo de câmeras que já existe', () => {
    const win = BRIDGE_DOWNLOADS.find((d) => d.id === 'win');
    expect(ps1).toContain(bridgeDownloadUrl(win.file));
    expect(sh).toContain('https://github.com/AlexxIT/go2rtc/releases/latest/download');
    for (const d of BRIDGE_DOWNLOADS.filter((x) => x.id !== 'win')) expect(sh).toContain(d.file);
    expect(ps1).toContain('if (-not (Test-Path $yaml))');
    expect(sh).toContain('if [ ! -f "$YAML" ]');
  });

  it('o script do Windows é só ASCII (o PowerShell antigo lê sem saber a codificação)', () => {
    // só texto imprimível, tabulação e quebra de linha
    expect(/[^\t\n\r -~]/.test(ps1)).toBe(false);
    expect(/[^\t\n\r -~]/.test(sh)).toBe(false);
  });
});
