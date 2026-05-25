@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title INSTALAR - Bolao Copa 2026

cd /d "%~dp0"
set "ROOT=%~dp0"

echo ============================================
echo   MIGRACAO COMPLETA - BOLAO COPA 2026
echo ============================================
echo.
echo Este script vai:
echo   1. Criar estrutura de pastas (core + modulos)
echo   2. Mover arquivos para nova estrutura
echo   3. Atualizar TODOS os imports automaticamente
echo   4. Atualizar configuracoes (vite, jsconfig)
echo   5. Limpar arquivos antigos duplicados
echo   6. Pronto para commit e deploy
echo.
pause

:: =============================================
:: PASSO 1: Criar estrutura de diretorios
:: =============================================
echo.
echo [PASSO 1/6] Criando estrutura de diretorios...

mkdir "src\core\config" 2>nul
mkdir "src\core\domain" 2>nul
mkdir "src\core\lib" 2>nul
mkdir "src\core\services" 2>nul
mkdir "src\core\components" 2>nul

mkdir "src\modules\auth\hooks" 2>nul
mkdir "src\modules\auth\services" 2>nul
mkdir "src\modules\auth\components" 2>nul

mkdir "src\modules\pool\hooks" 2>nul
mkdir "src\modules\pool\services" 2>nul
mkdir "src\modules\pool\components" 2>nul
mkdir "src\modules\pool\domain" 2>nul
mkdir "src\modules\pool\pages" 2>nul

mkdir "src\modules\bets\hooks" 2>nul
mkdir "src\modules\bets\services" 2>nul
mkdir "src\modules\bets\components" 2>nul

mkdir "src\modules\scoring\domain" 2>nul
mkdir "src\modules\scoring\services" 2>nul
mkdir "src\modules\scoring\hooks" 2>nul

mkdir "src\modules\tournament\hooks" 2>nul
mkdir "src\modules\tournament\services" 2>nul
mkdir "src\modules\tournament\data" 2>nul
mkdir "src\modules\tournament\utils" 2>nul

mkdir "src\modules\admin\hooks" 2>nul
mkdir "src\modules\admin\services" 2>nul
mkdir "src\modules\admin\components" 2>nul
mkdir "src\modules\admin\pages" 2>nul

mkdir "src\modules\notifications\hooks" 2>nul
mkdir "src\modules\notifications\services" 2>nul
mkdir "src\modules\notifications\components" 2>nul

echo OK - Diretorios criados.

:: =============================================
:: PASSO 2: Copiar arquivos para nova estrutura
:: =============================================
echo.
echo [PASSO 2/6] Copiando arquivos...

:: Core
copy /Y "src\config\firebase.js" "src\core\config\firebase.js" >nul 2>&1 && echo   OK: core/config/firebase.js
copy /Y "src\domain\scoringEngine.js" "src\core\domain\scoringEngine.js" >nul 2>&1 && echo   OK: core/domain/scoringEngine.js
copy /Y "src\domain\scoringEngine.test.js" "src\core\domain\scoringEngine.test.js" >nul 2>&1 && echo   OK: core/domain/scoringEngine.test.js
copy /Y "src\domain\types.js" "src\core\domain\types.js" >nul 2>&1 && echo   OK: core/domain/types.js
copy /Y "src\lib\FirebaseAuthContext.jsx" "src\core\lib\FirebaseAuthContext.jsx" >nul 2>&1 && echo   OK: core/lib/FirebaseAuthContext.jsx
copy /Y "src\lib\logger.js" "src\core\lib\logger.js" >nul 2>&1 && echo   OK: core/lib/logger.js
copy /Y "src\lib\utils.js" "src\core\lib\utils.js" >nul 2>&1 && echo   OK: core/lib/utils.js

:: Pool
copy /Y "src\services\poolsService.js" "src\modules\pool\services\poolsService.js" >nul 2>&1 && echo   OK: pool/services/poolsService.js
copy /Y "src\hooks\usePools.js" "src\modules\pool\hooks\usePools.js" >nul 2>&1 && echo   OK: pool/hooks/usePools.js
copy /Y "src\domain\poolSettings.js" "src\modules\pool\domain\poolSettings.js" >nul 2>&1 && echo   OK: pool/domain/poolSettings.js

:: Pool components
if exist "src\components\pool\" (
    xcopy /Y /Q "src\components\pool\*.jsx" "src\modules\pool\components\" >nul 2>&1 && echo   OK: pool/components
)

