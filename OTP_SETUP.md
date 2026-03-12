# PulseMesh India OTP Setup

The web app now calls an OTP backend endpoint:

- Send OTP: `POST /send-otp`
- Verify OTP: `POST /verify-otp`

Default endpoint expected by the app is:

- `http://localhost:8787/send-otp`

You can override by setting in browser console:

```js
localStorage.setItem('pulsemesh.otpEndpoint', 'https://your-domain/send-otp')
location.reload()
```

## Run local OTP service

```bash
node otp-server.js
```

## Real SMS delivery (India)

Configure MSG91 env vars:

```bash
export MSG91_AUTH_KEY='your_auth_key'
export MSG91_TEMPLATE_ID='your_template_id'
export MSG91_SENDER='PULSEM'
node otp-server.js
```

Without provider config, server returns `devOtp` for testing.
