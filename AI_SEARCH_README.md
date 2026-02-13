# AI-Powered Natural Language Search 🤖

This application now includes AI-powered natural language search for finding graves using **xAI Grok**!

## Features

✅ **Understands natural language queries**:
- "Find John Smith who died in 2020"
- "Looking for Mary buried between 1990 and 2000"
- "Show me graves from January 2020"
- "Died in December"
- "2020-2026"
- "Where is the Johnson family plot?"
- "locate graves from 1985"
- "Show me plot A-123"
- "Find John M. Smith who died at age 65"
- "January to March 2020"

✅ **Enhanced date & time search**:
- **Year search**: "2020", "died 2015", "namatay 2019"
- **Year ranges**: "2020-2026", "1990 to 2000", "between 2010 and 2020"
- **Month search**: "January", "December 2020", "died in March"
- **Month ranges**: "January-March", "January to March 2020"
- **Specific dates**: "2020-01-15", "15 January 2020", "01/15/2020"
- **Filipino support**: "Enero 2020", "mula 2015 hanggang 2020", "Disyembre"
- **Natural language**: "Find people who died in January", "Show graves from December to February"

✅ **Smart name matching**:
- Handles typos and variations
- Understands first, middle, and last names
- Works with partial names
- Supports compound names (dela Cruz, de la Rosa)
- Phonetic matching for pronunciation variations
- Honorifics support (Mr., Mrs., Dr., G., Gng., Bb.)

✅ **Advanced search capabilities**:
- **Plot number search**: "plot 123", "grave #A-45", "tomb B12"
- **Cemetery location**: "buried at Manila Memorial", "in Loyola"
- **Age-based search**: "died at 65", "80 years old", "between ages 70 and 80"
- **Date intelligence**: Extracts years, understands date ranges
- **Family searches**: "Johnson family", "Smith family plot"
- **Relationship keywords**: father, mother, wife, husband, family
- **Plot types**: family plot, single grave, mausoleum, columbarium

✅ **Multi-language support**:
- Full English support
- Tagalog/Filipino support (hanap, namatay, libingan, etc.)
- Mixed language queries

✅ **Always works**:
- AI enhancement is optional
- Falls back to keyword search if API is unavailable
- Zero cost fallback system
- **Pagination support**: Browse through large result sets
- **Year-only search**: Type "2006" to see all records from that year

## Setup (Optional - for AI Enhancement)

### Using xAI Grok (Recommended)

