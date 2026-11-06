// Initial content loaded into the database on first run. Everything here is
// editable from the admin panel afterwards.

const settings = {
  brandName: 'Dt Amna',
  brandSub: 'Transformation',
  logoLetter: 'A',
  logoImage: '',
  primaryColor: '#4a1d3f',
  themePaper: '#f6ece8', themePaper2: '#efdcd6', themeBlush: '#e8c3be', themeRose: '#b9737a',
  themePlum: '#4a1d3f', themeInk: '#2b1026', themeDeep: '#1f0a1b', themeMuted: '#705a68',
  themeFontDisplay: 'Cormorant Garamond', themeFontText: 'Jost', themeTextScale: '100',
  footerText: 'Helping women gain confidence & lose fat — one personalised plan at a time.',
  phone: '+92 300 0000000',
  whatsapp: '',
  email: 'hello@dtamnatransformation.com',
  calendly: 'https://calendly.com/fitnessbyank',
  instagram: 'https://www.instagram.com/fitnessby_ank/',
  facebook: '',
  tiktok: '',
  youtube: '',
  navCtaLabel: 'Book Now',
  navCtaUrl: '#contact',
  seoTitle: "Dt Amna Transformation | Women's Fat Loss Coach & Dietitian",
  seoDescription: 'Dt Amna Transformation — personalised diet plans and online fat-loss coaching for women by a certified senior dietitian. Lose fat, gain confidence.'
};

