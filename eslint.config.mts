import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import oxlint from 'eslint-plugin-oxlint';
import prettier from 'eslint-plugin-prettier/recommended';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores(['dist', 'coverage',]),
    {
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            oxlint.configs['flat/recommended'],
            prettier,
        ],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/member-ordering': [
                'error',
                {
                    default: [
                        // Properties
                        'private-instance-field',
                        'protected-instance-field',
                        'public-instance-field',

                        // Constructor
                        'constructor',

                        // Public methods
                        'public-instance-method',

                        // Private methods
                        'private-instance-method',
                        'protected-instance-method',
                    ],
                },
            ],
        },
    },
]);