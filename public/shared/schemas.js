// Section + settings schemas. Shared by the server (defaults, validation) and the
// admin panel (auto-generated edit forms). Field types:
//   text, textarea, richtext, image, number, select, checkbox, icon, list (with `fields`)
(function (root) {
  const heading = [
    { key: 'eyebrow', label: 'Small heading', type: 'text' },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'highlight', label: 'Highlighted words (orange)', type: 'text' }
  ];
  const button = (prefix = 'btn', label = 'Button') => [
    { key: prefix + 'Label', label: label + ' text', type: 'text' },
    { key: prefix + 'Url', label: label + ' link', type: 'text', hint: 'e.g. #contact or https://…' }
  ];

  const sectionTypes = {
    hero: {
      label: 'Hero banner',
      description: 'Big intro at the top of the page with photo, buttons and stats.',
      fields: [
        ...heading,
        { key: 'lead', label: 'Intro paragraph', type: 'textarea' },
        { key: 'image', label: 'Photo (first slide)', type: 'image' },
        { key: 'slides', label: 'More background photos (slider)', type: 'list', itemLabel: 'caption', fields: [
          { key: 'image', label: 'Photo', type: 'image' },
          { key: 'focus', label: 'Keep in view', type: 'select', options: ['center', 'top', 'bottom', 'left', 'right'] },
          { key: 'caption', label: 'Name for this slide (only shown in admin)', type: 'text' }
        ] },
        { key: 'focus', label: 'First photo: keep in view', type: 'select', options: ['center', 'top', 'bottom', 'left', 'right'] },
        { key: 'slideSeconds', label: 'Seconds per photo', type: 'number', hint: 'default 6' },
        { key: 'badge', label: 'Photo badge text', type: 'text' },
        ...button('btn', 'Main button'),
        ...button('btn2', 'Second button'),
        { key: 'stats', label: 'Stats', type: 'list', itemLabel: 'label', fields: [
          { key: 'value', label: 'Number', type: 'number' },
          { key: 'suffix', label: 'Suffix (e.g. + or %)', type: 'text' },
          { key: 'label', label: 'Label', type: 'text' }
        ] }
      ]
    },
    strip: {
      label: 'Tagline strip',
      description: 'Coloured full-width band with a short message.',
      fields: [
        { key: 'text', label: 'Text', type: 'text' },
        { key: 'highlight', label: 'Bold part', type: 'text' },
        { key: 'sub', label: 'Small text', type: 'text' }
      ]
    },
    about: {
      label: 'About / Meet the coach',
      description: 'Photo with a biography and checklist.',
      fields: [
        ...heading,
        { key: 'image', label: 'Photo', type: 'image' },
        { key: 'badgeTitle', label: 'Photo badge title', type: 'text' },
        { key: 'badgeText', label: 'Photo badge text', type: 'text' },
        { key: 'body', label: 'Biography', type: 'richtext' },
        { key: 'bullets', label: 'Checklist', type: 'list', itemLabel: 'text', fields: [
          { key: 'text', label: 'Point', type: 'text' }
        ] },
        ...button()
      ]
    },
    cards: {
      label: 'Cards (programs / services)',
      description: 'Grid of cards with icon, text and bullet points.',
      fields: [
        ...heading,
        { key: 'intro', label: 'Intro text', type: 'textarea' },
        { key: 'items', label: 'Cards', type: 'list', itemLabel: 'title', fields: [
          { key: 'icon', label: 'Icon', type: 'icon' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'text', label: 'Description', type: 'textarea' },
          { key: 'bullets', label: 'Bullet points (one per line)', type: 'textarea' },
          { key: 'tag', label: 'Corner tag (e.g. Most Popular)', type: 'text' },
          { key: 'featured', label: 'Highlight this card', type: 'checkbox' },
          { key: 'linkLabel', label: 'Link text', type: 'text' },
          { key: 'linkUrl', label: 'Link URL', type: 'text' }
        ] }
      ]
    },
    steps: {
      label: 'Steps / process',
      description: 'Numbered steps explaining how it works.',
      fields: [
        ...heading,
        { key: 'items', label: 'Steps', type: 'list', itemLabel: 'title', fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'text', label: 'Text', type: 'textarea' }
        ] }
      ]
    },
    gallery: {
      label: 'Before / after transformations',
      description: 'Client before & after photo cards.',
      fields: [
        ...heading,
        { key: 'intro', label: 'Intro text', type: 'textarea' },
        { key: 'items', label: 'Transformations', type: 'list', itemLabel: 'name', fields: [
          { key: 'before', label: 'Before photo', type: 'image' },
          { key: 'after', label: 'After photo', type: 'image' },
          { key: 'name', label: 'Client name', type: 'text' },
          { key: 'result', label: 'Result (e.g. -12 kg in 3 months)', type: 'text' }
        ] },
        ...button()
      ]
    },
    split: {
      label: 'Image + text',
      description: 'Text next to a photo, with optional checklist and feature boxes.',
      fields: [
        ...heading,
        { key: 'body', label: 'Text', type: 'textarea' },
        { key: 'image', label: 'Photo', type: 'image' },
        { key: 'imageSide', label: 'Photo side', type: 'select', options: ['right', 'left'] },
        { key: 'darkBg', label: 'Alternate background', type: 'checkbox' },
        { key: 'bullets', label: 'Checklist', type: 'list', itemLabel: 'text', fields: [
          { key: 'text', label: 'Point', type: 'text' }
        ] },
        { key: 'features', label: 'Feature boxes', type: 'list', itemLabel: 'title', fields: [
          { key: 'icon', label: 'Icon', type: 'icon' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'text', label: 'Text', type: 'text' }
        ] },
        ...button()
      ]
    },
    cta: {
      label: 'Call-to-action banner',
      description: 'Bold coloured banner with one button.',
      fields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'highlight', label: 'Highlighted words', type: 'text' },
        { key: 'text', label: 'Text', type: 'text' },
        ...button()
      ]
    },
    blog: {
      label: 'Latest blog posts',
      description: 'Shows your most recent published blog posts.',
      fields: [
        ...heading,
        { key: 'intro', label: 'Intro text', type: 'textarea' },
        { key: 'count', label: 'Number of posts', type: 'number' }
      ]
    },
    faq: {
      label: 'FAQ',
      description: 'Questions and answers that expand on click.',
      fields: [
        ...heading,
        { key: 'items', label: 'Questions', type: 'list', itemLabel: 'q', fields: [
          { key: 'q', label: 'Question', type: 'text' },
          { key: 'a', label: 'Answer', type: 'textarea' }
        ] }
      ]
    },
    contact: {
      label: 'Contact form',
      description: 'Contact details and the appointment form (submissions go to Leads).',
      fields: [
        ...heading,
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'programs', label: 'Program options (one per line)', type: 'textarea' },
        { key: 'buttonLabel', label: 'Submit button text', type: 'text' }
      ]
    },
    custom: {
      label: 'Custom content',
      description: 'Free-form section: any text, headings, lists and an optional photo.',
      fields: [
        ...heading,
        { key: 'body', label: 'Content', type: 'richtext' },
        { key: 'image', label: 'Photo (optional)', type: 'image' },
        { key: 'darkBg', label: 'Alternate background', type: 'checkbox' },
        ...button()
      ]
    },
    bmi: {
      label: 'BMI calculator',
      description: 'Instant BMI calculator (kg/lbs, ft/cm) with a button to the free assessment.',
      fields: [
        ...heading,
        { key: 'intro', label: 'Intro text', type: 'textarea' },
        { key: 'darkBg', label: 'Alternate background', type: 'checkbox' },
        ...button('btn', 'Button under result')
      ]
    },
    calorie: {
      label: 'Calorie calculator',
      description: 'Daily calorie calculator (age, height, weight, activity, goal) with a button to the free assessment.',
      fields: [
        ...heading,
        { key: 'intro', label: 'Intro text', type: 'textarea' },
        { key: 'darkBg', label: 'Alternate background', type: 'checkbox' },
        ...button('btn', 'Button under result')
      ]
    },
    assessmentCta: {
      label: 'Assessment banner',
      description: 'Banner inviting visitors to take the free assessment.',
      fields: [
        ...heading,
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'points', label: 'Points (one per line)', type: 'textarea' },
        ...button('btn', 'Button')
      ]
    }
  };

  // The free assessment (/assessment). Height & weight and contact steps are built in;
  // these questions are shown around them.
  const assessmentFields = [
    { key: 'introTitle', label: 'Start screen title', type: 'text' },
    { key: 'introText', label: 'Start screen text', type: 'textarea' },
    { key: 'startLabel', label: 'Start button text', type: 'text' },
    { key: 'questions', label: 'Questions', type: 'list', itemLabel: 'question', fields: [
      { key: 'question', label: 'Question', type: 'text' },
      { key: 'help', label: 'Help text (small, under the question)', type: 'text' },
      { key: 'multiple', label: 'Allow picking more than one answer', type: 'checkbox' },
      { key: 'required', label: 'Answer required', type: 'checkbox' },
      { key: 'options', label: 'Answers', type: 'list', itemLabel: 'label', fields: [
        { key: 'label', label: 'Answer', type: 'text' },
        { key: 'icon', label: 'Icon (optional)', type: 'icon' }
      ] }
    ] },
    { key: 'bodyStepAfter', label: 'Show the height & weight step after question number', type: 'number', hint: '0 = first' },
    { key: 'contactTitle', label: 'Contact step title', type: 'text' },
    { key: 'contactText', label: 'Contact step text', type: 'textarea' },
    { key: 'emailRequired', label: 'Email required', type: 'checkbox' },
    { key: 'consentText', label: 'WhatsApp consent text', type: 'text' },
    { key: 'resultTitle', label: 'Result screen title', type: 'text' },
    { key: 'msgUnder', label: 'Result message — underweight (BMI under 18.5)', type: 'textarea' },
    { key: 'msgHealthy', label: 'Result message — healthy (18.5 to 24.9)', type: 'textarea' },
    { key: 'msgOver', label: 'Result message — overweight (25 to 29.9)', type: 'textarea' },
    { key: 'msgObese', label: 'Result message — obese (30 and above)', type: 'textarea' },
    { key: 'resultBtnLabel', label: 'Result main button text', type: 'text' },
    { key: 'resultBtnUrl', label: 'Result main button link', type: 'text', hint: 'empty = your booking link' }
  ];

  const settingsFields = [
    { group: 'Brand', key: 'brandName', label: 'Brand name', type: 'text' },
    { group: 'Brand', key: 'brandSub', label: 'Brand sub-title', type: 'text' },
    { group: 'Brand', key: 'logoLetter', label: 'Logo letter', type: 'text' },
    { group: 'Brand', key: 'logoImage', label: 'Logo image (optional, replaces letter)', type: 'image' },
    { group: 'Theme', key: 'themePaper', label: 'Page background', type: 'color' },
    { group: 'Theme', key: 'themePaper2', label: 'Soft background', type: 'color' },
    { group: 'Theme', key: 'themeBlush', label: 'Blush accent', type: 'color' },
    { group: 'Theme', key: 'themeRose', label: 'Highlight / italic words', type: 'color' },
    { group: 'Theme', key: 'themePlum', label: 'Buttons & dark sections', type: 'color' },
    { group: 'Theme', key: 'themeInk', label: 'Main text', type: 'color' },
    { group: 'Theme', key: 'themeDeep', label: 'Deepest dark (footer)', type: 'color' },
    { group: 'Theme', key: 'themeMuted', label: 'Secondary text', type: 'color' },
    { group: 'Theme', key: 'themeFontDisplay', label: 'Heading font', type: 'text' },
    { group: 'Theme', key: 'themeFontText', label: 'Body font', type: 'text' },
    { group: 'Theme', key: 'themeTextScale', label: 'Text size (%)', type: 'text' },
    { group: 'Brand', key: 'footerText', label: 'Footer text', type: 'textarea' },
    { group: 'Contact', key: 'phone', label: 'Phone / WhatsApp (display)', type: 'text' },
    { group: 'Contact', key: 'whatsapp', label: 'WhatsApp number (digits, with country code)', type: 'text', hint: 'e.g. 923001234567' },
    { group: 'Contact', key: 'email', label: 'Email', type: 'text' },
    { group: 'Contact', key: 'calendly', label: 'Booking link (Calendly)', type: 'text' },
    { group: 'Social', key: 'instagram', label: 'Instagram URL', type: 'text' },
    { group: 'Social', key: 'facebook', label: 'Facebook URL', type: 'text' },
    { group: 'Social', key: 'tiktok', label: 'TikTok URL', type: 'text' },
    { group: 'Social', key: 'youtube', label: 'YouTube URL', type: 'text' },
    { group: 'Header', key: 'navCtaLabel', label: 'Header button text', type: 'text' },
    { group: 'Header', key: 'navCtaUrl', label: 'Header button link', type: 'text' },
    { group: 'Header', key: 'assessmentLabel', label: 'Header assessment button text', type: 'text', hint: 'empty = hide' },
    { group: 'SEO', key: 'seoTitle', label: 'Browser / Google title', type: 'text' },
    { group: 'SEO', key: 'seoDescription', label: 'Google description', type: 'textarea' }
  ];

  const S = { sectionTypes, settingsFields, assessmentFields };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  else root.SCHEMAS = S;
})(this);