const sections = [
  { type: 'hero', anchor: 'home', navLabel: 'Home', data: {
    eyebrow: "Women's Fat Loss Coach • Senior Dietitian",
    title: 'Lose Fat.', highlight: 'Gain Confidence.',
    lead: 'Dt Amna Transformation is dedicated to helping women build a healthier, stronger and more confident version of themselves — with practical diet plans that fit real life, real food and real families.',
    image: '', badge: 'Certified Dietitian',
    btnLabel: 'Book a Consultation', btnUrl: 'https://calendly.com/fitnessbyank',
    btn2Label: 'View Programs', btn2Url: '#programs',
    stats: [
      { value: 500, suffix: '+', label: 'Women Coached' },
      { value: 5, suffix: '+', label: 'Years Experience' },
      { value: 100, suffix: '%', label: 'Online & Personal' }
    ]
  } },
  { type: 'strip', anchor: 'tagline', navLabel: '', data: {
    text: 'Strength begins with a single step —', highlight: 'take your first step now.',
    sub: 'DM “ANK” on Instagram to start your journey.'
  } },
  { type: 'about', anchor: 'about', navLabel: 'About', data: {
    eyebrow: 'Meet Your Coach', title: "Hi, I'm", highlight: 'Dt Amna Narmeen',
    image: '', badgeTitle: 'Hospital', badgeText: 'Clinical experience',
    body: "<p>Welcome to <strong>Dt Amna Transformation</strong> — where we provide customised solutions not only for your body, but for your overall well-being. As a senior dietitian with hands-on hospital experience, I combine clinical nutrition science with a practical, judgement-free approach.</p><p>I understand one size doesn't fit all. Every woman's body, schedule, hormones and food culture are different — so every plan I create is built around <em>you</em>, using the desi meals you already love.</p>",
    bullets: [
      { text: 'Certified, clinically trained dietitian' },
      { text: "Specialised in women's fat loss & hormonal health" },
      { text: 'Flexible meal plans — no starving, no crash diets' },
      { text: 'Weekly check-ins & one-to-one WhatsApp support' }
    ],
    btnLabel: 'Start Your Journey', btnUrl: '#contact'
  } },
  { type: 'cards', anchor: 'programs', navLabel: 'Programs', data: {
    eyebrow: 'What I Offer', title: 'Programs Designed for', highlight: 'Women',
    intro: 'Choose the plan that fits your goal. Every program is 100% online and fully personalised.',
    items: [
      { icon: 'fa-solid fa-weight-scale', title: 'Fat Loss Program', text: 'Sustainable fat loss with calorie-smart desi meal plans, portion guidance and weekly progress tracking.', bullets: 'Custom diet chart\nWeekly check-ins\nWhatsApp support', tag: '', featured: false, linkLabel: 'Enroll now', linkUrl: '#contact' },
      { icon: 'fa-solid fa-venus', title: 'PCOS & Hormone Balance', text: 'Nutrition protocols for PCOS, insulin resistance and thyroid — manage symptoms and lose stubborn weight.', bullets: 'Hormone-friendly meals\nLifestyle & sleep guidance\nSymptom tracking', tag: 'Most Popular', featured: true, linkLabel: 'Enroll now', linkUrl: '#contact' },
      { icon: 'fa-solid fa-baby', title: 'Post-Pregnancy Weight Loss', text: 'Safe, gentle plans for new mums — including breastfeeding-friendly nutrition to regain energy and shape.', bullets: 'Lactation-safe plans\nEnergy & recovery focus\nBusy-mum friendly', tag: '', featured: false, linkLabel: 'Enroll now', linkUrl: '#contact' },
      { icon: 'fa-solid fa-heart-pulse', title: 'Diabetes & Medical Diets', text: 'Clinical nutrition for diabetes, cholesterol, BP and fatty liver — built on hospital experience.', bullets: 'Sugar-control meal plans\nLab-report review\nMedication-aware diet', tag: '', featured: false, linkLabel: 'Enroll now', linkUrl: '#contact' },
      { icon: 'fa-solid fa-dumbbell', title: 'Weight Gain & Toning', text: 'Healthy weight gain and body recomposition with high-protein meals and simple home workouts.', bullets: 'Protein-rich diet\nHome workout guide\nBody measurements', tag: '', featured: false, linkLabel: 'Enroll now', linkUrl: '#contact' },
      { icon: 'fa-solid fa-bowl-food', title: 'Healthy Lifestyle Coaching', text: 'Build lifelong habits — mindful eating, healthy drinks, late-night snack options and family-friendly recipes.', bullets: 'Habit coaching\nRecipe library\nGrocery guide', tag: '', featured: false, linkLabel: 'Enroll now', linkUrl: '#contact' }
    ]
  } },
  { type: 'steps', anchor: 'how-it-works', navLabel: '', data: {
    eyebrow: 'How It Works', title: 'Your Transformation in', highlight: '4 Simple Steps',
    items: [
      { title: 'Book a Call', text: 'Schedule a consultation or DM “ANK” on Instagram.' },
      { title: 'Assessment', text: 'We review your history, routine, food preferences and goals.' },
      { title: 'Your Plan', text: 'Receive a fully personalised diet chart within 24–48 hours.' },
      { title: 'Track & Transform', text: 'Weekly check-ins and adjustments until you hit your goal.' }
    ]
  } },
  { type: 'gallery', anchor: 'transformations', navLabel: 'Transformations', data: {
    eyebrow: 'Clients Win', title: 'Real Women,', highlight: 'Real Transformations',
    intro: 'Every journey is different — here are a few of the women who trusted the process.',
    items: [
      { before: '', after: '', name: 'Client 1', result: 'Result details' },
      { before: '', after: '', name: 'Client 2', result: 'Result details' },
      { before: '', after: '', name: 'Client 3', result: 'Result details' }
    ],
    btnLabel: 'See more on Instagram', btnUrl: 'https://www.instagram.com/fitnessby_ank/'
  } },
  { type: 'split', anchor: 'fatloss', navLabel: 'Fat Loss', data: {
    eyebrow: 'Fat Loss', title: 'Fat Loss Without', highlight: 'Starving Yourself',
    body: "Crash diets fail because they're impossible to sustain. My approach uses calorie awareness, high-protein desi meals and smart swaps so you lose fat while still enjoying roti, chawal and family dinners.",
    image: '', imageSide: 'right', darkBg: false, bullets: [],
    features: [
      { icon: 'fa-solid fa-fire', title: 'Calorie Smart', text: 'Learn what you eat — no guesswork.' },
      { icon: 'fa-solid fa-utensils', title: 'Desi Friendly', text: 'Plans built on home-cooked food.' },
      { icon: 'fa-solid fa-moon', title: 'Late-Night Options', text: 'Healthy 2 AM cravings fixes.' },
      { icon: 'fa-solid fa-glass-water', title: 'Healthy Drinks', text: 'Detox & metabolism-friendly recipes.' }
    ],
    btnLabel: '', btnUrl: ''
  } },
  { type: 'split', anchor: 'pcos', navLabel: 'PCOS & Hormones', data: {
    eyebrow: 'PCOS & Hormones', title: 'Take Control of', highlight: 'Your Hormones',
    body: "PCOS, insulin resistance and thyroid issues make weight loss feel impossible. With the right nutrition, it isn't. I build evidence-based plans that help regulate cycles, reduce cravings and support steady fat loss.",
    image: '', imageSide: 'left', darkBg: true,
    bullets: [
      { text: 'Low-GI, anti-inflammatory meal plans' },
      { text: 'Support for irregular periods & acne' },
      { text: 'Insulin-resistance focused nutrition' },
      { text: 'Stress, sleep & lifestyle coaching' }
    ],
    features: [],
    btnLabel: 'Get My PCOS Plan', btnUrl: '#contact'
  } },
  { type: 'cta', anchor: 'apply', navLabel: '', data: {
    title: 'Invest in your health —', highlight: "it's the greatest wealth.",
    text: 'Be a healthier, happier and more confident version of yourself.',
    btnLabel: 'Apply for a Session', btnUrl: 'https://calendly.com/fitnessbyank'
  } },
  { type: 'blog', anchor: 'blog', navLabel: 'Blog', data: {
    eyebrow: 'Blog', title: 'Tips, Recipes &', highlight: 'Inspiration',
    intro: 'Read insightful articles, tips and stories to inspire and guide your wellness journey.',
    count: 3
  } },
  { type: 'faq', anchor: 'faq', navLabel: 'FAQ', data: {
    eyebrow: 'FAQ', title: 'Frequently Asked', highlight: 'Questions',
    items: [
      { q: 'Is the coaching fully online?', a: 'Yes. Consultations, diet plans and weekly check-ins all happen online, so you can join from anywhere in Pakistan or abroad.' },
      { q: 'Will I have to stop eating roti or rice?', a: 'No. Your plan is built around foods you already eat. We adjust portions and combinations instead of banning foods.' },
      { q: 'Do you work with PCOS, thyroid or diabetes?', a: 'Yes — as a clinically trained dietitian, I create medical-condition-aware plans and can review your lab reports.' },
      { q: 'How soon will I see results?', a: 'Most clients notice changes in energy and bloating within the first 2 weeks, with steady, healthy fat loss after that. Results vary by individual.' },
      { q: 'Do I need to go to a gym?', a: 'Not at all. Nutrition drives most fat loss; I can also share simple home-workout and daily-steps guidance.' },
      { q: 'How do I get started?', a: 'Book a consultation, fill in the contact form, or DM “ANK” on Instagram.' }
    ]
  } },
  { type: 'contact', anchor: 'contact', navLabel: '', data: {
    eyebrow: 'Get In Touch', title: 'Ready to Start Your', highlight: 'Transformation?',
    text: "If you're still confused or have questions, fill out the form and I'll get in touch to answer your queries.",
    programs: 'Fat Loss Program\nPCOS & Hormone Balance\nPost-Pregnancy Weight Loss\nDiabetes & Medical Diets\nWeight Gain & Toning\nHealthy Lifestyle Coaching',
    buttonLabel: 'Book Appointment'
  } }
];

