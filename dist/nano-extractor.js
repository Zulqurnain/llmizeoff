"use strict";
/**
 * NanoExtractor — zero-dependency, zero-model lead extraction.
 *
 * Extracts emails, phone numbers, Telegram usernames, WhatsApp links,
 * LinkedIn URLs, and names from raw text using pure regex.
 * Works offline, 0 bytes of model, < 1 ms per call.
 *
 * For mobile apps that need to stay under 100 MB, use this for extraction
 * and SmolLM2-135M (see MOBILE_MODELS.SMOL_135M_NANO) for text generation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractLeads = extractLeads;
exports.buildOutreachEmail = buildOutreachEmail;
exports.buildOutreachMessage = buildOutreachMessage;
/** Extract structured lead data from any freeform text. */
function extractLeads(text) {
    return {
        emails: extractEmails(text),
        phones: extractPhones(text),
        telegram: extractTelegram(text),
        whatsapp: extractWhatsApp(text),
        linkedin: extractLinkedIn(text),
        names: extractNames(text),
    };
}
function unique(arr) {
    return [...new Set(arr.map(s => s.trim()).filter(Boolean))];
}
function extractEmails(text) {
    const RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    return unique(text.match(RE) ?? []);
}
function extractPhones(text) {
    // Matches international and local formats, avoids zip codes
    const RE = /(?:\+?[1-9]\d{0,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}(?:[\s\-.]?\d{1,4})?/g;
    const raw = text.match(RE) ?? [];
    // Filter: must have at least 7 digits
    return unique(raw.filter(p => (p.replace(/\D/g, "").length >= 7)));
}
function extractTelegram(text) {
    const results = [];
    // @username style
    const AT = /(?<![a-zA-Z0-9])@([a-zA-Z][a-zA-Z0-9_]{4,31})/g;
    let m;
    while ((m = AT.exec(text)) !== null)
        results.push("@" + m[1]);
    // t.me/username links
    const LINK = /t\.me\/([a-zA-Z][a-zA-Z0-9_]{4,31})/g;
    while ((m = LINK.exec(text)) !== null)
        results.push("@" + m[1]);
    return unique(results);
}
function extractWhatsApp(text) {
    const results = [];
    // wa.me links
    const WA = /wa\.me\/(\+?\d[\d\s\-]{7,20}\d)/g;
    let m;
    while ((m = WA.exec(text)) !== null)
        results.push(m[1].replace(/\s/g, ""));
    // "WhatsApp: +44..." or "WA: ..."
    const LABEL = /(?:whatsapp|wa)[:\s]+(\+?[\d\s\-().]{8,20})/gi;
    while ((m = LABEL.exec(text)) !== null) {
        const n = m[1].replace(/[^\d+]/g, "");
        if (n.length >= 7)
            results.push(n);
    }
    return unique(results);
}
function extractLinkedIn(text) {
    const RE = /linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/g;
    const results = [];
    let m;
    while ((m = RE.exec(text)) !== null) {
        results.push(`https://linkedin.com/in/${m[1]}`);
    }
    return unique(results);
}
/**
 * Heuristic name extraction: looks for Title-cased word pairs or
 * patterns like "My name is John Smith" / "I'm Sarah Connor".
 */
function extractNames(text) {
    const results = [];
    // "name is / I'm / I am / contact: " followed by title-cased words
    const INTRO = /(?:my name is|i['''`]?m|i am|contact[:\s]+|from\s+)([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/g;
    let m;
    while ((m = INTRO.exec(text)) !== null)
        results.push(m[1]);
    // Standalone Title Case pairs not at sentence start (heuristic)
    const PAIR = /(?<=[^\n.!?]\s)([A-Z][a-z]{2,}\s[A-Z][a-z]{2,})/g;
    while ((m = PAIR.exec(text)) !== null)
        results.push(m[1]);
    return unique(results);
}
/**
 * Generate a professional outreach email from a template.
 * No LLM needed — works 100% offline with zero model.
 */
function buildOutreachEmail(vars) {
    const greeting = vars.recipientName
        ? `Hi ${vars.recipientName.split(" ")[0]},`
        : "Hi,";
    const role = vars.jobTitle ? ` for the ${vars.jobTitle} role` : "";
    const company = vars.company ? ` at ${vars.company}` : "";
    const intro = vars.intro?.trim()
        ?? `I came across your posting${role}${company} and I'd love to connect.`;
    const body = `${greeting}

${intro}

I've attached my CV for your review. I'd be happy to chat at your convenience — feel free to reach out via email or on the contact details below.

Best regards,
${vars.senderName}`;
    return {
        subject: `Application${role}${company} — ${vars.senderName}`,
        body: body.trim(),
    };
}
/**
 * Generate a short WhatsApp / Telegram message.
 */
function buildOutreachMessage(vars) {
    const role = vars.jobTitle ? ` for the ${vars.jobTitle} role` : "";
    const company = vars.company ? ` at ${vars.company}` : "";
    return (`Hi${vars.recipientName ? " " + vars.recipientName.split(" ")[0] : ""}! ` +
        `I saw your posting${role}${company} and would love to connect. ` +
        `I'm ${vars.senderName} — happy to share my CV if interested!`);
}
//# sourceMappingURL=nano-extractor.js.map