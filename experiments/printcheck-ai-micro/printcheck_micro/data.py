"""Synthetic morphology classes; all images are invented, not customer artwork.

Pixel masks represent one print-color separation, NOT a composited full-colour image.
Labels describe the role of a candidate, not compliance with a process spec.
"""
import numpy as np
import cv2

CLASSES = ('bridge', 'gap', 'corner', 'island', 'safe')
SIZE = 21


def make_patch(label: int, rng: np.random.Generator) -> np.ndarray:
    p = np.zeros((SIZE, SIZE), dtype=np.uint8)
    t = int(rng.integers(1, 5))
    if label == 0:  # Thin positive joining two large filled areas
        lx = int(rng.integers(4, 8))
        cy = int(rng.integers(9, 12))
        cv2.rectangle(p, (0, 3), (lx, 17), 1, -1)
        cv2.rectangle(p, (SIZE - 1 - lx, 3), (SIZE - 1, 17), 1, -1)
        cv2.rectangle(p, (lx, cy - t // 2), (SIZE - 1 - lx, cy + (t - 1) // 2), 1, -1)
    elif label == 1:  # Thin negative space between two solid elements
        g = int(rng.integers(1, 5))
        x = SIZE // 2
        cv2.rectangle(p, (1, 2), (x - g // 2 - 1, 18), 1, -1)
        cv2.rectangle(p, (x + (g + 1) // 2, 2), (19, 18), 1, -1)
    elif label == 2:  # Corner taper must not automatically count as narrow stroke
        apex = (int(rng.integers(9, 12)), int(rng.integers(2, 6)))
        contour = np.array([[1, 18], [19, 18], apex], dtype=np.int32)
        cv2.fillConvexPoly(p, contour, 1)
    elif label == 3:  # Detached element
        r = int(rng.integers(1, 4))
        if rng.random() < 0.5:
            cv2.circle(p, (10, 10), r, 1, -1)
        else:
            cv2.rectangle(p, (10 - r, 10 - r), (10 + r, 10 + r), 1, -1)
    elif label == 4:  # Clearly safe, thick continuous area
        if rng.random() < 0.5:
            cv2.rectangle(p, (0, int(rng.integers(6, 9))), (20, int(rng.integers(13, 16))), 1, -1)
        else:
            cv2.rectangle(p, (int(rng.integers(5, 8)), 0), (int(rng.integers(13, 16)), 20), 1, -1)
    else:
        raise ValueError(f'unsupported label {label}')
    p = np.rot90(p, int(rng.integers(0, 4))).copy()
    return p


def make_dataset(samples_per_class: int, seed: int):
    rng = np.random.default_rng(seed)
    xs, ys = [], []
    for label in range(len(CLASSES)):
        for _ in range(samples_per_class):
            xs.append(make_patch(label, rng).ravel().astype(np.float32))
            ys.append(label)
    order = rng.permutation(len(ys))
    return np.stack(xs)[order], np.array(ys, dtype=np.int64)[order]
