/**
 * Advanced AI-Powered Notification & Communication Engine
 * Powered by Groq / Grok Cloud AI Model (openai/gpt-oss-120b)
 */
require('dotenv').config();
const db = require('../db');
const { sendWhatsAppMessage } = require('./whatsapp');

const GROK_API_KEY = process.env.GROK_API_KEY || '';
const GROK_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_NAME = 'openai/gpt-oss-120b';

/**
 * Universal AI Notification Generator
 */
async function generateAINotification({ eventType, context, defaultWhatsApp, defaultPortal }) {
  if (!GROK_API_KEY) {
    return { whatsapp: defaultWhatsApp, portal: defaultPortal };
  }

  const prompt = `
You are the Executive AI Communication Assistant for "Adwise ERP & Sales Automation".
Generate a high-converting, professional, polished message for WhatsApp and an executive in-app portal notification.

Event Type: ${eventType}
Context Details: ${JSON.stringify(context, null, 2)}

Requirements:
1. WhatsApp Message:
   - ALWAYS use the actual Project Name (e.g. "Digitizer", "Brand Identity") and NEVER display project numbers or IDs like "Project #7".
   - Format cleanly with modern business emojis (e.g. 🔔, 💎, 💼, ⚡, 🚨, 📅, 💰, ✅).
   - Use WhatsApp bolding (*text*) and italics (_text_).
   - Be clear, polite, structured with bullet points.
   - Do NOT include generic brackets or placeholders.

2. Portal In-App Notification:
   - ALWAYS show the real Project Name and NEVER project numbers or IDs.
   - Format with an emoji prefix and crisp executive summary (e.g. "🚨 [Urgent Payable] Server Bill (PKR 15,000) due today").
   - Maximum 150 characters, punchy and highly informative.

Return ONLY a valid JSON object:
{
  "whatsapp": "your generated whatsapp message",
  "portal": "your generated portal notification"
}
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: 'You are an executive business ERP notification engine. Respond strictly with JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[AI Notification Engine] API returned status ${response.status}. Using template fallback.`);
      return { whatsapp: defaultWhatsApp, portal: defaultPortal };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { whatsapp: defaultWhatsApp, portal: defaultPortal };
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        whatsapp: parsed.whatsapp || defaultWhatsApp,
        portal: parsed.portal || defaultPortal
      };
    }

    return { whatsapp: defaultWhatsApp, portal: defaultPortal };
  } catch (err) {
    console.warn('[AI Notification Engine] Request error:', err.message);
    return { whatsapp: defaultWhatsApp, portal: defaultPortal };
  }
}

/**
 * Universal Dispatcher: Creates Portal Notifications & Sends WhatsApp Messages via AI
 */
async function sendSmartAINotification({ userIds, eventType, context, defaultPortal, defaultWhatsApp, link, type = 'general' }) {
  try {
    const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];
    if (targetUserIds.length === 0) return;

    // Fetch user details
    const [users] = await db.query(
      `SELECT id, name, whatsapp_number, role FROM users WHERE id IN (?)`,
      [targetUserIds]
    );

    if (users.length === 0) return;

    // Generate AI Messages
    const aiResult = await generateAINotification({
      eventType,
      context,
      defaultWhatsApp: defaultWhatsApp || defaultPortal,
      defaultPortal: defaultPortal || 'New business update on Adwise Portal'
    });

    for (const user of users) {
      // 1. Insert in Portal Notifications
      await db.query(
        `INSERT INTO notifications (user_id, message, type, link, is_read) VALUES (?, ?, ?, ?, 0)`,
        [user.id, aiResult.portal, type, link || '/']
      );

      // 2. Dispatch WhatsApp Notification
      if (user.whatsapp_number) {
        try {
          await sendWhatsAppMessage(user.whatsapp_number, aiResult.whatsapp);
        } catch (waErr) {
          console.error(`[WhatsApp Error] User ${user.id}:`, waErr.message);
        }
      }
    }

    return aiResult;
  } catch (err) {
    console.error('[sendSmartAINotification Error]:', err);
  }
}

