'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/PublicNavbar';
import { getDirections, formatDistance, formatDuration, Route } from '@/lib/openrouteservice';
import { translations, t, Language } from '@/lib/translations';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
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
  const [voiceNavigationEnabled, setVoiceNavigationEnabled] = useState(true);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [lastSpokenIndex, setLastSpokenIndex] = useState(-1);
  const instructionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [targetBearing, setTargetBearing] = useState<number | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);
  const [showSearchTips, setShowSearchTips] = useState<boolean>(false);

  useEffect(() => {
    fetchCemeteryData();
    fetchPlots();
    // Automatically request location on page load for mobile experience
    // Use a small delay to ensure page is fully loaded
    const timer = setTimeout(() => {
      requestLocation();
    }, 100);
    
    // Set up device orientation for compass
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // Type assertion for iOS-specific property
      const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      
      if (iosEvent.webkitCompassHeading !== undefined) {
        // iOS - webkitCompassHeading gives degrees from North (0-360)
        setUserHeading(iosEvent.webkitCompassHeading);
      } else if (event.alpha !== null) {
        // Android - alpha is rotation around z-axis
        // Convert to compass heading (0 = North, 90 = East, 180 = South, 270 = West)
        let heading = event.alpha;
        
        // Adjust for device orientation if beta and gamma are available
        if (event.beta !== null && event.gamma !== null) {
          // For landscape mode adjustments
          heading = event.alpha;
        }
        
        setUserHeading(heading);
      }
    };

    // Request permission for iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          }
        })
        .catch(console.error);
    } else if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
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
        
        // Get heading if available (mainly on mobile devices)
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
          setUserHeading(position.coords.heading);
        }
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

  const performSearch = async (query: string, page: number = 1) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalResults(0);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const response = await fetch(
        `/api/deceased/search?q=${encodeURIComponent(query)}&cemetery_id=${cemeteryId}&page=${page}&pageSize=20`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
      setAiEnabled(data.aiEnabled || false);
      
      // Update pagination state
      if (data.pagination) {
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotalResults(data.pagination.totalResults);
        setHasNextPage(data.pagination.hasNextPage);
        setHasPrevPage(data.pagination.hasPrevPage);
      }
    } catch (error) {
      console.error('Error searching deceased:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    performSearch(searchQuery, newPage);
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
    
    // Save to search history
    saveToSearchHistory(result);
    
    const plot = plots.find(p => p.id === result.plot_id);
    if (plot && plot.latitude && plot.longitude && userLocation) {
      handleGetDirections([plot.latitude, plot.longitude]);
    }
  };

  const saveToSearchHistory = (result: any) => {
    try {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      const newItem = {
        id: result.id,
        name: result.name,
        cemeteryName: cemetery?.name || 'Unknown Cemetery',
        searchedAt: new Date().toISOString(),
      };
      
      // Remove duplicate if exists
      const filtered = history.filter((item: any) => item.id !== result.id);
      
      // Add to beginning and limit to 50 items
      const updated = [newItem, ...filtered].slice(0, 50);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  };

  const toggleBookmark = () => {
    if (!selectedResult) return;
    
    try {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      const isBookmarked = bookmarks.some((item: any) => item.id === selectedResult.id);
      
      if (isBookmarked) {
        // Remove bookmark
        const updated = bookmarks.filter((item: any) => item.id !== selectedResult.id);
        localStorage.setItem('bookmarks', JSON.stringify(updated));
      } else {
        // Add bookmark
        const newBookmark = {
          id: selectedResult.id,
          name: selectedResult.name,
          cemeteryId: cemeteryId,
          cemeteryName: cemetery?.name || 'Unknown Cemetery',
          addedAt: new Date().toISOString(),
        };
        const updated = [newBookmark, ...bookmarks];
        localStorage.setItem('bookmarks', JSON.stringify(updated));
      }
      
      // Force re-render by updating selected result
      setSelectedResult({ ...selectedResult });
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const isBookmarked = () => {
    if (!selectedResult) return false;
    try {
      const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
      return bookmarks.some((item: any) => item.id === selectedResult.id);
    } catch {
      return false;
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
    setVoiceNavigationEnabled(false);
    setCurrentInstructionIndex(0);
    setLastSpokenIndex(-1);
    setTargetBearing(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Calculate bearing between two points
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    
    return (bearing + 360) % 360; // Normalize to 0-360
  };

  // Get cardinal direction from degrees
  const getCardinalDirection = (degrees: number): string => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((degrees % 360) / 45)) % 8;
    return directions[index];
  };

  // Get turn direction (left, right, straight)
  const getTurnDirection = (currentHeading: number, targetBearing: number): string => {
    let diff = targetBearing - currentHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    if (Math.abs(diff) < 20) return 'straight';
    if (diff > 0) return 'right';
    return 'left';
  };

  // Update target bearing when route changes
  useEffect(() => {
    if (userLocation && route && route.length > 1) {
      // Calculate bearing to next point in route
      const nextPoint = route[Math.min(currentInstructionIndex + 1, route.length - 1)];
      const bearing = calculateBearing(
        userLocation[0],
        userLocation[1],
        nextPoint[0],
        nextPoint[1]
      );
      setTargetBearing(bearing);
    } else {
      setTargetBearing(null);
    }
  }, [userLocation, route, currentInstructionIndex]);

  const speakInstruction = (text: string) => {
    if ('speechSynthesis' in window && voiceNavigationEnabled) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Track user location and speak instructions
  useEffect(() => {
    if (!voiceNavigationEnabled || !routeInfo || !userLocation || !route) return;

    const instructions = routeInfo.instructions;
    if (currentInstructionIndex >= instructions.length) return;

    // Get the next waypoint from the route
    let waypointIndex = 0;
    let distanceSum = 0;
    
    for (let i = 0; i < instructions.length && i < currentInstructionIndex; i++) {
      distanceSum += instructions[i].distance;
    }

    // Find approximate waypoint based on distance
    let currentDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const segmentDistance = calculateDistance(
        route[i][0], route[i][1],
        route[i + 1][0], route[i + 1][1]
      );
      currentDistance += segmentDistance;
      
      if (currentDistance >= distanceSum) {
        waypointIndex = i;
        break;
      }
    }

    const nextWaypoint = route[Math.min(waypointIndex + 5, route.length - 1)];
    const distanceToNextPoint = calculateDistance(
      userLocation[0], userLocation[1],
      nextWaypoint[0], nextWaypoint[1]
    );

    // Speak instruction when within 30 meters and haven't spoken it yet
    if (distanceToNextPoint < 30 && lastSpokenIndex !== currentInstructionIndex) {
      const instruction = instructions[currentInstructionIndex];
      const distanceText = instruction.distance > 100 
        ? `in ${Math.round(instruction.distance)} meters`
        : 'now';
      
      speakInstruction(`${instruction.instruction} ${distanceText}`);
      setLastSpokenIndex(currentInstructionIndex);
      
      // Move to next instruction
      if (distanceToNextPoint < 10) {
        setTimeout(() => {
          setCurrentInstructionIndex(prev => prev + 1);
        }, 2000);
      }
    }
  }, [userLocation, voiceNavigationEnabled, routeInfo, route, currentInstructionIndex, lastSpokenIndex]);

  const toggleVoiceNavigation = () => {
    if (!voiceNavigationEnabled && routeInfo) {
      // Starting voice navigation
      setVoiceNavigationEnabled(true);
      setCurrentInstructionIndex(0);
      setLastSpokenIndex(-1);
      speakInstruction('Voice navigation started. Follow the instructions.');
    } else {
      // Stopping voice navigation
      setVoiceNavigationEnabled(false);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Navbar />
      
      <div className="w-full px-4 sm:px-4 py-3 sm:py-4">
        {/* Compact Mobile Header */}
        <div className="mb-4 sm:mb-4">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{cemetery.name}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Find and navigate to graves</p>
        </div>

        {/* Enable Location Button - Show if no location */}
        {!userLocation && !locationError && (
          <div className="mb-3 sm:mb-4 bg-gradient-to-r from-green-500 to-green-600 rounded-lg sm:rounded-xl p-4 sm:p-6 text-white shadow-lg">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-lg sm:text-xl font-bold">Enable Location Access</h3>
                </div>
                <p className="text-green-100 text-xs sm:text-sm mb-3 sm:mb-4">
                  Click the button below to allow location access. Your browser will show a permission prompt at the top.
                </p>
                <button
                  onClick={requestLocation}
                  className="bg-white text-green-600 px-6 py-3 rounded-lg font-bold text-base sm:text-lg hover:bg-green-50 active:bg-green-100 transition-all shadow-md hover:shadow-xl active:scale-95 flex items-center gap-2 justify-center mx-auto sm:mx-0 touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  Allow Location Access
                </button>
              </div>
              <svg className="hidden sm:block w-16 h-16 sm:w-24 sm:h-24 ml-4 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* Location Status */}
        {locationError && locationError === 'HTTPS_REQUIRED' ? (
          <div className="mb-3 sm:mb-4 bg-orange-50 border-l-4 border-orange-500 rounded p-3 sm:p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-orange-600 mr-2 sm:mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-medium text-orange-900 text-sm sm:text-base">Secure Connection Required</h3>
                <p className="text-xs sm:text-sm text-orange-800 mt-1">
                  Location access requires HTTPS. Please contact your administrator.
                </p>
              </div>
            </div>
          </div>
        ) : locationError && (
          <div className="mb-3 sm:mb-4 bg-red-50 border-l-4 border-red-500 rounded p-3 sm:p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 sm:mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="font-medium text-red-900 text-sm sm:text-base">Location Access Blocked</h3>
                <p className="text-xs sm:text-sm text-red-800 mt-1">{locationError}</p>
                <button
                  onClick={requestLocation}
                  className="mt-2 text-xs sm:text-sm text-red-700 hover:text-red-900 active:text-red-950 underline font-medium touch-manipulation"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar - AI Enhanced */}
        <div className="mb-3 sm:mb-4 relative z-40">
          <form onSubmit={handleSearch} className="relative">
            {/* AI Badge, Language Toggle & Tips */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {aiEnabled && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-semibold rounded-full shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 7H7v6h6V7z"/>
                      <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd"/>
                    </svg>
                    AI Search / AI Paghahanap
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowSearchTips(!showSearchTips)}
                className="text-xs text-gray-600 hover:text-green-600 font-medium flex items-center gap-1 touch-manipulation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Search Tips / Mga Tip sa Paghahanap
              </button>
            </div>

            {/* Search Tips Panel */}
            {showSearchTips && (
              <div className="mb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg sm:rounded-xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-blue-900 text-sm sm:text-base flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Enhanced Search Tips / Mga Tip sa Paghahanap
                  </h4>
                  <button
                    onClick={() => setShowSearchTips(false)}
                    className="text-gray-500 hover:text-gray-700 p-1 touch-manipulation"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-4 text-xs sm:text-sm">
                  {/* Name Search */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      Search by Name / Pangalan
                    </h5>
                    <ul className="space-y-1 text-gray-700 ml-5">
                      <li>• "Juan dela Cruz" or "John Smith"</li>
                      <li>• "Find Maria Santos" or "Hanap si Pedro"</li>
                      <li>• "G. Juan Reyes" or "Mrs. Mary Johnson"</li>
                    </ul>
                  </div>

                  {/* Date & Time Search */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      Search by Date & Time / Petsa at Panahon
                    </h5>
                    <ul className="space-y-1 text-gray-700 ml-5">
                      <li>• <span className="font-medium">Year:</span> "2020", "died 2015", "namatay 2019"</li>
                      <li>• <span className="font-medium">Year Range:</span> "2020-2026", "1990 to 2000", "between 2010 and 2020"</li>
                      <li>• <span className="font-medium">Month:</span> "January", "December 2020", "died in March"</li>
                      <li>• <span className="font-medium">Month Range:</span> "January-March", "January to March 2020"</li>
                      <li>• <span className="font-medium">Filipino:</span> "Enero 2020", "mula 2015 hanggang 2020"</li>
                      <li>• <span className="font-medium">Specific Date:</span> "2020-01-15", "15 January 2020", "01/15/2020"</li>
                    </ul>
                  </div>

                  {/* Combined Search */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                      </svg>
                      Combined Search / Pinagsama
                    </h5>
                    <ul className="space-y-1 text-gray-700 ml-5">
                      <li>• "John Smith 2020"</li>
                      <li>• "Maria Santos January 2015"</li>
                      <li>• "Find Juan dela Cruz died 2020-2026"</li>
                      <li>• "Pedro namatay 2019"</li>
                      <li>• "Mary born 1950 died December 2020"</li>
                    </ul>
                  </div>

                  {/* Natural Language */}
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                      <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                      Natural Language / Natural na Wika
                    </h5>
                    <ul className="space-y-1 text-gray-700 ml-5">
                      <li>• "Show me people who died in 2020"</li>
                      <li>• "Find graves from January to March 2020"</li>
                      <li>• "Hanap ang mga yumao noong Enero 2020"</li>
                      <li>• "Where is Juan who died between 2015 and 2020?"</li>
                      <li>• "Nasaan si Maria na namatay 2019?"</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim() && searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                placeholder={aiEnabled 
                  ? "Try: name, date, month, or range (e.g., 'John 2020', 'January', '2020-2026')" 
                  : "Search by name, date, month, or year range"}
                className="w-full pl-12 pr-12 py-3 sm:py-3.5 border-2 border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 text-sm sm:text-base text-gray-900 placeholder:text-gray-500 bg-white touch-manipulation transition-all"
                autoComplete="off"
                aria-label="Search for graves using natural language"
              />
              {isSearching && (
                <div className="absolute right-14 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24">
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 p-2.5 rounded-lg transition-colors touch-manipulation"
                  title="Clear search"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-300 rounded-lg sm:rounded-xl shadow-xl max-h-[70vh] overflow-hidden z-[100] flex flex-col">
                {/* Results header with count */}
                <div className="px-4 py-2 bg-green-50 border-b-2 border-green-200 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-green-900">
                      {totalResults > 0 ? (
                        <>
                          Showing {((currentPage - 1) * 20) + 1}-{Math.min(currentPage * 20, totalResults)} of {totalResults} results
                        </>
                      ) : (
                        `${searchResults.length} results found`
                      )}
                    </div>
                    {aiEnabled && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9a1 1 0 112 0 1 1 0 01-2 0zm1-5a1 1 0 00-1 1v1a1 1 0 002 0V5a1 1 0 00-1-1z"/>
                        </svg>
                        AI Powered
                      </span>
                    )}
                  </div>
                </div>

                {/* Scrollable results */}
                <div className="overflow-y-auto flex-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={`result-${result.deceased_id}-${index}`}
                      onClick={() => handleSelectSearchResult(result)}
                      className="w-full p-3 sm:p-4 text-left hover:bg-green-50 active:bg-green-100 border-b border-gray-200 last:border-b-0 transition-colors touch-manipulation"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-bold text-gray-900 text-base sm:text-lg truncate">
                              {result.first_name} {result.last_name}
                            </div>
                            {aiEnabled && index === 0 && result.score > 0.7 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                                Best Match
                              </span>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 mt-1 space-y-1">
                            <div className="truncate">
                              <span className="font-semibold">Born:</span> {new Date(result.date_of_birth).toLocaleDateString()} | 
                              <span className="font-semibold ml-1">Died:</span> {new Date(result.date_of_death).toLocaleDateString()}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold">Plot:</span> {result.plot_number} | 
                              <span className="font-semibold ml-1">Layer:</span> {result.layer || 1}
                            </div>
                          </div>
                        </div>
                        <div className="ml-2 text-green-600 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
                          View →
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200 flex items-center justify-between flex-shrink-0">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!hasPrevPage}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
                        hasPrevPage
                          ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      ← Previous
                    </button>
                    
                    <div className="text-sm text-gray-600 font-medium">
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!hasNextPage}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors touch-manipulation ${
                        hasNextPage
                          ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}

            {showSearchResults && searchResults.length === 0 && !isSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg sm:rounded-xl shadow-xl p-4 sm:p-6 z-[100]">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-700 font-medium text-sm sm:text-base">No results found / Walang resulta</p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-1">
                    No deceased persons found matching / Walang natagpuang yumaong tao na tumutugma sa &quot;{searchQuery}&quot;
                  </p>
                  <div className="mt-4 text-left bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                    <p className="font-semibold mb-2">Search tips / Mga tip sa paghahanap:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Try full names: "John Smith" / Buong pangalan: "Juan dela Cruz"</li>
                      <li>Use dates/years: "2020", "January 2020", "2020-2026"</li>
                      <li>By month: "January", "December 2020", "January-March"</li>
                      <li>Filipino: "Enero 2020", "mula 2020 hanggang 2026"</li>
                      <li>Natural language: "Find Mary died 2020" / "Hanap si Maria namatay 2020"</li>
                      <li>Check spelling / Suriin ang spelling</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Navigation Controls */}
        {selectedResult && (
          <div className="mb-3 sm:mb-4 bg-green-50 border-2 border-green-300 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-green-900 text-sm sm:text-base truncate">
                  {selectedResult.first_name} {selectedResult.last_name}
                </h3>
                <div className="text-xs sm:text-sm text-green-700 space-y-0.5 mt-1">
                  <div>
                    <span className="font-semibold">Born:</span> {new Date(selectedResult.date_of_birth).toLocaleDateString()} | 
                    <span className="font-semibold ml-1">Died:</span> {new Date(selectedResult.date_of_death).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-semibold">Plot:</span> {selectedResult.plot_number} | 
                    <span className="font-semibold ml-1">Layer:</span> {selectedResult.layer || 1}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={toggleBookmark}
                  className="text-green-600 hover:text-green-800 active:text-green-900 p-2 touch-manipulation"
                  title={isBookmarked() ? "Remove bookmark" : "Add bookmark"}
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill={isBookmarked() ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <button
                  onClick={clearRoute}
                  className="text-green-600 hover:text-green-800 active:text-green-900 font-medium text-xs sm:text-sm px-2 py-1 touch-manipulation"
                >
                  Clear ✕
                </button>
              </div>
            </div>

            {/* Travel Mode Selector */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNavigationMode('foot-walking')}
                className={`flex-1 px-2 sm:px-3 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                  navigationMode === 'foot-walking'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Walking
              </button>
              <button
                onClick={() => setNavigationMode('driving-car')}
                className={`flex-1 px-2 sm:px-3 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                  navigationMode === 'driving-car'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                Driving
              </button>
              <button
                onClick={() => setNavigationMode('cycling-regular')}
                className={`flex-1 px-2 sm:px-3 py-2.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                  navigationMode === 'cycling-regular'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
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
                className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 justify-center touch-manipulation"
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
          <div className="mb-3 sm:mb-4 bg-white border-2 border-gray-300 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base">Navigation Instructions</h3>
              {/* Voice Navigation Toggle */}
              {'speechSynthesis' in window && (
                <button
                  onClick={toggleVoiceNavigation}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 touch-manipulation ${
                    voiceNavigationEnabled
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title={voiceNavigationEnabled ? "Stop voice navigation" : "Start voice navigation"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {voiceNavigationEnabled ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    )}
                  </svg>
                  <span className="hidden sm:inline">{voiceNavigationEnabled ? 'Voice On' : 'Voice Off'}</span>
                </button>
              )}
            </div>
            <div className="flex gap-3 sm:gap-4 mb-3 text-xs sm:text-sm flex-wrap">
              <span className="text-gray-700">
                <strong>Distance:</strong> {formatDistance(routeInfo.distance)}
              </span>
              <span className="text-gray-700">
                <strong>Duration:</strong> {formatDuration(routeInfo.duration)}
              </span>
            </div>
            <div className="space-y-2 overflow-hidden">
              {routeInfo.instructions
                .filter((_, index) => {
                  // Show current step and next step only
                  return index === currentInstructionIndex || index === currentInstructionIndex + 1;
                })
                .map((instruction, idx) => {
                  const actualIndex = currentInstructionIndex + idx;
                  const isActive = actualIndex === currentInstructionIndex;
                  
                  return (
                    <div 
                      key={actualIndex}
                      ref={(el) => {
                        instructionRefs.current[actualIndex] = el;
                        // Auto-scroll to active instruction
                        if (isActive && el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }}
                      className={`flex items-start gap-2 text-xs sm:text-sm p-3 rounded-lg transition-all duration-300 ${
                        isActive
                          ? 'bg-green-50 border-l-4 border-green-500 shadow-md' 
                          : 'bg-gray-50 border-l-4 border-gray-300 opacity-70'
                      }`}
                    >
                      <span className={`px-2 py-1 rounded font-medium min-w-[28px] sm:min-w-[30px] text-center flex-shrink-0 transition-colors ${
                        isActive
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {actualIndex + 1}
                      </span>
                      <span className={`flex-1 ${
                        isActive ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}>
                        {instruction.instruction}
                      </span>
                      <span className={`text-xs whitespace-nowrap flex-shrink-0 ${
                        isActive ? 'text-gray-700 font-semibold' : 'text-gray-500'
                      }`}>
                        {formatDistance(instruction.distance)}
                      </span>
                    </div>
                  );
                })}
              {currentInstructionIndex < routeInfo.instructions.length - 1 && (
                <div className="text-center text-xs text-gray-500 py-2">
                  {routeInfo.instructions.length - currentInstructionIndex - 1} more step{routeInfo.instructions.length - currentInstructionIndex - 1 !== 1 ? 's' : ''} remaining
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-white border-2 border-gray-300 rounded-lg sm:rounded-xl overflow-hidden relative z-10" style={{ height: 'calc(100vh - 420px)', minHeight: '400px', maxHeight: '600px' }}>
          <GraveLocatorMap
            cemetery={cemetery}
            plots={plots}
            highlightedPlotId={highlightedPlotId}
            userLocation={userLocation}
            route={route}
            centerCoordinates={centerCoordinates}
            userHeading={userHeading}
            currentInstruction={routeInfo && routeInfo.instructions[currentInstructionIndex] ? routeInfo.instructions[currentInstructionIndex] : null}
            voiceNavigationEnabled={voiceNavigationEnabled}
            onToggleVoice={toggleVoiceNavigation}
          />
        </div>
      </div>
    </div>
  );
}
