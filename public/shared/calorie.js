// Daily calorie maths (Mifflin-St Jeor) shared by the website calculator.
(function (root) {
  const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  const num = v => (v === '' || v == null ? NaN : Number(v));

  // input: { sex:'female'|'male', age, weightUnit, weight, heightUnit, ft, inch, cm, activity, goal:'lose'|'maintain'|'gain' }
  function computeCalories(input) {
    const age = num(input.age);
    const weight = num(input.weight);
    const weightKg = input.weightUnit === 'lbs' ? weight * 0.45359237 : weight;
    const heightCm = input.heightUnit === 'cm' ? num(input.cm) : (num(input.ft) * 12 + (num(input.inch) || 0)) * 2.54;

    if (!Number.isFinite(age) || age < 15 || age > 90) return { error: 'Please enter an age between 15 and 90.' };
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) return { error: 'Please enter a height between 3 ft 4 in and 8 ft 2 in (100–250 cm).' };
    if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 300) return { error: 'Please enter a weight between 25 and 300 kg (55–660 lbs).' };

    const male = input.sex === 'male';
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (male ? 5 : -161);
    const maintain = bmr * (ACTIVITY[input.activity] || ACTIVITY.light);
    const floor = male ? 1500 : 1200;
    const r = n => Math.round(n / 5) * 5;
    const plan = { lose: Math.max(floor, r(maintain - 500)), maintain: r(maintain), gain: r(maintain + 300) };
    const goal = plan[input.goal] ? input.goal : 'maintain';
    return { bmr: r(bmr), target: plan[goal], plan, goal };
  }

  const api = { computeCalories, ACTIVITY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CALORIE = api;
})(this);
