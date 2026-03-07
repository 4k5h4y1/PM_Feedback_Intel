# Zero Trust + WARP Access Setup for SignalDesk

This guide walks through binding SignalDesk to a custom domain and securing it with Cloudflare Zero Trust + WARP, so only users running the WARP client can access the dashboard.

---

## Overview: What You're Building

```
User with WARP client running
         ↓
WARP validates device posture
         ↓
Cloudflare Access checks identity (is this user allowed?)
         ↓
Request reaches signaldesk.yourdomain.com
         ↓
Your Worker serves the dashboard
```

Without WARP running, the browser gets an Access login page or a block page — the Worker is never reached.

---

## Prerequisites

- A domain registered with Cloudflare (or transferred to Cloudflare DNS)
- Cloudflare account with Zero Trust plan (the free plan supports up to 50 users)
- SignalDesk deployed on Workers (already done: `signaldesk.ashar-0a8.workers.dev`)

---

## Step 1: Bind a Custom Domain to Your Worker

### In the Cloudflare Dashboard:

1. Go to **Workers & Pages** → **signaldesk**
2. Click the **Settings** tab
3. Under **Domains & Routes**, click **Add**
4. Select **Custom Domain**
5. Enter your domain: e.g., `signaldesk.yourdomain.com`
6. Click **Add Domain**

Cloudflare automatically:
- Creates a DNS CNAME record pointing to your Worker
- Provisions an SSL certificate
- Routes traffic from that domain to your Worker

Your Worker is now accessible at both:
- `https://signaldesk.ashar-0a8.workers.dev` (original)
- `https://signaldesk.yourdomain.com` (new)

> **Note:** If your domain is not on Cloudflare DNS, you'll need to either transfer it or add it to Cloudflare as a zone first (Workers & Pages → Custom Domains will guide you).

---

## Step 2: Enable Cloudflare Zero Trust

1. In the Cloudflare Dashboard, click **Zero Trust** in the left sidebar
   - If you haven't set up Zero Trust before, you'll be prompted to choose a team name (e.g., `yourcompany`). This becomes `yourcompany.cloudflareaccess.com`.
2. Complete onboarding (choose the Free plan if you have ≤ 50 users)

---

## Step 3: Deploy the WARP Client

WARP is Cloudflare's device client — it must be running on a user's machine for device posture checks to work.

### Create a Device Enrollment Policy:

1. In Zero Trust → **Settings** → **WARP Client** → **Device enrollment**
2. Click **Manage** → **Add a rule**
3. Rule: **Emails ending in** `@yourdomain.com` (or specific email addresses)
4. This controls who can install and enroll WARP into your Zero Trust org

### Deploy WARP to your device:

