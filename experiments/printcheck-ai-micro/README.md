# PrintCheck AI Micro — research prototype v0.1

**Status: experimental; not connected to the Maketnaya/PrintCheck production UI.**

This experiment explores a CPU-first **geometry-event-driven** approach to print-artwork checking. A precise vector/raster geometry analyzer (to be connected) emits *candidate events* and physical measurements in millimetres. A tiny classifier describes each candidate as `bridge`, `gap`, `corner`, `island`, or `safe`. A separate rule evaluator checks the real measurements against versioned specifications for the selected imprint technique. The NN cannot invent an mm measurement and is not entrusted to declare ambiguous cases compliant.

**Academic novelty has not been demonstrated.** The current classifier is a regular tiny MLP serving as a measurement baseline. A future experiment will compare it to a new topology-conditioned, sparse event-memory architecture on held-out *real* examples.

## CPU training and validation

Requires Python 3.10+, `numpy`, `opencv-python`, `pytest`; Node.js is needed only for the optional JS tests.

```bash
python -m printcheck_micro.train --epochs 18 --samples-per-class 720 --out runtime/weights.json
python -m pytest -q tests/test_model.py
node tests/test_runtime.mjs
```

Generated `runtime/weights.json` can be read by `runtime/printcheck-micro.mjs` inside a browser; no Python, GPU, network, or server is required for inference. Dataset and model may be trained fully offline on a CPU.

## Explicit exclusions / safety

- Do not upload order artwork to an AI service.
- Do not make any POST/PUT/PATCH/DELETE request against live gifts.ru orders.
- Do not modify the existing PrintCheck, VectorCraft/TraceDraw, mockup editor, geometry, mm conversions, templates, or PDF export.
- A synthesized image *does not* validate quality on production artwork.
- Never use raster thickness in pixels as an mm dimension without a verified calibration.
- Color separations must be processed independently; a boundary between different print colors is not automatically a negative gap.
- A narrow sharp corner must not be flagged purely on local thickness.
- The trained neural classifier is currently **not** an automated acceptance decision.

## Next experiments

1. Read actual PrintCheck diagnostics and extract independent test artwork.
2. Implement topology-aware candidate extraction from vector paths first, validated raster masks second.
3. Make a comparison baseline: morphological-only vs small MLP vs proposed event-neural architecture.
4. Test false positives on corners/serifs and false negatives on narrow positive and negative features.
5. Add uncertainty calibration and independent QA; then integrate behind a disabled feature flag.