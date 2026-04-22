// ActiveCampaign integration — contact sync, wealth segment tagging, and automation enrollment

const STAGE_TO_TAG = {
    'Survival Mode': 'Wealth: Survival',
    'Stability Trap': 'Wealth: Stability',
    'Growth Phase': 'Wealth: Growth',
    'Freedom Path': 'Wealth: Freedom'
};

// Automation names must exist in ActiveCampaign before they can be used
const STAGE_TO_AUTOMATION = {
    'Survival Mode': 'Wealth: Survival Automation',
    'Stability Trap': 'Wealth: Stability Automation',
    'Growth Phase': 'Wealth: Growth Automation',
    'Freedom Path': 'Wealth: Freedom Automation'
};

function getConfig() {
    const apiUrl = process.env.ACTIVECAMPAIGN_API_URL;
    const apiKey = process.env.ACTIVECAMPAIGN_API_KEY;

    if (!apiUrl || !apiKey) {
        throw new Error('ACTIVECAMPAIGN_API_URL and ACTIVECAMPAIGN_API_KEY must be set');
    }

    return {
        baseUrl: apiUrl.replace(/\/$/, ''),
        headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json'
        }
    };
}

async function acFetch(path, options = {}) {
    const { baseUrl, headers } = getConfig();
    const res = await fetch(`${baseUrl}/api/3${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`AC API ${options.method || 'GET'} ${path} → ${res.status}: ${body}`);
    }

    return res.json();
}

// Upsert contact by email. Returns the AC contact id.
async function syncContact({ email, firstName, lastName, phone }) {
    const body = {
        contact: {
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || ''
        }
    };

    const data = await acFetch('/contact/sync', {
        method: 'POST',
        body: JSON.stringify(body)
    });

    return data.contact.id;
}

// Find a tag by exact name. Returns the tag id or null.
async function findTagId(tagName) {
    const data = await acFetch(`/tags?search=${encodeURIComponent(tagName)}&limit=20`);
    const match = (data.tags || []).find(t => t.tag === tagName);
    return match ? match.id : null;
}

// Add a tag to a contact (idempotent — AC ignores duplicate contactTags).
async function addTag(contactId, tagId) {
    await acFetch('/contactTags', {
        method: 'POST',
        body: JSON.stringify({ contactTag: { contact: String(contactId), tag: String(tagId) } })
    });
}

// Find an automation by exact name. Returns the automation id or null.
async function findAutomationId(name) {
    const data = await acFetch(`/automations?search=${encodeURIComponent(name)}&limit=20`);
    const match = (data.automations || []).find(a => a.name === name);
    return match ? match.id : null;
}

// Enroll a contact in an automation. AC deduplicates active enrollments automatically.
async function enrollInAutomation(contactId, automationId) {
    await acFetch('/contactAutomations', {
        method: 'POST',
        body: JSON.stringify({ contactAutomation: { contact: String(contactId), automation: String(automationId) } })
    });
}

/**
 * Tag a contact with their wealth segment and enroll them in the corresponding automation.
 *
 * @param {{ email, firstName, lastName, phone }} contactData
 * @param {string} stage - One of the four wealth stages from RuleEngine.getStage()
 * @returns {{ contactId, tagName, tagId, automationId }}
 */
export async function tagContactWithWealthSegment(contactData, stage) {
    const tagName = STAGE_TO_TAG[stage];
    if (!tagName) throw new Error(`Unknown stage: ${stage}`);

    const contactId = await syncContact(contactData);

    const tagId = await findTagId(tagName);
    if (!tagId) throw new Error(`Tag "${tagName}" not found in ActiveCampaign — create it first`);

    await addTag(contactId, tagId);
    console.log(`✅ AC: contact ${contactId} tagged "${tagName}"`);

    const automationName = STAGE_TO_AUTOMATION[stage];
    const automationId = await findAutomationId(automationName);
    if (automationId) {
        await enrollInAutomation(contactId, automationId);
        console.log(`✅ AC: contact ${contactId} enrolled in automation "${automationName}"`);
    } else {
        console.warn(`⚠️ AC: automation "${automationName}" not found — skipping enrollment`);
    }

    return { contactId, tagName, tagId, automationId };
}