/**
 * Specialized Future Payable Due Alert
 */
async function getPayableDueAIMessage(payable, isOverdue = false) {
  const amountFmt = Number(payable.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const dueDateStr = payable.due_date ? String(payable.due_date).split('T')[0] : 'Today';

  const defaultWhatsApp = isOverdue
    ? `🚨 *OVERDUE FINANCIAL OBLIGATION* 🚨\n\n` +
      `📌 *Payable:* ${payable.title}\n` +
      `💰 *Amount Due:* PKR ${amountFmt}\n` +
      `📂 *Expense Category:* ${payable.category || 'General'}\n` +
      `📅 *Original Due Date:* ${dueDateStr} (Past Due)\n` +
      `🏦 *Designated Bank:* ${payable.preferred_bank || 'Cash / Any'}\n` +
      `${payable.notes ? `📝 *Notes:* ${payable.notes}\n` : ''}` +
      `\n⚠️ *Action Required:* Please log in to your portal to settle this payment voucher immediately.`
    : `🔔 *PAYMENT OBLIGATION DUE TODAY* 🔔\n\n` +
      `📌 *Payable:* ${payable.title}\n` +
      `💰 *Amount Due:* PKR ${amountFmt}\n` +
      `📂 *Expense Category:* ${payable.category || 'General'}\n` +
      `📅 *Due Date:* Today (${dueDateStr})\n` +
      `🏦 *Designated Bank:* ${payable.preferred_bank || 'Cash / Any'}\n` +
      `${payable.notes ? `📝 *Notes:* ${payable.notes}\n` : ''}` +
      `\n💡 *Action:* 1-Click settle this voucher on the Adwise Cash & Bank portal.`;

  const defaultPortal = isOverdue
    ? `🚨 [Overdue Payable] "${payable.title}" (PKR ${amountFmt}) requires immediate settlement!`
    : `🔔 [Due Today] Scheduled Payable "${payable.title}" (PKR ${amountFmt}) is due today!`;

  return generateAINotification({
    eventType: isOverdue ? 'payable_overdue' : 'payable_due_today',
    context: {
      title: payable.title,
      amount: `PKR ${amountFmt}`,
      category: payable.category,
      dueDate: dueDateStr,
      priority: payable.priority,
      preferredBank: payable.preferred_bank,
      notes: payable.notes,
      isOverdue
    },
    defaultWhatsApp,
    defaultPortal
  });
}

/**
 * Specialized Payable Payment Settled Alert
 */
async function getPayableSettledAIMessage(payable, settlement) {
  const amountFmt = Number(payable.amount).toLocaleString('en-US', { minimumFractionDigits: 2 });
  const defaultWhatsApp =
    `✅ *PAYMENT SETTLED & VOUCHER GENERATED* ✅\n\n` +
    `📌 *Payable:* ${payable.title}\n` +
    `💰 *Settled Amount:* PKR ${amountFmt}\n` +
    `🏦 *Paid Via Bank:* ${settlement.bank || 'Cash in Hand'}\n` +
    `💳 *Payment Mode:* ${settlement.payment_mode || 'Bank Transfer'}\n` +
    `🧾 *Voucher Reference:* ${settlement.reference_no || 'N/A'}\n` +
    `\nExpense has been officially posted to your Cash & Bank Ledger.`;

  const defaultPortal = `✅ [Settlement Posted] "${payable.title}" (PKR ${amountFmt}) recorded to Expense Ledger.`;

  return generateAINotification({
    eventType: 'payable_settled',
    context: {
      title: payable.title,
      amount: `PKR ${amountFmt}`,
      bank: settlement.bank,
      mode: settlement.payment_mode,
      reference: settlement.reference_no
    },
    defaultWhatsApp,
    defaultPortal
  });
}

module.exports = {
  generateAINotification,
  sendSmartAINotification,
  getPayableDueAIMessage,
  getPayableSettledAIMessage
};
