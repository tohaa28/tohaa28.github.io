import test from "node:test";
import assert from "node:assert/strict";
import {mapPointBetweenQuads,mapQuadBetweenQuads,cylinderWarpCoordinate} from "../assets/mockup-cylinder.mjs";

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

test("cylinder curvature is identity at zero and compresses the edges",()=>{
  assert.equal(cylinderWarpCoordinate(.25,0),.25);
  assert.equal(cylinderWarpCoordinate(.5,.8),.5);
  assert.ok(cylinderWarpCoordinate(.25,.8)<.25);
  assert.ok(cylinderWarpCoordinate(.75,.8)>.75);
  assert.ok(Math.abs(cylinderWarpCoordinate(0,.8))<1e-10);
  assert.ok(Math.abs(cylinderWarpCoordinate(1,.8)-1)<1e-10);
});
