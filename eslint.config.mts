import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import oxlint from 'eslint-plugin-oxlint';
import prettier from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['**/dist/**', '**/coverage/**', '**/.next/**', '**/.temp/**', '**/docs/.vitepress/cache/**']),
    {
        extends: [js.configs.recommended, tseslint.configs.recommended, oxlint.configs['flat/recommended'], prettier],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/prefer-enum-initializers': 'error',
            'no-restricted-syntax': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'eslint-plugin-unicorn/explicit-length-check': 'off',
            '@typescript-eslint/member-ordering': [
                'error',
                {
                    default: [
                        // Static properties
                        'public-static-field',
                        'protected-static-field',
                        'private-static-field',

                        // Instance properties
                        'public-instance-field',
                        'protected-instance-field',
                        'private-instance-field',

                        // Constructor
                        'constructor',

                        // Static methods
                        'public-static-method',
                        'protected-static-method',
                        'private-static-method',

                        // Instance methods
                        'public-instance-method',
                        'protected-instance-method',
                        'private-instance-method',
                    ],
                },
            ],
        },
    },
    {
        files: ['**/next-env.d.ts'],
        rules: {
            '@typescript-eslint/triple-slash-reference': 'off',
        },
    },
    {
        files: ['**/*.test.ts'],
        rules: {
            'no-restricted-syntax': 'off',
        },
    },
]);
