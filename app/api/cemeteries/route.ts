import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cemeteriesData = await query(
      `SELECT id, name, address, city, description, latitude, longitude 
       FROM cemeteries 
       WHERE is_active = TRUE 
       ORDER BY name ASC`
    );

    return NextResponse.json({ cemeteries: cemeteriesData }, { status: 200 });
  } catch (error) {
    console.error('Error fetching cemeteries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cemeteries' },
      { status: 500 }
    );
  }
}
