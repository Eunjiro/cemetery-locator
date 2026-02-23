import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cemeteryId = searchParams.get('cemetery_id');
  const q = searchParams.get('q') || '';

  if (!cemeteryId) {
    return NextResponse.json({ facilities: [] });
  }

  try {
    let query = `SELECT * FROM facilities WHERE cemetery_id = $1`;
    let params = [cemeteryId];
    if (q) {
      query += ` AND (LOWER(name) LIKE $2 OR LOWER(facility_type) LIKE $2)`;
      params.push(`%${q.toLowerCase()}%`);
    }
    const result = await pool.query(query, params);
    return NextResponse.json({ facilities: result.rows });
  } catch (error) {
    console.error('Error fetching facilities:', error);
    return NextResponse.json({ facilities: [] });
  }
}
