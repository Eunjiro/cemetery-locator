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
      // Extract clean name from query (remove all filler/keyword words)
      const cleanName = query
        .replace(/\b(can|you|could|would|please|help|me|find|search|look|for|show|tell|get|locate|where|who|what|is|are|was|were|do|does|have|has|been|the|a|an|to|at|in|on|of|and|or|but|from|with|this|that|it|my|your)\b/gi, '')
        .replace(/\b(hanap|hanapin|nasaan|saan|sino|si|ni|kay|ang|yung|ba|na|ng|sa|mga|ko|mo|po|opo)\b/gi, '')
        .replace(/\b(died|born|bornd|buried|passed|deceased|death|namatay|ipinanganak|pumanaw|yumao|nailibing|kamatayan)\b/gi, '')
        .replace(/\b(about|around|approximately|roughly|maybe|probably|possibly|think|i think|siguro|marahil)\b/gi, '')
        .replace(/\b(age|aged|old|years?|yrs?|taon|gulang|edad)\b/gi, '')
        .replace(/\b(noong|mula|hanggang|simula|dati|noon|ngayon)\b/gi, '')
        .replace(/\b(grave|tomb|burial|plot|puntod|libingan|nitso|record|data|info|someone|person|tao)\b/gi, '')
        .replace(/\b(19\d{2}|20\d{2})\b/g, '')
        .replace(/\b\d{1,3}\b/g, '')
        .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|enero|pebrero|marso|abril|mayo|hunyo|hulyo|agosto|setyembre|oktubre|nobyembre|disyembre)\b/gi, '')
        .replace(/\b(last year|this year|last month|this month|recently|kamakailan|nakaraang|ngayong|years? ago|taon na ang nakaraan)\b/gi, '')
        .replace(/\b(Jr\.?|Sr\.?|II|III|IV|Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Engr\.?|Atty\.?|G\.|Gng\.|Bb\.)\b/gi, '')
        .replace(/\b('?\d{2}s)\b/g, '')
        .replace(/[-\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Use extracted name parts for more accurate matching
      sqlQuery += ` AND (`;
      let nameConditionsAdded = false;

      // If we have firstName and lastName, try both normal and reversed order
      if (context.firstName && context.lastName) {
        // Normal order: firstName lastName
        sqlQuery += `(
          (LOWER(d.first_name) LIKE LOWER($${paramIndex}) AND LOWER(d.last_name) LIKE LOWER($${paramIndex + 1}))
        `;
        params.push(`%${context.firstName}%`, `%${context.lastName}%`);
        paramIndex += 2;
        
        // Add nickname variations for firstName
        if (context.firstNameVariations && context.firstNameVariations.length > 1) {
          for (const variation of context.firstNameVariations) {
            if (variation.toLowerCase() !== context.firstName.toLowerCase()) {
              sqlQuery += ` OR (LOWER(d.first_name) LIKE LOWER($${paramIndex}) AND LOWER(d.last_name) LIKE LOWER($${paramIndex + 1}))`;
              params.push(`%${variation}%`, `%${context.lastName}%`);
              paramIndex += 2;
            }
          }
        }
        
        // Add nickname variations for lastName
        if (context.lastNameVariations && context.lastNameVariations.length > 1) {
          for (const variation of context.lastNameVariations) {
            if (variation.toLowerCase() !== context.lastName.toLowerCase()) {
              sqlQuery += ` OR (LOWER(d.first_name) LIKE LOWER($${paramIndex}) AND LOWER(d.last_name) LIKE LOWER($${paramIndex + 1}))`;
              params.push(`%${context.firstName}%`, `%${variation}%`);
              paramIndex += 2;
            }
          }
        }
        
        // Reversed order: lastName firstName (for queries like "Smith John")
        sqlQuery += ` OR (LOWER(d.first_name) LIKE LOWER($${paramIndex}) AND LOWER(d.last_name) LIKE LOWER($${paramIndex + 1}))`;
        params.push(`%${context.lastName}%`, `%${context.firstName}%`);
        paramIndex += 2;
        
        // Middle name optional: "John Smith" should find "John Michael Smith"
        // Check if full_name contains both first and last name (flexible middle name)
        sqlQuery += ` OR (
          LOWER(d.first_name || ' ' || COALESCE(d.middle_name, '') || ' ' || d.last_name) LIKE LOWER($${paramIndex})
          AND LOWER(d.first_name || ' ' || COALESCE(d.middle_name, '') || ' ' || d.last_name) LIKE LOWER($${paramIndex + 1})
        )`;
        params.push(`%${context.firstName}%`, `%${context.lastName}%`);
        paramIndex += 2;
        
        sqlQuery += `)`;
        nameConditionsAdded = true;
      }
      // If we only have firstName (single name like "jiro"), search both fields with variations
      else if (context.firstName) {
        sqlQuery += `(
          LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.last_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($${paramIndex})
        `;
        params.push(`%${context.firstName}%`);
        paramIndex++;
        
        // Add nickname variations
        if (context.firstNameVariations && context.firstNameVariations.length > 1) {
          for (const variation of context.firstNameVariations) {
            if (variation.toLowerCase() !== context.firstName.toLowerCase()) {
              sqlQuery += ` OR LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR LOWER(d.last_name) LIKE LOWER($${paramIndex})`;
              params.push(`%${variation}%`);
              paramIndex++;
            }
          }
        }
        
        sqlQuery += `)`;
        nameConditionsAdded = true;
      }
      // If we only have lastName, search both fields with variations
      else if (context.lastName) {
        sqlQuery += `(
          LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.last_name) LIKE LOWER($${paramIndex}) OR
          LOWER(d.first_name || ' ' || d.last_name) LIKE LOWER($${paramIndex})
        `;
        params.push(`%${context.lastName}%`);
        paramIndex++;
        
        // Add nickname variations
        if (context.lastNameVariations && context.lastNameVariations.length > 1) {
          for (const variation of context.lastNameVariations) {
            if (variation.toLowerCase() !== context.lastName.toLowerCase()) {
              sqlQuery += ` OR LOWER(d.first_name) LIKE LOWER($${paramIndex}) OR LOWER(d.last_name) LIKE LOWER($${paramIndex})`;
              params.push(`%${variation}%`);
              paramIndex++;
            }
          }
        }
        
        sqlQuery += `)`;
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
      // If birth year was calculated from age, add ±2 year tolerance
      if (context.ageAtDeath) {
        sqlQuery += ` AND EXTRACT(YEAR FROM d.date_of_birth) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(context.yearOfBirth - 2, context.yearOfBirth + 2);
        paramIndex += 2;
      } else {
        sqlQuery += ` AND EXTRACT(YEAR FROM d.date_of_birth) = $${paramIndex}`;
        params.push(context.yearOfBirth);
        paramIndex++;
      }
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

    // Add pagination with smart ordering
    const offset = (validPage - 1) * validPageSize;
    
    // Smart ordering: prioritize exact matches, then starts-with, then contains, then recent
    let orderByClause = ` ORDER BY `;
    
    if (hasNameFilter) {
      // Build smart ordering based on match quality
      const searchFirstName = context.firstName?.toLowerCase() || '';
      const searchLastName = context.lastName?.toLowerCase() || '';
      
      orderByClause += `
        CASE
          -- Exact full name match (highest priority)
          WHEN LOWER(d.first_name || ' ' || d.last_name) = LOWER($${paramIndex}) THEN 1
          -- Exact first name AND exact last name
          WHEN LOWER(d.first_name) = LOWER($${paramIndex + 1}) AND LOWER(d.last_name) = LOWER($${paramIndex + 2}) THEN 2
          -- Exact first name only
          WHEN LOWER(d.first_name) = LOWER($${paramIndex + 1}) THEN 3
          -- Exact last name only
          WHEN LOWER(d.last_name) = LOWER($${paramIndex + 2}) THEN 4
          -- First name starts with search term
          WHEN LOWER(d.first_name) LIKE LOWER($${paramIndex + 1} || '%') THEN 5
          -- Last name starts with search term  
          WHEN LOWER(d.last_name) LIKE LOWER($${paramIndex + 2} || '%') THEN 6
          -- First name contains search term
          WHEN LOWER(d.first_name) LIKE LOWER('%' || $${paramIndex + 1} || '%') THEN 7
          -- Last name contains search term
          WHEN LOWER(d.last_name) LIKE LOWER('%' || $${paramIndex + 2} || '%') THEN 8
          ELSE 9
        END,
        d.date_of_death DESC NULLS LAST,  -- Most recent deaths first
        d.last_name,
        d.first_name
      `;
      
      // Add the search terms for ORDER BY
      const fullSearchName = context.firstName && context.lastName 
        ? `${context.firstName} ${context.lastName}`
        : context.firstName || context.lastName || query;
      params.push(fullSearchName, searchFirstName, searchLastName);
      paramIndex += 3;
    } else {
      // Default ordering by most recent deaths
      orderByClause += `d.date_of_death DESC NULLS LAST, d.last_name, d.first_name`;
    }
    
    sqlQuery += orderByClause + ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(validPageSize, offset);

    // Execute search query
    const result = await pool.query(sqlQuery, params);

    // Apply AI-powered ranking if enabled
    let rankedResults = result.rows;
    if (useAI && rankedResults.length > 0) {
      rankedResults = await rankSearchResults(query, result.rows, useAI);
    }

    // Generate "Did You Mean?" suggestions if no results and we have a name query
    let suggestions: string[] = [];
    if (rankedResults.length === 0 && (hasNameFilter || !hasDateFilter)) {
      // Search name from context first, or use the raw query if no name was extracted
      const searchName = context.firstName || context.lastName || query.trim();
      if (searchName && searchName.length >= 3) {
        try {
          const suggestionQuery = `
            SELECT DISTINCT 
              first_name,
              last_name,
              LEAST(
                levenshtein(LOWER(first_name), LOWER($1)),
                levenshtein(LOWER(last_name), LOWER($1)),
                levenshtein(LOWER(first_name || ' ' || last_name), LOWER($1))
              ) as distance
            FROM deceased_persons
            WHERE 
              levenshtein(LOWER(first_name), LOWER($1)) <= 3
              OR levenshtein(LOWER(last_name), LOWER($1)) <= 3
              OR levenshtein(LOWER(first_name || ' ' || last_name), LOWER($1)) <= 4
            ORDER BY distance ASC
            LIMIT 5
          `;
          
          const suggestionResult = await pool.query(suggestionQuery, [searchName]);
          suggestions = suggestionResult.rows.map(row => 
            `${row.first_name} ${row.last_name}`.trim()
          );
        } catch (error) {
          // Levenshtein extension might not be installed, skip suggestions
          console.log('Levenshtein extension not available for suggestions');
        }
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalResults / validPageSize);
    const hasNextPage = validPage < totalPages;
    const hasPrevPage = validPage > 1;

    return NextResponse.json({ 
      results: rankedResults,
      suggestions, // Add suggestions to response
      pagination: {
        page: validPage,
        pageSize: validPageSize,
        totalResults,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
      context, // Return parsed context for debugging
      interpretation: context.interpretation, // Human-readable search interpretation
      aiEnabled: useAI && !!process.env.XAI_API_KEY,
    });
  } catch (error) {
    console.error('Error searching deceased:', error);
    return NextResponse.json({ error: 'Failed to search deceased persons' }, { status: 500 });
  }
}