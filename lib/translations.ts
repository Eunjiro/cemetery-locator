// Bilingual translations for English and Filipino

export const translations = {
  en: {
    searchPlaceholder: "Ask naturally: 'Find John who died in 2020'",
    searchPlaceholderSimple: "Search: 'John Smith' or 'died 2020'",
    searchTips: "Search Tips",
    naturalLanguageExamples: "Natural Language Search Examples",
    tryExample: "💡 Try using complete sentences! The AI understands natural language queries.",
    aiSearch: "AI Search",
    noResults: "No results found",
    noResultsMessage: "No deceased persons found matching",
    searchTipsTitle: "Search tips:",
    searchTip1: "Try using full names: \"John Smith\"",
    searchTip2: "Include years: \"died 2020\"",
    searchTip3: "Use natural language: \"Find Mary born 1950\"",
    searchTip4: "Check spelling and try variations",
    bestMatch: "Best Match",
    born: "Born",
    died: "Died",
    plot: "Plot",
    layer: "Layer",
    view: "View",
    allowLocation: "Allow Location Access",
    secureConnectionRequired: "Secure Connection Required",
    secureConnectionMessage: "Location access requires HTTPS. Please contact your administrator.",
    locationBlocked: "Location Access Blocked",
    tryAgain: "Try Again",
    centerToGrave: "Center to grave location",
    locatedGrave: "Located Grave",
    burialDate: "Burial",
    getDirections: "Get Directions",
    walkingMode: "Walking",
    drivingMode: "Driving",
    cyclingMode: "Cycling",
    startNavigation: "Start Navigation",
    stopNavigation: "Stop Navigation",
    examples: {
      ex1: "Find John Smith died 2020",
      ex2: "Mary Jones buried 1995",
      ex3: "graves from 1990 to 2000",
      ex4: "Johnson family plot",
      ex5: "plot 123",
    }
  },
  fil: {
    searchPlaceholder: "Magtanong: 'Hanap si Juan namatay 2020'",
    searchPlaceholderSimple: "Maghanap: 'Juan dela Cruz' o 'namatay 2020'",
    searchTips: "Mga Tip sa Paghahanap",
    naturalLanguageExamples: "Mga Halimbawa ng Natural na Paghahanap",
    tryExample: "💡 Subukan ang kumpletong pangungusap! Nauunawaan ng AI ang natural na mga tanong.",
    aiSearch: "AI Paghahanap",
    noResults: "Walang resulta",
    noResultsMessage: "Walang natagpuang yumaong tao na tumutugma sa",
    searchTipsTitle: "Mga tip sa paghahanap:",
    searchTip1: "Gumamit ng buong pangalan: \"Juan dela Cruz\"",
    searchTip2: "Isama ang taon: \"namatay 2020\"",
    searchTip3: "Gumamit ng natural na wika: \"Hanap si Maria ipinanganak 1950\"",
    searchTip4: "Suriin ang spelling at subukan ang iba't ibang paraan",
    bestMatch: "Pinakamatch",
    born: "Ipinanganak",
    died: "Namatay",
    plot: "Plot",
    layer: "Layer",
    view: "Tingnan",
    allowLocation: "Payagan ang Lokasyon",
    secureConnectionRequired: "Kailangan ng Secure Connection",
    secureConnectionMessage: "Ang access sa lokasyon ay nangangailangan ng HTTPS. Makipag-ugnayan sa administrator.",
    locationBlocked: "Naka-block ang Access sa Lokasyon",
    tryAgain: "Subukan Muli",
    centerToGrave: "Pumunta sa puntod",
    locatedGrave: "Natagpuang Puntod",
    burialDate: "Libing",
    getDirections: "Kumuha ng Direksyon",
    walkingMode: "Lakad",
    drivingMode: "Sasakyan",
    cyclingMode: "Bisikleta",
    startNavigation: "Simulan ang Nabigasyon",
    stopNavigation: "Ihinto ang Nabigasyon",
    examples: {
      ex1: "Hanap si Juan dela Cruz namatay 2020",
      ex2: "Maria Santos nailibing 1995",
      ex3: "mga puntod mula 1990 hanggang 2000",
      ex4: "pamilya Santos plot",
      ex5: "plot 123",
    }
  }
};

export type Language = 'en' | 'fil';

export function t(lang: Language, key: string): string {
  const keys = key.split('.');
  let value: any = translations[lang];
  
  for (const k of keys) {
    value = value?.[k];
  }
  
  return typeof value === 'string' ? value : key;
}
