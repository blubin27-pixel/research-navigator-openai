import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Research Navigator',
  description: 'Find sources and plan your research projects.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
