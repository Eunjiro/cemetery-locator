'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PublicNavbar from '@/components/PublicNavbar';

interface SearchHistoryItem {
  id: string;
  name: string;
  cemeteryName: string;
  searchedAt: string;
}

interface Bookmark {
  id: string;
  deceased_id?: string;
  plot_id?: number;
  name: string;
  cemeteryId: string;
  cemeteryName: string;
  addedAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'history' | 'bookmarks'>('history');
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    // Load search history from localStorage
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }

    // Load bookmarks from localStorage
    const savedBookmarks = localStorage.getItem('bookmarks');
    if (savedBookmarks) {
      setBookmarks(JSON.parse(savedBookmarks));
    }
  }, []);

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all search history?')) {
      localStorage.removeItem('searchHistory');
      setSearchHistory([]);
    }
  };

  const removeHistoryItem = (id: string) => {
    const updated = searchHistory.filter(item => item.id !== id);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
    setSearchHistory(updated);
  };

  const removeBookmark = (id: string) => {
    const updated = bookmarks.filter(item => item.id !== id);
    localStorage.setItem('bookmarks', JSON.stringify(updated));
    setBookmarks(updated);
  };

  const clearAllBookmarks = () => {
    if (confirm('Are you sure you want to remove all bookmarks?')) {
      localStorage.removeItem('bookmarks');
      setBookmarks([]);
    }
  };

  return (
    <>
      <PublicNavbar />
      
      <div className="min-h-screen bg-gray-50 pb-20 sm:pb-6">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-6 mb-6 shadow-lg">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4 text-white">
                <h1 className="text-2xl font-bold">My Profile</h1>
                <p className="text-green-100 text-sm mt-1">Your saved searches and bookmarks</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-md mb-4 p-1 flex gap-1">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all touch-manipulation ${
                activeTab === 'history'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>History</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all touch-manipulation ${
                activeTab === 'bookmarks'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>Bookmarks</span>
              </div>
            </button>
          </div>

          {/* Search History Tab */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Search History</h2>
                {searchHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-red-600 hover:text-red-700 text-sm font-medium touch-manipulation"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {searchHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No search history yet</p>
                  <p className="text-xs text-gray-400 mt-1">Your recent searches will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {searchHistory.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => router.push(`/${item.id}`)}
                          className="flex-1 text-left touch-manipulation"
                        >
                          <h3 className="font-medium text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{item.cemeteryName}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(item.searchedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </button>
                        <button
                          onClick={() => removeHistoryItem(item.id)}
                          className="ml-2 p-2 text-gray-400 hover:text-red-600 transition-colors touch-manipulation"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bookmarks Tab */}
          {activeTab === 'bookmarks' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Saved Bookmarks</h2>
                {bookmarks.length > 0 && (
                  <button
                    onClick={clearAllBookmarks}
                    className="text-red-600 hover:text-red-700 text-sm font-medium touch-manipulation"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {bookmarks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <p className="text-sm">No bookmarks saved yet</p>
                  <p className="text-xs text-gray-400 mt-1">Bookmark graves to find them quickly later</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {bookmarks.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => router.push(`/${item.cemeteryId}?deceased_id=${item.deceased_id || item.id}`)}
                          className="flex-1 text-left touch-manipulation"
                        >
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            <div>
                              <h3 className="font-medium text-gray-900">{item.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{item.cemeteryName}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                Saved on {new Date(item.addedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => removeBookmark(item.id)}
                          className="ml-2 p-2 text-gray-400 hover:text-red-600 transition-colors touch-manipulation"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Storage Info */}
          <div className="mt-6 bg-green-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-green-800 font-medium">Data Stored Locally</p>
                <p className="text-xs text-green-700 mt-1">
                  All your search history and bookmarks are saved only on this device. They won't sync to other devices or servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation (from PublicNavbar) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 sm:hidden safe-area-bottom">
        <div className="grid grid-cols-3 h-16">
          <button 
            onClick={() => router.push('/')}
            className="flex flex-col items-center justify-center text-gray-400"
          >
            <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span className="text-xs font-medium">Home</span>
          </button>
          <button 
            onClick={() => router.push('/#cemeteries')}
            className="flex flex-col items-center justify-center text-gray-400"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs font-medium">Search</span>
          </button>
          <button className="flex flex-col items-center justify-center text-green-600">
            <svg className="w-6 h-6 mb-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
}
