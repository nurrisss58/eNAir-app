/* Shows "My account" instead of "Sign in" when the visitor is signed in. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const account = document.querySelector('[data-auth="account"]');
    const signin = document.querySelector('[data-auth="signin"]');
    if (!account && !signin) return;
    let localUser = null;
    try { localUser = JSON.parse(localStorage.getItem('enairUser') || 'null'); } catch (error) { localUser = null; }
    let serverUser = false;
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await response.json();
      serverUser = Boolean(data.authenticated);
    } catch (error) { /* offline preview keeps the local session */ }
    const authed = serverUser || Boolean(localUser && localUser.email);
    if (account) account.hidden = !authed;
    if (signin) signin.hidden = authed;
  });
})();
