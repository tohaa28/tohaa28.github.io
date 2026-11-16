"""Tiny CPU NumPy classifier; only invoked for geometric candidate events.

This MLP is a deliberately conventional control architecture. New architectural
claims must be tested against it; novelty is NOT asserted merely by naming.
"""
import json
import numpy as np
from .data import CLASSES, SIZE


class TinyMorphNet:
    def __init__(self, hidden=20, seed=7):
        rng = np.random.default_rng(seed)
        self.W1 = rng.normal(0, (2 / (SIZE * SIZE + hidden)) ** 0.5, (SIZE * SIZE, hidden)).astype('float32')
        self.b1 = np.zeros(hidden, np.float32)
        self.W2 = rng.normal(0, (2 / (hidden + len(CLASSES))) ** 0.5, (hidden, len(CLASSES))).astype('float32')
        self.b2 = np.zeros(len(CLASSES), np.float32)

    @property
    def parameter_count(self):
        return sum(a.size for a in self.params())

    def params(self):
        return (self.W1, self.b1, self.W2, self.b2)

    def predict_probabilities(self, x):
        x = np.asarray(x, np.float32).reshape(-1, SIZE * SIZE)
        h = np.tanh(x @ self.W1 + self.b1)
        z = h @ self.W2 + self.b2
        z -= z.max(axis=1, keepdims=True)
        q = np.exp(z)
        return q / q.sum(axis=1, keepdims=True)

    def fit(self, train_x, train_y, val_x, val_y, *, epochs=18, batch_size=128, lr=0.003, seed=17):
        rng = np.random.default_rng(seed)
        params = self.params()
        mt = [np.zeros_like(p) for p in params]
        vt = [np.zeros_like(p) for p in params]
        step = 0
        history = []
        for epoch in range(1, epochs + 1):
            order = rng.permutation(len(train_y))
            for start in range(0, len(order), batch_size):
                ix = order[start:start + batch_size]
                x, y = train_x[ix], train_y[ix]
                h = np.tanh(x @ self.W1 + self.b1)
                z = h @ self.W2 + self.b2
                z -= z.max(axis=1, keepdims=True)
                e = np.exp(z)
                prob = e / e.sum(axis=1, keepdims=True)
                dz = prob
                dz[np.arange(len(y)), y] -= 1
                dz /= len(y)
                dW2 = h.T @ dz
                db2 = dz.sum(axis=0)
                dh = (dz @ self.W2.T) * (1 - h * h)
                dW1 = x.T @ dh
                db1 = dh.sum(axis=0)
                step += 1
                for i, (p, g) in enumerate(zip(params, (dW1, db1, dW2, db2))):
                    mt[i] *= 0.9
                    mt[i] += 0.1 * g
                    vt[i] *= 0.999
                    vt[i] += 0.001 * (g * g)
                    p -= lr * (mt[i] / (1 - 0.9 ** step)) / (np.sqrt(vt[i] / (1 - 0.999 ** step)) + 1e-8)
            val_probs = self.predict_probabilities(val_x)
            acc = float(np.mean(val_probs.argmax(axis=1) == val_y))
            history.append({'epoch': epoch, 'validation_accuracy': round(acc, 4)})
        return history

    def save(self, path):
        obj = {'schema': 'printcheck.micro.patch.v1', 'patch': SIZE,
               'classes': list(CLASSES), 'hidden': len(self.b1),
               'weights': {n: np.round(getattr(self, n), 7).tolist() for n in ('W1', 'b1', 'W2', 'b2')},
               'data_provenance': 'synthetic-only-do-not-use-for-production-decisions'}
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(obj, f, separators=(',', ':'))

    @classmethod
    def load(cls, path):
        with open(path, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        if obj['schema'] != 'printcheck.micro.patch.v1' or obj['patch'] != SIZE or obj['classes'] != list(CLASSES):
            raise ValueError('model schema mismatch')
        net = cls(hidden=obj['hidden'])
        for n in ('W1', 'b1', 'W2', 'b2'):
            a = np.array(obj['weights'][n], dtype=np.float32)
            if a.shape != getattr(net, n).shape:
                raise ValueError(f'wrong tensor shape: {n}')
            setattr(net, n, a)
        return net
