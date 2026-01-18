'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PublicNavbar from '@/components/PublicNavbar';

interface Cemetery {
  id: number;
  name: string;
  address?: string;
  city?: string;
  description?: string;
}

export default function HomePage() {
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchCemeteries();
  }, []);

  const fetchCemeteries = async () => {
    try {
      const response = await fetch('/api/cemeteries');
      const data = await response.json();
      setCemeteries(data.cemeteries || []);
    } catch (error) {
      console.error('Error fetching cemeteries:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar />
      
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
            Find Your Loved Ones
          </h1>
          <p className="text-base sm:text-lg text-gray-700 px-4 font-medium">
            Search and locate graves across our cemeteries with interactive maps and GPS navigation
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">Loading cemeteries...</div>
          </div>
        ) : cemeteries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No cemeteries available at this time.</p>
          </div>
        ) : (
          <div className="rounded-xl p-4 sm:p-6 shadow-md" style={{ background: 'linear-gradient(to right, rgb(37, 99, 235), rgb(29, 78, 216))' }}>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Available Cemeteries</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cemeteries.map((cemetery) => (
              <div
                key={cemetery.id}
                onClick={() => router.push(`/${cemetery.id}`)}
                className="bg-white rounded-xl shadow-md hover:shadow-xl active:scale-98 transition-all cursor-pointer overflow-hidden touch-manipulation"
              >
                <div className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                    {cemetery.name}
                  </h3>
                  {cemetery.address && (
                    <p className="text-sm text-gray-700 mb-1 font-medium">
                      {cemetery.address}
                      {cemetery.city && `, ${cemetery.city}`}
                    </p>
                  )}
                  {cemetery.description && (
                    <p className="text-sm text-gray-600 mt-3 line-clamp-2">
                      {cemetery.description}
                    </p>
                  )}
                  <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg font-bold text-base transition-colors touch-manipulation shadow-sm">
                    Open Locator
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        <div className="mt-8 sm:mt-12 rounded-xl p-4 sm:p-6 shadow-lg" style={{ background: 'linear-gradient(to bottom right, rgb(22, 163, 74), rgb(21, 128, 61))' }}>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">How to Use</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-4 sm:p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold mb-1 text-base sm:text-lg text-gray-900">Search</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Enter the name of your loved one to find their grave location
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold mb-1 text-base sm:text-lg text-gray-900">Locate</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    View the exact plot location on an interactive cemetery map
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 sm:p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold mb-1 text-base sm:text-lg text-gray-900">Navigate</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Get turn-by-turn GPS directions from your current location
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