const posts = [
  {
    title: '5 Desi Breakfasts That Support Fat Loss',
    slug: '5-desi-breakfasts-for-fat-loss',
    excerpt: 'You don’t need oats every day. Here are five familiar breakfasts, made smarter, that keep you full until lunch.',
    tags: 'fat loss, recipes',
    content: '<p>Breakfast sets the tone for your whole day. These five ideas use ingredients already in a Pakistani kitchen.</p><h2>1. Egg &amp; vegetable omelette with one roti</h2><p>Protein from eggs keeps you full; vegetables add volume for very few calories.</p><h2>2. Besan chilla</h2><p>Gram flour is high in protein and fibre. Add onions, tomatoes and green chillies.</p><h2>3. Greek-style dahi with fruit</h2><p>Hung curd with a handful of berries or half a banana and a few nuts.</p><h2>4. Chana chaat</h2><p>Boiled chickpeas with lemon, onions and chaat masala — great for busy mornings.</p><h2>5. Daliya (broken wheat) porridge</h2><p>Cook in milk or water, add cinnamon and a few almonds.</p><p><em>This is an example post — edit or delete it from the admin panel.</em></p>'
  }
];

// Sections added in later versions — inserted into existing sites once (see migrations in db.js)
const bmiSection = { type: 'bmi', anchor: 'bmi', navLabel: 'BMI', data: {
  eyebrow: 'Free Tool', title: 'Check Your', highlight: 'BMI',
  intro: 'Body Mass Index (BMI) is a quick way to see if your weight is in a healthy range for your height. Enter your details for an instant result.',
  darkBg: true, btnLabel: 'Take the Free Assessment', btnUrl: '/assessment'
} };
const calorieSection = { type: 'calorie', anchor: 'calories', navLabel: 'Calories', data: {
  eyebrow: 'Free Tool', title: 'Find Your Daily', highlight: 'Calories',
  intro: 'Not sure how much to eat? Enter your details to estimate the calories your body needs each day, and a target for your goal.',
  darkBg: false, btnLabel: 'Get a Personal Meal Plan', btnUrl: '/assessment'
} };
const assessmentCtaSection = { type: 'assessmentCta', anchor: 'assessment', navLabel: '', data: {
  eyebrow: 'Free 60-Second Assessment', title: 'Is Your Body Ready for a', highlight: 'Transformation?',
  text: 'Answer 5 quick questions and get your BMI plus a personalised recommendation from Dt Amna.',
  points: 'Takes about 1 minute\nInstant BMI result\nPersonal plan recommendation',
  btnLabel: 'Start Free Assessment', btnUrl: '/assessment'
} };

