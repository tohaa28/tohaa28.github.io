"""python -m printcheck_micro.train --out runtime/weights.json"""
import argparse
import json
import time
from pathlib import Path
import numpy as np
from .data import make_dataset, CLASSES
from .model import TinyMorphNet
from .stress import change


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--out', default='runtime/weights.json')
    cli.add_argument('--epochs', type=int, default=18)
    cli.add_argument('--augment', action='store_true', help='Train on random rotations and shifts (experimental)')
    cli.add_argument('--samples-per-class', type=int, default=720)
    args = cli.parse_args()
    train_x, train_y = make_dataset(args.samples_per_class, 104)
    val_x, val_y = make_dataset(200, 202)
    test_x, test_y = make_dataset(200, 909)  # fixed independent seed
    if args.augment:
        rng = np.random.default_rng(401)
        aug_x = []
        aug_y = []
        for i in range(len(train_y)):
            xx=train_x[i]
            aug_x.append(xx)
            aug_y.append(train_y[i])
            # Angles and translations are mixed to avoid a fixed-coordinate shortcut.
            for kind in ('angle_45','shift_2'):
                aug_x.append(change(xx,rng,kind))
                aug_y.append(train_y[i])
        train_x=np.stack(aug_x)
        train_y=np.asarray(aug_y,dtype=np.int64)
    model = TinyMorphNet(hidden=20, seed=7)
    started = time.perf_counter()
    history = model.fit(train_x, train_y, val_x, val_y, epochs=args.epochs)
    elapsed = time.perf_counter() - started
    probs = model.predict_probabilities(test_x)
    pred = probs.argmax(axis=1)
    matrix = [[int(np.sum((test_y == i) & (pred == j))) for j in range(len(CLASSES))] for i in range(len(CLASSES))]
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    model.save(args.out)
    report = {'architecture': 'sparse-candidate-tiny-mlp-control', 'seed': 7,
              'dataset': 'synthetic only', 'augmentation': args.augment, 'n_train': len(train_y), 'n_validation': len(val_y), 'n_test': len(test_y),
              'parameters': model.parameter_count, 'weights_bytes_float32': model.parameter_count * 4,
              'training_seconds': round(elapsed, 3), 'accuracy_test': float(np.mean(pred == test_y)),
              'history': history, 'classes': list(CLASSES), 'confusion_matrix_true_rows_pred_columns': matrix}
    outfile = Path(args.out).with_name(Path(args.out).stem + '-training-report.json')
    outfile.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'weights': args.out, 'report': str(outfile), 'params': model.parameter_count,
                      'train_s': round(elapsed, 3), 'test_accuracy': report['accuracy_test']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
