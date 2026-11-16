"""Versioned physical limits applied AFTER shape classification.

No normative limits are built into the neural weights. Candidate measurements
must originate from calibrated vector geometry or a separately validated raster
measurement pipeline. False measured values must not be inferred from pixels.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Rule:
    method: str
    min_positive_mm: float
    min_negative_mm: float
    min_island_mm: float | None = None
    rule_source: str = 'experimental/example-not-a-production-specification'


def decide(class_probabilities, measurement_mm: float, rule: Rule, confidence_threshold: float = .85):
    classes = ('bridge', 'gap', 'corner', 'island', 'safe')
    if len(class_probabilities) != len(classes):
        raise ValueError('expected five classification probabilities')
    if measurement_mm < 0:
        raise ValueError('physical size cannot be negative')
    ix = max(range(len(classes)), key=lambda i: class_probabilities[i])
    kind, conf = classes[ix], float(class_probabilities[ix])
    if conf < confidence_threshold:
        return {'state': 'review', 'type': kind, 'confidence': conf,
                'message': 'Низкая уверенность классификации; требуется геометрическая проверка'}
    limit = {'bridge': rule.min_positive_mm, 'gap': rule.min_negative_mm,
             'island': rule.min_island_mm}.get(kind)
    if limit is None:
        return {'state': 'ok' if kind in ('corner', 'safe') else 'review', 'type': kind, 'confidence': conf,
                'message': 'Для данного типа нет применимого норматива' if kind == 'island' else 'Кандидат допустим по типу'}
    return {'state': 'defect' if measurement_mm < limit else 'ok', 'type': kind,
            'confidence': conf, 'measured_mm': measurement_mm,
            'limit_mm': limit, 'rule_source': rule.rule_source}
