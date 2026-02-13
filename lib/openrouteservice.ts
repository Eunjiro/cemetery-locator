/**
 * OpenRouteService API Integration
 * Provides routing and navigation features via server-side proxy
 */

export interface Route {
  distance: number; // in meters
  duration: number; // in seconds
  coordinates: [number, number][]; // [lng, lat] format
  instructions: RouteInstruction[];
}

export interface RouteInstruction {
  distance: number;
  duration: number;
  instruction: string;
  type: number;
  way_points?: [number, number]; // [startIndex, endIndex] into route coordinates array
}

/**
 * Get directions from one point to another
 * Uses server-side API proxy to avoid CORS issues
 * @param start [latitude, longitude]
 * @param end [latitude, longitude]
 * @param profile 'foot-walking' | 'driving-car' | 'cycling-regular'
 */
export async function getDirections(
  start: [number, number],
  end: [number, number],
  profile: 'foot-walking' | 'driving-car' | 'cycling-regular' = 'foot-walking'
): Promise<Route> {
  console.log('📍 Getting directions from', start, 'to', end);
  console.log('🚶 Profile:', profile);

  // Call our own API proxy instead of OpenRouteService directly
  const response = await fetch('/api/directions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start,
      end,
      profile,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Directions API error:', errorData);
    throw new Error(errorData.error || `Failed to get directions: ${response.status}`);
  }

  const data = await response.json();
  console.log('📡 Directions response received');

  // Convert coordinates from [lng, lat] to [lat, lng]
  const coordinates = data.coordinates.map(([lng, lat]: [number, number]) => 
    [lat, lng] as [number, number]
  );

  return {
    distance: data.distance,
    duration: data.duration,
    coordinates,
    instructions: data.instructions,
  };
}

/**
 * Calculate distance between two points
 * @param start [longitude, latitude]
 * @param end [longitude, latitude]
 */
export async function getDistance(
  start: [number, number],
  end: [number, number]
): Promise<{ distance: number; duration: number }> {
  const route = await getDirections(start, end);
  return {
    distance: route.distance,
    duration: route.duration,
  };
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} hr ${minutes} min`;
}