:: Pool pages
copy /Y "src\pages\CreatePool.jsx" "src\modules\pool\pages\CreatePool.jsx" >nul 2>&1 && echo   OK: pool/pages/CreatePool.jsx
copy /Y "src\pages\JoinPool.jsx" "src\modules\pool\pages\JoinPool.jsx" >nul 2>&1 && echo   OK: pool/pages/JoinPool.jsx
copy /Y "src\pages\MyPools.jsx" "src\modules\pool\pages\MyPools.jsx" >nul 2>&1 && echo   OK: pool/pages/MyPools.jsx
copy /Y "src\pages\Pool.jsx" "src\modules\pool\pages\Pool.jsx" >nul 2>&1 && echo   OK: pool/pages/Pool.jsx
copy /Y "src\pages\Dashboard.jsx" "src\modules\pool\pages\Dashboard.jsx" >nul 2>&1 && echo   OK: pool/pages/Dashboard.jsx

:: Bets
copy /Y "src\services\betsService.js" "src\modules\bets\services\betsService.js" >nul 2>&1 && echo   OK: bets/services/betsService.js
copy /Y "src\hooks\useBets.js" "src\modules\bets\hooks\useBets.js" >nul 2>&1 && echo   OK: bets/hooks/useBets.js

:: Tournament
copy /Y "src\services\tournamentService.js" "src\modules\tournament\services\tournamentService.js" >nul 2>&1 && echo   OK: tournament/services/tournamentService.js
copy /Y "src\hooks\useTournament.js" "src\modules\tournament\hooks\useTournament.js" >nul 2>&1 && echo   OK: tournament/hooks/useTournament.js
if exist "src\data\" (
    xcopy /Y /Q "src\data\seed*.js" "src\modules\tournament\data\" >nul 2>&1 && echo   OK: tournament/data (seed)
)
copy /Y "src\admin\buildSeedPayload.js" "src\modules\tournament\utils\buildSeedPayload.js" >nul 2>&1 && echo   OK: tournament/utils/buildSeedPayload.js

:: Admin
copy /Y "src\services\adminService.js" "src\modules\admin\services\adminService.js" >nul 2>&1 && echo   OK: admin/services/adminService.js
copy /Y "src\hooks\usePoolCreatorAuthorization.js" "src\modules\admin\hooks\usePoolCreatorAuthorization.js" >nul 2>&1 && echo   OK: admin/hooks/usePoolCreatorAuthorization.js
if exist "src\pages\admin\" (
    xcopy /Y /Q "src\pages\admin\*.jsx" "src\modules\admin\pages\" >nul 2>&1 && echo   OK: admin/pages
)

:: Notifications
copy /Y "src\hooks\useNotifications.js" "src\modules\notifications\hooks\useNotifications.js" >nul 2>&1 && echo   OK: notifications/hooks/useNotifications.js

:: Layout (mantem no components original)

echo OK - Arquivos copiados.

:: =============================================
:: PASSO 3: Atualizar imports nos arquivos NOVOS
:: =============================================
echo.
echo [PASSO 3/6] Atualizando imports nos novos arquivos...

