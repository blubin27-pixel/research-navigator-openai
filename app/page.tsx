'use client';

import Link from 'next/link';

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-10 px-4">
      <h1 className="text-4xl font-bold mb-4">Welcome to SchoolSafeAI</h1>
      <p className="text-lg text-white/80 mb-6 max-w-2xl text-center">
        Your safe, research and planning assistant for students and researchers. Get credible, free sources and organized study plans without worry.
      </p>
      <div className="flex flex-col md:flex-row gap-4">
        <Link href="/history" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-center">
          Start your first search
        </Link>
        <Link href="/planner" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-center">
          Create a plan
        </Link>
      </div>
    </div>
  );
}
