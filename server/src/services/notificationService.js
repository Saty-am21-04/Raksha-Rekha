const nodemailer = require('nodemailer');

const cleanRecipients = (recipients = []) => recipients
  .map((recipient) => String(recipient).trim())
  .filter(Boolean)
  .slice(0, 25);

const isDispatchEnabled = () => process.env.ALLOW_EMERGENCY_DISPATCH === 'true';

const sendWithTwilio = async ({ recipients, message, twilioClient }) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_FROM_NUMBER) {
    throw new Error('Twilio is not configured.');
  }

  const client = twilioClient || require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return Promise.all(recipients.map(async (to) => {
    try {
      const result = await client.messages.create({ from: process.env.TWILIO_FROM_NUMBER, to, body: message });
      return { recipient: to, ok: true, providerId: result.sid };
    } catch (error) {
      return { recipient: to, ok: false, error: error.message };
    }
  }));
};

const sendWithEmailFallback = async ({ recipients, subject, message, transport }) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    throw new Error('SMTP fallback is not configured.');
  }

  const mailer = transport || nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });

  return Promise.all(recipients.map(async (to) => {
    try {
      const result = await mailer.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: subject || 'RAKSHA-REKHA Emergency Notification',
        text: message
      });
      return { recipient: to, ok: true, providerId: result.messageId };
    } catch (error) {
      return { recipient: to, ok: false, error: error.message };
    }
  }));
};

const dispatchNotification = async ({ recipients, message, subject }, providers = {}) => {
  const normalizedRecipients = cleanRecipients(recipients);
  if (!isDispatchEnabled()) {
    const error = new Error('Emergency dispatch is disabled. Set ALLOW_EMERGENCY_DISPATCH=true for development use.');
    error.statusCode = 403;
    throw error;
  }
  if (!normalizedRecipients.length || !message || String(message).length > 800) {
    const error = new Error('Recipients and a message under 800 characters are required.');
    error.statusCode = 400;
    throw error;
  }

  try {
    return { channel: 'sms', results: await sendWithTwilio({ recipients: normalizedRecipients, message, twilioClient: providers.twilioClient }) };
  } catch (smsError) {
    return {
      channel: 'email-fallback',
      smsError: smsError.message,
      results: await sendWithEmailFallback({
        recipients: normalizedRecipients,
        subject,
        message,
        transport: providers.emailTransport
      })
    };
  }
};

module.exports = { dispatchNotification };
