import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = {
  title: ''SchoolSafeAI'',
    description: 'SchoolSafeAI: research and planning assistant for students with credible sources.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f19] text-white">
        <div className="min-h-screen flex">
           <div className="p-4">
          <Link href="/" className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition">
            Home
          </Link>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <div className="text-xs text-white/60 mb-2">SECTIONS</div>
          <Link href="/history" className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition">
            History
          </Link>
          <Link href="/planner" className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition">
            Planner
          </Link>
        </div>
        <div className="mt-auto p-4 text-xs text-white/50">
          Powered by OpenAI • SchoolSafeAI
        </div>
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
