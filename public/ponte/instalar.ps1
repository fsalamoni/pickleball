# PickleRush - instala a ponte das cameras IP (go2rtc) neste computador Windows.
# Uso (PowerShell):  irm https://picklerush.web.app/ponte/instalar.ps1 | iex
#
# O que faz, e so isso:
#  1. baixa a go2rtc (gratuita, MIT) da pagina oficial de versoes do projeto AlexxIT/go2rtc;
#  2. cria o go2rtc.yaml minimo (so este computador alcanca a ponte; as cameras
#     entram depois pela pagina do PickleRush). Um go2rtc.yaml que ja existe NAO e tocado;
#  3. faz a ponte ligar sozinha ao entrar no Windows (tarefa "PickleRush ponte", sem administrador);
#  4. liga a ponte agora.
# Rodar de novo atualiza a go2rtc e mantem as cameras. Ver docs/53-CONTROLE-DE-LINHAS.md 5b.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$dir = Join-Path $env:LOCALAPPDATA 'PickleRush\ponte'
$exe = Join-Path $dir 'go2rtc.exe'
$yaml = Join-Path $dir 'go2rtc.yaml'
$zip = Join-Path $dir 'go2rtc.zip'
$url = 'https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_win64.zip'

Write-Host 'PickleRush: instalando a ponte das cameras...'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# A ponte desta pasta, se ja estiver ligada, precisa parar para o arquivo ser trocado.
Get-Process -Name go2rtc -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | Stop-Process -Force

Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
Expand-Archive -Path $zip -DestinationPath $dir -Force
Remove-Item $zip -Force

if (-not (Test-Path $yaml)) {
  @(
    '# go2rtc.yaml - gerado pelo PickleRush (controle de linhas).',
    '# As cameras entram pela pagina do PickleRush e ficam gravadas aqui, com a senha delas.',
    'api:',
    "  listen: '127.0.0.1:1984'",
    "  origin: '*'"
  ) | Set-Content -Path $yaml -Encoding ASCII
}

$tr = '"' + $exe + '" -config "' + $yaml + '"'
schtasks /Create /F /SC ONLOGON /RL LIMITED /TN 'PickleRush ponte' /TR $tr | Out-Null

Start-Process -FilePath $exe -ArgumentList @('-config', "`"$yaml`"") -WorkingDirectory $dir -WindowStyle Hidden

Write-Host ''
Write-Host 'Pronto: a ponte esta ligada e vai ligar sozinha quando o computador iniciar.'
Write-Host 'Volte para o PickleRush: a tela da camera segue sozinha.'
Write-Host 'Se o Windows perguntar sobre o firewall, permita em rede privada.'
