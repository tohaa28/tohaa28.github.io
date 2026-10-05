import test from "node:test";
import assert from "node:assert/strict";
import {mapPointBetweenQuads,mapQuadBetweenQuads,cylinderWarpCoordinate,cylinderProjection,cylinderVisibleRange} from "../assets/mockup-cylinder.mjs";

test("cylinder guide keeps field attached while cylinder moves",()=>{
  const from=[{x:.2,y:.1},{x:.8,y:.1},{x:.8,y:.9},{x:.2,y:.9}];
  const to=[{x:.3,y:.2},{x:.9,y:.25},{x:.82,y:.95},{x:.24,y:.88}];
  const field=[{x:.35,y:.35},{x:.55,y:.35},{x:.55,y:.55},{x:.35,y:.55}];
  const moved=mapQuadBetweenQuads(field,from,to);
  for(let i=0;i<field.length;i++){
    const direct=mapPointBetweenQuads(field[i],from,to);
    assert.ok(Math.abs(moved[i].x-direct.x)<1e-10);
    assert.ok(Math.abs(moved[i].y-direct.y)<1e-10);
  }
  assert.notDeepEqual(moved,field);
});

test("cylinder projection wraps source and clips the back side",()=>{
  assert.equal(cylinderWarpCoordinate(.25,0),.25);
  assert.equal(cylinderProjection(.5,.8).coordinate,.5);
  const range=cylinderVisibleRange(.8);
  assert.equal(range.clipped,true);
  assert.ok(range.start>0&&range.end<1);
  assert.equal(cylinderProjection(0,.8).visible,false);
  assert.equal(cylinderProjection(1,.8).visible,false);
  assert.equal(cylinderProjection(.5,.8).visible,true);
  assert.ok(Math.abs(cylinderProjection(range.start,.8).coordinate)<1e-9);
  assert.ok(Math.abs(cylinderProjection(range.end,.8).coordinate-1)<1e-9);
  assert.ok(cylinderProjection(range.start-.01,.8).visible===false);
  assert.ok(cylinderProjection(range.end+.01,.8).visible===false);
});

test("moderate cylinder curvature keeps the full artwork visible",()=>{
  const range=cylinderVisibleRange(.5);
  assert.deepEqual({start:range.start,end:range.end,clipped:range.clipped},{start:0,end:1,clipped:false});
  assert.equal(cylinderProjection(0,.5).visible,true);
  assert.equal(cylinderProjection(1,.5).visible,true);
  assert.ok(Math.abs(cylinderWarpCoordinate(0,.5))<1e-10);
  assert.ok(Math.abs(cylinderWarpCoordinate(1,.5)-1)<1e-10);
});
