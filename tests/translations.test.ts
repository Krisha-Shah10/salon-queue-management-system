import { translations } from '../src/i18n/translations';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
  }
}

console.log('🧪 RUNNING TEST SUITE: Bilingual Localization & Key Equivalence\n');

const enKeys = Object.keys(translations.en) as (keyof typeof translations.en)[];
const guKeys = Object.keys(translations.gu) as (keyof typeof translations.gu)[];

assert(enKeys.length > 0, `English dictionary loaded with ${enKeys.length} keys`);
assert(guKeys.length > 0, `Gujarati dictionary loaded with ${guKeys.length} keys`);

// Check that every English key has a corresponding Gujarati key
let missingInGu: string[] = [];
for (const key of enKeys) {
  if (!(key in translations.gu)) {
    missingInGu.push(key);
  } else if (!translations.gu[key as keyof typeof translations.gu] || translations.gu[key as keyof typeof translations.gu].trim() === '') {
    missingInGu.push(`${key} (empty string)`);
  }
}

assert(missingInGu.length === 0, 'Every English key has a valid Gujarati translation', missingInGu.join(', '));

// Check critical customer labels
assert(translations.gu.app_name.includes('ગ્લેમર') || translations.gu.app_name.includes('રોયલ'), 'Gujarati app name localized properly');
assert(translations.gu.join_queue.includes('કતારમાં જોડાઓ'), 'Gujarati "Join Queue" translated accurately');
assert(translations.gu.its_your_turn.includes('તમારો વારો આવી ગયો છે!'), 'Gujarati "Its Your Turn!" translated accurately');
assert(translations.gu.start_coming.includes('સલૂન આવવાનું શરૂ કરો'), 'Gujarati approach alert translated accurately');
assert(translations.gu.done_service.includes('સેવા પૂર્ણ') || translations.gu.done_service.includes('પૂર્ણ'), 'Gujarati "Done" translated accurately');

console.log(`\n========================================`);
console.log(`TOTAL TRANSLATION TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
