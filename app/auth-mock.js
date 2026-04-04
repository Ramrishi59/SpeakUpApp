// auth-mock.js (DEV ONLY)

const AUTH_KEY = "su_auth";
const LICENSE_KEY = "su_license";

function safeParse(value, fallback) {
    if (!value) return fallback;              // ✅ handles null/empty
    try { return JSON.parse(value) ?? fallback; }  // ✅ handles "null"
    catch { return fallback; }
  }

  function getAuth() {
    const a = safeParse(localStorage.getItem(AUTH_KEY), { isLoggedIn: false, phone: null });
    return {
      isLoggedIn: !!(a && a.isLoggedIn),
      phone: (a && a.phone) ? a.phone : null
    };
  }

 function setAuth(authObj) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    isLoggedIn: !!authObj.isLoggedIn,
    phone: authObj.phone || null
  }));
}

 function getLicense() {
  const l = safeParse(localStorage.getItem(LICENSE_KEY), {
    entitled: false,
    entitlements: [],
    licenseExpiresAt: null
  });
  return {
    entitled: !!l.entitled,
    entitlements: Array.isArray(l.entitlements) ? l.entitlements : [],
    licenseExpiresAt: l.licenseExpiresAt || null
  };
}

 function setLicense(licenseObj) {
  localStorage.setItem(LICENSE_KEY, JSON.stringify({
    entitled: !!licenseObj.entitled,
    entitlements: Array.isArray(licenseObj.entitlements) ? licenseObj.entitlements : [],
    licenseExpiresAt: licenseObj.licenseExpiresAt || null
  }));
}

 function mockLogin(phone) {
  setAuth({ isLoggedIn: true, phone });
  // Don’t auto-unlock on login.
}

 function mockLogout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(LICENSE_KEY);
}

 function isEntitled() {
  const l = getLicense();
  if (!l.entitled) return false;
  if (!l.licenseExpiresAt) return false;
  const exp = new Date(l.licenseExpiresAt).getTime();
  return Number.isFinite(exp) && exp > Date.now();
}

 function mockGrantFullUnlock(days = 30) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  setLicense({
    entitled: true,
    entitlements: ["FULL_UNLOCK_V1"],
    licenseExpiresAt: expiresAt
  });
}

 function mockRevokeUnlock() {
  setLicense({ entitled: false, entitlements: [], licenseExpiresAt: null });
}

 function mockExpireLicense() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const l = getLicense();
  setLicense({
    entitled: l.entitled,
    entitlements: l.entitlements,
    licenseExpiresAt: yesterday
  });
}

// Make functions available to script.js (non-module setup)
window.SUAuth = {
    getAuth,
    setAuth,
    getLicense,
    setLicense,
    mockLogin,
    mockLogout,
    isEntitled,
    mockGrantFullUnlock,
    mockRevokeUnlock,
    mockExpireLicense
  };