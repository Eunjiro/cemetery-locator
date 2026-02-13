
// lib/ai-search.ts - AI-powered semantic search utilities (Enhanced)

interface EmbeddingResponse {
  embedding: number[];
}

interface SearchContext {
  query: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  fullName?: string;
  yearOfDeath?: number;
  yearOfBirth?: number;
  dateRange?: { start: number; end: number };
  monthOfDeath?: number; // 1-12
  monthOfBirth?: number; // 1-12
  monthRange?: { start: number; end: number }; // months 1-12
  dayOfMonth?: number; // 1-31
  specificDate?: Date; // for full date searches
  ageAtDeath?: number;
  ageRange?: { min: number; max: number };
  plotNumber?: string;
  plotType?: string;
  cemeteryName?: string;
  location?: string;
  relationship?: string;
  isFilipino?: boolean;
  soundexFirstName?: string;
  soundexLastName?: string;
  intentType?: 'find_person' | 'find_location' | 'find_plot' | 'find_family' | 'general';
}

/**
 * Extract structured information from natural language queries
 * Supports both English and Filipino/Tagalog
 */
export function parseNaturalLanguageQuery(query: string): SearchContext {
  const context: SearchContext = { query };
  // Normalize query
  const normalizedQuery = query.trim();
  const queryLower = normalizedQuery.toLowerCase();

  // Check if query is just a year (e.g., "2006")
  const yearOnlyMatch = /^(19\d{2}|20\d{2})$/.test(normalizedQuery);
  if (yearOnlyMatch) {
    const year = parseInt(normalizedQuery);
    context.yearOfDeath = year;
    context.intentType = 'general';
    return context;
  }

  // Month name mappings (English and Filipino)
  const monthNames: Record<string, number> = {
    // English
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12,
    // Filipino
    'enero': 1,
    'pebrero': 2,
    'marso': 3,
    'abril': 4,
    'mayo': 5,
    'hunyo': 6,
    'hulyo': 7,
    'agosto': 8,
    'setyembre': 9, 'septiyembre': 9,
    'oktubre': 10,
    'nobyembre': 11,
    'disyembre': 12
  };
  // Detect Filipino language (expanded)
  const filipinoKeywords = [
    'hanap', 'hanapin', 'nasaan', 'saan', 'namatay', 'pumanaw', 'yumao',
    'ipinanganak', 'libing', 'libingan', 'puntod', 'nitso', 'kamatayan',
    'nailibing', 'pamilya', 'angkan', 'lahi', 'kamag-anak', 'yumaong',
    'hinahanap', 'hinanap', 'namayapa', 'sumakabilang-buhay', 'katawan', 'patay', 'bata', 'matanda', 'asawa', 'anak', 'ina', 'ama', 'magulang', 'kapatid', 'kaibigan', 'kaanak', 'kamag-anak', 'ka-pamilya', 'kaibigan', 'kaanak', 'kaibigan', 'kaibigan', 'kaibigan'
  ];
  context.isFilipino = filipinoKeywords.some(word => queryLower.includes(word));
  // Extract names using multiple patterns (English and Filipino)
  const namePatterns = [
    // English with quotes: "Find \"John Smith\""
    /(?:find|looking for|where is|locate|search for|show me)\s+[\"']([^\"']+)[\"']/i,
    // English: "Find John Smith", "looking for Mary Jones"
    /(?:find|looking for|where is|locate|search for|show me|who is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
    // Filipino: "Hanap si Juan", "Hanapin si Maria", "Nasaan si Pedro"
    /(?:hanap|hanapin|nasaan|saan|sino)\s+(?:si)?\s*([A-Z][a-z]+(?:\s+(?:ng|na)?\s*[A-Z][a-z]+){1,3})/i,
    // English: "John Smith died", "Mary Jones buried", "James Brown's grave" (case-insensitive for partial names)
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(?:died|buried|grave|passed|'s grave|family|plot)/i,
    // Partial name before date keywords: "Jiro died", "maria born" (case-insensitive)
    /\b([a-zA-Z]{3,})\s+(?:died|born|buried|namatay|ipinanganak)/i,
    // Filipino: "Juan dela Cruz namatay", "Maria Santos yumao"
    /([A-Z][a-z]+(?:\s+(?:dela|de la|delos|de los|ng)?\s*[A-Z][a-z]+){1,3})\s+(?:namatay|pumanaw|yumao|yumaong|nailibing)/i,
    // Honorifics: "G./Gng./Bb./Mr./Mrs./Ms./Dr. Name"
    /(?:G\.|Gng\.|Bb\.|Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
    // Full name with middle initial: "John M. Smith"
    /\b([A-Z][a-z]+)\s+([A-Z]\.?)\s+([A-Z][a-z]+)\b/,
    // Standalone capitalized words (2-3 word names)
    /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?\b/,
  ];
  for (const pattern of namePatterns) {
    const match = normalizedQuery.match(pattern);
    if (match) {
      let fullName = match[1];
      
      // Handle middle initial pattern (match[2] is middle, match[3] is last)
      if (match[3]) {
        context.firstName = match[1].trim();
        context.middleName = match[2].trim().replace('.', '');
        context.lastName = match[3].trim();
        context.fullName = `${context.firstName} ${context.middleName} ${context.lastName}`.toLowerCase();
      }
      // If pattern captures two groups, second is last name
      else if (match[2] && match[2].length > 1) {
        context.firstName = match[1].trim();
        context.lastName = match[2].trim();
        context.fullName = `${context.firstName} ${context.lastName}`.toLowerCase();
      } else {
        // Otherwise split the full name
        fullName = fullName.trim();
        const nameParts = fullName.split(/\s+/);
        if (nameParts.length === 1) {
          // Single name - could be first or last, store in firstName for broader matching
          context.firstName = nameParts[0];
          context.fullName = nameParts[0].toLowerCase();
        } else if (nameParts.length === 2) {
          context.firstName = nameParts[0];
          context.lastName = nameParts[1];
          context.fullName = fullName.toLowerCase();
        } else if (nameParts.length === 3) {
          context.firstName = nameParts[0];
          context.middleName = nameParts[1];
          context.lastName = nameParts[2];
          context.fullName = fullName.toLowerCase();
        } else if (nameParts.length > 3) {
          // Compound last names (e.g., "dela Cruz", "de la Rosa")
          context.firstName = nameParts[0];
          context.lastName = nameParts.slice(1).join(' ');
          context.fullName = fullName.toLowerCase();
        }
      }
      // Add phonetic codes for fuzzy matching
      if (context.firstName) context.soundexFirstName = soundex(context.firstName);
      if (context.lastName) context.soundexLastName = soundex(context.lastName);
      if (context.firstName || context.lastName) {
        break;
      }
    }
  }


  // Extract plot number patterns
  const plotPatterns = [
    /\b(?:plot|grave|tomb|niche|lot)\s*#?\s*([A-Za-z0-9\-]+)\b/i,
    /\b([A-Za-z0-9]+)\s*(?:plot|grave)\b/i,
    /\b#\s*([A-Za-z0-9\-]+)\b/,
  ];
  for (const pattern of plotPatterns) {
    const plotMatch = normalizedQuery.match(pattern);
    if (plotMatch) {
      context.plotNumber = plotMatch[1].toUpperCase();
      break;
    }
  }

  // Extract plot type
  const plotTypePatterns = [
    { pattern: /\b(family plot|family grave|family tomb)\b/i, type: 'family' },
    { pattern: /\b(single|individual|private)\s*(?:plot|grave)\b/i, type: 'single' },
    { pattern: /\b(lawn|memorial park)\b/i, type: 'lawn' },
    { pattern: /\b(mausoleum|columbarium|crypt)\b/i, type: 'mausoleum' },
  ];
  for (const { pattern, type } of plotTypePatterns) {
    if (pattern.test(queryLower)) {
      context.plotType = type;
      break;
    }
  }

  // Extract cemetery or location names
  const cemeteryPatterns = [
    /(?:at|in|from|buried at|buried in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+Cemetery|\s+Memorial|\s+Park)?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:cemetery|memorial|park)/i,
  ];
  for (const pattern of cemeteryPatterns) {
    const cemMatch = normalizedQuery.match(pattern);
    if (cemMatch) {
      context.cemeteryName = cemMatch[1].trim();
      break;
    }
  }

  // Extract location references
  const locationPatterns = [
    /(?:in|at|near|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  ];
  if (!context.cemeteryName) {
    for (const pattern of locationPatterns) {
      const locMatch = normalizedQuery.match(pattern);
      if (locMatch) {
        context.location = locMatch[1].trim();
        break;
      }
    }
  }

  // Extract age at death
  const agePatterns = [
    /(?:died at|age|aged|was)\s+(\d{1,3})\s*(?:years?|yrs?|y\.o\.|yo)?/i,
    /\b(\d{1,3})\s*(?:years?|yrs?)\s+old\b/i,
  ];
  for (const pattern of agePatterns) {
    const ageMatch = normalizedQuery.match(pattern);
    if (ageMatch) {
      context.ageAtDeath = parseInt(ageMatch[1]);
      break;
    }
  }

  // Extract age ranges
  const ageRangePattern = /(?:between|ages?)\s+(\d{1,3})\s+(?:and|to|-)\s+(\d{1,3})/i;
  const ageRangeMatch = normalizedQuery.match(ageRangePattern);
  if (ageRangeMatch) {
    const age1 = parseInt(ageRangeMatch[1]);
    const age2 = parseInt(ageRangeMatch[2]);
    context.ageRange = { min: Math.min(age1, age2), max: Math.max(age1, age2) };
  }

  // Extract relationship keywords (for family searches)
  const relationshipPatterns = [
    { pattern: /\b(father|dad|papa|tatay|ama)\b/i, type: 'father' },
    { pattern: /\b(mother|mom|mama|nanay|ina)\b/i, type: 'mother' },
    { pattern: /\b(son|anak na lalaki)\b/i, type: 'son' },
    { pattern: /\b(daughter|anak na babae)\b/i, type: 'daughter' },
    { pattern: /\b(brother|kapatid na lalaki)\b/i, type: 'brother' },
    { pattern: /\b(sister|kapatid na babae)\b/i, type: 'sister' },
    { pattern: /\b(wife|asawa)\b/i, type: 'wife' },
    { pattern: /\b(husband|asawa)\b/i, type: 'husband' },
    { pattern: /\b(family|pamilya|angkan|lahi)\b/i, type: 'family' },
  ];
  for (const { pattern, type } of relationshipPatterns) {
    if (pattern.test(queryLower)) {
      context.relationship = type;
      break;
    }
  }

  // Detect search intent
  if (context.plotNumber) {
    context.intentType = 'find_plot';
  } else if (context.relationship === 'family' || context.plotType === 'family') {
    context.intentType = 'find_family';
  } else if (context.cemeteryName || context.location) {
    context.intentType = 'find_location';
  } else if (context.firstName || context.lastName || context.fullName) {
    context.intentType = 'find_person';
  } else {
    context.intentType = 'general';
  }

  // Simple Soundex implementation for phonetic matching
  function soundex(s: string): string {
    if (!s) return '';
    const a = s.toUpperCase().split('');
    const f = a.shift()!;
    const codes: any = {
      A: '', E: '', I: '', O: '', U: '', Y: '', H: '', W: '',
      B: '1', F: '1', P: '1', V: '1',
      C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
      D: '3', T: '3',
      L: '4',
      M: '5', N: '5',
      R: '6'
    };
    const output =
      f +
      a
        .map((c) => codes[c] || '')
        .filter((c, i, arr) => i === 0 || c !== arr[i - 1])
        .join('');
    return (output + '000').slice(0, 4);
  }
  
  // Extract month-only queries (e.g., "January", "December", "January-March")
  const monthOnlyPattern = new RegExp(
    `^(${Object.keys(monthNames).join('|')})$`,
    'i'
  );
  const monthOnlyMatch = normalizedQuery.match(monthOnlyPattern);
  if (monthOnlyMatch) {
    context.monthOfDeath = monthNames[monthOnlyMatch[1].toLowerCase()];
    context.intentType = 'general';
    return context;
  }

  // Extract month range (e.g., "January-March", "January to March")
  const monthRangePattern = new RegExp(
    `(${Object.keys(monthNames).join('|')})\\s*(?:-|to|through|hasta|hanggang)\\s*(${Object.keys(monthNames).join('|')})`,
    'i'
  );
  const monthRangeMatch = normalizedQuery.match(monthRangePattern);
  if (monthRangeMatch) {
    const startMonth = monthNames[monthRangeMatch[1].toLowerCase()];
    const endMonth = monthNames[monthRangeMatch[2].toLowerCase()];
    context.monthRange = { start: Math.min(startMonth, endMonth), end: Math.max(startMonth, endMonth) };
    context.intentType = 'general';
  }

  // Extract month with year (e.g., "January 2020", "December 2019")
  const monthYearPattern = new RegExp(
    `(${Object.keys(monthNames).join('|')})\\s+(19\\d{2}|20\\d{2})`,
    'i'
  );
  const monthYearMatch = normalizedQuery.match(monthYearPattern);
  if (monthYearMatch) {
    context.monthOfDeath = monthNames[monthYearMatch[1].toLowerCase()];
    context.yearOfDeath = parseInt(monthYearMatch[2]);
    context.intentType = 'general';
  }

  // Extract full date patterns (e.g., "2020-01-15", "01/15/2020", "15 January 2020")
  const fullDatePatterns = [
    // ISO format: 2020-01-15
    /(19\d{2}|20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/,
    // US format: 01/15/2020 or 1/15/2020
    /(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19\d{2}|20\d{2})/,
    // UK format: 15/01/2020 or 15-01-2020
    /(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](19\d{2}|20\d{2})/,
  ];
  for (const pattern of fullDatePatterns) {
    const dateMatch = normalizedQuery.match(pattern);
    if (dateMatch) {
      try {
        let year, month, day;
        if (pattern === fullDatePatterns[0]) { // ISO
          year = parseInt(dateMatch[1]);
          month = parseInt(dateMatch[2]);
          day = parseInt(dateMatch[3]);
        } else if (pattern === fullDatePatterns[1]) { // US
          month = parseInt(dateMatch[1]);
          day = parseInt(dateMatch[2]);
          year = parseInt(dateMatch[3]);
        } else { // UK
          day = parseInt(dateMatch[1]);
          month = parseInt(dateMatch[2]);
          year = parseInt(dateMatch[3]);
        }
        context.specificDate = new Date(year, month - 1, day);
        context.yearOfDeath = year;
        context.monthOfDeath = month;
        context.dayOfMonth = day;
        break;
      } catch {
        // Invalid date, continue
      }
    }
  }

  // Extract "day month year" format (e.g., "15 January 2020")
  const dayMonthYearPattern = new RegExp(
    `(0?[1-9]|[12]\\d|3[01])\\s+(${Object.keys(monthNames).join('|')})\\s+(19\\d{2}|20\\d{2})`,
    'i'
  );
  const dayMonthYearMatch = normalizedQuery.match(dayMonthYearPattern);
  if (dayMonthYearMatch) {
    const day = parseInt(dayMonthYearMatch[1]);
    const month = monthNames[dayMonthYearMatch[2].toLowerCase()];
    const year = parseInt(dayMonthYearMatch[3]);
    context.specificDate = new Date(year, month - 1, day);
    context.yearOfDeath = year;
    context.monthOfDeath = month;
    context.dayOfMonth = day;
  }

  // Extract years (death or birth) - look for 4-digit years
  const yearMatches = normalizedQuery.match(/\b(19\d{2}|20\d{2})\b/g);
  if (yearMatches && !context.yearOfDeath && !context.dateRange) {
    const years = yearMatches.map((y: string) => parseInt(y));
    // Fuzzy keyword matching for all relevant year keywords
    const fuzzyMatchAny = (word: string, keywords: string[], maxDist = 1) => {
      return keywords.some(kw => levenshteinDistance(word, kw) <= maxDist);
    };
    const words = queryLower.split(/\s+/).filter(w => w.length >= 4);
    const birthKeywords = ['born', 'birth', 'ipinanganak', 'isinilang', 'kapanganakan'];
    const deathKeywords = ['died', 'death', 'passed', 'buried', 'deceased', 'namatay', 'pumanaw', 'yumao', 'yumaong', 'nailibing', 'kamatayan'];
    if (years.length === 1) {
      const hasBirth = queryLower.match(/\b(born|birth|ipinanganak|isinilang|kapanganakan)\b/) || words.some(w => fuzzyMatchAny(w, birthKeywords));
      const hasDeath = queryLower.match(/\b(died|death|passed|buried|deceased|namatay|pumanaw|yumao|yumaong|nailibing|kamatayan)\b/) || words.some(w => fuzzyMatchAny(w, deathKeywords));
      if (hasBirth) {
        context.yearOfBirth = years[0];
      } else if (hasDeath) {
        context.yearOfDeath = years[0];
      } else {
        // Default to death year as it's more commonly searched
        context.yearOfDeath = years[0];
      }
    } else if (years.length >= 2) {
      // Multiple years - treat as range
      context.dateRange = { start: Math.min(...years), end: Math.max(...years) };
    }
  }
  
  // Extract year ranges - Enhanced English and Filipino patterns
  const rangePatterns = [
    /\b(\d{4})\s*(?:-|to|through)\s*(\d{4})\b/i,
    /between\s+(\d{4})\s+and\s+(\d{4})/i,
    /from\s+(\d{4})\s+to\s+(\d{4})/i,
    // Filipino: "mula 1990 hanggang 2000", "noong 1990 hanggang 2000"
    /(?:mula|noong|simula)\s+(\d{4})\s+(?:hanggang|hasta)\s+(\d{4})/i,
    // Filipino: "sa pagitan ng 1990 at 2000"
    /sa\s+pagitan\s+ng\s+(\d{4})\s+(?:at|hanggang)\s+(\d{4})/i,
  ];
  
  if (!context.dateRange) {
    for (const pattern of rangePatterns) {
      const rangeMatch = normalizedQuery.match(pattern);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        context.dateRange = { start: Math.min(start, end), end: Math.max(start, end) };
        break;
      }
    }
  }

  // Extract month with context (e.g., "died in January", "born in March", "namatay noong Enero")
  if (!context.monthOfDeath && !context.monthOfBirth) {
    const monthContextPattern = new RegExp(
      `(?:died|death|passed|buried|namatay|pumanaw|yumao).*?(${Object.keys(monthNames).join('|')})`,
      'i'
    );
    const monthContextMatch = queryLower.match(monthContextPattern);
    if (monthContextMatch) {
      context.monthOfDeath = monthNames[monthContextMatch[1].toLowerCase()];
    }

    const birthMonthPattern = new RegExp(
      `(?:born|birth|ipinanganak).*?(${Object.keys(monthNames).join('|')})`,
      'i'
    );
    const birthMonthMatch = queryLower.match(birthMonthPattern);
    if (birthMonthMatch) {
      context.monthOfBirth = monthNames[birthMonthMatch[1].toLowerCase()];
    }
  }
  
  return context;
}

/**
 * Calculate semantic similarity between query and text using xAI Grok
 * Falls back to keyword matching if API is unavailable
 */
export async function calculateSemanticSimilarity(
  query: string,
  text: string,
  useAI: boolean = true
): Promise<number> {
  // If no API key or AI disabled, use keyword-based similarity
  if (!useAI || !process.env.XAI_API_KEY) {
    return calculateKeywordSimilarity(query, text);
  }
  
  try {
    // Use Hugging Face's feature extraction API for embeddings
    const queryEmbedding = await getEmbedding(query);
    const textEmbedding = await getEmbedding(text);
    
    if (!queryEmbedding || !textEmbedding) {
      return calculateKeywordSimilarity(query, text);
    }
    
    // Calculate cosine similarity
    const similarity = cosineSimilarity(queryEmbedding, textEmbedding);
    
    // Normalize to 0-1 range (cosine similarity is already -1 to 1, we map to 0-1)
    return (similarity + 1) / 2;
  } catch (error) {
    console.error('Semantic similarity error, falling back to keyword matching:', error);
    return calculateKeywordSimilarity(query, text);
  }
}

/**
 * Get embeddings from xAI Grok
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(
      'https://api.x.ai/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: 'grok-1',
        }),
      }
    );
    
    if (!response.ok) {
      console.error('xAI Grok API error:', response.status, response.statusText);
      return null;
    }
    
    const result = await response.json();
    
    // Handle xAI response format
    if (result.data && Array.isArray(result.data) && result.data[0]?.embedding) {
      return result.data[0].embedding;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting embedding from Grok:', error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * Fallback keyword-based similarity calculation
 * Uses enhanced fuzzy matching with phonetic similarity
 */
function calculateKeywordSimilarity(query: string, text: string): number {
  const queryLower = query.toLowerCase().trim();
  const textLower = text.toLowerCase().trim();
  
  // Exact match gets highest score
  if (textLower === queryLower) {
    return 1.0;
  }
  
  // Full substring match
  if (textLower.includes(queryLower)) {
    return 0.9;
  }
  
  // Tokenize and clean (remove English and Filipino stopwords)
  const stopwords = [
    // English
    'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'was',
    // Filipino/Tagalog
    'ang', 'ng', 'sa', 'na', 'ay', 'si', 'ni', 'mga', 'at', 'o', 'pa',
  ];
  
  const queryTokens = queryLower
    .split(/\s+/)
    .filter(t => t.length > 1 && !stopwords.includes(t));
  const textTokens = textLower
    .split(/\s+/)
    .filter(t => t.length > 1);
  
  if (queryTokens.length === 0) {
    return 0;
  }
  
  let totalScore = 0;
  let matchedTokens = 0;
  
  for (const qToken of queryTokens) {
    let bestScore = 0;
    
    for (const tToken of textTokens) {
      let score = 0;
      
      // Exact token match
      if (tToken === qToken) {
        score = 1.0;
      }
      // One token starts with the other (e.g., "John" matches "Johnny")
      else if (tToken.startsWith(qToken)) {
        score = 0.9;
      }
      else if (qToken.startsWith(tToken)) {
        score = 0.85;
      }
      // Contains token
      else if (tToken.includes(qToken) || qToken.includes(tToken)) {
        score = 0.75;
      }
      // Fuzzy match using edit distance
      else {
        const maxLen = Math.max(qToken.length, tToken.length);
        const distance = levenshteinDistance(qToken, tToken);
        const similarity = 1 - (distance / maxLen);
        
        if (similarity >= 0.6) {
          score = similarity * 0.7; // Scale down fuzzy matches
        }
      }
      
      bestScore = Math.max(bestScore, score);
    }
    
    if (bestScore > 0) {
      matchedTokens++;
      totalScore += bestScore;
    }
  }
  
  // Calculate final score with penalties for unmatched tokens
  const matchRatio = matchedTokens / queryTokens.length;
  const avgScore = matchedTokens > 0 ? totalScore / queryTokens.length : 0;
  
  // Combine both metrics: heavily weight match ratio, moderately weight avg score
  return (matchRatio * 0.6) + (avgScore * 0.4);
}

/**
 * Simple fuzzy string matching
 */
function fuzzyMatch(s1: string, s2: string, threshold: number = 0.7): boolean {
  if (s1.length < 3 || s2.length < 3) return false;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const similarity = 1 - (distance / maxLen);
  
  return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

// Simple Soundex implementation for phonetic matching
function soundex(s: string): string {
  if (!s) return '';
  const a = s.toUpperCase().split('');
  const f = a.shift()!;
  const codes: any = {
    A: '', E: '', I: '', O: '', U: '', Y: '', H: '', W: '',
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6'
  };
  const output =
    f +
    a
      .map((c) => codes[c] || '')
      .filter((c, i, arr) => i === 0 || c !== arr[i - 1])
      .join('');
  return (output + '000').slice(0, 4);
}

/**
 * Rank search results using AI-powered semantic search
 */
export async function rankSearchResults(
  query: string,
  results: any[],
  useAI: boolean = true
): Promise<any[]> {
  // Parse the natural language query
  const context = parseNaturalLanguageQuery(query);
  
  // Calculate similarity scores for each result
  const scoredResults = await Promise.all(
    results.map(async (result) => {
      // Build a searchable text representation
      const fullName = `${result.first_name} ${result.last_name}`.toLowerCase();
      const deathYear = result.date_of_death ? new Date(result.date_of_death).getFullYear().toString() : '';
      const birthYear = result.date_of_birth ? new Date(result.date_of_birth).getFullYear().toString() : '';
      const searchText = [
        fullName,
        result.plot_number,
        result.cemetery_name,
        deathYear,
        birthYear,
      ].filter(Boolean).join(' ');
      
      // Calculate base semantic similarity
      let score = await calculateSemanticSimilarity(query.toLowerCase(), searchText, useAI);
      
      // Apply strong boosts for exact field matches
      const queryLower = query.toLowerCase();
      const firstNameLower = result.first_name?.toLowerCase() || '';
      const lastNameLower = result.last_name?.toLowerCase() || '';
      
      // Full name exact match (highest priority)
      if (context.fullName && fullName === context.fullName) {
        score += 1.0;
      }
      
      // Exact and fuzzy name match boosts (stronger)
      if (context.firstName) {
        const ctxFirst = context.firstName.toLowerCase();
        if (firstNameLower === ctxFirst) {
          score += 0.7;
        } else if (firstNameLower.startsWith(ctxFirst)) {
          score += 0.4;
        } else if (firstNameLower.includes(ctxFirst)) {
          score += 0.25;
        } else {
          // Fuzzy match for misspellings (Levenshtein)
          const lev = levenshteinDistance(firstNameLower, ctxFirst);
          if (lev <= 1) score += 0.3;
          else if (lev === 2) score += 0.18;
        }
        // Phonetic (Soundex) matching for names
        if (context.soundexFirstName && soundex(firstNameLower) === context.soundexFirstName) {
          score += 0.18;
        }
      }
      
      if (context.lastName) {
        const ctxLast = context.lastName.toLowerCase();
        if (lastNameLower === ctxLast) {
          score += 0.8;
        } else if (lastNameLower.startsWith(ctxLast)) {
          score += 0.45;
        } else if (lastNameLower.includes(ctxLast)) {
          score += 0.3;
        } else {
          // Fuzzy match for misspellings (Levenshtein)
          const lev = levenshteinDistance(lastNameLower, ctxLast);
          if (lev <= 1) score += 0.35;
          else if (lev === 2) score += 0.2;
        }
        // Phonetic (Soundex) matching for names
        if (context.soundexLastName && soundex(lastNameLower) === context.soundexLastName) {
          score += 0.22;
        }
      }
      
      // Plot number exact match (very high priority for plot searches)
      if (context.plotNumber && result.plot_number) {
        const plotLower = result.plot_number.toLowerCase();
        const ctxPlotLower = context.plotNumber.toLowerCase();
        if (plotLower === ctxPlotLower) {
          score += 1.5; // Highest boost
        } else if (plotLower.includes(ctxPlotLower) || ctxPlotLower.includes(plotLower)) {
          score += 0.8;
        }
      }
      
      // Cemetery name matching
      if (context.cemeteryName && result.cemetery_name) {
        const cemLower = result.cemetery_name.toLowerCase();
        const ctxCemLower = context.cemeteryName.toLowerCase();
        if (cemLower.includes(ctxCemLower) || ctxCemLower.includes(cemLower)) {
          score += 0.6;
        }
      }
      
      // Plot type matching
      if (context.plotType && result.plot_type) {
        if (result.plot_type.toLowerCase() === context.plotType) {
          score += 0.4;
        }
      }
      
      // Date-based boosting (stronger)
      if (result.date_of_death) {
        const deathDate = new Date(result.date_of_death);
        const deathYearNum = deathDate.getFullYear();
        const deathMonthNum = deathDate.getMonth() + 1; // JavaScript months are 0-indexed
        const deathDayNum = deathDate.getDate();
        
        // Specific date match (highest priority for dates)
        if (context.specificDate) {
          const specificDate = new Date(context.specificDate);
          if (deathDate.toDateString() === specificDate.toDateString()) {
            score += 1.2; // Very high boost for exact date match
          }
        }
        
        // Year match
        if (context.yearOfDeath && deathYearNum === context.yearOfDeath) {
          score += 0.6;
        }
        
        // Date range match
        if (context.dateRange && deathYearNum >= context.dateRange.start && deathYearNum <= context.dateRange.end) {
          score += 0.4;
        }
        
        // Month match
        if (context.monthOfDeath && deathMonthNum === context.monthOfDeath) {
          score += 0.5; // Good boost for month match
        }
        
        // Month range match
        if (context.monthRange && deathMonthNum >= context.monthRange.start && deathMonthNum <= context.monthRange.end) {
          score += 0.35;
        }
        
        // Day of month match
        if (context.dayOfMonth && deathDayNum === context.dayOfMonth) {
          score += 0.3;
        }
      }
      
      if (result.date_of_birth) {
        const birthDate = new Date(result.date_of_birth);
        const birthYearNum = birthDate.getFullYear();
        const birthMonthNum = birthDate.getMonth() + 1;
        
        // Year match
        if (context.yearOfBirth && birthYearNum === context.yearOfBirth) {
          score += 0.35;
        }
        
        // Month match for birth
        if (context.monthOfBirth && birthMonthNum === context.monthOfBirth) {
          score += 0.3;
        }
      }
      
      // Age-based boosting (if we have birth and death dates)
      if (context.ageAtDeath && result.date_of_birth && result.date_of_death) {
        const birth = new Date(result.date_of_birth);
        const death = new Date(result.date_of_death);
        const ageAtDeath = death.getFullYear() - birth.getFullYear();
        if (Math.abs(ageAtDeath - context.ageAtDeath) === 0) {
          score += 0.5;
        } else if (Math.abs(ageAtDeath - context.ageAtDeath) <= 2) {
          score += 0.25;
        }
      }
      
      // Age range matching
      if (context.ageRange && result.date_of_birth && result.date_of_death) {
        const birth = new Date(result.date_of_birth);
        const death = new Date(result.date_of_death);
        const ageAtDeath = death.getFullYear() - birth.getFullYear();
        if (ageAtDeath >= context.ageRange.min && ageAtDeath <= context.ageRange.max) {
          score += 0.4;
        }
      }
      
      // Family/relationship boost (if same last name for family searches)
      if (context.intentType === 'find_family' && context.lastName) {
        const ctxLast = context.lastName.toLowerCase();
        if (lastNameLower === ctxLast || lastNameLower.includes(ctxLast)) {
          score += 0.3;
        }
      }
      
      // Intent-based adjustments
      if (context.intentType === 'find_plot' && context.plotNumber) {
        // For plot searches, prioritize plot matches over name matches
        score *= 1.2;
      }
      
      return { ...result, score, _context: context };
    })
  );
  
  // Sort by score (descending)
  const sorted = scoredResults.sort((a, b) => b.score - a.score);
  
  // Return top results with relevance threshold
  // For plot searches, be more strict; for name searches, be more lenient
  const threshold = context.intentType === 'find_plot' ? 0.3 : 0.1;
  const filtered = sorted.filter(r => r.score >= threshold);
  
  return filtered.slice(0, 50);
}
