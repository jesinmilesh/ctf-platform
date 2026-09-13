'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopNav() {
  const pathname = usePathname();

  const tabs = [
    { name: 'Overview', path: '/dashboard/overview' },
    { name: 'Track', path: '/dashboard/track' },
    { name: 'Team', path: '/dashboard/team' },
    { name: 'Progress', path: '/dashboard/progress' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo area */}
            <div className="flex-shrink-0 flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center text-white font-bold">H</div>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 leading-tight">Terrier</span>
                <span className="text-xs text-gray-500">Cyber Quest 2026</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
              {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.path);
                return (
                  <Link
                    key={tab.name}
                    href={tab.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? 'border-indigo-600 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {tab.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side area */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Event Ended</span>
              <span className="font-mono text-sm font-bold bg-gray-50 px-2 py-1 rounded border">00:00:00:000</span>
            </div>
            
            <button className="p-2 text-gray-400 hover:text-gray-500 border rounded-full">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </button>
            
            <button className="p-2 text-gray-400 hover:text-gray-500 border rounded-full">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            
            <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full font-bold text-sm">
              10241CyberPunishers
            </div>
            
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              A
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
