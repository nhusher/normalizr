import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

import pkg from './package.json' assert { type: 'json' };

const name = pkg.name;
const isProduction = process.env.NODE_ENV === 'production';

const destBase = 'dist/normalizr';
const destExtension = `${isProduction ? '.min' : ''}.js`;

export default {
  input: 'src/index.js',
  output: [
    { file: `${destBase}${destExtension}`, format: 'cjs' },
    { file: `${destBase}.es${destExtension}`, format: 'es' },
    { file: `${destBase}.umd${destExtension}`, format: 'umd', name },
    { file: `${destBase}.amd${destExtension}`, format: 'amd', name },
    { file: `${destBase}.browser${destExtension}`, format: 'iife', name },
  ],
  plugins: [babel({ babelHelpers: 'bundled' }), isProduction && terser()].filter(Boolean),
};