:: Funcao para substituir em todos os arquivos .js e .jsx da pasta src
for /r "%ROOT%src" %%f in (*.js *.jsx) do (
    set "file=%%f"
    set "changed="
    
    :: Core imports
    findstr /c:"@/config/firebase" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/lib/FirebaseAuthContext" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/lib/logger" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/lib/utils" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/domain/scoringEngine" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/domain/types" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/services/poolsService" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/hooks/usePools" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/domain/poolSettings" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/services/betsService" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/hooks/useBets" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/services/tournamentService" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/hooks/useTournament" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/data/seed" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/services/adminService" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/hooks/useNotifications" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/admin/buildSeedPayload" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/components/pool/" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/pages/CreatePool" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/pages/JoinPool" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/pages/MyPools" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/pages/Pool" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/pages/Dashboard" "%%f" >nul 2>&1 && ( set "changed=1" )
    findstr /c:"@/pages/admin/" "%%f" >nul 2>&1 && ( set "changed=1" )
    
    if defined changed (
        powershell -Command "(gc -Encoding UTF8 '%%f') -replace '@/config/firebase','@/core/config/firebase' -replace '@/lib/FirebaseAuthContext','@/core/lib/FirebaseAuthContext' -replace '@/lib/logger','@/core/lib/logger' -replace '@/lib/utils','@/core/lib/utils' -replace '@/domain/scoringEngine','@/core/domain/scoringEngine' -replace '@/domain/types','@/core/domain/types' -replace '@/services/poolsService','@/modules/pool/services/poolsService' -replace '@/hooks/usePools','@/modules/pool/hooks/usePools' -replace '@/domain/poolSettings','@/modules/pool/domain/poolSettings' -replace '@/services/betsService','@/modules/bets/services/betsService' -replace '@/hooks/useBets','@/modules/bets/hooks/useBets' -replace '@/services/tournamentService','@/modules/tournament/services/tournamentService' -replace '@/hooks/useTournament','@/modules/tournament/hooks/useTournament' -replace '@/data/seed','@/modules/tournament/data/seed' -replace '@/services/adminService','@/modules/admin/services/adminService' -replace '@/hooks/usePoolCreatorAuthorization','@/modules/admin/hooks/usePoolCreatorAuthorization' -replace '@/hooks/useNotifications','@/modules/notifications/hooks/useNotifications' -replace '@/admin/buildSeedPayload','@/modules/tournament/utils/buildSeedPayload' -replace '@/components/pool/','@/modules/pool/components/' -replace '@/pages/CreatePool','@/modules/pool/pages/CreatePool' -replace '@/pages/JoinPool','@/modules/pool/pages/JoinPool' -replace '@/pages/MyPools','@/modules/pool/pages/MyPools' -replace '@/pages/Pool','@/modules/pool/pages/Pool' -replace '@/pages/Dashboard','@/modules/pool/pages/Dashboard' -replace '@/pages/admin/','@/modules/admin/pages/' | Set-Content '%%f' -Encoding UTF8" >nul 2>&1
        echo   UPDATED: %%~nxf
    )
)

echo OK - Imports atualizados.

:: =============================================
:: PASSO 4: Atualizar configuracoes
:: =============================================
echo.
echo [PASSO 4/6] Atualizando configuracoes...

:: Atualizar vite.config.js
(
    echo import react from '@vitejs/plugin-react';
    echo import { defineConfig } from 'vite';
    echo import path from 'node:path';
    echo.
    echo export default defineConfig({
    echo   plugins: [react()],
    echo   resolve: {
    echo     alias: {
    echo       '@': path.resolve(__dirname, './src'),
    echo       '@core': path.resolve(__dirname, './src/core'),
    echo       '@modules': path.resolve(__dirname, './src/modules'),
    echo     },
    echo   },
    echo   test: {
    echo     environment: 'jsdom',
    echo     globals: true,
    echo     include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    echo   },
    echo });
) > "%ROOT%vite.config.js"
echo   OK: vite.config.js

:: Atualizar jsconfig.json
(
    echo {
    echo   "compilerOptions": {
    echo     "target": "ES2022",
    echo     "module": "ESNext",
    echo     "moduleResolution": "Bundler",
    echo     "jsx": "preserve",
    echo     "allowJs": true,
    echo     "checkJs": false,
    echo     "strict": false,
    echo     "esModuleInterop": true,
    echo     "skipLibCheck": true,
    echo     "resolveJsonModule": true,
    echo     "isolatedModules": true,
    echo     "baseUrl": ".",
    echo     "paths": {
    echo       "@/*": ["./src/*"],
    echo       "@core/*": ["./src/core/*"],
    echo       "@modules/*": ["./src/modules/*"]
    echo     }
    echo   },
    echo   "include": ["src/**/*", "vite.config.js"],
    echo   "exclude": ["node_modules", "dist", "functions"]
    echo }
) > "%ROOT%jsconfig.json"
echo   OK: jsconfig.json

echo OK - Configuracoes atualizadas.

:: =============================================
:: PASSO 5: Limpar arquivos antigos
:: =============================================
echo.
echo [PASSO 5/6] Removendo arquivos antigos duplicados...