const assessment = {
  introTitle: 'Is Your Body Ready for a Transformation?',
  introText: 'Take our free 60-second assessment and get your BMI plus a personalised recommendation.',
  startLabel: 'Start',
  questions: [
    { question: 'What is your main goal?', help: '', multiple: false, required: true, options: [
      { label: 'Lose fat', icon: 'fa-solid fa-weight-scale' },
      { label: 'Manage PCOS / hormones', icon: 'fa-solid fa-venus' },
      { label: 'Lose post-pregnancy weight', icon: 'fa-solid fa-baby' },
      { label: 'Control diabetes / blood pressure', icon: 'fa-solid fa-heart-pulse' },
      { label: 'Gain healthy weight', icon: 'fa-solid fa-dumbbell' }
    ] },
    { question: 'Do you have any of these health conditions?', help: 'Select all that apply.', multiple: true, required: false, options: [
      { label: 'PCOS', icon: '' }, { label: 'Thyroid', icon: '' },
      { label: 'Diabetes / pre-diabetes', icon: '' }, { label: 'High blood pressure', icon: '' },
      { label: 'Acid reflux / bloating', icon: '' }, { label: 'None of these', icon: '' }
    ] },
    { question: 'What is your biggest challenge right now?', help: '', multiple: false, required: true, options: [
      { label: 'Cravings & emotional eating', icon: 'fa-solid fa-cookie-bite' },
      { label: 'No time to cook or plan', icon: 'fa-solid fa-clock' },
      { label: "I don't know what to eat", icon: 'fa-solid fa-circle-question' },
      { label: 'I lose motivation', icon: 'fa-solid fa-battery-quarter' }
    ] },
    { question: 'How ready are you to start?', help: '', multiple: false, required: true, options: [
      { label: 'Just exploring', icon: 'fa-solid fa-magnifying-glass' },
      { label: 'Within a month', icon: 'fa-regular fa-calendar' },
      { label: 'Ready to start now', icon: 'fa-solid fa-rocket' }
    ] }
  ],
  bodyStepAfter: 1,
  contactTitle: 'Where should we send your results?',
  contactText: 'Enter your details to see your BMI and personalised recommendation. We keep your information private. This assessment is not a substitute for medical advice.',
  emailRequired: false,
  consentText: 'Yes, Dt Amna can message me on WhatsApp',
  resultTitle: 'Your Results',
  msgUnder: 'Your BMI is below the healthy range. A balanced, high-protein plan can help you gain healthy weight and energy — without junk food.',
  msgHealthy: "Great news — your BMI is in the healthy range! A personalised plan can help you tone up, fix your energy and keep the results for life.",
  msgOver: 'Your BMI is slightly above the healthy range. With the right desi meal plan — no starving — most women see steady results within weeks.',
  msgObese: 'Your BMI is in a range where losing weight can make a big difference to your health, hormones and confidence. A clinical, personalised plan is the safest way to start.',
  resultBtnLabel: 'Book My Consultation',
  resultBtnUrl: ''
};

settings.assessmentLabel = 'Free Assessment';

module.exports = { settings, sections, posts, assessment, bmiSection, calorieSection, assessmentCtaSection };
