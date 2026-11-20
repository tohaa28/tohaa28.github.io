"""Reference research trainer for Vision synthetic 8-12-1 MLP.

Install (only in trusted offline research environment): pip install numpy torch
Never train on customer files without permission and independent holdout.
Output is a NEW unapproved checkpoint, not an automatic browser update.
"""
import argparse,json,numpy as np,torch
from torch import nn

X,Y=np.meshgrid(np.arange(-4,5,dtype=float),np.arange(-4,5,dtype=float))

def synthetic(n,seed):
    rng=np.random.default_rng(seed);patches=[];labels=[]
    while len(patches)<n:
        kind=int(rng.integers(0,7));angle=rng.uniform(0,np.pi)
        nx,ny=np.cos(angle),np.sin(angle)
        across=X*nx+Y*ny;along=-X*ny+Y*nx
        shift=rng.uniform(-.35,.35)
        is_thin=int(rng.random()<.5)
        width=rng.uniform(.75,2.35) if is_thin else rng.uniform(3.95,6.4)
        if kind<=2:
            mask=(np.abs(across-shift)<=width/2)&(np.abs(along)<=rng.uniform(5,9))
        elif kind==3:
            extent=rng.uniform(1.7,3.1) if is_thin else rng.uniform(5,9)
            mask=(np.abs(across-shift)<=width/2)&(np.abs(along)<=extent)
        elif kind==4:
            r=rng.uniform(.7,1.4) if is_thin else rng.uniform(2.6,5.5)
            mask=(X-rng.uniform(-.2,.2))**2+(Y-rng.uniform(-.2,.2))**2<r**2
        elif kind==5:
            mask=(np.abs(across-shift)<=width/2)|(np.abs(along-rng.uniform(-.1,.1))<=width/2)
        else:
            mask=across>=rng.uniform(-3.5,-.4);is_thin=0
        if not mask[4,4]:continue
        if rng.random()<.23:
            j=int(rng.integers(0,81))
            if j!=40:mask.flat[j]=not mask.flat[j]
        patches.append(mask.astype('float32'))
        labels.append(float(is_thin))
    return np.stack(patches),np.array(labels,dtype='float32')[:,None]

def extract(patches):
    return np.stack([
        patches[:,4,:].mean(axis=1),patches[:,:,4].mean(axis=1),
        np.trace(patches,axis1=1,axis2=2)/9,
        np.trace(patches[:,:,::-1],axis1=1,axis2=2)/9,
        patches[:,3:6,3:6].mean(axis=(1,2)),
        patches[:,2:7,2:7].mean(axis=(1,2)),
        patches.mean(axis=(1,2)),patches[:,4,3:6].mean(axis=1)
    ],axis=1).astype('float32')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('output')
    opt=parser.parse_args()
    torch.manual_seed(20261117);torch.set_num_threads(2)
    train,target=synthetic(19000,1001)
    holdout,truth=synthetic(3000,2002)
    x=torch.from_numpy(extract(train));y=torch.from_numpy(target)
    model=nn.Sequential(nn.Linear(8,12),nn.Tanh(),nn.Linear(12,1))
    optimizer=torch.optim.Adam(model.parameters(),lr=.015)
    for epoch in range(35):
        for batch in torch.randperm(len(x)).split(256):
            logits=model(x[batch])
            loss=nn.functional.binary_cross_entropy_with_logits(logits,y[batch])
            optimizer.zero_grad();loss.backward();optimizer.step()
    with torch.no_grad():
        p=torch.sigmoid(model(torch.from_numpy(extract(holdout)))).numpy().ravel()
    positive=truth.ravel()==1;selected=p>=.75
    output={'schema':'printcheck.vision.synthetic-feature-mlp.candidate.v1',
      'research_only':True,'auto_deploy_allowed':False,
      'layers':{'w1':model[0].weight.detach().numpy().round(5).tolist(),
        'b1':model[0].bias.detach().numpy().round(5).tolist(),
        'w2':model[2].weight.detach().numpy().round(5)[0].tolist(),
        'b2':round(float(model[2].bias.detach().numpy()[0]),5)},
      'validation':{'synthetic_holdout':len(p),
        'accuracy_0_5':round(float(((p>.5)==positive).mean()),5),
        'precision_0_75':round(float((selected&positive).sum()/max(1,selected.sum())),5),
        'recall_0_75':round(float(selected[positive].mean()),5)}}
    with open(opt.output,'w',encoding='utf-8') as f:json.dump(output,f,indent=2)
    print(json.dumps(output['validation'],ensure_ascii=False))

if __name__=='__main__':main()
