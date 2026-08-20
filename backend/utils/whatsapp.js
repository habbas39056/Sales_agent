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
 * Fetch user's whatsapp number and send message
 */
async function notifyUserWhatsApp(userId, message) {
    if (!userId) return false;
    try {
        const [[user]] = await db.query('SELECT whatsapp_number FROM users WHERE id = ?', [userId]);
        if (user && user.whatsapp_number) {
            return await sendWhatsAppMessage(user.whatsapp_number, message);
        }
    } catch (e) {
        console.error('notifyUserWhatsApp error:', e);
    }
    return false;
}

/**
 * Fetch client's whatsapp number and send message
 */
async function notifyClientWhatsApp(clientId, message) {
    if (!clientId) return false;
    try {
        const [[client]] = await db.query('SELECT whatsapp_number FROM clients WHERE id = ?', [clientId]);
        if (client && client.whatsapp_number) {
            return await sendWhatsAppMessage(client.whatsapp_number, message);
        }
    } catch (e) {
        console.error('notifyClientWhatsApp error:', e);
    }
    return false;
}

module.exports = {
    sendWhatsAppMessage,
    notifyUserWhatsApp,
    notifyClientWhatsApp
};
