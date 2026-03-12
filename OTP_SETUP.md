# PulseMesh India OTP Setup

## ✅ One-command run (recommended)

Run unified server (app + OTP API together on same origin):

```bash
node server.js
```

Open: `http://localhost:8787`

This removes CORS/endpoint mismatch issues and ensures OTP requests hit the correct backend.

---

## OTP endpoints used by app

- `POST /send-otp`
- `POST /verify-otp`
- `GET /otp-config`

By default frontend calls:

- `${location.origin}/send-otp`

Optional override:

```js
localStorage.setItem('pulsemesh.otpEndpoint', 'https://your-domain/send-otp')
location.reload()
```

---

## Real SMS provider setup (India)

### Option A: MSG91

```bash
export MSG91_AUTH_KEY='your_auth_key'
export MSG91_TEMPLATE_ID='your_template_id'
export MSG91_SENDER='PULSEM'
node server.js
```

### Option B: Fast2SMS

```bash
export FAST2SMS_API_KEY='your_fast2sms_key'
export FAST2SMS_ROUTE='dlt'
node server.js
```

If no provider is configured, backend returns `devOtp` for testing only.
