// Resend Email Service - Uses Replit's Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
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
