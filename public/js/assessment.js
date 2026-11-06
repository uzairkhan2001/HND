// Free assessment: intro → questions (+ height/weight step) → contact → result
(function () {
  const cfg = JSON.parse(document.getElementById('assessConfig').textContent);
  const card = document.getElementById('assess');
  const prevBtn = document.getElementById('assessPrev');
  const nextBtn = document.getElementById('assessNext');
  const nextLabel = nextBtn.querySelector('span');
  const errorEl = document.getElementById('assessError');
  const progress = document.getElementById('assessProgress');
  const bar = document.getElementById('assessBar');
  const count = document.getElementById('assessCount');
  const track = data => window.dtaTrack && window.dtaTrack.send({ type: 'assess', ...data });

  // Safe element builder (text only, never HTML)
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    children.flat().forEach(c => c != null && c !== false && el.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return el;
  }

  // ---------- state ----------
  const answers = cfg.questions.map(() => []);
  const body = { weightUnit: 'kg', heightUnit: 'ft', weight: '', ft: '', inch: '', cm: '' };
  const contact = { first: '', phone: '', email: '', consent: true };

  // ---------- steps ----------
  const steps = [];
  cfg.questions.forEach((q, i) => {
    if (i === Math.max(0, cfg.bodyStepAfter)) steps.push({ kind: 'body' });
    steps.push({ kind: 'question', index: i });
  });
  if (!steps.some(s => s.kind === 'body')) steps.push({ kind: 'body' });
  steps.push({ kind: 'contact' });

  const stepName = s => s.kind === 'question' ? cfg.questions[s.index].question.slice(0, 60)
    : s.kind === 'body' ? 'Height & weight' : 'Contact details';

  function questionStep(q, i) {
    const multi = !!q.multiple;
    const hasIcons = !cfg.plainIcons && q.options.some(o => o.icon);
    const n = q.options.length;
    const cols = hasIcons ? (n <= 4 ? n : n <= 6 ? 3 : 4) : 2;
    const grid = h('div', { class: 'assess-options' + (hasIcons ? ' has-icons' : ''), style: `--cols:${cols}` });
    q.options.forEach(o => {
      const selected = () => answers[i].includes(o.label);
      const opt = h('button', {
        type: 'button', class: 'assess-option', role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false',
        onclick: () => {
          if (multi) {
            // "None of these" clears the others and vice versa
            const isNone = /^none/i.test(o.label);
            if (selected()) answers[i] = answers[i].filter(v => v !== o.label);
            else answers[i] = isNone ? [o.label] : answers[i].filter(v => !/^none/i.test(v)).concat(o.label);
          } else {
            answers[i] = [o.label];
          }
          grid.querySelectorAll('.assess-option').forEach(b => {
            const on = answers[i].includes(b.dataset.label);
            b.classList.toggle('is-selected', on);
            b.setAttribute('aria-checked', on);
          });
          errorEl.textContent = '';
          if (!multi) setTimeout(() => current === steps.findIndex(s => s.kind === 'question' && s.index === i) && go(1), 280);
        }
      },
      h('span', { class: 'assess-option__mark' + (multi ? ' is-box' : '') }),
      hasIcons && o.icon ? h('span', { class: 'assess-option__icon' }, h('i', { class: o.icon })) : null,
      h('span', { class: 'assess-option__label' }, o.label));
      opt.dataset.label = o.label;
      grid.append(opt);
    });
    return [
      h('h2', {}, q.question, q.required ? h('span', { class: 'req' }, ' *') : null),
      h('p', { class: 'assess-sub' }, q.help || (multi ? 'Select all that apply, then press Next.' : 'Choose one.')),
      grid
    ];
  }

  function toggle(name, options, key) {
    const wrap = h('div', { class: 'unit-toggle', role: 'group', 'aria-label': name });
    options.forEach(([value, label]) => wrap.append(h('button', {
      type: 'button', class: body[key] === value ? 'active' : '',
      onclick: () => { body[key] = value; render(); }
    }, label)));
    return wrap;
  }
  const field = (key, placeholder, unit, attrs = {}) => h('label', { class: 'assess-input' },
    h('input', { type: 'number', inputmode: 'decimal', placeholder, value: body[key], ...attrs, oninput: e => { body[key] = e.target.value; errorEl.textContent = ''; } }),
    h('span', {}, unit));

  function bodyStep() {
    return [
      h('h2', {}, 'What is your height and weight?', h('span', { class: 'req' }, ' *')),
      h('p', { class: 'assess-sub' }, 'Used to calculate your BMI. Choose the units you know.'),
      h('div', { class: 'bmi-row' }, h('span', { class: 'bmi-label' }, 'Height'), toggle('Height unit', [['ft', 'ft / in'], ['cm', 'cm']], 'heightUnit')),
      body.heightUnit === 'ft'
        ? h('div', { class: 'assess-inputs' }, field('ft', '5', 'ft', { min: 3, max: 8, 'aria-label': 'Feet' }), field('inch', '4', 'in', { min: 0, max: 11, 'aria-label': 'Inches' }))
        : h('div', { class: 'assess-inputs' }, field('cm', '163', 'cm', { min: 100, max: 250, 'aria-label': 'Centimetres' })),
      h('div', { class: 'bmi-row' }, h('span', { class: 'bmi-label' }, 'Weight'), toggle('Weight unit', [['kg', 'kg'], ['lbs', 'lbs']], 'weightUnit')),
      h('div', { class: 'assess-inputs' }, field('weight', body.weightUnit === 'kg' ? '70' : '155', body.weightUnit, { min: 25, max: 660, 'aria-label': 'Weight' }))
    ];
  }

  function contactStep() {
    const input = (key, label, type, required, autocomplete) => h('label', { class: 'assess-field' },
      h('span', {}, label, required ? h('span', { class: 'req' }, ' *') : h('span', { class: 'opt' }, ' (optional)')),
      h('input', { type, value: contact[key], autocomplete, oninput: e => { contact[key] = e.target.value; errorEl.textContent = ''; } }));
    return [
      h('h2', {}, cfg.contactTitle || 'Where should we send your results?'),
      cfg.contactText ? h('p', { class: 'assess-sub' }, cfg.contactText) : null,
      h('div', { class: 'assess-fields' },
        input('first', 'Your name', 'text', true, 'given-name'),
        input('phone', 'Phone / WhatsApp', 'tel', true, 'tel'),
        input('email', 'Email', 'email', cfg.emailRequired, 'email')),
      cfg.consentText ? h('label', { class: 'assess-consent' },
        h('input', { type: 'checkbox', checked: contact.consent, onchange: e => { contact.consent = e.target.checked; } }),
        h('span', {}, cfg.consentText)) : null,
      h('label', { class: 'hp', 'aria-hidden': 'true' }, 'Website', h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', id: 'assessHp' }))
    ];
  }

  // ---------- validation ----------
  function validate(step) {
    if (step.kind === 'question') {
      const q = cfg.questions[step.index];
      if (q.required && !answers[step.index].length) return 'Please choose an answer to continue.';
    } else if (step.kind === 'body') {
      const r = window.BMI.computeBmi(body);
      if (r.error) return r.error;
    } else if (step.kind === 'contact') {
      if (!contact.first.trim()) return 'Please enter your name.';
      if (contact.phone.replace(/\D/g, '').length < 7) return 'Please enter a valid phone / WhatsApp number.';
      if ((cfg.emailRequired || contact.email.trim()) && !/^\S+@\S+\.\S+$/.test(contact.email.trim())) return 'Please enter a valid email address.';
    }
    return '';
  }

  // ---------- rendering ----------
  let current = -1; // -1 = intro
  const intro = card.querySelector('[data-step="intro"]');

  function render() {
    const step = steps[current];
    intro.classList.toggle('is-active', current === -1);
    card.querySelectorAll('.assess-step:not([data-step="intro"])').forEach(n => n.remove());
    if (step) {
      const content = step.kind === 'question' ? questionStep(cfg.questions[step.index], step.index)
        : step.kind === 'body' ? bodyStep() : contactStep();
      const section = h('section', { class: 'assess-step is-active', 'data-step': step.kind }, content);
      card.append(section);
      // restore selection state for question steps
      if (step.kind === 'question') section.querySelectorAll('.assess-option').forEach(b => {
        const on = answers[step.index].includes(b.dataset.label);
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on);
      });
    }
    prevBtn.hidden = current < 0;
    nextLabel.textContent = current === -1 ? (nextLabel.dataset.start || nextLabel.textContent)
      : step.kind === 'contact' ? 'See My Results' : 'Next';
    progress.hidden = current < 0;
    if (current >= 0) {
      bar.style.width = ((current + 1) / steps.length * 100) + '%';
      count.textContent = `${current + 1} of ${steps.length}`;
    }
  }
  nextLabel.dataset.start = nextLabel.textContent;

  function focusStep() {
    const first = card.querySelector('.assess-step.is-active input, .assess-step.is-active .assess-option');
    if (first && window.innerWidth > 700) first.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function go(dir) {
    errorEl.textContent = '';
    if (dir > 0 && current >= 0) {
      const err = validate(steps[current]);
      if (err) { errorEl.textContent = err; return; }
    }
    if (dir > 0 && current === steps.length - 1) return submit();
    if (current === -1 && dir > 0) track({ label: 'start', section: 'Start' });
    current = Math.max(-1, Math.min(steps.length - 1, current + dir));
    if (dir > 0 && current >= 0) track({ label: 'step-' + (current + 1), section: stepName(steps[current]) });
    render();
    focusStep();
  }

  nextBtn.addEventListener('click', () => go(1));
  prevBtn.addEventListener('click', () => go(-1));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); go(1); }
  });

  // ---------- submit + result ----------
  async function submit() {
    nextBtn.disabled = true;
    nextLabel.textContent = 'Calculating…';
    try {
      const res = await fetch('/api/assessment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers, body, contact, website: (document.getElementById('assessHp') || {}).value || '',
          path: location.pathname, ...(window.dtaTrack ? window.dtaTrack.ids() : {})
        })
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
      track({ label: 'done', section: 'Completed' });
      showResult(out);
    } catch (err) {
      errorEl.textContent = err.message;
      nextBtn.disabled = false;
      nextLabel.textContent = 'See My Results';
    }
  }

  function showResult(r) {
    card.querySelectorAll('.assess-step').forEach(n => n.classList.remove('is-active'));
    card.querySelectorAll('.assess-step:not([data-step="intro"])').forEach(n => n.remove());
    document.getElementById('assessNav').hidden = true;
    progress.hidden = true;
    // Marker position on a 15–40 scale
    const pos = Math.min(100, Math.max(0, (r.bmi - 15) / 25 * 100));
    const name = contact.first.trim().split(' ')[0];
    card.append(h('section', { class: 'assess-step assess-result is-active', 'data-step': 'result' },
      h('p', { class: 'eyebrow' }, cfg.resultTitle || 'Your Results'),
      h('h2', {}, name ? `Thank you, ${name}!` : 'Thank you!'),
      h('div', { class: 'assess-result__bmi' },
        h('div', {}, h('span', { class: 'bmi-result__label' }, 'Your BMI'), h('strong', { class: 'bmi-result__value' }, r.bmi.toFixed(1))),
        h('span', { class: 'bmi-result__cat', style: `background:${r.category.color}` }, r.category.label)),
      h('div', { class: 'bmi-gauge' }, h('span', { class: 'bmi-gauge__marker', style: `left:${pos}%` })),
      h('div', { class: 'bmi-gauge__ticks' }, ['15', '18.5', '25', '30', '40'].map(t => h('span', {}, t))),
      h('p', { class: 'bmi-result__range' }, `A healthy weight for your height (${r.heightCm} cm) is about ${r.healthyMinKg}–${r.healthyMaxKg} kg.`),
      r.message ? h('p', { class: 'assess-result__msg' }, r.message) : null,
      h('div', { class: 'assess-result__actions' },
        h('a', { class: cfg.plainIcons ? 'e-btn' : 'btn', href: cfg.bookUrl, target: /^https?:/.test(cfg.bookUrl) ? '_blank' : null, rel: 'noopener', 'data-track': 'Assessment result: ' + cfg.resultBtnLabel },
          cfg.plainIcons ? null : h('i', { class: 'fa-regular fa-calendar-check' }), cfg.plainIcons ? '' : ' ', cfg.resultBtnLabel, cfg.plainIcons ? ' →' : ''),
        cfg.whatsapp ? h('a', { class: cfg.plainIcons ? 'e-link' : 'btn btn--ghost', href: cfg.whatsapp, target: '_blank', rel: 'noopener', 'data-track': 'Assessment result: WhatsApp' },
          cfg.plainIcons ? null : h('i', { class: 'fa-brands fa-whatsapp' }), cfg.plainIcons ? 'Chat on WhatsApp' : ' Chat on WhatsApp')
          : cfg.instagram ? h('a', { class: cfg.plainIcons ? 'e-link' : 'btn btn--ghost', href: cfg.instagram, target: '_blank', rel: 'noopener', 'data-track': 'Assessment result: Instagram' },
            cfg.plainIcons ? null : h('i', { class: 'fa-brands fa-instagram' }), cfg.plainIcons ? 'Message on Instagram' : ' Message on Instagram') : null),
      h('p', { class: 'assess-result__note' }, 'BMI is a general guide and does not measure body fat directly. Dt Amna will review your answers personally.'),
      h('a', { class: 'assess-result__home', href: cfg.home || '/' }, 'Back to website')));
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  render();
})();
