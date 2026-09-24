// Resend email service.
// Reads credentials from the environment: RESEND_API_KEY (required) and
// RESEND_FROM_EMAIL (optional; must be an address on a Resend-verified domain).
// Replaces the previous Replit-connector integration, which does not exist
// outside Replit's runtime.
import { Resend } from 'resend';

const DEFAULT_FROM_EMAIL = 'GovernmentAffairs.io <no-reply@governmentaffairs.io>';

async function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }

  return { apiKey, fromEmail };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const emailPayload: any = {
      from: fromEmail,
      to: options.to,
      subject: options.subject,
    };
    
    if (options.html) {
      emailPayload.html = options.html;
    }
    if (options.text) {
      emailPayload.text = options.text;
    }
    
    const result = await client.emails.send(emailPayload);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to send email' };
  }
}

// ── Shared branded layout ────────────────────────────────────────────────────
// Brand system: Capitol Navy #14253D, Signal Blue #078ACB, Paper #F7F6F2,
// Stone #E9ECEC. The GA mark is built in HTML (navy/white square) rather than
// an <img> so it renders even when clients block remote images.

const EMAIL_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function renderBrandedEmail(options: {
  kicker?: string;
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const { kicker, heading, bodyHtml, cta, footerNote } = options;
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F6F2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F2;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:${EMAIL_FONT};">

        <!-- Header: Capitol Navy with GA lockup -->
        <tr><td style="background:#14253D;border-radius:12px 12px 0 0;padding:24px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;height:34px;background:#ffffff;border-radius:6px;text-align:center;vertical-align:middle;font-family:${EMAIL_FONT};font-size:14px;font-weight:800;letter-spacing:-0.02em;color:#14253D;">GA</td>
            <td style="padding-left:11px;font-family:${EMAIL_FONT};font-size:17px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">GovernmentAffairs<span style="color:#078ACB;">.co</span></td>
          </tr></table>
          ${kicker ? `<p style="margin:18px 0 0 0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#078ACB;">${kicker}</p>` : ""}
          <h1 style="margin:${kicker ? "6px" : "18px"} 0 0 0;font-size:22px;line-height:1.25;letter-spacing:-0.02em;color:#F7F6F2;">${heading}</h1>
        </td></tr>

        <!-- Body card -->
        <tr><td style="background:#ffffff;border:1px solid #E9ECEC;border-top:none;padding:26px 28px;font-size:15px;line-height:1.6;color:#14253D;">
          ${bodyHtml}
          ${
            cta
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
                   <td style="background:#078ACB;border-radius:6px;">
                     <a href="${cta.url}" style="display:inline-block;padding:13px 26px;font-family:${EMAIL_FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${cta.label}</a>
                   </td>
                 </tr></table>`
              : ""
          }
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#14253D;border-radius:0 0 12px 12px;padding:20px 28px;text-align:center;">
          <p style="margin:0;font-size:13px;font-style:italic;color:#9FB0C4;">Find the path to the people who shape policy.</p>
          <p style="margin:10px 0 0 0;font-size:12px;color:#5A6B80;">
            GovernmentAffairs.io · <a href="mailto:support@governmentaffairs.io" style="color:#078ACB;text-decoration:none;">support@governmentaffairs.io</a>
          </p>
          ${footerNote ? `<p style="margin:8px 0 0 0;font-size:11px;color:#5A6B80;">${footerNote}</p>` : ""}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendDailyBrief(options: {
  to: string;
  clientName: string;
  matterName: string;
  briefContent: string;
  portalUrl?: string;
}) {
  const html = renderBrandedEmail({
    kicker: "Daily Brief",
    heading: `${options.matterName} Update`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Dear ${options.clientName},</p>
      <div>${options.briefContent}</div>`,
    cta: options.portalUrl ? { label: "View Full Research Portal", url: options.portalUrl } : undefined,
  });

  return sendEmail({
    to: options.to,
    subject: `Daily Brief: ${options.matterName}`,
    html,
  });
}

export async function sendPasswordResetEmail(options: {
  to: string;
  firstName: string;
  resetUrl: string;
}) {
  const html = renderBrandedEmail({
    kicker: "Account Security",
    heading: "Password reset request",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi ${options.firstName || "there"},</p>
      <p style="margin:0;">We received a request to reset your password. Click the button below to create a new one:</p>`,
    cta: { label: "Reset Password", url: options.resetUrl },
    footerNote: "This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.",
  });

  return sendEmail({
    to: options.to,
    subject: 'Reset Your Password',
    html,
  });
}

export async function sendResearchUpdate(options: {
  to: string;
  clientName: string;
  matterName: string;
  updateType: 'new_document' | 'ai_analysis' | 'question_answered';
  summary: string;
  portalUrl?: string;
}) {
  const updateTypeLabels = {
    new_document: 'New Research Document Added',
    ai_analysis: 'AI Analysis Complete',
    question_answered: 'Research Question Answered',
  };

  const html = renderBrandedEmail({
    kicker: updateTypeLabels[options.updateType],
    heading: options.matterName,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hello ${options.clientName},</p>
      <p style="margin:0;">${options.summary}</p>`,
    cta: options.portalUrl ? { label: "View in Portal", url: options.portalUrl } : undefined,
  });

  return sendEmail({
    to: options.to,
    subject: `${updateTypeLabels[options.updateType]} - ${options.matterName}`,
    html,
  });
}

// Send news alert for high-relevance articles
export async function sendNewsAlert(options: {
  to: string;
  clientName: string;
  articles: Array<{
    title: string;
    source: string;
    summary: string;
    url: string;
    relevanceScore: number;
    matchedTopics: string[];
  }>;
}) {
  const articlesList = options.articles.map(article => `
    <div style="margin-bottom: 16px; padding: 14px 16px; background: #F7F6F2; border-radius: 8px; border-left: 4px solid ${article.relevanceScore >= 70 ? '#A53B39' : '#078ACB'};">
      <p style="margin: 0 0 6px 0;">
        <span style="background: ${article.relevanceScore >= 70 ? '#A53B39' : '#078ACB'}; color: #ffffff; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 700;">
          ${article.relevanceScore} relevance
        </span>
        <span style="color: #5A6B80; font-size: 12px; padding-left: 8px;">${article.source}</span>
      </p>
      <h3 style="margin: 0 0 6px 0; font-size: 16px; letter-spacing: -0.01em;"><a href="${article.url}" style="color: #14253D; text-decoration: none;">${article.title}</a></h3>
      <p style="color: #5A6B80; font-size: 14px; margin: 0 0 6px 0;">${article.summary?.substring(0, 200) || ''}${article.summary && article.summary.length > 200 ? '...' : ''}</p>
      ${article.matchedTopics.length > 0 ? `
        <div style="font-size: 12px; color: #5A6B80;">
          Matches: ${article.matchedTopics.slice(0, 3).map(t => `<span style="background: #E9ECEC; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${t}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  const html = renderBrandedEmail({
    kicker: "News Alert",
    heading: `${options.articles.length} high-relevance article${options.articles.length > 1 ? "s" : ""}`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hello ${options.clientName},</p>
      <p style="margin:0 0 16px 0;">We found news articles highly relevant to your tracked research:</p>
      ${articlesList}`,
    footerNote: "You're receiving this because you have email alerts enabled.",
  });

  return sendEmail({
    to: options.to,
    subject: `News Alert: ${options.articles.length} High-Relevance Article${options.articles.length > 1 ? 's' : ''}`,
    html,
  });
}