del /Q "%ROOT%src\config\firebase.js" >nul 2>&1 && echo   REMOVIDO: src/config/firebase.js
del /Q "%ROOT%src\lib\FirebaseAuthContext.jsx" >nul 2>&1 && echo   REMOVIDO: src/lib/FirebaseAuthContext.jsx
del /Q "%ROOT%src\lib\logger.js" >nul 2>&1 && echo   REMOVIDO: src/lib/logger.js
del /Q "%ROOT%src\lib\utils.js" >nul 2>&1 && echo   REMOVIDO: src/lib/utils.js
del /Q "%ROOT%src\domain\scoringEngine.js" >nul 2>&1 && echo   REMOVIDO: src/domain/scoringEngine.js
del /Q "%ROOT%src\domain\scoringEngine.test.js" >nul 2>&1 && echo   REMOVIDO: src/domain/scoringEngine.test.js
del /Q "%ROOT%src\domain\types.js" >nul 2>&1 && echo   REMOVIDO: src/domain/types.js
del /Q "%ROOT%src\domain\poolSettings.js" >nul 2>&1 && echo   REMOVIDO: src/domain/poolSettings.js
del /Q "%ROOT%src\services\poolsService.js" >nul 2>&1 && echo   REMOVIDO: src/services/poolsService.js
del /Q "%ROOT%src\services\betsService.js" >nul 2>&1 && echo   REMOVIDO: src/services/betsService.js
del /Q "%ROOT%src\services\tournamentService.js" >nul 2>&1 && echo   REMOVIDO: src/services/tournamentService.js
del /Q "%ROOT%src\services\adminService.js" >nul 2>&1 && echo   REMOVIDO: src/services/adminService.js
del /Q "%ROOT%src\hooks\usePools.js" >nul 2>&1 && echo   REMOVIDO: src/hooks/usePools.js
del /Q "%ROOT%src\hooks\useBets.js" >nul 2>&1 && echo   REMOVIDO: src/hooks/useBets.js
del /Q "%ROOT%src\hooks\useTournament.js" >nul 2>&1 && echo   REMOVIDO: src/hooks/useTournament.js
del /Q "%ROOT%src\hooks\useNotifications.js" >nul 2>&1 && echo   REMOVIDO: src/hooks/useNotifications.js
del /Q "%ROOT%src\hooks\usePoolCreatorAuthorization.js" >nul 2>&1 && echo   REMOVIDO: src/hooks/usePoolCreatorAuthorization.js
del /Q "%ROOT%src\admin\buildSeedPayload.js" >nul 2>&1 && echo   REMOVIDO: src/admin/buildSeedPayload.js

:: Remover subpastas vazias (opcional)
rmdir /Q "%ROOT%src\config" >nul 2>&1
rmdir /Q "%ROOT%src\lib" >nul 2>&1
rmdir /Q "%ROOT%src\domain" >nul 2>&1
rmdir /Q "%ROOT%src\services" >nul 2>&1
rmdir /Q "%ROOT%src\hooks" >nul 2>&1
rmdir /Q "%ROOT%src\data" >nul 2>&1
rmdir /Q "%ROOT%src\admin" >nul 2>&1
rmdir /Q "%ROOT%src\components\pool" >nul 2>&1
rmdir /Q "%ROOT%src\pages\admin" >nul 2>&1

echo OK - Arquivos antigos removidos.

:: =============================================
:: PASSO 6: Verificacao final
:: =============================================
echo.
echo [PASSO 6/6] Verificando estrutura final...

if exist "%ROOT%src\core\config\firebase.js" ( echo   [OK] core/config/firebase.js ) else ( echo   [FALHA] core/config/firebase.js )
if exist "%ROOT%src\core\domain\scoringEngine.js" ( echo   [OK] core/domain/scoringEngine.js ) else ( echo   [FALHA] core/domain/scoringEngine.js )
if exist "%ROOT%src\core\lib\FirebaseAuthContext.jsx" ( echo   [OK] core/lib/FirebaseAuthContext.jsx ) else ( echo   [FALHA] core/lib/FirebaseAuthContext.jsx )
if exist "%ROOT%src\modules\pool\services\poolsService.js" ( echo   [OK] modules/pool/services/poolsService.js ) else ( echo   [FALHA] modules/pool/services/poolsService.js )
if exist "%ROOT%src\modules\bets\services\betsService.js" ( echo   [OK] modules/bets/services/betsService.js ) else ( echo   [FALHA] modules/bets/services/betsService.js )
if exist "%ROOT%src\modules\tournament\services\tournamentService.js" ( echo   [OK] modules/tournament/services/tournamentService.js ) else ( echo   [FALHA] modules/tournament/services/tournamentService.js )
if exist "%ROOT%src\modules\admin\services\adminService.js" ( echo   [OK] modules/admin/services/adminService.js ) else ( echo   [FALHA] modules/admin/services/adminService.js )

echo.
echo ============================================
echo   MIGRACAO CONCLUIDA!
echo ============================================
echo.
echo Agora execute os comandos abaixo no terminal:
echo.
echo   npm run build
echo   npm run test
echo.
echo Se tudo passar, faca o commit e deploy:
echo.
echo   git add -A
echo   git commit -m "feat: reestruturacao completa - core + modulos + database bolao2026"
echo   git push origin main
echo   npm run deploy:firebase
echo.
pause
