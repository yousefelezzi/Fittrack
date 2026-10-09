/**
 * Sends emails over SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * MAIL_FROM in .env). Without SMTP settings, emails are written to the server
 * log instead, so the links still work while developing.
 */
const nodemailer = require('nodemailer');

let transport = null;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transport;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * A short email: a heading, paragraphs and an optional button link.
 * @param {{ to, subject, heading, paragraphs: string[], button?: { label, url }, footer?: string }} mail
 */
async function sendMail({ to, subject, heading, paragraphs, button, footer }) {
  const text = [heading, '', ...paragraphs, ...(button ? ['', `${button.label}: ${button.url}`] : []), ...(footer ? ['', footer] : [])].join('\n');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(heading)}</h2>
  ${paragraphs.map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n  ')}
  ${button ? `<p style="margin:20px 0"><a href="${escapeHtml(button.url)}" style="background:#0284c7;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:600">${escapeHtml(button.label)}</a></p>
  <p style="margin:0 0 12px;font-size:12px;color:#6b7280">Or open this link: ${escapeHtml(button.url)}</p>` : ''}
  ${footer ? `<p style="margin:16px 0 0;font-size:12px;color:#6b7280">${escapeHtml(footer)}</p>` : ''}
</div>`;

  const t = getTransport();
  if (!t) {
    console.log(`📧 Email (SMTP not set up, so not sent)\n   To: ${to}\n   Subject: ${subject}\n${text.split('\n').map((l) => `   ${l}`).join('\n')}`);
    return { sent: false };
  }
  await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
  return { sent: true };
}

module.exports = { sendMail };
