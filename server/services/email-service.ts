// Resend email service.
// Reads credentials from the environment: RESEND_API_KEY (required) and
// RESEND_FROM_EMAIL (optional; must be an address on a Resend-verified domain).
// Replaces the previous Replit-connector integration, which does not exist
// outside Replit's runtime.
import { Resend } from 'resend';

const DEFAULT_FROM_EMAIL = 'GovernmentAffairs.co <no-reply@governmentaffairs.co>';

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

export async function sendDailyBrief(options: {
  to: string;
  clientName: string;
  matterName: string;
  briefContent: string;
  portalUrl?: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; }
        .footer { background: #1a1a2e; color: #888; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        h1 { margin: 0; font-size: 24px; }
        h2 { color: #1a1a2e; margin-top: 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Political Intelligence Brief</h1>
        </div>
        <div class="content">
          <h2>${options.matterName} Update</h2>
          <p>Dear ${options.clientName},</p>
          <div>${options.briefContent}</div>
          ${options.portalUrl ? `<a href="${options.portalUrl}" class="button">View Full Research Portal</a>` : ''}
        </div>
        <div class="footer">
          <p>Powered by Political Intelligence Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;

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
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; }
        .footer { background: #1a1a2e; color: #888; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        h1 { margin: 0; font-size: 24px; }
        .warning { color: #666; font-size: 13px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hi ${options.firstName || 'there'},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${options.resetUrl}" class="button">Reset Password</a>
          <p class="warning">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div class="footer">
          <p>Powered by Political Intelligence Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .badge { display: inline-block; background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; }
        .footer { background: #1a1a2e; color: #888; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        h1 { margin: 0; font-size: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${options.matterName}</h1>
          <span class="badge">${updateTypeLabels[options.updateType]}</span>
        </div>
        <div class="content">
          <p>Hello ${options.clientName},</p>
          <p>${options.summary}</p>
          ${options.portalUrl ? `<a href="${options.portalUrl}" class="button">View in Portal</a>` : ''}
        </div>
        <div class="footer">
          <p>Powered by Political Intelligence Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;

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
    <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid ${article.relevanceScore >= 70 ? '#22c55e' : '#eab308'};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="background: ${article.relevanceScore >= 70 ? '#dcfce7' : '#fef9c3'}; color: ${article.relevanceScore >= 70 ? '#166534' : '#854d0e'}; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
          ${article.relevanceScore}% relevance
        </span>
        <span style="color: #6b7280; font-size: 12px;">${article.source}</span>
      </div>
      <h3 style="margin: 0 0 8px 0; font-size: 16px;"><a href="${article.url}" style="color: #1a1a2e; text-decoration: none;">${article.title}</a></h3>
      <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px 0;">${article.summary?.substring(0, 200) || ''}${article.summary && article.summary.length > 200 ? '...' : ''}</p>
      ${article.matchedTopics.length > 0 ? `
        <div style="font-size: 12px; color: #6b7280;">
          Matches: ${article.matchedTopics.slice(0, 3).map(t => `<span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; margin-right: 4px;">${t}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #f3f4f6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 25px; border-radius: 12px 12px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; }
        .footer { background: #1a1a2e; color: #888; padding: 15px; text-align: center; font-size: 12px; border-radius: 0 0 12px 12px; }
        h1 { margin: 0; font-size: 22px; }
        .subtitle { color: #94a3b8; margin-top: 5px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>High-Relevance News Alert</h1>
          <p class="subtitle">${options.articles.length} article${options.articles.length > 1 ? 's' : ''} matching your research</p>
        </div>
        <div class="content">
          <p>Hello ${options.clientName},</p>
          <p>We found news articles highly relevant to your tracked research:</p>
          ${articlesList}
        </div>
        <div class="footer">
          <p>Political Intelligence Platform - News Intelligence System</p>
          <p style="color: #6b7280; font-size: 11px;">You're receiving this because you have email alerts enabled.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: options.to,
    subject: `News Alert: ${options.articles.length} High-Relevance Article${options.articles.length > 1 ? 's' : ''}`,
    html,
  });
}
