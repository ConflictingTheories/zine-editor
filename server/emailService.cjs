/**
 * Email notifications for SVRN.
 *
 * Sends transactional emails for:
 * - New subscriber
 * - New tip/sale
 * - Publish confirmation
 * - Weekly digest
 *
 * Uses the configured email provider (SMTP by default).
 */

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  if (!to) throw new Error('Recipient required');
  
  const from = process.env.EMAIL_FROM || 'noreply@svrn.network';
  
  try {
    await getTransporter().sendMail({ from, to, subject, html, text: text || html });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (e) {
    console.error(`Email failed to ${to}:`, e.message);
    // Don't throw — email failure shouldn't break the main flow
  }
}

// Template: new subscriber
async function notifyNewSubscriber(creatorEmail, subscriberName, zineTitle) {
  await sendEmail({
    to: creatorEmail,
    subject: `New subscriber: ${subscriberName}`,
    html: `<p><strong>${subscriberName}</strong> subscribed to <strong>${zineTitle}</strong>.</p>`,
  });
}

// Template: new tip
async function notifyTip(creatorEmail, tipperName, amount, zineTitle) {
  const dollars = (amount / 100).toFixed(2);
  await sendEmail({
    to: creatorEmail,
    subject: `You received a $${dollars} tip!`,
    html: `<p><strong>${tipperName}</strong> tipped you <strong>$${dollars}</strong> for <strong>${zineTitle}</strong>.</p><p>100% goes to you.</p>`,
  });
}

// Template: new sale
async function notifySale(creatorEmail, buyerName, amount, zineTitle) {
  const dollars = (amount / 100).toFixed(2);
  const creatorCut = (amount * 0.95 / 100).toFixed(2);
  await sendEmail({
    to: creatorEmail,
    subject: `New sale: ${zineTitle}`,
    html: `<p><strong>${buyerName}</strong> purchased <strong>${zineTitle}</strong> for $${dollars}.</p><p>Your cut (95%): $${creatorCut}</p>`,
  });
}

// Template: publish confirmation
async function notifyPublished(creatorEmail, zineTitle, zineUrl) {
  await sendEmail({
    to: creatorEmail,
    subject: `"${zineTitle}" is live!`,
    html: `<p>Your zine <strong>${zineTitle}</strong> is now published.</p><p><a href="${zineUrl}">View it here</a></p>`,
  });
}

module.exports = {
  sendEmail,
  notifyNewSubscriber,
  notifyTip,
  notifySale,
  notifyPublished,
};
