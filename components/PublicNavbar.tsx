'use client';

import { useRouter, usePathname } from 'next/navigation';

export default function PublicNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  return (
    <>
      {/* Minimal Mobile App Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg sticky top-0 z-50 backdrop-blur-lg">
        <div className="flex items-center justify-between px-4 h-14 sm:h-16">
          {!isHomePage && (
            <button 
              onClick={() => router.back()}
              className="text-white hover:bg-white/10 active:bg-white/20 p-2 rounded-lg transition-colors touch-manipulation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className={`text-white font-bold text-lg sm:text-xl ${isHomePage ? 'mx-auto' : 'flex-1 text-center'}`}>
            Cemetery Locator
          </h1>
          {!isHomePage && <div className="w-10"></div>}
        </div>
      </header>

      {/* Bottom Navigation Bar for Mobile App Feel */}
      {isHomePage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 sm:hidden safe-area-bottom">
          <div className="grid grid-cols-3 h-16">
            <button className="flex flex-col items-center justify-center text-blue-600">
              <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              <span className="text-xs font-medium">Home</span>
            </button>
            <button className="flex flex-col items-center justify-center text-gray-400">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs font-medium">Search</span>
            </button>
            <button className="flex flex-col items-center justify-center text-gray-400">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-medium">Profile</span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
