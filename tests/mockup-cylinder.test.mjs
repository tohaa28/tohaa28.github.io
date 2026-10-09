import test from "node:test";
import assert from "node:assert/strict";
import {mapPointBetweenQuads,mapQuadBetweenQuads,cylinderWarpCoordinate,cylinderProjection,cylinderVisibleRange,cylinder3DSurfacePoint,cylinder3DInverseSurfacePoint,cylinder3DArtworkQuad,cylinder3DResizeFieldPreservingAspect,cylinder3DArcHandle,cylinder3DArcRatioFromPoint} from "../assets/mockup-cylinder.mjs";

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


test("3D inverse projection round-trips cylinder coordinates for both axes",()=>{
  const q=[{x:10,y:20},{x:220,y:28},{x:230,y:310},{x:0,y:300}];
  for(const axis of ["vertical","horizontal"]){
    const opts={axis,curvature:.72,topArc:.09,bottomArc:.055};
    for(const [x,y] of [[.15,.2],[.5,.5],[.85,.7]]){
      const projected=cylinder3DSurfacePoint(q,x,y,opts);
      const recovered=cylinder3DInverseSurfacePoint(q,projected,opts);
      assert.ok(Math.abs(recovered.x-x)<1e-6,axis+" x inverse error: "+JSON.stringify({x,y,recovered}));
      assert.ok(Math.abs(recovered.y-y)<1e-6,axis+" y inverse error: "+JSON.stringify({x,y,recovered}));
    }
  }
});

test("cylinder artwork fit preserves intrinsic aspect ratio inside the field",()=>{
  const surface=[{x:.08,y:.12},{x:.92,y:.14},{x:.94,y:.88},{x:.06,y:.86}];
  const opts={axis:"vertical",curvature:.72,topArc:.09,bottomArc:.055};
  const localField=[{x:.32,y:.28},{x:.48,y:.28},{x:.48,y:.72},{x:.32,y:.72}];
  const field=localField.map(p=>cylinder3DSurfacePoint(surface,p.x,p.y,opts));
  const fitted=cylinder3DArtworkQuad(surface,field,2.0,opts);
  const du=fitted.bounds.u1-fitted.bounds.u0,dv=fitted.bounds.v1-fitted.bounds.v0;
  assert.ok(fitted.fieldAspect<2.0,"wide artwork should be fitted vertically inside a taller field");
  assert.ok(Math.abs((du/dv)*fitted.fieldAspect-2.0)<1e-8,"the fitted source aspect must remain 2:1");
  assert.ok(du<=1&&dv<1&&dv>0,"artwork is contained within the selected field");
});

test("cylinder field aspect lock keeps its ratio while a corner is resized",()=>{
  const surface=[{x:.08,y:.12},{x:.92,y:.14},{x:.94,y:.88},{x:.06,y:.86}];
  const opts={axis:"vertical",curvature:.72,topArc:.09,bottomArc:.055};
  const localField=[{x:.28,y:.3},{x:.52,y:.3},{x:.52,y:.5},{x:.28,y:.5}];
  const field=localField.map(p=>cylinder3DSurfacePoint(surface,p.x,p.y,opts));
  const dragged=cylinder3DSurfacePoint(surface,.78,.78,opts);
  const resized=cylinder3DResizeFieldPreservingAspect(surface,field,2,dragged,opts);
  const recovered=resized.map(p=>cylinder3DInverseSurfacePoint(surface,p,opts));
  const width=(Math.hypot(recovered[1].x-recovered[0].x,recovered[1].y-recovered[0].y)+Math.hypot(recovered[2].x-recovered[3].x,recovered[2].y-recovered[3].y))/2;
  const height=(Math.hypot(recovered[3].x-recovered[0].x,recovered[3].y-recovered[0].y)+Math.hypot(recovered[2].x-recovered[1].x,recovered[2].y-recovered[1].y))/2;
  assert.ok(Math.abs(width/height-1.2)<1e-5,"locked field ratio must remain 1.2: "+width/height);
  const anchor=cylinder3DInverseSurfacePoint(surface,field[0],opts);
  assert.ok(Math.abs(recovered[0].x-anchor.x)<1e-6&&Math.abs(recovered[0].y-anchor.y)<1e-6,"opposite corner stays anchored");
});
