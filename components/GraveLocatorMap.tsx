'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to handle map instance and effects
function MapController({ 
  highlightedPlotId, 
  plots, 
  onMapReady,
  userLocation,
  centerToUser,
  centerToLocation 
}: { 
  highlightedPlotId: number | null; 
  plots: Plot[];
  onMapReady: (map: L.Map) => void;
  userLocation: [number, number] | null;
  centerToUser: () => void;
  centerToLocation: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  // Handle centering to user location
  const handleCenterToUser = () => {
    if (userLocation && map) {
      map.flyTo(userLocation, 19, {
        duration: 1
      });
    }
  };

  // Handle centering to highlighted plot
  const handleCenterToLocation = () => {
    if (!highlightedPlotId || !map) return;

    const highlightedPlot = plots.find(p => p.id === highlightedPlotId);
    if (!highlightedPlot) return;

    const coords = highlightedPlot.map_coordinates;
    if (!coords || !Array.isArray(coords) || coords.length === 0) return;

    const latSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[0], 0);
    const lngSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[1], 0);
    const centerLat = latSum / coords.length;
    const centerLng = lngSum / coords.length;

    map.flyTo([centerLat, centerLng], 21, {
      duration: 1
    });
  };

  // Handle plot highlighting
  useEffect(() => {
    if (!highlightedPlotId || !map) return;

    const highlightedPlot = plots.find(p => p.id === highlightedPlotId);
    if (!highlightedPlot) return;

    const coords = highlightedPlot.map_coordinates;
    if (!coords || !Array.isArray(coords) || coords.length === 0) return;

    // Calculate center of the plot
    const latSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[0], 0);
    const lngSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[1], 0);
    const centerLat = latSum / coords.length;
    const centerLng = lngSum / coords.length;

    // Wait a tick to ensure map is fully rendered
    setTimeout(() => {
      try {
        // Zoom to the plot with smooth animation
        map.flyTo([centerLat, centerLng], 21, {
          duration: 1.5,
          easeLinearity: 0.25
        });
      } catch (error) {
        console.error('Error flying to plot:', error);
      }
    }, 100);
  }, [highlightedPlotId, plots, map]);

  return null;
}

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
  size_width?: number;
  size_length?: number;
}

interface GraveLocatorMapProps {
  cemetery: Cemetery;
  plots: Plot[];
  highlightedPlotId?: number | null;
  userLocation?: [number, number] | null;
  route?: [number, number][] | null;
  centerCoordinates?: [number, number] | null;
}

