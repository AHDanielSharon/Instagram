// India OTP backend for PulseMesh
// Supports MSG91 or Fast2SMS if configured.

const http = require('http');
const crypto = require('crypto');

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '';
const MSG91_SENDER = process.env.MSG91_SENDER || 'PULSEM';

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || '';
const FAST2SMS_ROUTE = process.env.FAST2SMS_ROUTE || 'dlt';

const store = new Map();

const normIndian = (v = '') => {
  const raw = String(v).replace(/\s|-/g, '');
  if (/^\+91\d{10}$/.test(raw)) return raw;
  if (/^91\d{10}$/.test(raw)) return `+${raw}`;
  if (/^0\d{10}$/.test(raw)) return `+91${raw.slice(1)}`;
  if (/^\d{10}$/.test(raw)) return `+91${raw}`;
  return null;
};

async function sendViaMsg91(phone, otp) {
  const payload = {
    template_id: MSG91_TEMPLATE_ID,
    sender: MSG91_SENDER,
    short_url: 0,
    mobiles: phone.replace('+', ''),
    VAR1: otp
  };
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: MSG91_AUTH_KEY },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MSG91 failed: ${text}`);
}

async function sendViaFast2SMS(phone, otp) {
  const payload = new URLSearchParams({
    route: FAST2SMS_ROUTE,
    message: `Your PulseMesh OTP is ${otp}. It is valid for 5 minutes.`,
    language: 'english',
    numbers: phone.replace('+91', '')
  });

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: FAST2SMS_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });
  const data = await res.json();
  if (!res.ok || data.return === false) throw new Error(`Fast2SMS failed: ${JSON.stringify(data)}`);
}

function providerName() {
  if (MSG91_AUTH_KEY && MSG91_TEMPLATE_ID) return 'msg91';
  if (FAST2SMS_API_KEY) return 'fast2sms';
  return null;
}

async function deliverOtp(phone, otp) {
  if (MSG91_AUTH_KEY && MSG91_TEMPLATE_ID) {
    await sendViaMsg91(phone, otp);
    return 'msg91';
  }
  if (FAST2SMS_API_KEY) {
    await sendViaFast2SMS(phone, otp);
    return 'fast2sms';
  }
  return null;
}

function createOtpHandler() {
  return async function handleOtp(req, res) {
    const json = (code, payload) => {
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS'
      });
      res.end(JSON.stringify(payload));
    };

    if (req.method === 'OPTIONS') return json(200, { ok: true });

    if (req.method === 'GET' && req.url === '/otp-config') {
      return json(200, { success: true, provider: providerName(), hasRealProvider: !!providerName() });
    }

    if (req.method === 'POST' && req.url === '/send-otp') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', async () => {
        try {
          const { phone } = JSON.parse(body || '{}');
          const normalized = normIndian(phone);
          if (!normalized) return json(400, { success: false, message: 'Invalid Indian phone number' });

          const otp = String(crypto.randomInt(100000, 999999));
          const otpToken = crypto.randomBytes(12).toString('hex');

          store.set(normalized, { otp, otpToken, expiresAt: Date.now() + 5 * 60 * 1000 });

          const provider = await deliverOtp(normalized, otp);
          if (provider) return json(200, { success: true, provider, otpToken });

          return json(200, {
            success: true,
            provider: null,
            otpToken,
            devOtp: otp,
            message: 'No SMS provider configured. Returning dev OTP for testing.'
          });
        } catch (err) {
          return json(500, { success: false, message: err.message });
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/verify-otp') {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        try {
          const { phone, otp, otpToken } = JSON.parse(body || '{}');
          const normalized = normIndian(phone);
          if (!normalized) return json(400, { success: false, message: 'Invalid phone' });

          const rec = store.get(normalized);
          if (!rec) return json(400, { success: false, message: 'OTP not requested' });
          if (Date.now() > rec.expiresAt) {
            store.delete(normalized);
            return json(400, { success: false, message: 'OTP expired' });
          }
          if (otpToken && rec.otpToken !== otpToken) return json(400, { success: false, message: 'Invalid token' });
          if (String(otp) !== rec.otp) return json(400, { success: false, message: 'Incorrect OTP' });

          store.delete(normalized);
          return json(200, { success: true });
        } catch (err) {
          return json(500, { success: false, message: err.message });
        }
      });
      return;
    }

    return false;
  };
}

function startStandaloneServer(port = Number(process.env.OTP_PORT || 8787)) {
  const handler = createOtpHandler();
  const server = http.createServer((req, res) => {
    handler(req, res).then((handled) => {
      if (handled === false) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
      }
    });
  });

  server.listen(port, () => {
    console.log(`PulseMesh OTP server running at http://localhost:${port}`);
    if (!providerName()) console.log('No SMS provider configured. Using dev OTP fallback mode.');
  });
}

if (require.main === module) {
  startStandaloneServer();
}

module.exports = { createOtpHandler, startStandaloneServer, normIndian };