1. **Get an API key**:
   - Go to [xAI Console](https://console.x.ai/)
   - Sign up for an account
   - Create a new API key
   - Check their pricing at [xAI Pricing](https://x.ai/api)

2. **Add to your `.env.local`**:
   ```bash
   XAI_API_KEY=xai-your_api_key_here
   ```

3. **Restart your dev server**:
   ```bash
   npm run dev
   ```

That's it! The search will now use Grok-powered semantic similarity.

### Without API Key

The system works perfectly fine without any API key! It uses an intelligent keyword-based matching system with:
- Fuzzy string matching
- Phonetic similarity
- Name parsing and extraction
- Date range detection

## How It Works

1. **Query Parsing**: Extracts names, dates, and other info from natural language
2. **Smart SQL**: Builds optimized database queries based on parsed context
3. **AI Ranking** (optional): Uses xAI Grok's embeddings to rank results by semantic similarity
4. **Fallback**: If AI is unavailable, uses enhanced fuzzy matching

## Example Queries

### Person Search
```
"John Smith"                          → Traditional name search
"Find Mary Jones died 2020"           → Natural language with date
"John M. Smith"                       → Name with middle initial
"Dr. Robert dela Cruz"                → Name with honorific
"Looking for Juanita aged 75"         → Name with age
"Jiro died 2026"                      → Partial name + date (finds "Eunjiro")
"mary 2020"                           → Case-insensitive partial match
// NEW: Nickname search
"Bob Smith"                           → Finds "Robert Smith"
"Mike died 2020"                      → Finds "Michael"
"Jun dela Cruz"                       → Finds "Junior dela Cruz"
"Tony"                                → Finds "Antonio" or "Anthony"

// NEW: Name order flexibility
"Smith John"                          → Finds "John Smith"
"dela Cruz Juan"                      → Finds "Juan dela Cruz"

// NEW: Special characters
"Jose Garcia"                         → Finds "José Garcia"
"Pena"                                → Finds "Peña"
"OBrien"                              → Finds "O'Brien"```

### Plot & Location Search
```
"plot 123"                            → Plot number search
"grave #A-45"                         → Plot with prefix
"Johnson family plot"                 → Family plot search
"buried at Manila Memorial Park"      → Cemetery search
"graves in Loyola Memorial"           → Location-based search
```

### Date & Age Search
```
"2020"                                → All deaths in 2020
"died 2026"                           → All deaths in 2026 (natural language)
"January"                             → All deaths in January (any year)
"December 2020"                       → Specific month and year
"January-March"                       → Month range (any year)
"January to March 2020"               → Month range in specific year
"2020-2026"                           → Year range search
"died between 1990 and 2000"          → Natural language year range
"Looking for graves from 1985"        → Single year search
"2006"                                → Show all from 2006 (with pagination)
"2020-01-15"                          → Specific date (ISO format)
"15 January 2020"                     → Specific date (readable format)
"01/15/2020"                          → Specific date (US format)
"died in March"                       → Natural language month
"died at age 65"                      → Age at death
"between 70 and 80 years old"         → Age range
```

### Filipino/Tagalog Date Queries
```
"Enero 2020"                          → January 2020
"Disyembre"                           → December
"mula 2015 hanggang 2020"             → From 2015 to 2020
"namatay noong Enero"                 → Died in January
"2019-2025"                           → Year range
```

### Combined Search (Name + Date/Month)
```
"John Smith 2020"                     → Name and year
"Jiro died 2026"                      → Partial name + date (finds "Eunjiro Marbilla")
"Maria Santos January 2015"           → Name, month, and year
"Find Juan dela Cruz died 2020-2026"  → Name and year range
"Pedro namatay Enero 2019"            → Filipino name and date
"Mary born 1950 died December 2020"   → Name, birth year, and death month
"maria died 2020"                     → Case-insensitive name + year
```

### Family & Relationship Search
```
"Where is my father buried?"          → Relationship search
"Smith family graves"                 → Family name search
"Looking for the Santos family plot"  → Family plot search
```

### Filipino/Tagalog Queries
```
"Hanap si Juan dela Cruz"             → Find Juan dela Cruz
"Nasaan si Maria Santos namatay 2020" → Where is Maria Santos died 2020
"Libingan ng pamilya Reyes"           → Reyes family cemetery
```

## API Usage

Search endpoint automatically uses AI:
```
GET /api/deceased/search?q=find+john+smith+died+2020
```

With pagination:
```
GET /api/deceased/search?q=2006&page=2&pageSize=20
```

Disable AI (use only keyword matching):
```
GET /api/deceased/search?q=john+smith&ai=false
```

### Response Format
```json
{
  "results": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalResults": 145,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "context": {...},
  "aiEnabled": true
}
```

## Cost

- **Paid** with xAI Grok (check [xAI Pricing](https://x.ai/api) for rates)
- **FREE** without API key (unlimited, uses local fuzzy matching)
- Pay only for what you use with xAI
- No monthly subscription required

## Alternative Options

### 1. Self-hosted Ollama (Unlimited & Free)
- Install [Ollama](https://ollama.ai/)
- Run locally: `ollama run nomic-embed-text`
- Modify `lib/ai-search.ts` to use local endpoint
- Perfect for production with high traffic

### 2. Hugging Face (Free Tier Available)
- 30,000 requests/month free
- Easy to switch back by changing the API endpoint in `lib/ai-search.ts`

### 2. OpenRouter (Free Credits)
- Sign up at [OpenRouter](https://openrouter.ai/)
- Get free credits
- Change endpoint in `lib/ai-search.ts`

## Performance

- Typical query: **< 500ms** (with AI)
- Fallback query: **< 100ms** (without AI)
- Results cached on client side
- Debounced search (300ms delay)

## Privacy

- AI processing happens via API (if enabled)
- No personal data stored by Hugging Face
- Queries are not saved
- Use local fallback for complete privacy
