/* PrintCheck AI Micro v0.1. Experimental CPU/JS inference; not wired into production. */
export const SCHEMA = 'printcheck.micro.patch.v1';
export const CLASSES = Object.freeze(['bridge', 'gap', 'corner', 'island', 'safe']);

export function classifyCandidate(patch, model) {
  if (!model || model.schema !== SCHEMA || model.patch !== 21 || model.classes?.join('|') !== CLASSES.join('|'))
    throw new Error('Incompatible PrintCheck AI Micro model');
  if (!patch || patch.length !== 441) throw new Error('Candidate must have a 21x21 binary pixel patch');
  const {W1, b1, W2, b2} = model.weights;
  const h = new Float32Array(model.hidden);
  for (let j = 0; j < model.hidden; j++) h[j] = b1[j];
  for (let i = 0; i < 441; i++) {
    const ink = Number(patch[i]);
    if (ink !== 0 && ink !== 1) throw new Error('Each patch pixel must be binary');
    if (ink === 0) continue;
    const row = W1[i];
    for (let j = 0; j < model.hidden; j++) h[j] += row[j];
  }
  for (let j = 0; j < h.length; j++) h[j] = Math.tanh(h[j]);
  const logits = Array.from(b2);
  for (let j = 0; j < model.hidden; j++) {
    const row = W2[j];
    for (let k = 0; k < logits.length; k++) logits[k] += h[j] * row[k];
  }
  const peak = Math.max(...logits);
  const exps = logits.map(z => Math.exp(z - peak));
  const total = exps.reduce((a,b)=>a+b,0);
  const probs = exps.map(z => z/total);
  const index = probs.indexOf(Math.max(...probs));
  return {type: CLASSES[index], confidence: probs[index], probabilities: probs};
}

export function assessCandidate(candidate, model, rules, minConfidence=0.85) {
  if (!candidate || !candidate.needsReview) return {state:'skipped', reason:'No geometry event'};
  if (!Number.isFinite(candidate.measuredMm) || candidate.measuredMm < 0)
    throw new Error('Missing a valid calibrated physical measurement');
  for (const key of ['positiveMm', 'negativeMm']) {
    if (!Number.isFinite(rules?.[key]) || rules[key] < 0) throw new Error(`Invalid rule ${key}`);
  }
  const result = classifyCandidate(candidate.patch, model);
  if (result.confidence < minConfidence) return {...result, state:'review', reason:'Classification uncertain'};
  const limit = result.type === 'bridge' ? rules.positiveMm :
    result.type === 'gap' ? rules.negativeMm :
    result.type === 'island' ? rules.islandMm : null;
  if (limit == null) return {...result, state: result.type === 'island'?'review':'ok'};
  if (!Number.isFinite(limit) || limit < 0) throw new Error('Invalid island limit');
  return {...result, state:candidate.measuredMm < limit?'defect':'ok',
    measuredMm:candidate.measuredMm, limitMm:limit, ruleVersion:rules.version||null};
}
