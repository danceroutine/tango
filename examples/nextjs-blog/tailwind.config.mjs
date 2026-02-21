import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
const config = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    theme: {
        extend: {
            typography: {
                DEFAULT: {
                    css: {
                        maxWidth: 'none',
                    },
                },
            },
        },
    },
    plugins: [typography],
};

export default config;
