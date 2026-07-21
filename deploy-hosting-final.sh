#!/bin/bash
# ============================================================
# DEPLOY FINAL DO HOSTING — Arena V3 PickleRush
# ============================================================
# Cola este bloco INTEIRO no Cloud Shell (projeto antonov-82411).
# Ele faz: build + deploy só do hosting (sem rules/indexes/functions).
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DEPLOY HOSTING — PickleRush Arena V3${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# ===== SETAR PROJETO =====
echo -e "${YELLOW}[1/5]${NC} Setando projeto antonov-82411..."
gcloud config set project antonov-82411
firebase use antonov-82411

# ===== AUTH (se necessário) =====
echo -e "${YELLOW}[2/5]${NC} Verificando autenticação Firebase..."
if ! firebase projects:list 2>/dev/null | grep -q "antonov-82411"; then
  echo -e "${YELLOW}Faça login no Firebase...${NC}"
  firebase login --no-localhost
fi

# ===== PUXAR MAIN =====
echo -e "${YELLOW}[3/5]${NC} Puxando main atualizado do GitHub..."
cd ~
rm -rf pickleball
git clone https://github.com/fsalamoni/pickleball.git
cd pickleball
git checkout main

# ===== INSTALAR DEPS + BUILD =====
echo -e "${YELLOW}[4/5]${NC} Instalando dependências + build..."
npm install --silent
npm run build

# Confere que tem as páginas V2
V2_COUNT=$(ls dist/assets/ | grep -c "V2Arena")
echo -e "${GREEN}✓ Build OK — $V2_COUNT páginas V2 Arena no bundle${NC}"

# ===== DEPLOY HOSTING =====
echo -e "${YELLOW}[5/5]${NC} Deploy do Hosting (só hosting, rules/indexes/functions já estão OK)..."
firebase deploy --only hosting --project antonov-82411

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOY CONCLUÍDO! ✓${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "🌐 Site: https://picklerush.web.app"
echo ""
echo "Próximos passos:"
echo "  1. Acesse o site e faça login"
echo "  2. Vá em /arenas/{id}/gerir/modulos — vai listar 50+ módulos"
echo "  3. Ative o master switch arena_modules + 1 sub-flag"
echo "  4. Ative em uma arena específica"
echo "  5. Acesse /arenas/{id}/gerir/open-match para ver a página funcionando"
echo ""
echo "Para verificar tudo:"
echo "  firebase hosting:channel:list --project antonov-82411"