export default function GraveLocatorMap({ 
  cemetery, 
  plots, 
  highlightedPlotId = null,
  userLocation = null,
  route = null,
  centerCoordinates = null,
}: GraveLocatorMapProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const highlightMarkerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const center: [number, number] = centerCoordinates || [cemetery.latitude, cemetery.longitude];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle highlighting marker
  useEffect(() => {
    if (!map || !highlightedPlotId) {
      if (highlightMarkerRef.current) {
        map?.removeLayer(highlightMarkerRef.current);
        highlightMarkerRef.current = null;
      }
      return;
    }

    const highlightedPlot = plots.find(p => p.id === highlightedPlotId);
    if (!highlightedPlot) return;

    const coords = highlightedPlot.map_coordinates;
    if (!coords || !Array.isArray(coords) || coords.length === 0) return;

    // Calculate center of the plot
    const latSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[0], 0);
    const lngSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[1], 0);
    const centerLat = latSum / coords.length;
    const centerLng = lngSum / coords.length;

    // Create a pulsing marker at the plot center
    const pulsingIcon = L.divIcon({
      className: 'highlight-marker',
      html: `
        <div style="
          position: relative;
          width: 40px;
          height: 40px;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 20px;
            height: 20px;
            background-color: #ef4444;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
            animation: pulse 2s infinite;
          "></div>
          <style>
            @keyframes pulse {
              0% {
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
              }
              70% {
                box-shadow: 0 0 0 20px rgba(239, 68, 68, 0);
              }
              100% {
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
              }
            }
          </style>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    // Remove old marker if it exists
    if (highlightMarkerRef.current) {
      map.removeLayer(highlightMarkerRef.current);
    }

    // Add new marker
    highlightMarkerRef.current = L.marker([centerLat, centerLng], { 
      icon: pulsingIcon,
      zIndexOffset: 1000 
    }).addTo(map);
  }, [map, highlightedPlotId, plots]);

  const getPlotColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#10b981'; // green
      case 'occupied':
        return '#3b82f6'; // blue
      case 'reserved':
        return '#f59e0b'; // yellow
      default:
        return '#6b7280'; // gray
    }
  };

  const getPlotBounds = (plot: Plot & { map_coordinates: { x: number; y: number } }): [[number, number], [number, number]] => {
    const { x, y } = plot.map_coordinates;
    const width = plot.size_width || 2;
    const length = plot.size_length || 1;
    
    const metersToLat = 1 / 111320;
    const metersToLng = 1 / (111320 * Math.cos(cemetery.latitude * (Math.PI / 180)));
    
    return [
      [y, x],
      [y + (length * metersToLat), x + (width * metersToLng)],
    ];
  };

  if (!isMounted) {
    return <div className="h-full w-full flex items-center justify-center text-gray-500">Loading map...</div>;
  }

  return (
    <div className="h-full w-full relative">
      {isMounted && (
        <MapContainer
          key={`map-${cemetery.id}`}
          center={center}
          zoom={20}
          maxZoom={22}
          minZoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
        <MapController 
          highlightedPlotId={highlightedPlotId}
          plots={plots}
          onMapReady={setMap}
          userLocation={userLocation}
          centerToUser={() => {
            if (userLocation && map) {
              map.flyTo(userLocation, 19, { duration: 1 });
            }
          }}
          centerToLocation={() => {
            if (!highlightedPlotId || !map) return;
            const plot = plots.find(p => p.id === highlightedPlotId);
            if (!plot) return;
            const coords = plot.map_coordinates;
            if (!coords || !Array.isArray(coords) || coords.length === 0) return;
            const latSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[0], 0);
            const lngSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[1], 0);
            map.flyTo([latSum / coords.length, lngSum / coords.length], 21, { duration: 1 });
          }}
        />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={22}
          maxNativeZoom={19}
        />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} />
        )}

        {/* Navigation Route */}
        {route && route.length > 0 && (
          <Polyline
            positions={route}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 5',
            }}
          />
        )}
      </MapContainer>
      )}

      {/* Floating Map Controls */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-2">
        {/* Center to User Location Button */}
        {userLocation && (
          <button
            onClick={() => {
              if (map && userLocation) {
                map.flyTo(userLocation, 19, { duration: 1 });
              }
            }}
            className="bg-white hover:bg-gray-100 text-gray-700 p-2 rounded-lg shadow-lg transition-colors"
            title="Center to my location"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Center to Selected Plot Button */}
        {highlightedPlotId && (
          <button
            onClick={() => {
              if (!map || !highlightedPlotId) return;
              const plot = plots.find(p => p.id === highlightedPlotId);
              if (!plot) return;
              const coords = plot.map_coordinates;
              if (!coords || !Array.isArray(coords) || coords.length === 0) return;
              const latSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[0], 0);
              const lngSum = coords.reduce((sum: number, coord: [number, number]) => sum + coord[1], 0);
              map.flyTo([latSum / coords.length, lngSum / coords.length], 21, { duration: 1 });
            }}
            className="bg-white hover:bg-gray-100 text-gray-700 p-2 rounded-lg shadow-lg transition-colors"
            title="Center to grave location"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Legend - Only show when a plot is highlighted */}
      {highlightedPlotId && (
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-white rounded-lg shadow-lg p-2 sm:p-3 z-[1000]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-gray-900">Located Grave</span>
          </div>
        </div>
      )}
    </div>
  );
}
