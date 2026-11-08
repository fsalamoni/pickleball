#!/bin/sh
# PickleRush - instala a ponte das cameras IP (go2rtc) neste Mac, Linux ou Raspberry Pi.
# Uso (Terminal):  curl -fsSL https://picklerush.web.app/ponte/instalar.sh | sh
#
# O que faz, e so isso:
#  1. baixa a go2rtc (gratuita, MIT) da pagina oficial de versoes do projeto AlexxIT/go2rtc;
#  2. cria o go2rtc.yaml minimo (so este computador alcanca a ponte; as cameras
#     entram depois pela pagina do PickleRush). Um go2rtc.yaml que ja existe NAO e tocado;
#  3. faz a ponte ligar sozinha quando o computador inicia (launchd no Mac,
#     systemd do usuario no Linux), sem administrador;
#  4. liga a ponte agora.
# Rodar de novo atualiza a go2rtc e mantem as cameras. Ver docs/53-CONTROLE-DE-LINHAS.md 5b.
set -eu

DIR="$HOME/.picklerush-ponte"
BIN="$DIR/go2rtc"
YAML="$DIR/go2rtc.yaml"
BASE="https://github.com/AlexxIT/go2rtc/releases/latest/download"

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS-$ARCH" in
  Darwin-arm64) FILE="go2rtc_mac_arm64.zip" ;;
  Darwin-*) FILE="go2rtc_mac_amd64.zip" ;;
  Linux-x86_64|Linux-amd64) FILE="go2rtc_linux_amd64" ;;
  Linux-aarch64|Linux-arm64) FILE="go2rtc_linux_arm64" ;;
  Linux-armv7l) FILE="go2rtc_linux_arm" ;;
  Linux-armv6l) FILE="go2rtc_linux_armv6" ;;
  *) echo "Sistema nao reconhecido: $OS $ARCH"; exit 1 ;;
esac

echo "PickleRush: instalando a ponte das cameras..."
mkdir -p "$DIR"
TMP="$DIR/download.tmp"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$BASE/$FILE" -o "$TMP"
else
  wget -qO "$TMP" "$BASE/$FILE"
fi

case "$FILE" in
  *.zip)
    rm -rf "$DIR/unzip.tmp"
    mkdir -p "$DIR/unzip.tmp"
    unzip -oq "$TMP" -d "$DIR/unzip.tmp"
    mv -f "$DIR/unzip.tmp/go2rtc" "$BIN"
    rm -rf "$DIR/unzip.tmp" "$TMP"
    ;;
  *) mv -f "$TMP" "$BIN" ;;
esac
chmod +x "$BIN"

if [ ! -f "$YAML" ]; then
  cat > "$YAML" <<'EOF'
# go2rtc.yaml - gerado pelo PickleRush (controle de linhas).
# As cameras entram pela pagina do PickleRush e ficam gravadas aqui, com a senha delas.
api:
  listen: '127.0.0.1:1984'
  origin: '*'
EOF
fi

if [ "$OS" = "Darwin" ]; then
  xattr -d com.apple.quarantine "$BIN" 2>/dev/null || true
  PLIST="$HOME/Library/LaunchAgents/app.picklerush.ponte.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>app.picklerush.ponte</string>
<key>ProgramArguments</key><array><string>$BIN</string><string>-config</string><string>$YAML</string></array>
<key>WorkingDirectory</key><string>$DIR</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
</dict></plist>
EOF
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
elif command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
  UNIT="$HOME/.config/systemd/user/picklerush-ponte.service"
  mkdir -p "$(dirname "$UNIT")"
  printf '[Unit]\nDescription=PickleRush ponte (go2rtc)\n\n[Service]\nWorkingDirectory=%s\nExecStart=%s -config %s\nRestart=always\n\n[Install]\nWantedBy=default.target\n' "$DIR" "$BIN" "$YAML" > "$UNIT"
  systemctl --user daemon-reload
  systemctl --user enable picklerush-ponte.service >/dev/null
  systemctl --user restart picklerush-ponte.service
  # Sem isto a ponte so liga depois que alguem entra no computador.
  loginctl enable-linger "$(id -un)" 2>/dev/null || true
else
  # Sem systemd: liga agora; para ligar sozinha, ponha esta linha no inicio da sessao.
  nohup "$BIN" -config "$YAML" >"$DIR/ponte.log" 2>&1 &
  AUTO=0
fi

echo ""
if [ "${AUTO:-1}" = 1 ]; then
  echo "Pronto: a ponte esta ligada e vai ligar sozinha quando o computador iniciar."
else
  echo "Pronto: a ponte esta ligada. Para ela ligar sozinha, ponha no inicio da sessao: $BIN -config $YAML"
fi
echo "Volte para o PickleRush: a tela da camera segue sozinha."
