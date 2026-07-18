function getDashboardUrl() {
  return new URL("dashboard.html#login", import.meta.url).href;
}

function renderDeviceBlockedScreen() {
  document.body.innerHTML = `
    <main style="min-height:100svh;display:grid;place-items:center;padding:24px;font-family:Fredoka,system-ui,sans-serif;background:#fff7ed;color:#312015;text-align:center;">
      <section style="width:min(440px,100%);background:#fff;border:2px solid #f4c18f;border-radius:18px;padding:28px;box-shadow:0 16px 40px rgba(92,52,18,.16);">
        <h1 style="margin:0 0 10px;font-size:clamp(26px,7vw,38px);">Already in use on another device</h1>
        <p style="margin:0 0 22px;font-size:17px;line-height:1.5;">This SpeakUp account is locked to one device. If you have changed or lost your phone, message us on WhatsApp and we will reset it for you.</p>
        <a href="https://wa.me/916282405919?text=Hi%2C%20I%20need%20to%20reset%20my%20SpeakUp%20device%20lock." style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;">Message us on WhatsApp</a>
      </section>
    </main>
  `;
}

function renderLockedScreen(message) {
  document.body.innerHTML = `
    <main style="min-height:100svh;display:grid;place-items:center;padding:24px;font-family:Fredoka,system-ui,sans-serif;background:#fff7ed;color:#312015;text-align:center;">
      <section style="width:min(420px,100%);background:#fff;border:2px solid #f4c18f;border-radius:18px;padding:28px;box-shadow:0 16px 40px rgba(92,52,18,.16);">
        <h1 style="margin:0 0 10px;font-size:clamp(28px,8vw,42px);">Lessons locked</h1>
        <p style="margin:0 0 22px;font-size:18px;line-height:1.4;">${message}</p>
        <a href="${getDashboardUrl()}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:999px;background:#ff7a59;color:#fff;text-decoration:none;font-weight:700;">Go to account</a>
      </section>
    </main>
  `;
}

async function waitForAuthReady() {
  for (let i = 0; i < 80 && !window.SUAuth; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (window.SUAuth?.ready) await window.SUAuth.ready;
}

window.SUAccessReady = (async () => {
  await waitForAuthReady();
  const deviceBlocked = window.SUAuth?.getDeviceBlocked?.() === true;
  const license = window.SUAuth?.getLicense?.();
  const requirePaidOnly = window.SU_REQUIRE_PAID_ONLY === true;
  const isTrialBlocked = requirePaidOnly && license?.trialActive === true;
  const hasAccess = license?.fullUnlock === true && !isTrialBlocked;
  if (deviceBlocked) {
    renderDeviceBlockedScreen();
  } else if (!hasAccess) {
    renderLockedScreen(
      isTrialBlocked
        ? "The Vocab Pack is part of the paid plan. Your free trial doesn't include it — buy premium to unlock it."
        : "Your 24-hour trial has ended. Buy premium to keep using SpeakUp."
    );
  }
  return hasAccess;
})();
