/**
 * WhatsApp Notification Templates Engine - Adwise Sales & Operations Platform
 * Centralized, dynamic templates matching official corporate communication formats.
 */
require('dotenv').config();

function getPortalBaseUrl() {
  if (process.env.PORTAL_URL) return process.env.PORTAL_URL;
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.NODE_ENV === 'production') return 'https://adwiselabs.com';
  return 'http://localhost:5173';
}

function getCrmBaseUrl() {
  if (process.env.CRM_URL) return process.env.CRM_URL;
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.NODE_ENV === 'production') return 'https://adwiselabs.com';
  return 'http://localhost:5173';
}

/**
 * AI-generated summary of client revision request
 */
async function summarizeRevisionWithAI(rawText) {
  if (!rawText || !rawText.trim()) return "Client requested project modifications.";
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return rawText.length > 140 ? rawText.substring(0, 140) + '...' : rawText.trim();
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
            content: 'You are an executive CRM assistant. Summarize the client revision points in 1 crisp, natural sentence for an internal manager WhatsApp alert. Do not use quotes or introductory phrases.' 
          },
          { role: 'user', content: rawText }
        ],
        temperature: 0.2,
        max_tokens: 300
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content?.trim();
      if (summary) return summary.replace(/^["']|["']$/g, '');
    }
  } catch (e) {
    console.warn('[AI Revision Summary Warning]:', e.message);
  }

  // Clean fallback
  const firstLine = rawText.split('\n').filter(l => l.trim().length > 0)[0] || rawText;
  return firstLine.length > 140 ? firstLine.substring(0, 140) + '...' : firstLine.trim();
}

/**
 * 1. Delivery Submitted (Sent to Client or Project Group)
 */
function getDeliverySubmittedTemplate({ clientName, taskName, portalLink }) {
  const client = clientName || 'Client';
  const task = taskName || 'Your project deliverable';
  const link = portalLink || `${getPortalBaseUrl()}/client-portal`;

  return `Hi ${client} 👋\n\n${task} has been delivered on your Client Portal. ✅\n\nPlease review it and submit any revisions through the portal within 48 hours (2 days).\n\n⏳ If we don’t hear from you within 48 hours, the delivery will be automatically accepted.\n\n🔗 Portal: ${link}\n\n— Adwise Labs`;
}

/**
 * 2. Manager — Revision Submitted (Sent to PM / Production / Admin)
 */
function getManagerRevisionSubmittedTemplate({ clientName, taskName, projectName, revisionSummary, crmLink }) {
  const client = clientName || 'Client';
  const task = taskName || 'Deliverable';
  const project = projectName || 'Project';
  const summary = revisionSummary || 'Client submitted revision points.';
  const link = crmLink || `${getCrmBaseUrl()}/deadlines`;

  return `🔄 Revision Requested\n\n${client} has requested a revision on ${task} for ${project}.\n\n📝 Revision: ${summary}\n\n🔗 View in CRM: ${link}`;
}

/**
 * 3. When Client Submits Revision (Confirmation sent to Client)
 */
function getClientRevisionReceivedTemplate({ clientName, taskName, portalLink }) {
  const client = clientName || 'Client';
  const task = taskName || 'your work';
  const link = portalLink || `${getPortalBaseUrl()}/client-portal`;

  return `Hi ${client} 👋\n\nYour revision request for ${task} has been received. ✅\n\nOur team will review the feedback and proceed accordingly.\n\n🔗 Portal: ${link}\n\n— Adwise Labs`;
}

/**
 * 4. Manager — Delivery Approved (Sent to PM / Production / Admin)
 */
function getManagerDeliveryApprovedTemplate({ clientName, taskName, projectName, crmLink }) {
  const client = clientName || 'Client';
  const task = taskName || 'Deliverable';
  const project = projectName || 'Project';
  const link = crmLink || `${getCrmBaseUrl()}/deadlines`;

  return `✅ Delivery Approved\n\n${client} has approved ${task} for ${project}.\n\nNo further revisions were requested.\n\n🔗 View in CRM: ${link}`;
}

/**
 * 5. When Client Approves (Confirmation sent to Client)
 */
function getClientApprovalRecordedTemplate({ clientName, taskName }) {
  const client = clientName || 'Client';
  const task = taskName || 'the delivery';

  return `Hi ${client} 👋\n\nYour approval for ${task} has been recorded successfully. ✅\n\nThe delivery is now marked as approved.\n\nThank you! — Adwise Labs`;
}

/**
 * 6. When Client Invoice Is Due (Sent along with invoice)
 */
function getClientInvoiceDueTemplate({ clientName, invoiceNumber, amount, dueDate }) {
  const client = clientName || 'Client';
  const invNum = invoiceNumber || 'INV';
  const amtFormatted = typeof amount === 'number' 
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : String(amount);
  const due = dueDate || 'Due on Receipt';

  return `Hi ${client} 👋\nYour invoice #${invNum} of Rs. ${amtFormatted} is due on ${due}.\nPlease make the payment by the due date.\n\n🏦 Bank Alfalah\nAccount Title: ADWISE LABS\nAccount No: 56395002519988\nIBAN: PK57ALFH5639005002519988\n\nOnce paid, please share the payment confirmation.\n— Adwise Labs`;
}

module.exports = {
  getPortalBaseUrl,
  getCrmBaseUrl,
  summarizeRevisionWithAI,
  getDeliverySubmittedTemplate,
  getManagerRevisionSubmittedTemplate,
  getClientRevisionReceivedTemplate,
  getManagerDeliveryApprovedTemplate,
  getClientApprovalRecordedTemplate,
  getClientInvoiceDueTemplate
};
