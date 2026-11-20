import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await cp('public', 'dist', { recursive: true });
await build({
  entryPoints: ['src/worker.ts', 'src/settings.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome121',
  legalComments: 'none',
});
