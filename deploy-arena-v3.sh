#!/bin/bash
# ============================================================
# DEPLOY COMPLETO — Arena V3 (PickleRush)
# ============================================================
# Use este script no Cloud Shell da Google:
#   https://shell.cloud.google.com
#   (projeto: antonov-82411)
#
# O que ele faz:
#   1. Autentica no Firebase
#   2. Puxa a branch main atualizada
#   3. Faz deploy das Firestore Rules (17 novas collections)
#   4. Faz deploy dos Firestore Indexes (11 novos)
#   5. Faz deploy das 4 Cloud Functions
#
# Tempo estimado: 5-10 minutos
# ============================================================

set -e  # Para em qualquer erro

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  DEPLOY ARENA V3 — PickleRush (antonov-82411)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# ===== 1. SETAR PROJETO =====
echo -e "${YELLOW}[1/6]${NC} Setando projeto antonov-82411..."
gcloud config set project antonov-82411

# ===== 2. AUTH =====
echo -e "${YELLOW}[2/6]${NC} Verificando autenticação Firebase..."
if ! firebase projects:list 2>/dev/null | grep -q "antonov-82411"; then
  echo -e "${YELLOW}Faça login no Firebase...${NC}"
  firebase login --no-localhost
fi
firebase use antonov-82411

# ===== 3. PUXAR MAIN =====
echo -e "${YELLOW}[3/6]${NC} Puxando main atualizado do GitHub..."
cd ~
rm -rf pickleball
git clone https://github.com/fsalamoni/pickleball.git
cd pickleball
git checkout main

# ===== 4. HABILITAR APIs =====
echo -e "${YELLOW}[4/6]${NC} Habilitando APIs necessárias..."
gcloud services enable firestore.googleapis.com cloudfunctions.googleapis.com cloudscheduler.googleapis.com --project=antonov-82411 2>&1 | tail -3 || true

# ===== 5. DEPLOY RULES =====
echo -e "${YELLOW}[5/6]${NC} Deploying Firestore Rules..."
firebase deploy --only firestore:rules
echo -e "${GREEN}✓ Rules deployed${NC}"

# ===== 6. DEPLOY INDEXES =====
echo -e "${YELLOW}[6/6]${NC} Deploying Firestore Indexes (pode levar 5-30 min)..."
firebase deploy --only firestore:indexes
echo -e "${GREEN}✓ Indexes enfileirados para criação${NC}"

# ===== BÔNUS: DEPLOY FUNCTIONS =====
echo -e "${YELLOW}[BÔNUS]${NC} Deploying Cloud Functions (5 functions)..."
cd functions
npm install --silent
cd ..
firebase deploy --only functions
echo -e "${GREEN}✓ Functions deployed${NC}"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOY COMPLETO! ✓${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Próximos passos opcionais:"
echo "  • Conectar como platform admin: edite users/{seuUid} role=platform_admin"
echo "  • Rodar migração de feature flags:"
echo "    cd /tmp && curl -sL https://raw.githubusercontent.com/fsalamoni/pickleball/main/scripts/migrate-arena-v3-flags.mjs -o migrate.mjs"
echo "    (configurar credenciais firebase-admin)"
echo "  • Validar com health check:"
echo "    cd /tmp && curl -sL https://raw.githubusercontent.com/fsalamoni/pickleball/main/scripts/health-check-arena-v3.mjs -o hc.mjs"