1. Download WARP from [1.1.1.1](https://1.1.1.1/) (the same app, just enrolled into your org)
2. After installing, click the WARP icon → **Preferences** → **Account** → **Login with Cloudflare Zero Trust**
3. Enter your team name (e.g., `yourcompany`)
4. Authenticate with your email
5. WARP is now enrolled and reporting device posture to your Zero Trust org

---

## Step 4: Configure Split Tunnel (Allow SignalDesk Domain Through WARP)

By default, WARP tunnels all traffic. Split tunneling lets you route specific domains through WARP while everything else goes to the regular internet — or vice versa.

For SignalDesk, you want to **include** `signaldesk.yourdomain.com` in the WARP tunnel so Access can enforce posture checks.

### Default Exclude mode (recommended):

WARP's default is **Exclude** mode — it routes everything through WARP except the domains you list as excluded.

If you're using Exclude mode, you **don't need to do anything** — `signaldesk.yourdomain.com` will automatically go through WARP.

### If you're using Include mode (routing only specific traffic through WARP):

1. Zero Trust → **Settings** → **WARP Client** → **Split Tunnels**
2. Make sure you're in **Include** mode
3. Click **Add an entry**
4. Add `signaldesk.yourdomain.com`
5. Save

This ensures requests to your dashboard go through the WARP tunnel where Access can inspect them.

---

## Step 5: Create a Cloudflare Access Application

This is the policy that protects SignalDesk. It intercepts all requests and verifies the user before forwarding to your Worker.

1. Zero Trust → **Access** → **Applications** → **Add an application**
2. Select **Self-hosted**

### Configure the application:

| Field | Value |
|-------|-------|
| **Application name** | SignalDesk |
| **Session duration** | 8 hours (or 24h for less frequent login) |
| **Application domain** | `signaldesk.yourdomain.com` |

3. Click **Next**

### Add an Access Policy:

| Field | Value |
|-------|-------|
| **Policy name** | WARP Users |
| **Action** | Allow |
| **Include** rule | **WARP** (selector) |

This means: only users with an active, enrolled WARP session can access SignalDesk. Users without WARP running (or not enrolled) are blocked.

**Optional — add identity check too:**

Add a second Include rule:
- **Emails** → enter your specific email addresses, OR
- **Email domain** → `@yourdomain.com`

With both rules (WARP + email domain), users must have WARP running AND be logged in with an approved email.

4. Click **Next** → **Add application**

---

## Step 6: Verify It Works

### Test 1: With WARP running
1. Make sure WARP is connected (icon in menu bar shows connected)
2. Visit `https://signaldesk.yourdomain.com`
3. You should either go directly to the dashboard (if already authenticated) or see a Cloudflare Access login page (one-time per session)
4. After logging in, you see SignalDesk ✓

### Test 2: With WARP disconnected
1. Disconnect WARP (click the toggle in the WARP app)
2. Visit `https://signaldesk.yourdomain.com`
3. You should see an Access block page or be unable to reach the site ✓

### Test 3: From a device without WARP
1. Try accessing from a phone without WARP installed
2. Should be blocked ✓

---

## Step 7: Optional — Secure the .workers.dev URL

Your Worker is still accessible at `signaldesk.ashar-0a8.workers.dev` (no Access protection). To block direct access:

1. In the Cloudflare Dashboard → **Workers & Pages** → **signaldesk**
2. **Settings** → **Domains & Routes**
3. Find the `*.workers.dev` route
4. You can disable it here, forcing all traffic through your custom domain (which has Access protection)

Alternatively, wrap it in Access too by adding `signaldesk.ashar-0a8.workers.dev` as a second application domain.

---

## Step 8: (Advanced) WARP Device Posture for Security-Sensitive Records

SignalDesk has a concept of `visibility_scope = security_team_only` — records that should only be visible to the security team with verified devices.

### Add a posture check:

1. Zero Trust → **Settings** → **WARP Client** → **Device posture**
2. Add a check: **OS version** (ensure device is up to date), or **Disk encryption** (device must be encrypted)
3. Create a second Access Policy on the same application:

| Field | Value |
|-------|-------|
| **Policy name** | Security Team |
| **Action** | Allow |
| **Include** | Email → security-team member emails |
| **Require** | Device Posture → your posture check |

This means security team members must also pass the posture check. In the Workers code, you would then check the identity headers injected by Access (`CF-Access-Authenticated-User-Email`) to gate the security-sensitive content.

> **Note:** Full content-gating based on identity headers requires additional code changes in the Worker to read the `CF-Access-Authenticated-User-Email` header and match it against a list of security team emails before returning unreacted content.

---

## Architecture After Setup

```
Internet
    │
    ▼
Cloudflare Edge (globally distributed)
    │
    ├─ signaldesk.yourdomain.com (DNS resolves here)
    │
    ▼
Cloudflare Access (Zero Trust policy evaluation)
    │  ← Checks: Is WARP connected? Is user authenticated?
    │  ← If NO → Block page / login page
    │  ← If YES → Continue
    │
    ▼
Cloudflare Worker (signaldesk)
    │
    ├─ D1 Database (feedback + analysis)
    ├─ KV Store (cache)
    ├─ R2 Bucket (raw payloads)
    ├─ Workers AI (digest generation)
    └─ Workflows (ingest pipeline)
```

---

## Troubleshooting

**WARP says connected but Access still blocks me:**
- Ensure you enrolled WARP into your Zero Trust organization (not just the public 1.1.1.1 WARP)
- In WARP app → Preferences → Account — should show your team name

**Can't reach the dashboard at all (connection refused):**
- Check the custom domain is properly configured under Workers & Pages → signaldesk → Settings → Domains
- Check DNS propagation: `nslookup signaldesk.yourdomain.com` should return Cloudflare IPs

**Access login loop (log in, redirect, log in again):**
- Session cookie issue — try in incognito mode
- Ensure the application domain exactly matches what you typed (no trailing slash)

**WARP split tunnel not working:**
- Check Settings → WARP Client → Split Tunnels mode (Include vs Exclude)
- In Include mode, verify `signaldesk.yourdomain.com` is in the include list

---

## Cost Estimate

| Component | Cost |
|-----------|------|
| Zero Trust (up to 50 users) | Free |
| WARP client | Free |
| Custom domain (if you own it) | $0/year on Cloudflare DNS |
| Domain registration (if new) | ~$10-15/year |
| Workers (dashboard serving) | Free tier covers ~100k req/day |
| D1, KV, R2 | Free tier covers all demo usage |

For a small internal team, the total cost is essentially just the domain registration fee (~$10/year).
