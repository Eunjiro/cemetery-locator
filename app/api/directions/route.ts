import { NextRequest, NextResponse } from 'next/server';

const ORS_API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY || '';
const ORS_BASE_URL = 'https://api.openrouteservice.org';

export async function POST(request: NextRequest) {
  try {
    if (!ORS_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouteService API key is not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { start, end, profile = 'foot-walking' } = body;

    if (!start || !end || !Array.isArray(start) || !Array.isArray(end)) {
      return NextResponse.json(
        { error: 'Invalid start or end coordinates' },
        { status: 400 }
      );
    }

    // Convert [lat, lng] to [lng, lat] for OpenRouteService
    const startCoords: [number, number] = [start[1], start[0]];
    const endCoords: [number, number] = [end[1], end[0]];

    const url = `${ORS_BASE_URL}/v2/directions/${profile}/geojson`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': ORS_API_KEY,
      },
      body: JSON.stringify({
        coordinates: [startCoords, endCoords],
        instructions: true,
        language: 'en',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouteService error:', errorText);
      return NextResponse.json(
        { error: `Failed to get directions: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return NextResponse.json(
        { error: 'No routes found in response' },
        { status: 404 }
      );
    }

    const feature = data.features[0];
    const route = feature.properties;
    const geometry = feature.geometry;

    if (!route || !geometry || !geometry.coordinates) {
      return NextResponse.json(
        { error: 'Invalid route data in response' },
        { status: 500 }
      );
    }

    // Return the processed route data
    return NextResponse.json({
      distance: route.segments?.[0]?.distance || 0,
      duration: route.segments?.[0]?.duration || 0,
      coordinates: geometry.coordinates,
      instructions: route.segments?.[0]?.steps || [],
    });

  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate route', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
