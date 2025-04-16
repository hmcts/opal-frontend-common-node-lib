// eslint.config.js
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // Recommended base config (no type-checking rules)
  ...tseslint.configs.recommended,

  // You can add stricter type-checking rules later:
  // ...tseslint.configs['recommended-requiring-type-checking'],

  {
    files: ['**/*.ts'],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
];
