const https = require('https');
const http = require('http');
const db = require('../db');
const {
  getPortalBaseUrl,
  getCrmBaseUrl,
  getDeliverySubmittedTemplate,
  getManagerRevisionSubmittedTemplate,
  getClientRevisionReceivedTemplate,
  getManagerDeliveryApprovedTemplate,
  getClientApprovalRecordedTemplate,
  summarizeRevisionWithAI
} = require('./whatsappTemplates');

/**
 * Robust HTTP POST helper using native https/http (no external dependencies)
 */
function postJson(urlStr, headers, bodyData) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(urlStr);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            const postData = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    ...headers
                },
                timeout: 12000
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        text: async () => data
                    });
                });
            });

            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Evolution API request timed out after 12s'));
            });

            req.write(postData);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Normalizes a phone number by ensuring it starts with the country code
 * and contains only digits and a leading '+'.
 * 
 * Evolution API format requires just numbers, no special characters other than optional +
 * WhatsApp Group JIDs (e.g. 1203630248234@g.us) are preserved as is.
 */
function normalizePhoneNumber(number) {
    if (!number) return null;
    const str = String(number).trim();
    
    // If it is a WhatsApp Group JID (e.g. 1203630248234@g.us), preserve as is
    if (str.includes('@g.us')) return str;

    // Strip everything except digits
    let cleaned = str.replace(/\D/g, '');
    if (!cleaned) return null;
    
    // Auto-normalize Pakistani numbers from 0300... to 92300...
    if (cleaned.startsWith('03') && cleaned.length === 11) {
        cleaned = '92' + cleaned.substring(1);
    }

    // Require at least 10 digits for a valid international WhatsApp number
    if (cleaned.length < 10) {
        console.warn(`[WhatsApp Warning]: Phone number "${number}" has fewer than 10 digits (${cleaned.length}). Skipping invalid number.`);
        return null;
    }

    return cleaned;
}

/**
 * Fetch WhatsApp Evolution API settings from the database with reliable production fallbacks
 */
async function getWhatsAppSettings() {
    const verifiedDefaults = {
        evolution_api_url: 'https://evolution-evolution-api.o1nqjj.easypanel.host',
        evolution_instance_name: 'Adwise ERP',
        evolution_api_key: '429683C4C977415CAAFCCE10F7D57E11',
        whatsapp_notifications_enabled: 'true',
        whatsapp_delivery_group_jid: ''
    };

    try {
        const [rows] = await db.query(
            "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('whatsapp_notifications_enabled', 'evolution_api_url', 'evolution_instance_name', 'evolution_api_key', 'whatsapp_delivery_group_jid')"
        );
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        // Smart fallback: If live DB has blank credentials or placeholder URL, use working Evolution API instance
        const url = settings['evolution_api_url'] && settings['evolution_api_url'] !== 'https://evolution.adwiselabs.com'
            ? settings['evolution_api_url']
            : (process.env.EVOLUTION_API_URL || verifiedDefaults.evolution_api_url);

        const instance = settings['evolution_instance_name'] && settings['evolution_instance_name'] !== 'adwise_main'
            ? settings['evolution_instance_name']
            : (process.env.EVOLUTION_INSTANCE_NAME || verifiedDefaults.evolution_instance_name);

        const apiKey = settings['evolution_api_key'] && settings['evolution_api_key'].trim() !== ''
            ? settings['evolution_api_key']
            : (process.env.EVOLUTION_API_KEY || verifiedDefaults.evolution_api_key);

        const enabled = settings['whatsapp_notifications_enabled'] !== 'false';
        const groupJid = settings['whatsapp_delivery_group_jid'] || process.env.WHATSAPP_GROUP_JID || '';

        return {
            evolution_api_url: url,
            evolution_instance_name: instance,
            evolution_api_key: apiKey,
            whatsapp_notifications_enabled: enabled ? 'true' : 'false',
            whatsapp_delivery_group_jid: groupJid
        };
    } catch (error) {
        console.error('Error fetching WhatsApp settings from DB, using working defaults:', error.message);
        return {
            evolution_api_url: process.env.EVOLUTION_API_URL || verifiedDefaults.evolution_api_url,
            evolution_instance_name: process.env.EVOLUTION_INSTANCE_NAME || verifiedDefaults.evolution_instance_name,
            evolution_api_key: process.env.EVOLUTION_API_KEY || verifiedDefaults.evolution_api_key,
            whatsapp_notifications_enabled: 'true',
            whatsapp_delivery_group_jid: process.env.WHATSAPP_GROUP_JID || ''
        };
    }
}

