import { build } from 'esbuild';
// Expo's module:preserve output is for Metro, not the Node serverless runtime.
// Bundle local server imports into an explicit CommonJS function; npm packages stay external.
await build({
  entryPoints: ['lib/server/auth/requestEmailCodeRoute.ts'],
  outfile: 'api/auth/request-email-code.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
  sourcemap: false,
  footer: { js: 'module.exports = module.exports.default;' },
});
