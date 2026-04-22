// Run with: node check-ac.mjs
const API_URL = process.env.ACTIVECAMPAIGN_API_URL;
const API_KEY = process.env.ACTIVECAMPAIGN_API_KEY;

if (!API_URL || !API_KEY) {
    console.error('Set ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_KEY env vars');
    process.exit(1);
}

const base = API_URL.replace(/\/$/, '') + '/api/3';
const headers = { 'Api-Token': API_KEY, 'Content-Type': 'application/json' };

async function get(path) {
    const r = await fetch(`${base}${path}`, { headers });
    return r.json();
}

const REQUIRED_TAGS = ['Wealth: Survival', 'Wealth: Stability', 'Wealth: Growth', 'Wealth: Freedom'];
const REQUIRED_AUTOMATIONS = ['Survival Mode Follow-up', 'Stability Trap Follow-up', 'Growth Phase Follow-up', 'Freedom Path Follow-up'];

console.log('\n=== TAGS ===');
const { tags } = await get('/tags?limit=50');
for (const name of REQUIRED_TAGS) {
    const found = tags?.find(t => t.tag === name);
    console.log(found ? `  ✅ "${name}" (id: ${found.id})` : `  ❌ MISSING: "${name}"`);
}

console.log('\n=== AUTOMATIONS ===');
const { automations } = await get('/automations?limit=50');
for (const name of REQUIRED_AUTOMATIONS) {
    const found = automations?.find(a => a.name === name);
    console.log(found ? `  ✅ "${name}" (id: ${found.id})` : `  ❌ MISSING: "${name}"`);
}
console.log('');
