// India OTP server for PulseMesh
// Usage:
//   MSG91_AUTH_KEY=... MSG91_TEMPLATE_ID=... MSG91_SENDER=... node otp-server.js
// Endpoints:
//   POST /send-otp   { phone: "+919876543210" }
//   POST /verify-otp { phone: "+919876543210", otp: "123456", otpToken?: "..." }

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.OTP_PORT || 8787);
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || '';
const MSG91_SENDER = process.env.MSG91_SENDER || 'PULSEM';

const store = new Map();

const json = (res, code, payload) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
};

const norm = (v = '') => {
  const raw = String(v).replace(/\s|-/g, '');
  if (/^\+91\d{10}$/.test(raw)) return raw;
  if (/^91\d{10}$/.test(raw)) return `+${raw}`;
  if (/^0\d{10}$/.test(raw)) return `+91${raw.slice(1)}`;
  if (/^\d{10}$/.test(raw)) return `+91${raw}`;
  return null;
};

async function sendViaMsg91(phone, otp) {
  // MSG91 variable template route
  const payload = {
    template_id: MSG91_TEMPLATE_ID,
    sender: MSG91_SENDER,
    short_url: 0,
    mobiles: phone.replace('+', ''),
    VAR1: otp
  };

  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: MSG91_AUTH_KEY
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`MSG91 failed: ${text}`);
  return text;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });

  if (req.method === 'POST' && req.url === '/send-otp') {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', async () => {
      try {
        const { phone } = JSON.parse(body || '{}');
        const normalized = norm(phone);
        if (!normalized) return json(res, 400, { success: false, message: 'Invalid Indian phone number' });

        const otp = String(crypto.randomInt(100000, 999999));
        const otpToken = crypto.randomBytes(12).toString('hex');

        store.set(normalized, {
          otp,
          otpToken,
          expiresAt: Date.now() + 5 * 60 * 1000
        });

        if (MSG91_AUTH_KEY && MSG91_TEMPLATE_ID) {
          await sendViaMsg91(normalized, otp);
          return json(res, 200, { success: true, provider: 'msg91', otpToken });
        }

        return json(res, 200, {
          success: true,
          provider: null,
          otpToken,
          devOtp: otp,
          message: 'Provider not configured; returning dev OTP for testing'
        });
      } catch (err) {
        return json(res, 500, { success: false, message: err.message });
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
        const normalized = norm(phone);
        if (!normalized) return json(res, 400, { success: false, message: 'Invalid phone' });

        const rec = store.get(normalized);
        if (!rec) return json(res, 400, { success: false, message: 'OTP not requested' });
        if (Date.now() > rec.expiresAt) {
          store.delete(normalized);
          return json(res, 400, { success: false, message: 'OTP expired' });
        }
        if (otpToken && rec.otpToken !== otpToken) return json(res, 400, { success: false, message: 'Invalid token' });
        if (String(otp) !== rec.otp) return json(res, 400, { success: false, message: 'Incorrect OTP' });

        store.delete(normalized);
        return json(res, 200, { success: true });
      } catch (err) {
        return json(res, 500, { success: false, message: err.message });
      }
    });
    return;
  }

  return json(res, 404, { success: false, message: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`PulseMesh OTP server running at http://localhost:${PORT}`);
  if (!MSG91_AUTH_KEY || !MSG91_TEMPLATE_ID) {
    console.log('MSG91 not configured. Using dev OTP fallback mode.');
  }
});
