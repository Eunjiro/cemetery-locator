import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { rankSearchResults, parseNaturalLanguageQuery } from '@/lib/ai-search';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const cemeteryId = searchParams.get('cemetery_id');
    const useAI = searchParams.get('ai') !== 'false'; // Enable AI by default
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    if (!query) {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 });
    }

    // Validate pagination parameters
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(Math.max(1, pageSize), 100); // Max 100 results per page

    // Parse natural language query for better SQL filtering
    const context = parseNaturalLanguageQuery(query);

    // Build dynamic SQL query with smarter filtering
    let sqlQuery = `
      SELECT 
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
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Determine if this is a date-only search or includes name
    const hasDateFilter = context.yearOfDeath || context.yearOfBirth || context.dateRange || 
                         context.monthOfDeath || context.monthOfBirth || context.monthRange || 
                         context.specificDate;
    const hasNameFilter = context.firstName || context.lastName || context.fullName;

    // If there's a name component, search by extracted names, otherwise use full query
    if (hasNameFilter) {
      // Extract clean name from query (remove date keywords and years)
      const cleanName = query
        .replace(/\b(died|born|buried|namatay|ipinanganak|pumanaw|yumao|in|at|on|noong)\b/gi, '')
        .replace(/\b(19\d{2}|20\d{2})\b/g, '')
        .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|enero|pebrero|marso|abril|mayo|hunyo|hulyo|agosto|setyembre|oktubre|nobyembre|disyembre)\b/gi, '')
        .replace(/[-\/]/g, ' ')
        .trim();
      
      // Use extracted name parts for more accurate matching
      sqlQuery += ` AND (`;
      let nameConditionsAdded = false;

      // If we have firstName and lastName, require both to match
      if (context.firstName && context.lastName) {
        sqlQuery += `(
          LOWER(d.first_name) LIKE LOWER($${paramIndex}) AND
          LOWER(d.last_name) LIKE LOWER($${paramIndex + 1})
        )`;
        params.push(`%${context.firstName}%`, `%${context.lastName}%`);
        paramIndex += 2;
        nameConditionsAdded = true;
      }
      // If we only have firstName (single name like "jiro"), search both fields
      else if (context.firstName) {
        sqlQuery += `(
          LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.last_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($${paramIndex})
        )`;
        params.push(`%${context.firstName}%`);
        paramIndex++;
        nameConditionsAdded = true;
      }
      // If we only have lastName, search both fields
      else if (context.lastName) {
        sqlQuery += `(
          LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.last_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($${paramIndex})
        )`;
        params.push(`%${context.lastName}%`);
        paramIndex++;
        nameConditionsAdded = true;
      }

      // Also check cleaned full query as fallback
      if (nameConditionsAdded && cleanName) {
        sqlQuery += ` OR (
          LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.last_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($${paramIndex})
        )`;
        params.push(`%${cleanName}%`);
        paramIndex++;
      }

      sqlQuery += ')';
    } else if (!hasDateFilter) {
      // No name or date filters, use full query string
      sqlQuery += ` AND (
        LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR
        LOWER(d.last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($${paramIndex}) OR
        LOWER(gp.plot_number) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${query}%`);
      paramIndex++;
    }
    // If only date filter, no name WHERE clause needed

    // Add date range filtering if detected
    if (context.dateRange) {
      sqlQuery += ` AND (
        EXTRACT(YEAR FROM d.date_of_death) BETWEEN $${paramIndex} AND $${paramIndex + 1}
        OR EXTRACT(YEAR FROM d.date_of_birth) BETWEEN $${paramIndex} AND $${paramIndex + 1}
      )`;
      params.push(context.dateRange.start, context.dateRange.end);
      paramIndex += 2;
    } else if (context.yearOfDeath) {
      sqlQuery += ` AND EXTRACT(YEAR FROM d.date_of_death) = $${paramIndex}`;
      params.push(context.yearOfDeath);
      paramIndex++;
    } else if (context.yearOfBirth) {
      sqlQuery += ` AND EXTRACT(YEAR FROM d.date_of_birth) = $${paramIndex}`;
      params.push(context.yearOfBirth);
      paramIndex++;
    }

    // Add month filtering for death date
    if (context.monthOfDeath) {
      sqlQuery += ` AND EXTRACT(MONTH FROM d.date_of_death) = $${paramIndex}`;
      params.push(context.monthOfDeath);
      paramIndex++;
    }

    // Add month filtering for birth date
    if (context.monthOfBirth) {
      sqlQuery += ` AND EXTRACT(MONTH FROM d.date_of_birth) = $${paramIndex}`;
      params.push(context.monthOfBirth);
      paramIndex++;
    }

    // Add month range filtering (applies to death date)
    if (context.monthRange) {
      sqlQuery += ` AND EXTRACT(MONTH FROM d.date_of_death) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(context.monthRange.start, context.monthRange.end);
      paramIndex += 2;
    }

    // Add day of month filtering
    if (context.dayOfMonth) {
      sqlQuery += ` AND EXTRACT(DAY FROM d.date_of_death) = $${paramIndex}`;
      params.push(context.dayOfMonth);
      paramIndex++;
    }

    // Add specific date filtering (for exact date searches)
    if (context.specificDate) {
      sqlQuery += ` AND DATE(d.date_of_death) = $${paramIndex}`;
      params.push(context.specificDate.toISOString().split('T')[0]);
      paramIndex++;
    }

    if (cemeteryId) {
      sqlQuery += ` AND gp.cemetery_id = $${paramIndex}`;
      params.push(cemeteryId);
      paramIndex++;
    }

    // Get total count for pagination (before limiting)
    const countQuery = sqlQuery.replace(
      /SELECT[\s\S]+?FROM/i,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params);
    const totalResults = parseInt(countResult.rows[0]?.total || '0');

    // Add pagination
    const offset = (validPage - 1) * validPageSize;
    sqlQuery += ` ORDER BY d.last_name, d.first_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(validPageSize, offset);

    // Execute search query
    const result = await pool.query(sqlQuery, params);

    // Apply AI-powered ranking if enabled
    let rankedResults = result.rows;
    if (useAI && rankedResults.length > 0) {
      rankedResults = await rankSearchResults(query, result.rows, useAI);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalResults / validPageSize);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    return NextResponse.json({ 
      results: rankedResults,
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        totalResults,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      context, // Return parsed context for debugging
      aiEnabled: useAI && !!process.env.XAI_API_KEY,
    });
  } catch (error) {
    console.error('Error searching deceased:', error);
    return NextResponse.json({ error: 'Failed to search deceased persons' }, { status: 500 });
  }
}