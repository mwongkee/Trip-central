import { build } from 'esbuild';

/**
 * Bundle the Lambda handler into a single ESM file for packaging by Terraform
 * (infra/lambda.tf zips services/api/dist). The AWS SDK v3 is provided by the
 * Node 20 runtime, so it's marked external and not bundled.
 */
await build({
  entryPoints: ['src/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'es2022',
  format: 'esm',
  minify: true,
  outfile: 'lambda-build/handler.mjs',
  external: ['@aws-sdk/*'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

// eslint-disable-next-line no-console
console.log('bundled services/api → lambda-build/handler.mjs');
