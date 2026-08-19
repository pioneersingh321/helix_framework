import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isMin = mode === 'min';
  const env = loadEnv(mode, resolve(__dirname, '../../'), '');
  const version = env.VITE_CORE_VERSION || '11.1.20';

  return {
    envDir: '../../',
    define: {
      '__CORE_VERSION__': JSON.stringify(version)
    },
    build: {
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'Helix',
        formats: ['iife'],
        fileName: () => isMin ? 'helix.min.js' : 'helix.js'
      },
      minify: isMin ? 'esbuild' : false,
      emptyOutDir: false,
      rollupOptions: {
        output: {
          extend: true,
          exports: 'named'
        }
      }
    }
  };
});
