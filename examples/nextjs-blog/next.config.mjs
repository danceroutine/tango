/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        externalDir: true,
    },
    transpilePackages: [
        '@danceroutine/tango-adapters-next',
        '@danceroutine/tango-config',
        '@danceroutine/tango-core',
        '@danceroutine/tango-migrations',
        '@danceroutine/tango-openapi',
        '@danceroutine/tango-orm',
        '@danceroutine/tango-resources',
        '@danceroutine/tango-schema',
    ],
    // Required for native package dependencies in server components.
    serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