/**
 * Send a WhatsApp text message using Evolution API
 * @param {string} to - The phone number or group JID to send the message to
 * @param {string} message - The text message to send
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function sendWhatsAppMessage(to, message) {
    if (!to || !message) return false;
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
            console.warn('[WhatsApp Error]: Evolution API credentials are not fully configured.');
            return false;
        }

        const normalizedNumber = normalizePhoneNumber(to);
        if (!normalizedNumber) {
            console.warn(`[WhatsApp Error]: Invalid or missing recipient identifier "${to}".`);
            return false;
        }

        const endpoint = `${url}/message/sendText/${encodeURIComponent(instance)}`;
        
        const payload = {
            number: normalizedNumber,
            text: message,
            options: {
                delay: 600,
                presence: "composing"
            }
        };

        const response = await postJson(endpoint, { 'apikey': apiKey }, payload);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[WhatsApp API Error] (${response.status}) for recipient ${normalizedNumber}:`, errorText);
            return false;
        }

        console.log(`✅ WhatsApp message delivered successfully to ${normalizedNumber}`);
        return true;
    } catch (error) {
        console.error('[WhatsApp Dispatch Error]:', error.message);
        return false;
    }
}

/**
 * Automatically polish and format non-standard messages using Grok AI (if requested)
 */
async function formatWhatsAppWithAI(rawMessage, context = {}) {
    const apiKey = process.env.GROK_API_KEY || '';
    if (!apiKey) return rawMessage;

    if (rawMessage.includes('💰 *Amount') || rawMessage.includes('📌 *Payable:') || rawMessage.includes('Hi ') || rawMessage.includes('🔄 Revision')) {
        return rawMessage;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

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
Convert raw system notifications into rich, structured WhatsApp messages.
- Always preserve real project names.
- Return ONLY the formatted text.`
                    },
                    {
                        role: 'user',
                        content: `Transform this notification: "${rawMessage}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 250
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) return rawMessage;

        const data = await response.json();
        const aiText = data.choices?.[0]?.message?.content?.trim();
        return aiText || rawMessage;
    } catch (e) {
        return rawMessage;
    }
}

/**
 * Fetch user's whatsapp number and send direct WhatsApp message
 */
async function notifyUserWhatsApp(userId, message, context = {}) {
    if (!userId) return false;
    try {
        const [[user]] = await db.query('SELECT whatsapp_number, name FROM users WHERE id = ?', [userId]);
        if (user && user.whatsapp_number) {
            const finalMessage = context.skipAI ? message : await formatWhatsAppWithAI(message, { recipient: user.name, ...context });
            return await sendWhatsAppMessage(user.whatsapp_number, finalMessage);
        }
    } catch (e) {
        console.error('notifyUserWhatsApp error:', e);
    }
    return false;
}

/**
 * Fetch client's whatsapp number and send direct WhatsApp message
 */
async function notifyClientWhatsApp(clientId, message, context = {}) {
    if (!clientId) return false;
    try {
        const [[client]] = await db.query('SELECT whatsapp_number, full_name, business_name FROM clients WHERE id = ?', [clientId]);
        if (client && client.whatsapp_number) {
            const finalMessage = context.skipAI ? message : await formatWhatsAppWithAI(message, { client: client.full_name, company: client.business_name, ...context });
            return await sendWhatsAppMessage(client.whatsapp_number, finalMessage);
        }
    } catch (e) {
        console.error('notifyClientWhatsApp error:', e);
    }
    return false;
}

/**
 * Notify internal managers (PMs and Admins) directly via WhatsApp
 */
async function notifyManagersWhatsApp(userIds, message) {
    if (!userIds || userIds.length === 0) return;
    const rawIds = Array.isArray(userIds) ? userIds : [userIds];
    const validIds = rawIds.filter(id => id && !isNaN(id));
    if (validIds.length === 0) return;
    try {
        const [users] = await db.query('SELECT id, whatsapp_number FROM users WHERE id IN (?)', [validIds]);
        for (const user of users) {
            if (user.whatsapp_number) {
                await sendWhatsAppMessage(user.whatsapp_number, message);
            }
        }
    } catch (e) {
        console.error('notifyManagersWhatsApp error:', e);
    }
}

