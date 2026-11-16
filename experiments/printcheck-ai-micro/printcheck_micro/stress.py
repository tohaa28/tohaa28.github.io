"""Out-of-distribution robustness checks, not production validation."""
import argparse
import json
import cv2
import numpy as np
from .data import make_dataset, SIZE, CLASSES
from .model import TinyMorphNet


def change(x, rng, kind):
    y = x.reshape(SIZE, SIZE).astype('uint8')
    if kind == 'angle_45':
        mat = cv2.getRotationMatrix2D((10,10),45,1)
        y = cv2.warpAffine(y,mat,(SIZE,SIZE),flags=cv2.INTER_NEAREST,borderValue=0)
    elif kind == 'shift_2':
        mat = np.float32([[1,0,2],[0,1,-2]])
        y = cv2.warpAffine(y,mat,(SIZE,SIZE),flags=cv2.INTER_NEAREST,borderValue=0)
    elif kind == 'noise_1pct':
        flips = rng.random((SIZE,SIZE))<.01
        y[flips] = 1 - y[flips]
    elif kind == 'noise_4pct':
        flips = rng.random((SIZE,SIZE))<.04
        y[flips] = 1 - y[flips]
    return y.ravel().astype('float32')


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--model',default='runtime/weights.json')
    args=p.parse_args()
    model=TinyMorphNet.load(args.model)
    x,y=make_dataset(200,1818)
    rng=np.random.default_rng(48)
    results={}
    for kind in ('original','angle_45','shift_2','noise_1pct','noise_4pct'):
        xx=x if kind=='original' else np.stack([change(z,rng,kind) for z in x])
        pp=model.predict_probabilities(xx)
        pred=pp.argmax(axis=1)
        results[kind]={'accuracy':float(np.mean(pred==y)),
                       'accuracy_per_class':{label:float(np.mean(pred[y==i]==i)) for i,label in enumerate(CLASSES)},
                       'fraction_confident':float(np.mean(pp.max(axis=1)>=.85))}
    outfile = 'runtime/' + __import__('pathlib').Path(args.model).stem + '-stress-report.json'
    with open(outfile,'w',encoding='utf8') as f:
        json.dump(results,f,ensure_ascii=False,indent=2)
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
