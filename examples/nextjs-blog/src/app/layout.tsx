import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Tango Blog',
    description: 'A blog built with Tango and Next.js',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased">{children}</body>
        </html>
    );
}
