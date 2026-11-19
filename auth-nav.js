/* Shows "My account" instead of "Sign in" when the visitor is signed in. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const account = document.querySelector('[data-auth="account"]');
    const signin = document.querySelector('[data-auth="signin"]');
    if (!account && !signin) return;
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin' });
      const data = await response.json();
      const authed = Boolean(data.authenticated);
      if (account) account.hidden = !authed;
      if (signin) signin.hidden = authed;
    } catch (error) {
      if (account) account.hidden = true;
      if (signin) signin.hidden = false;
    }
  });
})();
