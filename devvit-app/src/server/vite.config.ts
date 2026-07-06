import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: path.resolve(__dirname, 'index.ts'),
    outDir: path.resolve(__dirname, '../../dist/server'),
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: [...builtinModules],
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
      },
    },
  },
});
