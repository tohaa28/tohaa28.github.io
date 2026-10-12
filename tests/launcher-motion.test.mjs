import {test} from 'node:test';
import assert from 'node:assert/strict';
import {launcherCss,motionMarkup,MOTION_DURATION_MS} from '../tools/launcher-motion.mjs';
test('modern startup intro has real staged brand and print-preview visuals',()=>{
 assert.equal(MOTION_DURATION_MS,2600);
 for(const token of ['gwb-motion-brand','Макетная','gwb-motion-project','gwb-motion-floatcard','gwb-motion-dieline','gwb-motion-progress'])
  assert.ok(motionMarkup.includes(token),token);
 assert.match(launcherCss,/gwbMotionExit 2600ms/);
 assert.match(launcherCss,/gwbFrameReveal 2600ms/);
 assert.match(launcherCss,/@keyframes gwbProjectIn/);
 assert.match(launcherCss,/@media\(max-width:760px\)/);
 assert.match(launcherCss,/pointer-events:none/);
 assert.doesNotMatch(launcherCss,/gwbDoorOpen|gwb-door-stage/);
});
test('animated startup reveals existing UI and preserves close affordance',()=>{
 assert.match(launcherCss,/#gifts-layout-workbench-host\.gwb-opened \.gwb-frame/);
 assert.match(launcherCss,/#gifts-layout-workbench-host\.gwb-opened \.gwb-close/);
 assert.match(launcherCss,/@keyframes gwbFrameClose/);
 assert.match(motionMarkup,/ПОЛЕ НАНЕСЕНИЯ/);
});
