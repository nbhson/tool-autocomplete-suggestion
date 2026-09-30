import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const banner = `/*!
 * SAutocomplete Suggestion v${pkg.version}
 * A lightweight, dependency-free grouped autocomplete suggestion input
 * MIT License
 */`;

export default [
  // Build CSS
  {
    input: 'src/styles.css',
    output: {
      file: 'dist/styles.css',
    },
    plugins: [
      postcss({
        extract: 'styles.css',
        minimize: true,
      }),
    ],
  },
  // Build UMD and ESM bundles (dependency-free, no externals)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/sautocomplete-suggestion.umd.js',
        format: 'umd',
        name: 'SAutocomplete',
        exports: 'named',
        banner,
        sourcemap: true,
      },
      {
        file: 'dist/sautocomplete-suggestion.esm.js',
        format: 'es',
        exports: 'named',
        banner,
        sourcemap: true,
      },
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        sourceMap: true,
      }),
      terser(),
    ],
  },
  // Build type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/types/index.d.ts',
      format: 'es',
    },
    plugins: [
      dts({
        respectNone: false,
      }),
    ],
  },
];