/**
 * High-level Broadcast: WHEN A DELIVERY IS SUBMITTED * (MESSAGE TO BE SENT IN GROUP) *
 * Dispatches Template 1 to:
 * 1. Client direct WhatsApp (if valid)
 * 2. WhatsApp Group JID (from project, client, or global settings)
 * 3. Management Team (Admins & PM) as operational confirmation
 */
async function broadcastDeliveryNotification({ projectId, deliverableName, portalLink }) {
    try {
        const [[proj]] = await db.query(
            `SELECT p.id, p.title, p.pm_id, p.production_id, p.whatsapp_group_jid as proj_group_jid,
                    c.id as client_id, c.full_name as client_name, c.business_name, c.whatsapp_number as client_whatsapp, c.whatsapp_group_jid as client_group_jid
             FROM projects p 
             LEFT JOIN clients c ON p.client_id = c.id 
             WHERE p.id = ?`,
            [projectId]
        );
        if (!proj) return false;

        const clientDisplayName = proj.client_name || proj.business_name || 'Valued Client';
        const taskName = deliverableName || proj.title;
        const link = portalLink || `${getPortalBaseUrl()}/client-portal?id=${proj.id}`;

        const templateText = getDeliverySubmittedTemplate({
            clientName: clientDisplayName,
            taskName: taskName,
            portalLink: link
        });

        const settings = await getWhatsAppSettings();
        const globalGroupJid = settings['whatsapp_delivery_group_jid'];

        // Collect all distinct destination endpoints
        const recipients = new Set();

        // 1. Client direct WhatsApp
        if (proj.client_whatsapp) {
            const norm = normalizePhoneNumber(proj.client_whatsapp);
            if (norm) recipients.add(norm);
        }

        // 2. WhatsApp Group (Project-specific > Client-specific > Global Settings)
        const groupTarget = proj.proj_group_jid || proj.client_group_jid || globalGroupJid;
        if (groupTarget) {
            recipients.add(groupTarget.trim());
        }

        // 3. Always dispatch a copy to Admin / PM team so notification is never lost in live
        const [managers] = await db.query("SELECT id, whatsapp_number FROM users WHERE role IN ('Admin', 'Product Manager')");
        managers.forEach(m => {
            if (m.whatsapp_number) {
                const norm = normalizePhoneNumber(m.whatsapp_number);
                if (norm) recipients.add(norm);
            }
        });
        if (proj.pm_id) {
            const [pmUsers] = await db.query('SELECT whatsapp_number FROM users WHERE id = ?', [proj.pm_id]);
            if (pmUsers && pmUsers.length > 0 && pmUsers[0].whatsapp_number) {
                const norm = normalizePhoneNumber(pmUsers[0].whatsapp_number);
                if (norm) recipients.add(norm);
            }
        }

        console.log(`[WhatsApp Broadcast] Dispatching Delivery Submitted template to ${recipients.size} destination(s):`, Array.from(recipients));

        // Dispatch in parallel
        await Promise.all(Array.from(recipients).map(to => sendWhatsAppMessage(to, templateText)));
        return true;
    } catch (err) {
        console.error('[broadcastDeliveryNotification Error]:', err);
        return false;
    }
}

/**
 * High-level Broadcast: Manager — Revision Submitted & When Client Submits Revision
 */
