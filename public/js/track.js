// Privacy-friendly first-party analytics: anonymous visitor id, no personal data.
(function () {
  const store = (kind, key, make) => {
    try {
      const s = window[kind];
      let v = s.getItem(key);
      if (!v) { v = make(); s.setItem(key, v); }
      return v;
    } catch { return make(); }
  };
  const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const visitor = store('localStorage', 'dta_vid', rid);

  // A session ends after 30 minutes without activity
  let session;
  try {
    const last = +localStorage.getItem('dta_last') || 0;
    session = localStorage.getItem('dta_sid');
    if (!session || Date.now() - last > 30 * 60 * 1000) {
      session = rid();
      localStorage.setItem('dta_sid', session);
    }
    localStorage.setItem('dta_last', Date.now());
  } catch { session = rid(); }

  const send = data => {
    const body = JSON.stringify({ visitor, session, path: location.pathname, ...data });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain' }));
    else fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  };

  const params = new URLSearchParams(location.search);
  const post = document.body.dataset.post || null;

  send({ type: 'pageview', referrer: document.referrer, utm: params.get('utm_source') || params.get('ref'), post });

  // Click tracking for every link and button
  document.addEventListener('click', e => {
    const el = e.target.closest('a, button');
    if (!el || (el.tagName !== 'A' && el.closest('[data-no-track]')) || el.closest('form') && el.type !== 'submit' && el.tagName !== 'A') return;
    const label = (el.dataset.track || el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    const href = el.getAttribute('href') || (el.type === 'submit' ? 'form submit' : '');
    const section = el.closest('section[id], header, footer');
    send({ type: 'click', label, target: href, section: section ? (section.id || section.tagName.toLowerCase()) : '' });
  }, true);

  // Blog read = scrolled through 60% of the article, or stayed 45 seconds
  if (post) {
    let done = false;
    const read = () => { if (!done) { done = true; send({ type: 'read', post }); } };
    const article = document.querySelector('.post__content');
    window.addEventListener('scroll', () => {
      if (!article) return;
      const r = article.getBoundingClientRect();
      if (r.top + r.height * 0.6 < window.innerHeight) read();
    }, { passive: true });
    setTimeout(read, 45000);
  }

  window.dtaTrack = { ids: () => ({ visitor, session }), send };
})();
