// BMI maths shared by the website (calculator + assessment) and the server.
(function (root) {
  const CATEGORIES = [
    { key: 'under', max: 18.5, label: 'Underweight', color: '#3b82f6' },
    { key: 'healthy', max: 25, label: 'Healthy weight', color: '#18a058' },
    { key: 'over', max: 30, label: 'Overweight', color: '#eab308' },
    { key: 'obese', max: Infinity, label: 'Obese', color: '#e5484d' }
  ];

  const num = v => (v === '' || v == null ? NaN : Number(v));

  // input: { weightUnit: 'kg'|'lbs', weight, heightUnit: 'ft'|'cm', ft, inch, cm }
  // returns { bmi, category, heightCm, weightKg, healthyMinKg, healthyMaxKg } or { error }
  function computeBmi(input) {
    const weight = num(input.weight);
    const weightKg = input.weightUnit === 'lbs' ? weight * 0.45359237 : weight;
    let heightCm;
    if (input.heightUnit === 'cm') heightCm = num(input.cm);
    else heightCm = (num(input.ft) * 12 + (num(input.inch) || 0)) * 2.54;

    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) return { error: 'Please enter a height between 3 ft 4 in and 8 ft 2 in (100–250 cm).' };
    if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 300) return { error: 'Please enter a weight between 25 and 300 kg (55–660 lbs).' };

    const m = heightCm / 100;
    const bmi = Math.round(weightKg / (m * m) * 10) / 10;
    const category = CATEGORIES.find(c => bmi < c.max);
    return {
      bmi, category: { key: category.key, label: category.label, color: category.color },
      heightCm: Math.round(heightCm), weightKg: Math.round(weightKg * 10) / 10,
      healthyMinKg: Math.round(18.5 * m * m), healthyMaxKg: Math.round(24.9 * m * m)
    };
  }

  const api = { computeBmi, CATEGORIES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BMI = api;
})(this);
