// Hero background slider: crossfade + slow zoom, with indicators and a pause button.
// Extra photos load only after the first one is showing, so the page stays fast.
(function () {
  document.querySelectorAll('[data-slider]').forEach(media => {
    const hero = media.closest('.e-hero') || media.parentElement;
    const slides = [...media.querySelectorAll('.e-slide')];
    const nav = hero.querySelector('.e-slider-nav');
    if (slides.length < 2) return;
    const dots = nav ? [...nav.querySelectorAll('[data-slide-to]')] : [];
    const counter = nav && nav.querySelector('[data-slide-now]');
    const pauseBtn = nav && nav.querySelector('[data-slide-pause]');
    const seconds = Math.max(3, Number(media.dataset.interval) || 6);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let current = 0;
    let timer = null;
    let paused = reduce; // with "reduce motion" the slideshow waits for the visitor
    let leaveTimer = null;

    const load = img => new Promise(resolve => {
      if (!img.dataset.src) return resolve();
      img.onload = img.onerror = () => resolve();
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });

    function restartAnimation(el) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }

    async function show(next, fromUser) {
      if (next === current) return;
      const prev = slides[current];
      const incoming = slides[next];
      await load(incoming);
      clearTimeout(leaveTimer);
      slides.forEach(s => s.classList.remove('is-leaving'));
      prev.classList.remove('is-active');
      prev.classList.add('is-leaving');
      restartAnimation(incoming);
      incoming.classList.add('is-active');
      leaveTimer = setTimeout(() => prev.classList.remove('is-leaving'), 1900);
      current = next;
      dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === next);
        d.classList.toggle('is-done', i < next);
        if (i === next) { d.setAttribute('aria-current', 'true'); restartAnimation(d.querySelector('i')); }
        else d.removeAttribute('aria-current');
      });
      if (counter) counter.textContent = String(next + 1).padStart(2, '0');
      if (fromUser) schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (paused || document.hidden) return;
      timer = setTimeout(() => show((current + 1) % slides.length).then(schedule), seconds * 1000);
    }

    function setPaused(p) {
      paused = p;
      hero.classList.toggle('is-paused', p);
      if (pauseBtn) {
        pauseBtn.setAttribute('aria-label', p ? 'Play slideshow' : 'Pause slideshow');
        pauseBtn.querySelector('span').textContent = p ? 'Play' : 'Pause';
      }
      schedule();
    }

    dots.forEach((d, i) => d.addEventListener('click', () => show(i, true)));
    if (pauseBtn) pauseBtn.addEventListener('click', () => setPaused(!paused));
    document.addEventListener('visibilitychange', schedule);

    // Swipe on phones
    let startX = null;
    hero.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 60) show((current + (dx < 0 ? 1 : slides.length - 1)) % slides.length, true);
    }, { passive: true });

    // Preload the rest once the first photo is on screen, then start
    const begin = () => {
      slides.slice(1).reduce((p, img) => p.then(() => load(img)), Promise.resolve());
      setPaused(paused);
    };
    if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin, { once: true });
  });
})();
