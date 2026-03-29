/** @type {import('next').NextConfig} */
const nextConfig = {
    // Required for workspace/native package dependencies in server components.
    serverExternalPackages: ['@danceroutine/tango-orm', 'better-sqlite3'],
};

export default nextConfig;
