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
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    },
  };
});