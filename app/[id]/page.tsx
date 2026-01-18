'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/PublicNavbar';
import { getDirections, formatDistance, formatDuration, Route } from '@/lib/openrouteservice';

const GraveLocatorMap = dynamic(() => import('@/components/GraveLocatorMap'), { ssr: false });

interface Cemetery {
  id: number;
  name: string;
  map_coordinates: [number, number][];
  latitude: number;
  longitude: number;
}

interface Plot {
  id: number;
  plot_number: string;
  status: string;
  plot_type: string;
  map_coordinates: { x: number; y: number } | [number, number][];
  cemetery_id: number;
  latitude?: number;
  longitude?: number;
}

export default function GraveLocatorPage() {
  const params = useParams();
  const router = useRouter();
  const cemeteryId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [cemetery, setCemetery] = useState<Cemetery | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [highlightedPlotId, setHighlightedPlotId] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeInfo, setRouteInfo] = useState<Route | null>(null);
  const [showDirections, setShowDirections] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'foot-walking' | 'driving-car' | 'cycling-regular'>('foot-walking');
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [centerCoordinates, setCenterCoordinates] = useState<[number, number] | null>(null);

  useEffect(() => {
    fetchCemeteryData();
    fetchPlots();
    // Automatically request location on page load for mobile experience
    // Use a small delay to ensure page is fully loaded
    const timer = setTimeout(() => {
      requestLocation();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [cemeteryId]);

  // Watch for navigation mode changes and recalculate route if one exists
  useEffect(() => {
    if (showDirections && selectedResult && userLocation) {
      const plot = plots.find(p => p.id === selectedResult.plot_id);
      if (plot) {
        let targetCoords: [number, number] | null = null;

        if (plot.latitude && plot.longitude) {
          targetCoords = [plot.latitude, plot.longitude];
        } else if (plot.map_coordinates) {
          if (Array.isArray(plot.map_coordinates) && plot.map_coordinates.length > 0) {
            const coords = plot.map_coordinates[0];
            if (Array.isArray(coords) && coords.length === 2) {
              targetCoords = [coords[0], coords[1]];
            }
          } else if (typeof plot.map_coordinates === 'object' && 'x' in plot.map_coordinates && 'y' in plot.map_coordinates) {
            targetCoords = [plot.map_coordinates.x, plot.map_coordinates.y];
          }
        }

        if (targetCoords) {
          handleGetDirections(targetCoords);
        }
      }
    }
  }, [navigationMode]);

  // Auto-search as user types with debouncing
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [searchQuery, cemeteryId]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    // Check if we're on a secure origin (HTTPS or localhost)
    const isSecureContext = window.isSecureContext;
    const hostname = window.location.hostname;

    // Mobile browsers require HTTPS for geolocation (except localhost)
    if (!isSecureContext && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      setLocationError('HTTPS_REQUIRED');
      return;
    }

    // Use watchPosition for real-time GPS tracking
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setLocationError(null);
      },
      (error) => {
        
        let errorMessage = '';
        
        if (error.code === 1) {
          // Check if it's due to insecure origin
          if (error.message && error.message.toLowerCase().includes('secure')) {
            errorMessage = 'HTTPS_REQUIRED';
          } else {
            errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
          }
        } else if (error.code === 2) {
          errorMessage = 'Location unavailable. Please check your device settings.';
        } else if (error.code === 3) {
          errorMessage = 'Location request timed out. Please try again.';
        } else {
          errorMessage = 'Unable to get your location. Please try again.';
        }
        
        setLocationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
    // Return cleanup function to stop watching position
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };  };

  const fetchCemeteryData = async () => {
    try {
      const response = await fetch(`/api/cemeteries/${cemeteryId}`);
      const data = await response.json();
      setCemetery(data.cemetery);
      
      // Calculate and set the center of the cemetery for initial map view
      if (data.cemetery?.map_coordinates && data.cemetery.map_coordinates.length > 0) {
        const coords = data.cemetery.map_coordinates;
        const latSum = coords.reduce((sum: number, [lat]: [number, number]) => sum + lat, 0);
        const lngSum = coords.reduce((sum: number, [, lng]: [number, number]) => sum + lng, 0);
        const centerLat = latSum / coords.length;
        const centerLng = lngSum / coords.length;
        setCenterCoordinates([centerLat, centerLng]);
      }
    } catch (error) {
      console.error('Error fetching cemetery:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlots = async () => {
    try {
      const response = await fetch(`/api/plots?cemetery_id=${cemeteryId}`);
      const data = await response.json();
      setPlots(data.plots || []);
    } catch (error) {
      console.error('Error fetching plots:', error);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const response = await fetch(
        `/api/deceased/search?q=${encodeURIComponent(query)}&cemetery_id=${cemeteryId}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching deceased:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const handleSelectSearchResult = (result: any) => {
    setHighlightedPlotId(result.plot_id);
    setSelectedResult(result);
    setShowSearchResults(false);
    setSearchQuery('');
    
    const plot = plots.find(p => p.id === result.plot_id);
    if (plot && plot.latitude && plot.longitude && userLocation) {
      handleGetDirections([plot.latitude, plot.longitude]);
    }
  };

  const handleGetDirections = async (destination: [number, number]) => {
    if (!userLocation) {
      alert('Please enable location access to get directions');
      return;
    }

    setIsLoadingRoute(true);
    setRoute(null);
    setRouteInfo(null);

    try {
      const routeData = await getDirections(
        userLocation,
        destination,
        navigationMode
      );

      if (routeData) {
        setRoute(routeData.coordinates);
        setRouteInfo(routeData);
        setShowDirections(true);
      } else {
        alert('No route found. Please try a different travel mode.');
      }
    } catch (error) {
      alert('Unable to calculate route. Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const clearRoute = () => {
    setRoute(null);
    setRouteInfo(null);
    setShowDirections(false);
    setHighlightedPlotId(null);
    setSelectedResult(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!cemetery) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-red-500">Cemetery not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="w-full px-4 py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{cemetery.name} - Grave Locator</h1>
          <p className="text-sm text-gray-600">Search for deceased persons and navigate to their graves</p>
        </div>

        {/* Enable Location Button - Show if no location */}
        {!userLocation && !locationError && (
          <div className="mb-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-xl font-bold">Enable Location Access</h3>
                </div>
                <p className="text-blue-100 text-sm mb-4">
                  Click the button below to allow location access. Your browser will show a permission prompt at the top.
                </p>
                <button
                  onClick={requestLocation}
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold text-lg hover:bg-blue-50 transition-all shadow-md hover:shadow-xl transform hover:scale-105 flex items-center gap-2 justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Allow Location Access
                </button>
              </div>
              <svg className="w-24 h-24 ml-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* Location Status */}
        {locationError && locationError === 'HTTPS_REQUIRED' ? (
          <div className="mb-4 bg-orange-50 border-l-4 border-orange-500 rounded p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-orange-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-medium text-orange-900">Secure Connection Required</h3>
                <p className="text-sm text-orange-800 mt-1">
                  Location access requires HTTPS. Please contact your administrator.
                </p>
              </div>
            </div>
          </div>
        ) : locationError && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-medium text-red-900">Location Access Blocked</h3>
                <p className="text-sm text-red-800 mt-1">{locationError}</p>
                <button
                  onClick={requestLocation}
                  className="mt-2 text-sm text-red-700 hover:text-red-900 underline font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-4 relative z-50">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim() && searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                placeholder="Search by name (e.g., John Doe)"
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-base z-50"
                autoComplete="off"
              />
              {isSearching && (
                <div className="absolute right-14 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-lg transition-colors"
                  title="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-300 rounded-lg shadow-xl max-h-96 overflow-y-auto z-[100]">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.id}-${index}`}
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full p-4 text-left hover:bg-blue-50 border-b border-gray-200 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-lg">
                          {result.first_name} {result.last_name}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 space-y-1">
                          <div>
                            <span className="font-semibold">Born:</span> {new Date(result.date_of_birth).toLocaleDateString()} | 
                            <span className="font-semibold ml-2">Died:</span> {new Date(result.date_of_death).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-semibold">Plot:</span> {result.plot_number} | 
                            <span className="font-semibold ml-2">Layer:</span> {result.layer || 1}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 text-blue-600 font-medium text-sm whitespace-nowrap">
                        View Location →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showSearchResults && searchResults.length === 0 && !isSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-xl p-6 z-[100]">
                <div className="text-center">
                  <p className="text-gray-700 font-medium">No results found</p>
                  <p className="text-gray-500 text-sm mt-1">
                    No deceased persons found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Navigation Controls */}
        {selectedResult && (
          <div className="mb-4 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-blue-900">
                  {selectedResult.first_name} {selectedResult.last_name}
                </h3>
                <p className="text-sm text-blue-700">Plot: {selectedResult.plot_number}</p>
              </div>
              <button
                onClick={clearRoute}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Clear ✕
              </button>
            </div>

            {/* Travel Mode Selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNavigationMode('foot-walking')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  navigationMode === 'foot-walking'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Walking
              </button>
              <button
                onClick={() => setNavigationMode('driving-car')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  navigationMode === 'driving-car'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Driving
              </button>
              <button
                onClick={() => setNavigationMode('cycling-regular')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  navigationMode === 'cycling-regular'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Cycling
              </button>
            </div>

            {/* Get Directions Button */}
            {userLocation && !showDirections && (
              <button
                onClick={() => {
                  const plot = plots.find(p => p.id === selectedResult.plot_id);
                  
                  if (!plot) {
                    alert('Plot not found.');
                    return;
                  }

                  let targetCoords: [number, number] | null = null;

                  // First try latitude/longitude
                  if (plot.latitude && plot.longitude) {
                    targetCoords = [plot.latitude, plot.longitude];
                  } 
                  // Then try to extract from map_coordinates
                  else if (plot.map_coordinates) {
                    if (Array.isArray(plot.map_coordinates) && plot.map_coordinates.length > 0) {
                      // If it's an array of coordinates, use the first one (or center)
                      const coords = plot.map_coordinates[0];
                      if (Array.isArray(coords) && coords.length === 2) {
                        targetCoords = [coords[0], coords[1]];
                      }
                    } else if (typeof plot.map_coordinates === 'object' && 'x' in plot.map_coordinates && 'y' in plot.map_coordinates) {
                      // If it's {x, y} format, assume these are lat/lng
                      targetCoords = [plot.map_coordinates.x, plot.map_coordinates.y];
                    }
                  }

                  if (targetCoords) {
                    handleGetDirections(targetCoords);
                  } else {
                    alert('This plot does not have coordinates set. Please edit the plot in the map editor to add coordinates.');
                  }
                }}
                disabled={isLoadingRoute}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 flex items-center gap-2 justify-center"
              >
                {isLoadingRoute ? (
                  'Loading Route...'
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Get Directions
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Route Information */}
        {routeInfo && showDirections && (
          <div className="mb-4 bg-white border-2 border-gray-300 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 mb-2">Navigation Instructions</h3>
            <div className="flex gap-4 mb-3 text-sm">
              <span className="text-gray-700">
                <strong>Distance:</strong> {formatDistance(routeInfo.distance)}
              </span>
              <span className="text-gray-700">
                <strong>Duration:</strong> {formatDuration(routeInfo.duration)}
              </span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {routeInfo.instructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium min-w-[30px] text-center">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 flex-1">{instruction.instruction}</span>
                  <span className="text-gray-500 text-xs whitespace-nowrap">
                    {formatDistance(instruction.distance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden relative z-10" style={{ height: '600px' }}>
          <GraveLocatorMap
            cemetery={cemetery}
            plots={plots}
            highlightedPlotId={highlightedPlotId}
            userLocation={userLocation}
            route={route}
            centerCoordinates={centerCoordinates}
          />
        </div>
      </div>
    </div>
  );
}
