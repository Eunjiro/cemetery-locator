import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const cemeteryId = searchParams.get('cemetery_id');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const searchTerm = query.trim();
    let sqlQuery = `
      SELECT DISTINCT 
        first_name,
        last_name,
        COALESCE(middle_name, '') as middle_name
      FROM deceased_persons d
      WHERE 
        (
          LOWER(d.first_name) LIKE LOWER($1) OR
          LOWER(d.last_name) LIKE LOWER($1) OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($1)
        )
    `;
    
    const params: any[] = [`${searchTerm}%`]; // Prefix match for autocomplete
    let paramIndex = 2;

    if (cemeteryId) {
      sqlQuery += ` AND d.id IN (
        SELECT b.deceased_person_id 
        FROM burials b 
        JOIN grave_plots gp ON b.grave_plot_id = gp.id 
        WHERE gp.cemetery_id = $${paramIndex}
      )`;
      params.push(cemeteryId);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY d.last_name, d.first_name LIMIT 10`;

    const result = await pool.query(sqlQuery, params);

    // Format suggestions as full names
    const suggestions = result.rows.map(row => {
      const parts = [row.first_name, row.middle_name, row.last_name].filter(Boolean);
      return parts.join(' ').trim();
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    return NextResponse.json({ suggestions: [], error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
