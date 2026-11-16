/**
 * PrintCheck Vision: deterministic rule resolver, v1.
 * Pure, dependency-free, no network, no mutation, no model inference.
 *
 * This is NOT production approval. Experimental registries may be evaluated
 * only with research_mode=true. Missing provenance/scope/scale => MANUAL.
 */
const MANUAL = (reason, extra = {}) => Object.freeze({status:"MANUAL",reason,...extra});
const own = (value,key) => Object.prototype.hasOwnProperty.call(value||{},key);
const finite = n => typeof n==="number" && Number.isFinite(n) && n>=0;
const norm = value => String(value??"").trim().toUpperCase();
const isDefined = value => value!==undefined && value!==null && value!=="";
const supportedTier = {technology:1,constructor:2,order:3};

function matchesRequirement(condition = {}, features = {}) {
  let missing = false;
  for (const [key, expected] of Object.entries(condition)) {
    if (!own(features,key) || !isDefined(features[key])) { missing=true; continue; }
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.some(value => value===features[key])) return {state:"no"};
  }
  return {state:missing ? "unknown" : "yes"};
}
function equalNumber(a,b) {
  return a === b; // exact values, avoid silently smoothing conflicting official rules
}
function validProvenance(prov) {
  return !!(prov && typeof prov.url==="string" &&
    /^https:\/\/gifts\.ru\//.test(prov.url) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(prov.reviewed_at || "")));
}
function matchingOverride(entry, query) {
  if (!entry || entry.dimension!==query.dimension) return false;
  if (!["order","constructor"].includes(entry.tier)) return false;
  if (entry.technology && norm(entry.technology)!==norm(query.technology)) return false;
  if (entry.tier==="order" && (!query.order_id || entry.scope_id!==query.order_id)) return false;
  if (entry.tier==="constructor" && (!query.constructor_id || entry.scope_id!==query.constructor_id)) return false;
  return true;
}

/**
 * Returns one traceable minimum threshold or MANUAL.
 * Inputs: {technology,dimension,features?,overrides?,order_id?,constructor_id?}
 * Expected overrides are signed-off rules for the actual order/constructor,
 * never untrusted values extracted from arbitrary PDF comments.
 */
export function resolveRequirement(registry, query = {}) {
  if (!registry || registry.schema!=="printcheck.vision.rules.v1" ||
      !Array.isArray(registry.rules) || !query.dimension || !query.technology) {
    return MANUAL("RULESET_OR_CONTEXT_MISSING");
  }
  const technology=norm(query.technology), dimension=query.dimension;
  const supported=registry.rules.filter(rule=>Array.isArray(rule.technologies) &&
    rule.technologies.some(code=>norm(code)===technology) &&
    own(rule.measurements,dimension));
  const providedOverrides=(Array.isArray(query.overrides)?query.overrides:[])
    .filter(rule=>matchingOverride(rule,{...query,technology,dimension}));
  const candidates=[];
  let unknownAtTier=-1;
  const blockerDetails=[];
  for(const item of providedOverrides) {
    const tier=supportedTier[item.tier];
    const matched=matchesRequirement(item.conditions||{},query.features||{});
    if(matched.state==="no")continue;
    if(matched.state==="unknown") {
      unknownAtTier=Math.max(unknownAtTier,tier);
      blockerDetails.push("OVERRIDE_FEATURE_UNKNOWN");
      continue;
    }
    if(item.approved!==true || !item.approved_by || !item.source_ref ||
        !isDefined(item.scope_id) || !finite(item.threshold) ||
        !/^[a-f0-9]{64}$/i.test(item.source_sha256||"")) {
      unknownAtTier=Math.max(unknownAtTier,tier);
      blockerDetails.push("UNVERIFIED_OVERRIDE");
      continue;
    }
    candidates.push({
      tier, specificity:Object.keys(item.conditions||{}).length,
      threshold:item.threshold,rule_id:item.id||"APPROVED-OVERRIDE",
      provenance:{url:item.source_ref,reviewed_at:item.approved_at||null,sha256:item.source_sha256},
      source_tier:item.tier
    });
  }
  for(const item of supported) {
    if(!finite(item.measurements[dimension]) || !validProvenance(item.provenance)) {
      unknownAtTier=Math.max(unknownAtTier,1);
      blockerDetails.push("SOURCE_PROVENANCE_INVALID");
      continue;
    }
    const matching=matchesRequirement(item.conditions||{},query.features||{});
    if(matching.state==="no")continue;
    if(matching.state==="unknown") {
      unknownAtTier=Math.max(unknownAtTier,1);
      blockerDetails.push("CONDITIONAL_FEATURE_UNKNOWN");
      continue;
    }
    candidates.push({
      tier:1, specificity:Object.keys(item.conditions||{}).length,
      threshold:item.measurements[dimension],rule_id:item.id,
      provenance:{url:item.provenance.url,reviewed_at:item.provenance.reviewed_at},
      source_tier:"technology"
    });
  }
  if(!candidates.length) return MANUAL(
    blockerDetails[0]||"NO_APPLICABLE_RULE",{technology,dimension}
  );
  const maxTier=Math.max(...candidates.map(x=>x.tier));
  if(unknownAtTier>=maxTier)return MANUAL(blockerDetails[0]||"UNRESOLVED_CONDITION",{technology,dimension});
  const priorityCandidates=candidates.filter(x=>x.tier===maxTier);
  const maxSpecificity=Math.max(...priorityCandidates.map(x=>x.specificity));
  const exact=priorityCandidates.filter(x=>x.specificity===maxSpecificity);
  if(exact.some(x=>!equalNumber(x.threshold,exact[0].threshold))) {
    return MANUAL("RULE_SOURCE_CONFLICT",{
      technology,dimension,candidates:exact.map(({rule_id,threshold,provenance})=>
        ({rule_id,threshold,provenance}))
    });
  }
  // A declared conflict between official sources is deliberately fail-closed.
  const conflict=(registry.source_conflicts||[]).find(x=>
    x.metric===dimension && x.technologies?.some(code=>norm(code)===technology));
  if(conflict && maxTier<=1)return MANUAL("RULE_SOURCE_CONFLICT",{
    technology,dimension,conflict_id:conflict.id,variants:conflict.variants
  });
  const best=exact.slice().sort((a,b)=>a.rule_id.localeCompare(b.rule_id))[0];
  return Object.freeze({
    status:"RESOLVED",technology,dimension,threshold:best.threshold,
    unit:dimension.endsWith("_mm")?"mm":
      dimension.endsWith("_dpi")||dimension==="effective_dpi"?"dpi":"%",
    operator:">=",rule_id:best.rule_id,source_tier:best.source_tier,
    provenance:best.provenance,revision:registry.revision
  });
}

/**
 * Deterministic numeric decision. Neural scores must never override an ERROR.
 * geometry_proven and scale_proven are expected to originate in independent
 * geometric verification, not from the network.
 */
export function evaluateMeasurement(registry, query = {}) {
  if(registry?.status!=="production_approved" && query.research_mode!==true)
    return MANUAL("RULESET_NOT_APPROVED");
  if(query.scale_proven!==true)return MANUAL("PHYSICAL_SCALE_NOT_PROVEN");
  if(query.geometry_proven!==true)return MANUAL("GEOMETRY_NOT_PROVEN");
  if(!finite(query.measured))return MANUAL("MEASUREMENT_NOT_AVAILABLE");
  const requirement=resolveRequirement(registry,query);
  if(requirement.status!=="RESOLVED")return requirement;
  const uncertainty=query.uncertainty ?? 0;
  if(!finite(uncertainty))return MANUAL("UNCERTAINTY_INVALID");
  const threshold=requirement.threshold;
  if(query.measured-uncertainty>=threshold) {
    return Object.freeze({...requirement,status:"OK",measured:query.measured,uncertainty});
  }
  if(query.measured+uncertainty<threshold) {
    return Object.freeze({...requirement,status:"ERROR",measured:query.measured,uncertainty});
  }
  return MANUAL("MEASUREMENT_OVERLAPS_THRESHOLD",{
    technology:requirement.technology,dimension:requirement.dimension,
    threshold,measured:query.measured,uncertainty,
    rule_id:requirement.rule_id,provenance:requirement.provenance
  });
}
