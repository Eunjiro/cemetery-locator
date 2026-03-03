import { NextRequest, NextResponse } from 'next/server';

const ORS_API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY || '';
const ORS_BASE_URL = 'https://api.openrouteservice.org';

/**
 * Translate an English ORS navigation instruction to Filipino
 */
function translateToFilipino(instruction: string): string {
  let text = instruction;

  // Handle dynamic patterns first (with callback replacements)
  text = text.replace(/\bHead (north|south|east|west|northeast|northwest|southeast|southwest)\b/gi, 
    (_m: string, dir: string) => `Pumunta sa ${translateDirection(dir)}`);
  text = text.replace(/\bAt the roundabout, take the (\d+)\w+ exit\b/gi, 
    (_m: string, n: string) => `Sa rotonda, kunin ang pang-${n} labasan`);

  // Static phrase translations (order matters - longer phrases first)
  const translations: [RegExp, string][] = [
    // Turns
    [/\bTurn sharp right\b/gi, 'Lumiko nang matarik sa kanan'],
    [/\bTurn sharp left\b/gi, 'Lumiko nang matarik sa kaliwa'],
    [/\bTurn slight right\b/gi, 'Lumiko nang bahagya sa kanan'],
    [/\bTurn slight left\b/gi, 'Lumiko nang bahagya sa kaliwa'],
    [/\bTurn right\b/gi, 'Lumiko sa kanan'],
    [/\bTurn left\b/gi, 'Lumiko sa kaliwa'],
    [/\bKeep right\b/gi, 'Manatili sa kanan'],
    [/\bKeep left\b/gi, 'Manatili sa kaliwa'],
    [/\bKeep straight\b/gi, 'Dumiretso'],
    // Go
    [/\bGo straight\b/gi, 'Dumiretso'],
    [/\bContinue straight\b/gi, 'Magpatuloy nang diretso'],
    [/\bContinue\b/gi, 'Magpatuloy'],
    [/\bProceed\b/gi, 'Magpatuloy'],
    // Arrival
    [/\bArrive at your destination, on the right\b/gi, 'Narating mo na ang iyong destinasyon, sa kanan'],
    [/\bArrive at your destination, on the left\b/gi, 'Narating mo na ang iyong destinasyon, sa kaliwa'],
    [/\bArrive at your destination\b/gi, 'Narating mo na ang iyong destinasyon'],
    [/\bYou have arrived at your destination\b/gi, 'Narating mo na ang iyong destinasyon'],
    [/\bDestination reached\b/gi, 'Narating na ang destinasyon'],
    // Start
    [/\bStart\b/gi, 'Magsimula'],
    [/\bDepart\b/gi, 'Umalis'],
    // Roundabout
    [/\bEnter the roundabout\b/gi, 'Pumasok sa rotonda'],
    [/\bExit the roundabout\b/gi, 'Lumabas sa rotonda'],
    // U-turn
    [/\bMake a U-turn\b/gi, 'Mag-U-turn'],
    [/\bU-turn\b/gi, 'U-turn'],
    // Connectors
    [/\bonto\b/gi, 'papunta sa'],
    [/\bon\b/gi, 'sa'],
    [/\bfor about\b/gi, 'ng mga'],
    [/\bfor\b/gi, 'ng'],
    [/\babout\b/gi, 'mga'],
    [/\bmeters?\b/gi, 'metro'],
    [/\bkilometers?\b/gi, 'kilometro'],
  ];

  for (const [pattern, replacement] of translations) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

function translateDirection(dir: string): string {
  const directions: Record<string, string> = {
    'north': 'hilaga',
    'south': 'timog',
    'east': 'silangan',
    'west': 'kanluran',
    'northeast': 'hilaga-silangan',
    'northwest': 'hilaga-kanluran',
    'southeast': 'timog-silangan',
    'southwest': 'timog-kanluran',
  };
  return directions[dir.toLowerCase()] || dir;
}

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

    // Translate instructions to Filipino
    const steps = route.segments?.[0]?.steps || [];
    const translatedSteps = steps.map((step: any) => ({
      ...step,
      instruction: step.instruction ? translateToFilipino(step.instruction) : step.instruction,
    }));

    // Return the processed route data
    return NextResponse.json({
      distance: route.segments?.[0]?.distance || 0,
      duration: route.segments?.[0]?.duration || 0,
      coordinates: geometry.coordinates,
      instructions: translatedSteps,
    });

  } catch (error) {
    console.error('Directions API error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate route', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
