import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'HistoryGPT',
  description: 'Restricted research assistant for credible sources.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f19] text-white">
        <div className="min-h-screen flex">
          {/* Sidebar */}
          <aside className="w-[280px] hidden md:flex flex-col border-r border-white/10 bg-[#0a0e17]">
            <div className="p-4">
              <Link
                href="/"
                className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
              >
                + New chat
              </Link>
            </div>

            <div className="px-4 pb-4">
              <div className="text-xs text-white/60 mb-2">PROJECT</div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="font-semibold">HistoryGPT</div>
                <div className="text-sm text-white/60">
                  Research-only. No essay writing.
                </div>
              </div>
            </div>

            <div className="mt-auto p-4 text-xs text-white/50">
              Powered by OpenAI + scholarly databases
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
