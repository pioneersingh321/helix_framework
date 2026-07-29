import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isMin = mode === 'min';
  return {
    envDir: '../../',
    build: {
      outDir: 'dist',
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'HelixLoaderPlugin',
        formats: ['iife'],
        fileName: () => isMin ? 'helix-loader.min.js' : 'helix-loader.js'
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
