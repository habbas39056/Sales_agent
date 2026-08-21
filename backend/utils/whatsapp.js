const db = require('../db');

/**
 * Normalizes a phone number by ensuring it starts with the country code
 * and contains only digits and a leading '+'.
 * 
 * Evolution API format requires just numbers, no special characters other than optional +
 * We will strip everything except digits.
 */
function normalizePhoneNumber(number) {
    if (!number) return null;
    // Strip everything except digits
    let cleaned = number.replace(/\D/g, '');
    if (!cleaned) return null;
    
    // Some formats require the exact number (like 5511999999999 for Brazil)
    // We will just return the cleaned digits. The user must provide the country code when saving.
    return cleaned;
}

/**
 * Fetch WhatsApp Evolution API settings from the database
 */
async function getWhatsAppSettings() {
    try {
        const [rows] = await db.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('whatsapp_notifications_enabled', 'evolution_api_url', 'evolution_instance_name', 'evolution_api_key')");
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        return settings;
    } catch (error) {
        console.error('Error fetching WhatsApp settings:', error);
        return {};
    }
}

/**
 * Send a WhatsApp text message using Evolution API
 * @param {string} to - The phone number to send the message to
 * @param {string} message - The text message to send
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function sendWhatsAppMessage(to, message) {
    try {
        const settings = await getWhatsAppSettings();
        
        // Check if notifications are globally enabled
        if (settings['whatsapp_notifications_enabled'] === 'false') {
            console.log('WhatsApp notifications are disabled globally.');
            return false;
        }

        const url = settings['evolution_api_url'];
        const instance = settings['evolution_instance_name'];
        const apiKey = settings['evolution_api_key'];

        if (!url || !instance || !apiKey) {
            console.log('Evolution API credentials are not fully configured.');
            return false;
        }

        const normalizedNumber = normalizePhoneNumber(to);
        if (!normalizedNumber) {
            console.log('Invalid or missing phone number for WhatsApp message.');
            return false;
        }

        // We dynamically require node-fetch or use global fetch depending on node version
        const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        const endpoint = `${url}/message/sendText/${encodeURIComponent(instance)}`;
        
        const payload = {
            number: normalizedNumber,
            text: message,
            options: {
                delay: 1200,
                presence: "composing"
            }
        };

        const response = await fetchFn(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Evolution API Error (${response.status}):`, errorText);
            return false;
        }

        console.log(`WhatsApp message sent successfully to ${normalizedNumber}`);
        return true;
    } catch (error) {
        console.error('Failed to send WhatsApp message:', error.message);
        return false;
    }
}

/**
 * Automatically polish and format messages using Grok AI
 */
async function formatWhatsAppWithAI(rawMessage, context = {}) {
    const apiKey = process.env.GROK_API_KEY || '';
    if (!apiKey) return rawMessage;

    // If message is already rich/detailed with multiple emojis and headers, skip re-prompting
    if (rawMessage.includes('💰 *Amount') || rawMessage.includes('📌 *Payable:')) {
        return rawMessage;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const fetchFn = typeof fetch !== 'undefined' ? fetch : (...args) => import('node-fetch').then(({default: f}) => f(...args));

        const response = await fetchFn('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [
                    {
                        role: 'system',
                        content: `You are an executive business ERP communication AI for "Adwise Sales & Operations".
Convert raw system notifications into rich, structured, executive WhatsApp messages.
Rules:
- ALWAYS show the real Project Name (e.g. "Digitizer", "Brand Identity") and NEVER display project numbers or IDs like "Project #7" or "ID: 7".
- Add appropriate business emojis (📌, 💼, 🚀, 📅, ⚡, 🔔, ✅, 💰).
- Use WhatsApp markdown (*bold*, _italics_).
- Format clearly with headers, bullet points, and actionable next steps.
- Do NOT add placeholders like [Your Name] or [Your Company].
- Return ONLY the final formatted message text, nothing else.`
                    },
                    {
                        role: 'user',
                        content: `Transform this ERP notification into a rich WhatsApp alert: "${rawMessage}"\nContext: ${JSON.stringify(context)}`
                    }
                ],
                temperature: 0.3
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) return rawMessage;

        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content?.trim();
        return aiText || rawMessage;
    } catch (e) {
        console.warn('[WhatsApp AI Format Error]:', e.message);
        return rawMessage;
    }
}

/**
 * Fetch user's whatsapp number, AI format message, and send message
 */
async function notifyUserWhatsApp(userId, message, context = {}) {
    if (!userId) return false;
    try {
        const [[user]] = await db.query('SELECT whatsapp_number, name FROM users WHERE id = ?', [userId]);
        if (user && user.whatsapp_number) {
            const aiFormattedMessage = await formatWhatsAppWithAI(message, { recipient: user.name, ...context });
            return await sendWhatsAppMessage(user.whatsapp_number, aiFormattedMessage);
        }
    } catch (e) {
        console.error('notifyUserWhatsApp error:', e);
    }
    return false;
}

/**
 * Fetch client's whatsapp number, AI format message, and send message
 */
async function notifyClientWhatsApp(clientId, message, context = {}) {
    if (!clientId) return false;
    try {
        const [[client]] = await db.query('SELECT whatsapp_number, full_name, business_name FROM clients WHERE id = ?', [clientId]);
        if (client && client.whatsapp_number) {
            const aiFormattedMessage = await formatWhatsAppWithAI(message, { client: client.full_name, company: client.business_name, ...context });
            return await sendWhatsAppMessage(client.whatsapp_number, aiFormattedMessage);
        }
    } catch (e) {
        console.error('notifyClientWhatsApp error:', e);
    }
    return false;
}

module.exports = {
    sendWhatsAppMessage,
    notifyUserWhatsApp,
    notifyClientWhatsApp,
    formatWhatsAppWithAI
};

