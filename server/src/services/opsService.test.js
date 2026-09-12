const assert = require('node:assert/strict');

const { dispatchNotification } = require('./notificationService');
const { requestGeminiSitrep } = require('./sitrepService');

const originalEnv = { ...process.env };

const run = async () => {
  process.env.ALLOW_EMERGENCY_DISPATCH = 'true';
  delete process.env.TWILIO_ACCOUNT_SID;
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_FROM = 'ops@example.test';

  const fallback = await dispatchNotification({
    recipients: ['ops@example.test'],
    subject: 'Test',
    message: 'Move to designated relief camp.'
  }, {
    emailTransport: {
      sendMail: async () => ({ messageId: 'mock-mail-1' })
    }
  });
  assert.equal(fallback.channel, 'email-fallback');
  assert.equal(fallback.results[0].ok, true);

  process.env.GEMINI_API_KEY = 'test-key';
  const report = await requestGeminiSitrep({ sourceDataTimestamp: 'now', zones: [] }, async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'Mock SitRep' }] } }] })
  }));
  assert.equal(report, 'Mock SitRep');

  process.env.ALLOW_EMERGENCY_DISPATCH = 'false';
  await assert.rejects(
    () => dispatchNotification({ recipients: ['x'], message: 'blocked' }),
    /disabled/
  );

  process.env = originalEnv;
  console.log('Ops service smoke test passed.');
};

run().catch((error) => {
  process.env = originalEnv;
  console.error(error);
  process.exit(1);
});
