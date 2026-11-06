// Mobile navigation
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');

function setMenu(open) {
  if (open) {
    // The menu is positioned inside the header (its blur effect makes it the containing block),
    // so it opens right under it; limit its height to the screen space left below the header
    const header = document.getElementById('header');
    nav.style.top = header.offsetHeight + 'px';
    nav.style.maxHeight = `calc(100dvh - ${Math.max(0, header.getBoundingClientRect().bottom)}px)`;
  }
  if (open) document.getElementById('header').classList.remove('is-hidden');
  nav.classList.toggle('open', open);
  navToggle.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open);
  navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
}
navToggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('click', e => {
  if (nav.classList.contains('open') && !nav.contains(e.target) && !navToggle.contains(e.target)) setMenu(false);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
window.addEventListener('resize', () => { if (window.innerWidth > 1300) setMenu(false); });

// Header shadow + active link on scroll (home page only)
const header = document.getElementById('header');
const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...nav.querySelectorAll('a[href^="#"]:not(.btn)')];

function onScroll() {
  header.classList.toggle('scrolled', window.scrollY > 10);
  if (!sections.length || !navLinks.length) return;
  const pos = window.scrollY + 120;
  let current = sections[0].id;
  sections.forEach(s => { if (s.offsetTop <= pos) current = s.id; });
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Reveal on scroll
const revealer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealer.observe(el));

// Count-up stats
const counter = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const target = +el.dataset.count;
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / 1500, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    counter.unobserve(el);
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => counter.observe(el));

// Contact form → saved as a lead in the admin panel
const form = document.getElementById('contactForm');
if (form) {
  const note = document.getElementById('formNote');
  const button = form.querySelector('button[type=submit]');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;
    form.querySelectorAll('[required]').forEach(input => {
      const ok = input.value.trim() !== '' && (input.type !== 'email' || /^\S+@\S+\.\S+$/.test(input.value));
      input.classList.toggle('invalid', !ok);
      if (!ok) valid = false;
    });
    if (!valid) {
      note.textContent = 'Please fill in your name, a valid email and phone number.';
      note.className = 'form__note err';
      return;
    }

    button.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    Object.assign(data, window.dtaTrack ? window.dtaTrack.ids() : {}, { path: location.pathname });
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Something went wrong');
      note.textContent = "Thank you! Your request has been received — we'll contact you shortly.";
      note.className = 'form__note ok';
      form.reset();
    } catch (err) {
      note.textContent = err.message + ' Please try again or message us on Instagram.';
      note.className = 'form__note err';
    } finally {
      button.disabled = false;
    }
  });
}

// Any image that fails to load shows the placeholder instead of a broken icon
document.querySelectorAll('img').forEach(img => {
  const fix = () => { img.onerror = null; img.src = '/img/placeholder.svg'; img.classList.add('img-missing'); };
  if (img.complete && !img.naturalWidth) fix();
  else img.addEventListener('error', fix, { once: true });
});

// BMI calculator section
document.querySelectorAll('[data-bmi]').forEach(form => {
  const state = { heightUnit: 'ft', weightUnit: 'kg' };
  const result = form.querySelector('.bmi-result');
  const error = form.querySelector('.bmi-error');
  const val = name => form.querySelector(`[name="${name}"]`).value;

  form.querySelectorAll('[data-height-unit]').forEach(b => b.addEventListener('click', () => {
    state.heightUnit = b.dataset.heightUnit;
    form.querySelectorAll('[data-height-unit]').forEach(x => x.classList.toggle('active', x === b));
    form.querySelectorAll('[data-height]').forEach(g => { g.hidden = g.dataset.height !== state.heightUnit; });
  }));
  form.querySelectorAll('[data-weight-unit]').forEach(b => b.addEventListener('click', () => {
    state.weightUnit = b.dataset.weightUnit;
    form.querySelectorAll('[data-weight-unit]').forEach(x => x.classList.toggle('active', x === b));
    form.querySelector('[data-weight-label]').textContent = state.weightUnit;
    form.querySelector('[name="weight"]').placeholder = state.weightUnit === 'kg' ? '70' : '155';
  }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const r = window.BMI.computeBmi({ ...state, weight: val('weight'), ft: val('ft'), inch: val('inch'), cm: val('cm') });
    if (r.error) { error.textContent = r.error; result.hidden = true; return; }
    error.textContent = '';
    result.hidden = false;
    result.querySelector('.bmi-result__value').textContent = r.bmi.toFixed(1);
    const cat = result.querySelector('.bmi-result__cat');
    cat.textContent = r.category.label;
    cat.style.background = r.category.color;
    result.querySelector('.bmi-gauge__marker').style.left = Math.min(100, Math.max(0, (r.bmi - 15) / 25 * 100)) + '%';
    result.querySelector('.bmi-result__range').textContent =
      `A healthy weight for your height is about ${r.healthyMinKg}–${r.healthyMaxKg} kg.`;
    if (window.dtaTrack) window.dtaTrack.send({ type: 'bmi', label: r.category.label, section: 'bmi' });
  });
});

// Calorie calculator section
document.querySelectorAll('[data-calorie]').forEach(form => {
  const state = { sex: 'female', heightUnit: 'ft', weightUnit: 'kg' };
  const result = form.querySelector('.bmi-result');
  const error = form.querySelector('.bmi-error');
  const val = name => form.querySelector(`[name="${name}"]`).value;
  const set = (sel, text) => { form.querySelector(sel).textContent = text; };
  const kcal = n => n.toLocaleString('en-US');

  form.querySelectorAll('[data-sex]').forEach(b => b.addEventListener('click', () => {
    state.sex = b.dataset.sex;
    form.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('active', x === b));
  }));
  form.querySelectorAll('[data-height-unit]').forEach(b => b.addEventListener('click', () => {
    state.heightUnit = b.dataset.heightUnit;
    form.querySelectorAll('[data-height-unit]').forEach(x => x.classList.toggle('active', x === b));
    form.querySelectorAll('[data-height]').forEach(g => { g.hidden = g.dataset.height !== state.heightUnit; });
  }));
  form.querySelectorAll('[data-weight-unit]').forEach(b => b.addEventListener('click', () => {
    state.weightUnit = b.dataset.weightUnit;
    form.querySelectorAll('[data-weight-unit]').forEach(x => x.classList.toggle('active', x === b));
    form.querySelector('[data-weight-label]').textContent = state.weightUnit;
    form.querySelector('[name="weight"]').placeholder = state.weightUnit === 'kg' ? '70' : '155';
  }));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const r = window.CALORIE.computeCalories({
      ...state, age: val('age'), weight: val('weight'), ft: val('ft'), inch: val('inch'), cm: val('cm'),
      activity: val('activity'), goal: val('goal')
    });
    if (r.error) { error.textContent = r.error; result.hidden = true; return; }
    error.textContent = '';
    result.hidden = false;
    set('[data-cal-target]', kcal(r.target));
    set('[data-cal-goal]', 'kcal / day to ' + { lose: 'lose weight', maintain: 'maintain', gain: 'gain weight' }[r.goal]);
    set('[data-cal-lose]', kcal(r.plan.lose) + ' kcal');
    set('[data-cal-maintain]', kcal(r.plan.maintain) + ' kcal');
    set('[data-cal-gain]', kcal(r.plan.gain) + ' kcal');
    set('[data-cal-bmr]', kcal(r.bmr));
  });
});
