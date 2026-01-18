import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const cemeteryId = searchParams.get('cemetery_id');

    if (!query) {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 });
    }

    // Search deceased persons and their associated plots
    const result = await pool.query(
      `SELECT 
        d.id as deceased_id,
        d.first_name,
        d.last_name,
        d.date_of_birth,
        d.date_of_death,
        b.id as burial_id,
        b.burial_date,
        b.position_in_plot,
        b.layer,
        gp.id as plot_id,
        gp.plot_number,
        gp.plot_type,
        gp.status,
        gp.map_coordinates,
        gp.cemetery_id,
        c.name as cemetery_name
      FROM deceased_persons d
      INNER JOIN burials b ON d.id = b.deceased_id
      INNER JOIN grave_plots gp ON b.plot_id = gp.id
      INNER JOIN cemeteries c ON gp.cemetery_id = c.id
      WHERE (
        LOWER(d.first_name) LIKE LOWER($1) OR
        LOWER(d.last_name) LIKE LOWER($1) OR
        LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($1)
      )
      ${cemeteryId ? 'AND gp.cemetery_id = $2' : ''}
      ORDER BY d.last_name, d.first_name
      LIMIT 20`,
      cemeteryId ? [`%${query}%`, cemeteryId] : [`%${query}%`]
    );

    return NextResponse.json({ results: result.rows });
  } catch (error) {
    console.error('Error searching deceased:', error);
    return NextResponse.json({ error: 'Failed to search deceased persons' }, { status: 500 });
  }
}
