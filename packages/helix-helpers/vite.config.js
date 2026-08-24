import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

const rootEnvPath = resolve(__dirname, '../../.env');
const hasMonorepoEnv = fs.existsSync(rootEnvPath);

export default defineConfig(({ mode }) => {
  const isMin = mode === 'min';
  return {
    envDir: hasMonorepoEnv ? '../../' : './',
    build: {
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'HelixHelpersPlugin',
        formats: ['iife'],
        fileName: () => isMin ? 'helix-helpers.min.js' : 'helix-helpers.js'
      },
      minify: isMin ? 'esbuild' : false,
      emptyOutDir: !isMin,
      rollupOptions: {
        output: {
          exports: 'named',
          extend: true
        }
      }
    }
  };
});
