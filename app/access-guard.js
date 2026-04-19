function getDashboardUrl() {
  return new URL("dashboard.html#login", import.meta.url).href;
}

function renderLockedScreen() {
  document.body.innerHTML = `
    <main style="min-height:100svh;display:grid;place-items:center;padding:24px;font-family:Fredoka,system-ui,sans-serif;background:#fff7ed;color:#312015;text-align:center;">
      <section style="width:min(420px,100%);background:#fff;border:2px solid #f4c18f;border-radius:18px;padding:28px;box-shadow:0 16px 40px rgba(92,52,18,.16);">
        <h1 style="margin:0 0 10px;font-size:clamp(28px,8vw,42px);">Lessons locked</h1>
        <p style="margin:0 0 22px;font-size:18px;line-height:1.4;">Your 24-hour trial has ended. Buy premium to keep using SpeakUp.</p>
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
  const hasAccess = window.SUAuth?.getLicense?.().fullUnlock === true;
  if (!hasAccess) {
    renderLockedScreen();
  }
  return hasAccess;
})();
