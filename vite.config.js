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