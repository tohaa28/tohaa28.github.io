import test from "node:test";
import assert from "node:assert/strict";
import {mapPointBetweenQuads,mapQuadBetweenQuads,cylinderWarpCoordinate,cylinderProjection,cylinderVisibleRange,cylinder3DSurfacePoint,cylinder3DArcHandle,cylinder3DArcRatioFromPoint} from "../assets/mockup-cylinder.mjs";

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


test("3D cylinder bends top and bottom edges and hides the back",()=>{
  const q=[{x:0,y:0},{x:100,y:0},{x:100,y:200},{x:0,y:200}];
  const topCenter=cylinder3DSurfacePoint(q,.5,0,{axis:"vertical",curvature:.72,topArc:.08,bottomArc:.04});
  const bottomCenter=cylinder3DSurfacePoint(q,.5,1,{axis:"vertical",curvature:.72,topArc:.08,bottomArc:.04});
  assert.ok(topCenter.y>0,"top edge must bow toward the cylinder body");
  assert.ok(bottomCenter.y>200,"bottom edge must bow toward the cylinder body");
  assert.equal(cylinder3DSurfacePoint(q,-.2,.5,{axis:"vertical",curvature:.72}).visible,false);
  assert.equal(cylinder3DSurfacePoint(q,.5,.5,{axis:"vertical",curvature:.72}).visible,true);
  assert.equal(cylinder3DSurfacePoint(q,1.2,.5,{axis:"vertical",curvature:.72}).visible,false);
});

test("3D cylinder arc handles round-trip their curve depth",()=>{
  const q=[{x:0,y:0},{x:100,y:0},{x:100,y:200},{x:0,y:200}];
  const opts={axis:"vertical",curvature:.72,topArc:.09,bottomArc:.055};
  const top=cylinder3DArcHandle(q,"top",opts),bottom=cylinder3DArcHandle(q,"bottom",opts);
  assert.ok(Math.abs(cylinder3DArcRatioFromPoint(q,top,"top",opts)-.09)<1e-9);
  assert.ok(Math.abs(cylinder3DArcRatioFromPoint(q,bottom,"bottom",opts)-.055)<1e-9);
});
