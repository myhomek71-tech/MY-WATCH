/* MY-WATCH auth — shared by login.html, admin.html and any protected page.
   NOTE: this runs in the browser, so it is a front-end gate only. Real security needs a server. */
(() => {
  'use strict';

  // Passwords are stored as SHA-256 of "mywatch:<username>:<password>".
  // Generate a hash in the browser console:
  //   Auth.hash('mywatch:alice:MyPassword1').then(console.log)
  const ACCOUNTS = {
    admin: { role: 'admin', name: 'Administrator', hash: 'd16d5494910eca1523ee182c31431fc569fa3780eb1e078d4b2429db14535111' },
    user:  { role: 'user',  name: 'Watch Fan',     hash: '965bbcb8161c2bf16ee419bf66fd12c4a802118d6b1e11d1a5a511ba26e258c9' }
  };
  const KEY = 'mywatch_session';
  const HOME = { admin: 'admin.html', user: 'index.html' };
  const MAX_TRIES = 5, LOCK_MS = 30000;

  const hash = async text => {
    if (!window.crypto || !crypto.subtle) throw new Error('secure-context');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const current = () => {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const s = JSON.parse(store.getItem(KEY) || 'null');
        if (s && s.exp > Date.now() && ACCOUNTS[s.username] && ACCOUNTS[s.username].role === s.role) return s;
      } catch (e) {}
    }
    return null;
  };
  const save = (s, persist) => { try { (persist ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  const clear = () => { try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) {} };

  // Call at the top of a protected page: Auth.require('admin') or Auth.require() for any signed-in user.
  const require = role => {
    const s = current();
    if (!s || (role && s.role !== role)) { location.replace('login.html'); return null; }
    return s;
  };
  const logout = () => { clear(); location.href = 'login.html'; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  window.Auth = { ACCOUNTS, hash, current, require, logout, esc };

  /* ---------------- Login page only ---------------- */
  const form = document.getElementById('loginForm');
  if (!form) return;

  const $ = id => document.getElementById(id);
  let role = 'user', tries = 0, lockedUntil = 0;

  const already = current();
  if (already) { location.replace(HOME[already.role]); return; }

  // Decorative watch face
  const ticks = $('ticks'), NS = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < 60; i++) {
    const major = i % 5 === 0, a = i * Math.PI / 30, r1 = major ? 70 : 75;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', 100 + r1 * Math.sin(a)); l.setAttribute('y1', 100 - r1 * Math.cos(a));
    l.setAttribute('x2', 100 + 80 * Math.sin(a)); l.setAttribute('y2', 100 - 80 * Math.cos(a));
    l.setAttribute('stroke-width', major ? 2.5 : 1);
    ticks.appendChild(l);
  }
  const tick = () => {
    const d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
    $('sh').setAttribute('transform', `rotate(${s * 6} 100 100)`);
    $('mh').setAttribute('transform', `rotate(${m * 6} 100 100)`);
    $('hh').setAttribute('transform', `rotate(${h * 30} 100 100)`);
  };
  tick(); setInterval(tick, 1000);

  const say = (text, ok) => { const m = $('msg'); m.textContent = text; m.classList.toggle('ok', !!ok); };

  document.querySelectorAll('.roles button').forEach(btn => btn.addEventListener('click', () => {
    role = btn.dataset.role;
    document.querySelectorAll('.roles button').forEach(b => b.setAttribute('aria-selected', b === btn));
    $('submit').textContent = 'Sign in as ' + (role === 'admin' ? 'Admin' : 'User');
    say('');
  }));

  $('peek').addEventListener('click', () => {
    const p = $('password'), show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('peek').textContent = show ? 'Hide' : 'Show';
    $('peek').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const username = $('username').value.trim().toLowerCase(), password = $('password').value;

    if (Date.now() < lockedUntil) return say(`Too many attempts. Try again in ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
    if (!username || !password) return say('Enter your username and password.');

    $('submit').disabled = true;
    let h;
    try { h = await hash(`mywatch:${username}:${password}`); }
    catch (err) { $('submit').disabled = false; return say('Sign-in needs https:// or localhost. Open the site through a web server.'); }
    $('submit').disabled = false;

    const acct = ACCOUNTS[username];
    if (!acct || acct.hash !== h) {
      if (++tries >= MAX_TRIES) { lockedUntil = Date.now() + LOCK_MS; tries = 0; return say('Too many failed attempts. Locked for 30 seconds.'); }
      return say('Username or password is incorrect.');
    }
    if (acct.role !== role) {
      return say(acct.role === 'admin' ? 'This is an admin account. Select the Admin tab.' : 'This account is not an admin. Select the User tab.');
    }

    tries = 0;
    const remember = $('remember').checked;
    save({ username, role: acct.role, exp: Date.now() + (remember ? 7 * 864e5 : 2 * 36e5) }, remember);
    say('Welcome back — redirecting…', true);
    setTimeout(() => location.href = HOME[acct.role], 600);
  });
})();
