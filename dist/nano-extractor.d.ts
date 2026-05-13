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
export interface ExtractedLeads {
    emails: string[];
    phones: string[];
    telegram: string[];
    whatsapp: string[];
    linkedin: string[];
    /** Candidate person names (heuristic — may have false positives) */
    names: string[];
}
/** Extract structured lead data from any freeform text. */
export declare function extractLeads(text: string): ExtractedLeads;
export interface MessageTemplate {
    subject?: string;
    body: string;
}
export interface TemplateVars {
    /** Recipient's name (from extractLeads) */
    recipientName?: string;
    /** Company name */
    company?: string;
    /** Job title from the post */
    jobTitle?: string;
    /** Sender's full name */
    senderName: string;
    /** 1-2 sentence custom intro */
    intro?: string;
}
/**
 * Generate a professional outreach email from a template.
 * No LLM needed — works 100% offline with zero model.
 */
export declare function buildOutreachEmail(vars: TemplateVars): MessageTemplate;
/**
 * Generate a short WhatsApp / Telegram message.
 */
export declare function buildOutreachMessage(vars: TemplateVars): string;
//# sourceMappingURL=nano-extractor.d.ts.map