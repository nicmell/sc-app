import path from 'node:path';

import { defineConfig } from 'vitest/config';

const serverCommandsPkg = path.resolve(
  __dirname,
  'packages/server-commands/src',
);
const synthdefCompilerPkg = path.resolve(
  __dirname,
  'packages/synthdef-compiler/src',
);

// Mirrors `vite.config.ts`'s alias surface. Kept separate from the
// app config because vitest doesn't need the React plugin or the
// dev-server proxy block. Only `src/**/*.test.ts` is picked up;
// the workspace-package vitest configs (synthdef-compiler) run
// independently from inside their own folders.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
      {
        find: /^@sc-app\/server-commands$/,
        replacement: `${serverCommandsPkg}/index.ts`,
      },
      {
        find: /^@sc-app\/synthdef-compiler$/,
        replacement: `${synthdefCompilerPkg}/index.ts`,
      },
    ],
  },
});
