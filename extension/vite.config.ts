import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

/**
 * Tailwind v4 dentro de shadow DOM (mesma correção do BuildChat): as utilities
 * leem variáveis `--tw-*` cujo valor inicial vem de `@property`, que a spec
 * IGNORA dentro de uma shadow tree. Sem isso `.border` fica invisível e
 * `shadow-*` some. Repetimos os valores iniciais como variáveis comuns.
 */
function valoresIniciaisDoTailwind(): Plugin {
  return {
    name: 'ax-tw-property-fallback',
    apply: 'build',
    generateBundle(_o, pacote) {
      for (const arquivo of Object.values(pacote)) {
        if (arquivo.type !== 'asset' || !arquivo.fileName.endsWith('.css')) continue;
        const css = String(arquivo.source);
        const iniciais = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)]
          .map(([, nome, corpo]) => {
            const valor = /initial-value:\s*([^;]+);/.exec(corpo)?.[1]?.trim();
            return valor ? `    ${nome}: ${valor};` : null;
          })
          .filter(Boolean);
        if (iniciais.length === 0) continue;
        arquivo.source =
          `${css}\n/* Valores iniciais das variáveis do Tailwind (shadow DOM) */\n` +
          `@layer base {\n  .bc-root, .bc-root * {\n${iniciais.join('\n')}\n  }\n}\n`;
      }
    },
  };
}

// Duas entradas (mesma técnica do BuildChat):
//  - content   -> módulo ES carregado por public/content-loader.js (mundo ISOLATED)
//  - wa-bridge -> roda no contexto da PÁGINA (mundo MAIN) e fala com o WPP
// As variáveis VITE_SUPABASE_* vêm do .env.local do Advox (pasta acima).
export default defineConfig({
  plugins: [react(), tailwindcss(), valoresIniciaisDoTailwind()],
  envDir: path.resolve(__dirname, '..'),
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, 'src/content/main.tsx'),
        'wa-bridge': path.resolve(__dirname, 'src/page/wa-bridge.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