async function broadcastRevisionNotification({ projectId, taskName, revisionText, crmLink, portalLink }) {
    try {
        const [[proj]] = await db.query(
            `SELECT p.id, p.title, p.pm_id, p.production_id, p.whatsapp_group_jid as proj_group_jid,
                    c.id as client_id, c.full_name as client_name, c.business_name, c.whatsapp_number as client_whatsapp, c.whatsapp_group_jid as client_group_jid
             FROM projects p 
             LEFT JOIN clients c ON p.client_id = c.id 
             WHERE p.id = ?`,
            [projectId]
        );
        if (!proj) return false;

        const clientDisplayName = proj.client_name || proj.business_name || 'Client';
        const taskTitle = taskName || proj.title;
        const crmUrl = crmLink || `${getCrmBaseUrl()}/projects/${proj.id}`;
        const portalUrl = portalLink || `${getPortalBaseUrl()}/client-portal?id=${proj.id}`;

        const aiSummary = await summarizeRevisionWithAI(revisionText || taskTitle);

        // Template 2: Manager — Revision Submitted
        const managerMsg = getManagerRevisionSubmittedTemplate({
            clientName: clientDisplayName,
            taskName: taskTitle,
            projectName: proj.title,
            revisionSummary: aiSummary,
            crmLink: crmUrl
        });

        // Template 3: When Client Submits Revision
        const clientMsg = getClientRevisionReceivedTemplate({
            clientName: clientDisplayName,
            taskName: taskTitle,
            portalLink: portalUrl
        });

        const settings = await getWhatsAppSettings();
        const globalGroupJid = settings['whatsapp_delivery_group_jid'];
        const groupTarget = proj.proj_group_jid || proj.client_group_jid || globalGroupJid;

        const [managers] = await db.query("SELECT id, whatsapp_number FROM users WHERE role IN ('Admin', 'Product Manager')");
        const managerIds = new Set(managers.map(m => m.id).filter(Boolean));
        if (proj.pm_id) managerIds.add(proj.pm_id);
        if (proj.production_id) managerIds.add(proj.production_id);

        if (managerIds.size > 0) {
            await notifyManagersWhatsApp(Array.from(managerIds), managerMsg);
        }
        if (groupTarget) {
            await sendWhatsAppMessage(groupTarget.trim(), managerMsg);
        }

        // Dispatch Template 3 to Client
        if (proj.client_whatsapp) {
            await sendWhatsAppMessage(proj.client_whatsapp, clientMsg);
        }

        return true;
    } catch (err) {
        console.error('[broadcastRevisionNotification Error]:', err);
        return false;
    }
}

/**
 * High-level Broadcast: Manager — Delivery Approved & When Client Approves
 */
async function broadcastDeliveryApprovedNotification({ projectId, taskName, crmLink, assigneeId }) {
    try {
        const [[proj]] = await db.query(
            `SELECT p.id, p.title, p.pm_id, p.production_id, p.whatsapp_group_jid as proj_group_jid,
                    c.id as client_id, c.full_name as client_name, c.business_name, c.whatsapp_number as client_whatsapp, c.whatsapp_group_jid as client_group_jid
             FROM projects p 
             LEFT JOIN clients c ON p.client_id = c.id 
             WHERE p.id = ?`,
            [projectId]
        );
        if (!proj) return false;

        const clientDisplayName = proj.client_name || proj.business_name || 'Client';
        const taskTitle = taskName || proj.title;
        const crmUrl = crmLink || `${getCrmBaseUrl()}/projects/${proj.id}`;

        // Template 4: Manager — Delivery Approved
        const managerMsg = getManagerDeliveryApprovedTemplate({
            clientName: clientDisplayName,
            taskName: taskTitle,
            projectName: proj.title,
            crmLink: crmUrl
        });

        // Template 5: When Client Approves
        const clientMsg = getClientApprovalRecordedTemplate({
            clientName: clientDisplayName,
            taskName: taskTitle
        });

        const settings = await getWhatsAppSettings();
        const globalGroupJid = settings['whatsapp_delivery_group_jid'];
        const groupTarget = proj.proj_group_jid || proj.client_group_jid || globalGroupJid;

        // 1. Dispatch Template 4 to Managers, Production Lead, Assignee, and WhatsApp Group
        const [managers] = await db.query("SELECT id, whatsapp_number FROM users WHERE role IN ('Admin', 'Product Manager')");
        const managerIds = new Set(managers.map(m => m.id).filter(Boolean));
        if (proj.pm_id) managerIds.add(proj.pm_id);
        if (proj.production_id) managerIds.add(proj.production_id);
        if (assigneeId) managerIds.add(assigneeId);

        if (managerIds.size > 0) {
            await notifyManagersWhatsApp(Array.from(managerIds), managerMsg);
        }
        if (groupTarget) {
            await sendWhatsAppMessage(groupTarget.trim(), managerMsg);
        }

        // 2. Dispatch Template 5 to Client
        if (proj.client_whatsapp) {
            await sendWhatsAppMessage(proj.client_whatsapp, clientMsg);
        }

        return true;
    } catch (err) {
        console.error('[broadcastDeliveryApprovedNotification Error]:', err);
        return false;
    }
}

module.exports = {
    sendWhatsAppMessage,
    notifyUserWhatsApp,
    notifyClientWhatsApp,
    notifyManagersWhatsApp,
    broadcastDeliveryNotification,
    broadcastRevisionNotification,
    broadcastDeliveryApprovedNotification,
    formatWhatsAppWithAI,
    normalizePhoneNumber,
    getWhatsAppSettings
};
