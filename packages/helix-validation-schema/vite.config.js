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
        name: 'HelixValidationSchemaPlugin',
        formats: ['iife'],
        fileName: () => isMin ? 'helix-validation-schema.min.js' : 'helix-validation-schema.js'
      },
      minify: isMin ? 'esbuild' : false,
      emptyOutDir: !isMin,
      rollupOptions: {
        output: {
          extend: true,
          exports: 'named'
        }
      }
    }
  };
});
