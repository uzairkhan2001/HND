// Site theme: defaults, font choices and the CSS the public site is rendered with.
// Shared by the server (injects the CSS into every page) and the admin Theme editor (live preview).
(function (root) {
  const DEFAULTS = {
    themePaper: '#f6ece8',
    themePaper2: '#efdcd6',
    themeBlush: '#e8c3be',
    themeRose: '#b9737a',
    themePlum: '#4a1d3f',
    themeInk: '#2b1026',
    themeDeep: '#1f0a1b',
    themeMuted: '#705a68',
    themeFontDisplay: 'Cormorant Garamond',
    themeFontText: 'Jost',
    themeTextScale: '100'
  };

  // `q` is the Google Fonts family query (only weights the family really has)
  const DISPLAY_FONTS = [
    { name: 'Cormorant Garamond', css: "'Cormorant Garamond', 'Cormorant', Garamond, 'Times New Roman', serif", q: 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600' },
    { name: 'Playfair Display', css: "'Playfair Display', Georgia, serif", q: 'Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500' },
    { name: 'Fraunces', css: "'Fraunces', Georgia, serif", q: 'Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500' },
    { name: 'Lora', css: "'Lora', Georgia, serif", q: 'Lora:ital,wght@0,400;0,500;0,600;1,400;1,500' },
    { name: 'Bodoni Moda', css: "'Bodoni Moda', Georgia, serif", q: 'Bodoni+Moda:ital,wght@0,400;0,500;0,600;1,400;1,500' },
    { name: 'DM Serif Display', css: "'DM Serif Display', Georgia, serif", q: 'DM+Serif+Display:ital@0;1' },
    { name: 'Libre Baskerville', css: "'Libre Baskerville', Georgia, serif", q: 'Libre+Baskerville:ital,wght@0,400;0,700;1,400' },
    { name: 'Marcellus', css: "'Marcellus', Georgia, serif", q: 'Marcellus' }
  ];
  const TEXT_FONTS = [
    { name: 'Jost', css: "'Jost', 'Futura', 'Avenir Next', system-ui, sans-serif", q: 'Jost:wght@300;400;500;600' },
    { name: 'Inter', css: "'Inter', system-ui, sans-serif", q: 'Inter:wght@300;400;500;600' },
    { name: 'Poppins', css: "'Poppins', system-ui, sans-serif", q: 'Poppins:wght@300;400;500;600' },
    { name: 'DM Sans', css: "'DM Sans', system-ui, sans-serif", q: 'DM+Sans:wght@300;400;500;600' },
    { name: 'Montserrat', css: "'Montserrat', system-ui, sans-serif", q: 'Montserrat:wght@300;400;500;600' },
    { name: 'Manrope', css: "'Manrope', system-ui, sans-serif", q: 'Manrope:wght@300;400;500;600' },
    { name: 'Work Sans', css: "'Work Sans', system-ui, sans-serif", q: 'Work+Sans:wght@300;400;500;600' },
    { name: 'Nunito Sans', css: "'Nunito Sans', system-ui, sans-serif", q: 'Nunito+Sans:wght@300;400;600' },
    { name: 'Lato', css: "'Lato', system-ui, sans-serif", q: 'Lato:wght@300;400;700' },
    { name: 'Open Sans', css: "'Open Sans', system-ui, sans-serif", q: 'Open+Sans:wght@300;400;500;600' }
  ];

  const HEX = /^#[0-9a-f]{6}$/i;
  const COLOR_KEYS = ['themePaper', 'themePaper2', 'themeBlush', 'themeRose', 'themePlum', 'themeInk', 'themeDeep', 'themeMuted'];

  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ');
  const pick = (list, name, fallback) => list.find(f => f.name === name) || list.find(f => f.name === fallback);

  // Cleans whatever was stored: bad colours/fonts fall back to the defaults
  function resolve(s = {}) {
    const t = {};
    for (const k of COLOR_KEYS) t[k] = HEX.test(s[k] || '') ? s[k].toLowerCase() : DEFAULTS[k];
    t.display = pick(DISPLAY_FONTS, s.themeFontDisplay, DEFAULTS.themeFontDisplay);
    t.text = pick(TEXT_FONTS, s.themeFontText, DEFAULTS.themeFontText);
    const scale = Number(s.themeTextScale);
    t.scale = Number.isFinite(scale) ? Math.min(125, Math.max(85, Math.round(scale))) : 100;
    return t;
  }

  function themeCss(s) {
    const t = resolve(s);
    return ':root{' +
      `--paper:${t.themePaper};--paper-2:${t.themePaper2};--blush:${t.themeBlush};--rose:${t.themeRose};` +
      `--plum:${t.themePlum};--ink:${t.themeInk};--deep:${t.themeDeep};--muted:${t.themeMuted};` +
      `--line:rgba(${rgb(t.themeInk)},.17);--line-strong:rgba(${rgb(t.themeInk)},.55);--line-light:rgba(${rgb(t.themePaper)},.22);` +
      `--display:${t.display.css};--text:${t.text.css};}` +
      (t.scale !== 100 ? `html{font-size:${t.scale}%;}` : '');
  }

  const fontsHref = s => {
    const t = resolve(s);
    const q = [...new Set([t.display.q, t.text.q])];
    return 'https://fonts.googleapis.com/css2?' + q.map(f => 'family=' + f).join('&') + '&display=swap';
  };

  const api = { DEFAULTS, DISPLAY_FONTS, TEXT_FONTS, COLOR_KEYS, resolve, themeCss, fontsHref };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.THEME = api;
})(this);
