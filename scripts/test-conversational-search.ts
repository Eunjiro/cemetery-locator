// Test conversational search queries
import { parseNaturalLanguageQuery } from '../lib/ai-search';

const testQueries = [
  // ===== ENGLISH CONVERSATIONAL =====
  "can you find jiro about 20 age I think bornd on 2023",
  "find john around 25 years old",
  "i'm looking for maria santos",
  "do you know where john smith is buried",
  "who is pedro dela cruz",
  "tell me about mary jones who died in 2020",
  "any record of juan reyes?",
  "the grave of maria",
  "where's john at",
  "i need to find someone named pedro",
  "show me people who died in january 2020",
  
  // ===== FILIPINO CONVERSATIONAL =====
  "hanap si juan dela cruz",
  "nasaan si maria santos",
  "sino si pedro reyes",
  "pakihanap si jose",
  "pwede mo ba hanapin si maria",
  "gusto kong hanapin si pedro namatay 2020",
  "may record ba ni juan?",
  "libingan ni maria",
  "asan si john",
  
  // ===== HYBRID (English + Filipino) =====
  "can you find si juan",
  "help me hanap si maria about 30 years old",
  "find si pedro namatay 2020",
  "where si maria santos",
  "pwede mo find john smith",
  "hanap ang john maybe born 1990",
  
  // ===== CASUAL / VOICE-TO-TEXT =====
  "um can you find jiro he was about 20 years old",
  "i think jose died around 2019",
  "maybe maria was born 1985",
  "probably died about 30 age",
  "looking for john i think he's mga 25 taon",
  
  // ===== EDGE CASES =====
  "jiro",
  "maria santos",
  "2020",
  "january 2020",
  "john died 2020 around age 50",
];

console.log('Testing Conversational Natural Language Queries:\n');
console.log('='.repeat(90));

let passed = 0;
let warnings = 0;

testQueries.forEach((query, index) => {
  console.log(`\n${index + 1}. Query: "${query}"`);
  const result = parseNaturalLanguageQuery(query);
  
  const fields: string[] = [];
  if (result.firstName) fields.push(`Name: ${result.firstName}${result.lastName ? ' ' + result.lastName : ''}`);
  if (result.middleName) fields.push(`Middle: ${result.middleName}`);
  if (result.ageAtDeath) fields.push(`Age: ${result.ageAtDeath}`);
  if (result.yearOfBirth) fields.push(`Birth: ${result.yearOfBirth}`);
  if (result.yearOfDeath) fields.push(`Death: ${result.yearOfDeath}`);
  if (result.monthOfDeath) fields.push(`Month: ${result.monthOfDeath}`);
  if (result.dateRange) fields.push(`Range: ${result.dateRange.start}-${result.dateRange.end}`);
  if (result.relationship) fields.push(`Relation: ${result.relationship}`);
  if (result.intentType) fields.push(`Intent: ${result.intentType}`);
  if (result.isFilipino) fields.push(`Filipino: yes`);
  
  if (fields.length > 0) {
    console.log(`   ✓ ${fields.join(' | ')}`);
    passed++;
  } else {
    console.log(`   ⚠ No fields extracted`);
    warnings++;
  }
});

console.log('\n' + '='.repeat(90));
console.log(`\n✓ Results: ${passed} parsed successfully, ${warnings} warnings out of ${testQueries.length} total`);
console.log('\nSupported Conversational Patterns:');
console.log('  English:  "can you find X", "i\'m looking for X", "where is X", "any record of X"');
console.log('  Filipino: "hanap si X", "nasaan si X", "sino si X", "libingan ni X"');
console.log('  Hybrid:   "find si X", "help me hanap X", "pwede mo find X"');
console.log('  Casual:   "um find jiro about 20 age", "i think jose died 2019"');
console.log('  Voice:    Microphone button auto-transcribes and searches');
