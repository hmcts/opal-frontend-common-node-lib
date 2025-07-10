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
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'private-static-field',
            'protected-static-field',
            'public-static-field',
            'private-instance-field',
            'protected-instance-field',
            'public-instance-field',
            'constructor',
            'private-static-method',
            'protected-static-method',
            'public-static-method',
            'private-instance-method',
            'protected-instance-method',
            'public-instance-method',
          ],
        },
      ],
    },
  },
];
