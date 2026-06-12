# Browser Strategy — Amazon Competitor Radar

## Overview

Amazon actively detects and blocks automated access. This document defines the project's approach to browser-based product page capture across four tiers, from fully automatic to fully manual.

**Core principle:** Fail explainably, degrade gracefully. Never add anti-detection layers.

---

## Tier 1: Playwright (Primary — Current)

**Status:** Implemented (Phase 4)

**How it works:**
- `chromium.launch({ headless: true })` with `--no-sandbox` and `--disable-setuid-sandbox`
- Navigate to product URL, wait for DOM content, parse page
- No stealth modifications, no `AutomationControlled` flags, no webdriver property removal

**Strengths:**
- Zero user interaction required
- Reliable HTML access for JSON-LD / meta / DOM parsing
- Same engine used for testing — easy to maintain parsers

**Limitations:**
- Amazon detects headless Chromium and may serve captcha or block pages
- Success rate varies by region, time of day, request frequency
- No guarantees — some products will always trigger bot detection

**When to use:** Default mode. The scheduler always attempts Playwright first.

**Degradation triggers:**
- `CAPTCHA_DETECTED` → stop auto-retry for this competitor, pause after 3 consecutive failures, suggest manual fallback
- `PAGE_LOAD_FAILED` or `NETWORK_TIMEOUT` → retry on next scheduled run, pause after 3 consecutive failures
- `PRODUCT_NOT_FOUND` → keep in monitor list but stop auto-capture

---

## Tier 2: CDP Direct-to-Chrome (Designed — Not Implemented)

**Status:** Architecture documented, not implemented

**How it would work:**
- Connect to the user's own Chrome browser via `--remote-debugging-port`
- Use Chrome DevTools Protocol directly (no Playwright middleware)
- More closely resembles real user browsing — fewer automation signals

**Strengths:**
- User's own browser has cookies, login state, browsing history — lower detection risk
- CDP gives full page access without Playwright's automation markers

**Limitations:**
- User must launch Chrome with `--remote-debugging-port=9222` — technical barrier
- Security risk: any local process can control that Chrome instance
- Requires clear warning to user about the debugging port
- Not suitable for average non-technical users

**Implementation notes:**
- Would replace `chromium.launch()` with `chromium.connectOverCDP('http://localhost:9222')`
- Existing parser pipeline (page-parser.ts) would work unchanged
- Need a guide/script that walks user through launching Chrome with the flag
- Safety: always check if debugging port is already in use before connecting

**When to implement:** If Playwright success rate drops below an acceptable threshold for a significant portion of users, implement CDP as an opt-in advanced mode.

---

## Tier 3: Browser Extension + Native Messaging (Designed — Not Implemented)

**Status:** Architecture documented, not implemented

**How it would work:**
- A lightweight browser extension that reads the current page's product data
- Communicates with the Electron app via Native Messaging
- User navigates to Amazon naturally, clicks the extension icon to capture

**Strengths:**
- Runs in the user's actual browser — indistinguishable from normal browsing
- Zero automation signals
- User can verify the page before capturing

**Limitations:**
- Requires extension installation (Chrome Web Store or sideload)
- Native Messaging setup is complex (manifest registration, host application path)
- User must manually navigate to each product page
- Extension must be maintained for Chrome, Edge, Firefox variants

**Implementation notes:**
- Extension manifest registers a Native Messaging host pointing to a helper executable
- Helper process sends JSON product data via stdin/stdout to the Electron app
- App listens for messages and saves as snapshot
- Extension permission model: `activeTab` only — no broad host permissions needed
- Not a V1 priority due to setup complexity

**When to implement:** V2 or later. Suitable when manual capture volume makes the extension worth the setup cost.

---

## Tier 4: Semi-Automatic / Manual Entry (Implemented — Current)

**Status:** Implemented (Phase 9)

**How it works:**
- When automatic capture fails, the user can open the product page in their system browser
- The user verifies the data they see and manually enters price, rating, review count, availability
- The app saves this as a manual snapshot with source marking

**Strengths:**
- Works 100% of the time — no detection possible
- User validates the data — no parsing errors
- Zero risk of triggering Amazon bot detection

**Limitations:**
- Requires user action for each capture
- Manual data entry is slower than automated
- Data accuracy depends on user attention

**Implementation:**
- IPC channel `capture:manual-save` accepts competitor ID + manual data
- `ManualCapture` component shows input fields for price, rating, reviews, availability
- Save button writes snapshot with `capture_status='success'` to DB
- Alert rules run on manual snapshots same as automatic ones

**When to use:**
- Competitor in error/paused state after auto-capture failures
- User wants to fill gaps in data history
- User is actively monitoring and sees a change

---

## Degradation Flow

```
                         ┌──────────────────┐
                         │  Playwright Auto  │ ← scheduler triggers
                         └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
               Success      CAPTCHA /       Network /
                            Blocked         Timeout
                    │            │              │
                    │            ▼              ▼
                    │    ┌──────────────┐  Retry next
                    │    │ Pause after  │  scheduled run
                    │    │ 3 failures   │      │
                    │    └──────┬───────┘      │
                    │           │              │
                    │           ▼              │
                    │  ┌─────────────────┐     │
                    │  │ Suggest Manual   │     │
                    │  │ Capture Fallback │◄────┘
                    │  └────────┬────────┘
                    │           │
                    ▼           ▼
              ┌──────────────────────┐
              │   Snapshot Saved     │
              │   (auto or manual)   │
              └──────────────────────┘
```

---

## What We Explicitly Do NOT Build

- ❌ Stealth plugins or `puppeteer-extra-plugin-stealth`
- ❌ `--disable-blink-features=AutomationControlled` or similar flags
- ❌ Proxy rotation, IP pools, VPN chaining
- ❌ CAPTCHA solving services (2Captcha, Anti-Captcha, etc.)
- ❌ Session hijacking or cookie injection
- ❌ Login-state scraping
- ❌ High-frequency or concurrent bulk scraping

**Why:** This project is open-source. Its compliance boundary is "local, low-frequency monitoring of public pages." Adding anti-detection layers crosses into "evading platform access controls" — a fundamentally different product category with different legal and ethical implications.

---

## References

- [Playwright Browser Context docs](https://playwright.dev/docs/browser-contexts)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Chrome Extension Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- Project tech decisions: `.harness/TECH_DECISIONS.md`
