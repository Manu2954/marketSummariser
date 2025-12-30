import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'market-summary-ui',
  description: 'Market summary dashboard UI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-display">
        <div className="min-h-screen px-6 py-8 md:px-10">
          {children}
        </div>
      </body>
    </html>
  );
}
