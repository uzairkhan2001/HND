// Motion: intro, smooth scrolling, word-rise headings, photo reveals and parallax.
// Everything is skipped when the visitor has "reduce motion" switched on.
(function () {
  window.__motionReady = true;
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { root.classList.add('motion-off'); endIntro(true); return; }
  root.classList.add('motion-on');

  // ---------- intro (home page, once per visit) ----------
  function endIntro(now) {
    const intro = document.getElementById('intro');
    document.body.classList.add('is-loaded');
    if (!intro) return;
    if (now) { intro.remove(); return; }
    intro.classList.add('is-done');
    setTimeout(() => intro.remove(), 900);
  }
  const intro = document.getElementById('intro');
  if (intro) {
    try { sessionStorage.setItem('dta_intro', '1'); } catch {}
    setTimeout(() => endIntro(false), 1700);
  } else {
    requestAnimationFrame(() => document.body.classList.add('is-loaded'));
  }

  // ---------- smooth scrolling (desktop / trackpad; phones keep native scrolling) ----------
  let lenis = null;
  if (window.Lenis && !window.matchMedia('(pointer: coarse)').matches) {
    lenis = new window.Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), wheelMultiplier: 1 });
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    root.classList.add('lenis', 'lenis-smooth');
    // Same-page anchor links glide too, landing just below the sticky header
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      const header = document.getElementById('header');
      lenis.scrollTo(target, { offset: -(header ? header.offsetHeight : 0) - 10 });
      history.pushState(null, '', url.hash);
    });
    // Pause smooth scroll while the mobile menu is open
    new MutationObserver(() => document.body.classList.contains('menu-open') ? lenis.stop() : lenis.start())
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.dtaLenis = lenis;
  }

  // ---------- headings rise word by word ----------
  function splitWords(el) {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.className = 'w__i';
            inner.style.setProperty('--i', i++);
            inner.textContent = p;
            w.append(inner);
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && !child.classList.contains('w')) {
          walk(child);
        }
      });
    };
    walk(el);
    el.classList.add('split');
  }
  const headings = document.querySelectorAll('main h1, main h2, .cta-banner h2, .page-hero h1, .assess-cta h2, .e-footer__lede');
  headings.forEach(splitWords);

  // ---------- photos: unveil + settle, then gentle parallax ----------
  const photos = document.querySelectorAll('.hero__media img, .about__media img, .split__media img, .tcard__imgs img, .post-card__img img, .post__cover, [data-photo]');
  photos.forEach(img => img.classList.add('m-photo'));

  // ---------- cascade: siblings in grids reveal one after another ----------
  document.querySelectorAll('.cards, .gallery, .steps__grid, .posts, .features, .accordion, .bmi__scale, .checklist, .hero__stats, [data-stagger]').forEach(group => {
    [...group.children].forEach((child, n) => child.style.setProperty('--d', Math.min(n, 8)));
    group.classList.add('m-stagger');
  });

  // One observer drives everything: add .is-in when an element scrolls into view
  // A fully masked photo counts as invisible to the browser, so photos are triggered by their frame
  const frames = new Map();
  photos.forEach(img => {
    const frame = img.parentElement;
    if (!frames.has(frame)) frames.set(frame, []);
    frames.get(frame).push(img);
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      (frames.get(e.target) || [e.target]).forEach(el => el.classList.add('is-in'));
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
  document.querySelectorAll('.eyebrow, .section__head > p, .lead, .strip p').forEach(el => el.classList.add('m-fade'));
  document.querySelectorAll('.split, .m-stagger > *, .m-fade').forEach(el => io.observe(el));
  frames.forEach((imgs, frame) => io.observe(frame));

  // Parallax: photos drift slightly slower than the page
  const drift = [...document.querySelectorAll('.hero__media img, .about__media img, .split__media img, .hero__blob, [data-parallax]')];
  const strength = el => el.classList.contains('hero__blob') ? -0.06 : 0.07;
  let ticking = false;
  function updateParallax() {
    ticking = false;
    const vh = window.innerHeight;
    drift.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      const offset = (r.top + r.height / 2 - vh / 2) * strength(el);
      el.style.setProperty('--py', Math.max(-60, Math.min(60, offset)).toFixed(1) + 'px');
    });
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateParallax); } };
  if (lenis) lenis.on('scroll', onScroll); else window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  updateParallax();

  // ---------- header: thin progress line; hides while scrolling down, returns on scroll up ----------
  const header = document.getElementById('header');
  if (header) {
    const bar = document.createElement('span');
    bar.className = 'scroll-progress';
    header.append(bar);
    let lastY = window.scrollY;
    const onHeader = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
      const menuOpen = document.body.classList.contains('menu-open');
      if (!menuOpen && Math.abs(y - lastY) > 6) {
        header.classList.toggle('is-hidden', y > lastY && y > 400);
        lastY = y;
      }
    };
    if (lenis) lenis.on('scroll', onHeader); else window.addEventListener('scroll', onHeader, { passive: true });
    onHeader();
  }
})();
