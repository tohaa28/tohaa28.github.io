import numpy as np
import pytest
from printcheck_micro.data import make_dataset, make_patch, SIZE, CLASSES
from printcheck_micro.model import TinyMorphNet
from printcheck_micro.decision import Rule, decide


def test_dataset_balanced_and_reproducible():
    a,b=make_dataset(4,7)
    c,d=make_dataset(4,7)
    assert a.shape==(20,SIZE*SIZE)
    assert np.array_equal(a,c) and np.array_equal(b,d)
    assert sorted(np.bincount(b).tolist())==[4]*5

@pytest.mark.parametrize('label',range(5))
def test_shape_generator_binary(label):
    p=make_patch(label,np.random.default_rng(14))
    assert p.shape==(21,21)
    assert set(np.unique(p)) <= {0,1}


def test_model_probabilities():
    x,_=make_dataset(2,12)
    m=TinyMorphNet()
    y=m.predict_probabilities(x)
    assert y.shape==(10,len(CLASSES))
    np.testing.assert_allclose(y.sum(axis=1),1,atol=1e-6)
    assert m.parameter_count < 10000


def test_roundtrip(tmp_path):
    a=TinyMorphNet()
    path=tmp_path/'model.json'
    a.save(path)
    b=TinyMorphNet.load(path)
    x,_=make_dataset(1,40)
    np.testing.assert_allclose(a.predict_probabilities(x),b.predict_probabilities(x),atol=1e-6)


def test_bad_model_schema(tmp_path):
    p=tmp_path/'bad.json'
    p.write_text('{"schema":"wrong","patch":0,"classes":[]}',encoding='utf8')
    with pytest.raises(ValueError): TinyMorphNet.load(p)


def test_physical_rule_not_learned():
    rule=Rule('TEST',0.3,0.2)
    assert decide([.99,.002,.002,.003,.003],0.25,rule)['state']=='defect'
    assert decide([.99,.002,.002,.003,.003],0.35,rule)['state']=='ok'
    assert decide([.002,.99,.002,.003,.003],0.15,rule)['state']=='defect'
    assert decide([.002,.002,.99,.003,.003],0.01,rule)['state']=='ok'


def test_uncertainty_requires_review():
    rule=Rule('TEST',0.3,0.2)
    assert decide([.4,.3,.1,.1,.1],0.1,rule)['state']=='review'


def test_missing_island_limit_reviews():
    rule=Rule('TEST',0.3,0.2)
    assert decide([0,0,0,1,0],0.1,rule)['state']=='review'

def test_invalid_physical_measurements_blocked():
    r=Rule("TEST",.2,.2)
    for v in (-1, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            decide([1,0,0,0,0],v,r)
    with pytest.raises(ValueError):
        decide([1,0,0,0,0],.1,Rule("TEST",float("nan"),.2))
