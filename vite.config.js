import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            const normalizedId = id.replace(/\\/g, '/');
            if (
              normalizedId.includes('/react-router/')
              || normalizedId.includes('/react-router-dom/')
              || normalizedId.includes('/@tanstack/react-query/')
            ) return 'vendor-routing-data';
            if (
              normalizedId.includes('/@radix-ui/')
              || normalizedId.includes('/lucide-react/')
              || normalizedId.includes('/sonner/')
              || normalizedId.includes('/class-variance-authority/')
              || normalizedId.includes('/clsx/')
              || normalizedId.includes('/tailwind-merge/')
              || normalizedId.includes('/tailwindcss-animate/')
            ) return 'vendor-ui';
            if (
              normalizedId.includes('/react-markdown/')
              || normalizedId.includes('/remark-gfm/')
            ) return 'vendor-markdown';
            // Libs do card de compartilhamento (flag share_cards): isoladas em um
            // chunk próprio para só carregarem sob demanda ao abrir o card.
            if (
              normalizedId.includes('/html-to-image/')
              || normalizedId.includes('/qrcode/')
              || normalizedId.includes('/dijkstrajs/')
              || normalizedId.includes('/encode-utf8/')
              || normalizedId.includes('/pngjs/')
            ) return 'vendor-sharing';
            if (normalizedId.includes('@firebase/firestore') || normalizedId.includes('/firebase/firestore')) return 'vendor-firebase-firestore';
            if (normalizedId.includes('@firebase/auth') || normalizedId.includes('/firebase/auth')) return 'vendor-firebase-auth';
            if (normalizedId.includes('@firebase/functions') || normalizedId.includes('/firebase/functions')) return 'vendor-firebase-functions';
            if (normalizedId.includes('@firebase') || normalizedId.includes('/firebase/')) return 'vendor-firebase-core';
            return 'vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@core': path.resolve(__dirname, './src/core'),
        '@modules': path.resolve(__dirname, './src/modules'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      // `functions/` entra porque as Cloud Functions escrevem no banco — a
      // lógica pura delas (ex.: montagem do ranking sazonal) merece o mesmo
      // rigor do resto. Só os arquivos de teste; o deploy segue intocado.
      include: [
        'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
        'functions/**/*.{test,spec}.js',
      ],
      // Robustez de CI: limites explícitos para um teste/hook travado abortar
      // rápido (com mensagem clara) em vez de pendurar o processo. Um pouco
      // mais folgados que o padrão para tolerar a CPU mais lenta do runner.
      testTimeout: 20000,
      hookTimeout: 20000,
      teardownTimeout: 20000,
      // Uma re-tentativa na CI absorve contenção real de CPU do runner. Duas
      // já começam a esconder teste genuinamente instável — que é bug, não
      // ruído. Localmente fica 0 para expor qualquer instabilidade na hora.
      retry: process.env.CI ? 1 : 0,
    },
  };
});
