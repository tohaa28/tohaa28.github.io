export const MOTION_DURATION_MS=2600;
export const motionMarkup=String.raw`<div class="gwb-motion-scene" aria-hidden="true">
  <div class="gwb-motion-grid"></div>
  <div class="gwb-motion-glass glass-a"></div><div class="gwb-motion-glass glass-b"></div><div class="gwb-motion-glass glass-c"></div>
  <div class="gwb-motion-brand">
    <div class="gwb-motion-mark">М</div>
    <div class="gwb-motion-copy">
      <span>РЕДАКТОР МАКЕТОВ ДЛЯ GIFTS.RU</span>
      <strong>Макетная</strong>
      <small>От идеи — к готовому макету</small>
    </div>
  </div>
  <div class="gwb-motion-project">
    <div class="gwb-motion-project-head"><span class="gwb-motion-project-dots"><i></i><i></i><i></i></span><span>МАКЕТ · PDF / SVG</span><b>АКТИВНО</b></div>
    <div class="gwb-motion-project-paper">
      <svg class="gwb-motion-dieline" viewBox="0 0 280 320" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M38 83L79 42H202L243 83V271H38V83Z" stroke="#9FADB0" stroke-width="1.3"/>
        <path d="M79 42V20H202V42M38 105H243M65 83V20M216 83V20" stroke="#D1DBDA" stroke-width="1.1"/>
        <rect x="72" y="138" width="138" height="106" rx="2" fill="#EDF7E0" fill-opacity=".55" stroke="#5BABBF" stroke-width="1.8" stroke-dasharray="6 5"/>
        <path d="M91 219L125 178L147 196L181 163L201 190" stroke="#81B315" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="115" cy="158" r="7" stroke="#81B315" stroke-width="1.6"/>
        <path d="M72 152V138H86M196 244H210V230" stroke="#81B315" stroke-width="2.2"/>
      </svg>
      <div class="gwb-motion-field-label"><i></i> ПОЛЕ НАНЕСЕНИЯ</div>
    </div>
  </div>
  <div class="gwb-motion-floatcard">
    <div class="gwb-motion-file-icon"><svg viewBox="0 0 34 34" fill="none" aria-hidden="true"><path d="M6 7H28V27H6V7Z" stroke="#6A9822" stroke-width="1.5"/><path d="M8 22L15 15L19 19L24 13L27 18" stroke="#6A9822" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="#81B315"/></svg></div>
    <div><b>Макет готов</b><span>Вектор · PDF · SVG</span></div>
    <span class="gwb-motion-check">✓</span>
  </div>
  <div class="gwb-motion-footer"><span>МАКЕТНАЯ <i></i> РАБОЧЕЕ ПРОСТРАНСТВО</span><div class="gwb-motion-progress"><b></b></div><span>ЗАПУСК РЕДАКТОРА</span></div>
</div>`;
export const launcherCss=String.raw`#gifts-layout-workbench-host{position:fixed;inset:0;z-index:2147483647;overflow:hidden;background:#f5f8f3;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;isolation:isolate}
#gifts-layout-workbench-host .gwb-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;opacity:.04;transform:scale(1.035);filter:blur(17px);will-change:opacity,transform,filter}
#gifts-layout-workbench-host.gwb-opening .gwb-frame{animation:gwbFrameReveal 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host.gwb-opened .gwb-frame{opacity:1;transform:none;filter:none}
#gifts-layout-workbench-host .gwb-motion-stage{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden;color:#34434a;background:radial-gradient(ellipse at 65% 35%,#edf8d9 0,transparent 46%),radial-gradient(ellipse at 12% 9%,#e7f1e5 0,transparent 36%),#f8faf7;opacity:1;will-change:opacity,transform,filter}
#gifts-layout-workbench-host.gwb-opening .gwb-motion-stage{animation:gwbMotionExit 2600ms cubic-bezier(.23,.8,.23,1) both}
#gifts-layout-workbench-host .gwb-motion-scene{position:absolute;inset:0;overflow:hidden}
#gifts-layout-workbench-host .gwb-motion-grid{position:absolute;inset:0;background-image:linear-gradient(#81b31512 1px,transparent 1px),linear-gradient(90deg,#81b31512 1px,transparent 1px);background-size:76px 76px;mask-image:radial-gradient(ellipse at center,#000 3%,transparent 78%);opacity:.48}
#gifts-layout-workbench-host .gwb-motion-glass{position:absolute;border-radius:32px;border:1px solid #ffffffaf;box-shadow:0 28px 100px #3c564123, inset 1px 1px 2px #ffffffd6;backdrop-filter:blur(10px);will-change:transform,opacity}
#gifts-layout-workbench-host .glass-a{width:44vw;height:61vh;left:-18vw;top:-20vh;background:linear-gradient(145deg,#fff9,#f3f9e5cb 50%,#a9d27091);animation:gwbGlassA 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .glass-b{width:38vw;height:53vh;right:-13vw;bottom:-27vh;background:linear-gradient(145deg,#405059ed,#536a5ee3 62%,#a6c878bd);animation:gwbGlassB 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .glass-c{width:24vw;height:27vh;left:26vw;bottom:-18vh;background:linear-gradient(120deg,#fff,#b2d98a7a);animation:gwbGlassC 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .gwb-motion-brand{position:absolute;left:clamp(6%,13vw,22%);top:44%;display:flex;align-items:center;gap:19px;z-index:5;animation:gwbBrandIn 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .gwb-motion-mark{display:grid;place-items:center;flex:0 0 82px;width:82px;height:82px;border-radius:19px;color:white;background:linear-gradient(145deg,#a9dc42,#81b315 57%,#518607);font-size:51px;font-weight:860;box-shadow:0 24px 62px #648a3070,inset 0 2px 3px #fff6;animation:gwbMarkIn 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .gwb-motion-copy{display:flex;flex-direction:column;align-items:flex-start;gap:7px;white-space:nowrap}
#gifts-layout-workbench-host .gwb-motion-copy span{font-size:10px;letter-spacing:.21em;color:#72867b;font-weight:700;animation:gwbTypeIn 2600ms ease both}
#gifts-layout-workbench-host .gwb-motion-copy strong{font-size:clamp(33px,4.2vw,67px);font-weight:780;letter-spacing:-.055em;line-height:1.03;color:#36474c;animation:gwbTypeIn 2600ms ease both}
#gifts-layout-workbench-host .gwb-motion-copy small{font-size:13px;color:#80908d;animation:gwbTypeIn 2600ms ease both}
#gifts-layout-workbench-host .gwb-motion-project{position:absolute;left:55%;top:15%;z-index:4;width:min(32vw,460px);min-width:290px;height:min(68vh,600px);min-height:320px;overflow:hidden;border:1px solid #e3eade;border-radius:23px;background:linear-gradient(145deg,#fff,#f8fcf6);box-shadow:0 40px 110px #213c3840;animation:gwbProjectIn 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .gwb-motion-project-head{height:50px;padding:0 17px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e3ebe1;color:#81908a;font-size:9px;letter-spacing:.15em;font-weight:700}
#gifts-layout-workbench-host .gwb-motion-project-head b{font-weight:800;color:#739e23}
#gifts-layout-workbench-host .gwb-motion-project-dots{display:flex;gap:5px}
#gifts-layout-workbench-host .gwb-motion-project-dots i{width:6px;height:6px;background:#d0d9d1;border-radius:50%}
#gifts-layout-workbench-host .gwb-motion-project-dots i:first-child{background:#81b315}
#gifts-layout-workbench-host .gwb-motion-project-paper{position:relative;height:calc(100% - 50px);display:grid;place-items:center;background:linear-gradient(90deg,transparent 49.8%,#bfd0c426 50%,transparent 50.2%),linear-gradient(#fcfefb,#eff5ed)}
#gifts-layout-workbench-host .gwb-motion-dieline{width:80%;height:83%;max-height:480px;filter:drop-shadow(0 4px 8px #314b3412)}
#gifts-layout-workbench-host .gwb-motion-dieline rect{animation:gwbFieldScan 2s linear infinite}
#gifts-layout-workbench-host .gwb-motion-field-label{position:absolute;bottom:17px;left:18px;display:flex;align-items:center;gap:8px;color:#71847b;font-size:9px;letter-spacing:.1em;font-weight:700}
#gifts-layout-workbench-host .gwb-motion-field-label i{width:7px;height:7px;border-radius:50%;background:#81b315}
#gifts-layout-workbench-host .gwb-motion-floatcard{position:absolute;left:47%;top:69%;z-index:6;width:254px;display:flex;align-items:center;gap:11px;padding:13px;background:#fffffff2;border:1px solid #ecf2e8;border-radius:15px;box-shadow:0 26px 75px #26413c38;backdrop-filter:blur(12px);animation:gwbFloatIn 2600ms cubic-bezier(.2,.8,.2,1) both}
#gifts-layout-workbench-host .gwb-motion-file-icon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;background:#eef7e4;border-radius:11px}
#gifts-layout-workbench-host .gwb-motion-file-icon svg{width:34px;height:34px}
#gifts-layout-workbench-host .gwb-motion-floatcard>div:nth-child(2){display:flex;flex-direction:column;gap:3px}
#gifts-layout-workbench-host .gwb-motion-floatcard b{font-size:13px;color:#3d5051}
#gifts-layout-workbench-host .gwb-motion-floatcard span:not(.gwb-motion-check){font-size:10px;color:#86938e}
#gifts-layout-workbench-host .gwb-motion-check{margin-left:auto;display:grid;place-items:center;width:24px;height:24px;background:#81b315;border-radius:50%;color:#fff;font-weight:800}
#gifts-layout-workbench-host .gwb-motion-footer{position:absolute;left:7%;right:7%;bottom:7%;z-index:7;display:flex;align-items:center;gap:25px;color:#8a9993;font-size:9px;letter-spacing:.13em;font-weight:750;animation:gwbFooterIn 2600ms ease both}
#gifts-layout-workbench-host .gwb-motion-footer span{white-space:nowrap;display:flex;align-items:center}
#gifts-layout-workbench-host .gwb-motion-footer i{width:20px;height:1px;background:#81b315;margin:0 8px}
#gifts-layout-workbench-host .gwb-motion-progress{flex:1;height:2px;background:#d7e5d4;overflow:hidden}
#gifts-layout-workbench-host .gwb-motion-progress b{display:block;width:0;height:100%;background:linear-gradient(90deg,#81b315,#527b17);animation:gwbProgress 2600ms linear both}
#gifts-layout-workbench-host .gwb-close{position:absolute;right:8px;bottom:8px;z-index:8;width:42px;height:42px;border-radius:50%;border:1px solid #839095;background:#435159;color:#fff;font:28px/1 system-ui;cursor:pointer;box-shadow:0 3px 14px #0004;opacity:0;transform:translateY(8px) scale(.9)}
#gifts-layout-workbench-host.gwb-opened .gwb-close{animation:gwbCloseIn .28s ease-out forwards}
#gifts-layout-workbench-host .gwb-close::after{content:attr(data-tooltip);position:absolute;top:50%;right:calc(100% + 10px);transform:translate(5px,-50%);padding:7px 10px;border-radius:5px;background:#33444b;color:#fff;white-space:nowrap;font:600 12px/1.3 system-ui,sans-serif;box-shadow:0 4px 14px #0003;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .15s ease,transform .15s ease}
#gifts-layout-workbench-host.gwb-opened .gwb-close:is(:hover,:focus-visible)::after{opacity:1;visibility:visible;transform:translate(0,-50%)}
#gifts-layout-workbench-host.gwb-closing .gwb-motion-stage{animation:gwbMotionClose 700ms ease-in both}
#gifts-layout-workbench-host.gwb-closing .gwb-frame{animation:gwbFrameClose 850ms ease-in both}
#gifts-layout-workbench-host.gwb-closing .gwb-close{opacity:0}
@keyframes gwbMotionExit{0%,60%{opacity:1;transform:scale(1);filter:none}82%{opacity:.75}100%{opacity:0;transform:scale(1.04);filter:blur(12px)}}
@keyframes gwbFrameReveal{0%,61%{opacity:.04;transform:scale(1.035);filter:blur(17px)}84%{opacity:.84;transform:scale(1.006);filter:blur(3px)}100%{opacity:1;transform:none;filter:none}}
@keyframes gwbGlassA{0%{opacity:0;transform:translate(-70px,-95px) rotate(-40deg)}17%,66%{opacity:.75;transform:translate(0,0) rotate(-28deg)}100%{opacity:.3;transform:translate(-50px,-15px) rotate(-18deg)}}
@keyframes gwbGlassB{0%{opacity:0;transform:translate(150px,120px) rotate(38deg)}17%,66%{opacity:.88;transform:translate(0,0) rotate(23deg)}100%{opacity:.35;transform:translate(80px,35px) rotate(15deg)}}
@keyframes gwbGlassC{0%{opacity:0;transform:translate(70px,80px) rotate(-35deg)}20%,68%{opacity:.6;transform:translate(0,0) rotate(-15deg)}100%{opacity:0;transform:translate(-40px,-80px) rotate(-5deg)}}
@keyframes gwbBrandIn{0%,11%{opacity:0;transform:translate(-38px,20px) scale(.85);filter:blur(8px)}36%,74%{opacity:1;transform:translate(0,0) scale(1);filter:none}100%{opacity:1;transform:translate(-25px,-5px) scale(.97);filter:none}}
@keyframes gwbMarkIn{0%,12%{transform:scale(.7) rotate(-11deg)}30%{transform:scale(1.06) rotate(0)}50%,100%{transform:scale(1) rotate(0)}}
@keyframes gwbTypeIn{0%,18%{opacity:0;transform:translateY(17px);filter:blur(6px)}41%,100%{opacity:1;transform:none;filter:none}}
@keyframes gwbProjectIn{0%,29%{opacity:0;transform:translate(150px,70px) rotate(16deg) scale(.85);filter:blur(10px)}55%,75%{opacity:1;transform:translate(0,0) rotate(6deg) scale(1);filter:none}100%{opacity:1;transform:translate(-18px,-12px) rotate(0) scale(1.05)}}
@keyframes gwbFloatIn{0%,43%{opacity:0;transform:translate(65px,45px) rotate(-5deg) scale(.8)}66%,80%{opacity:1;transform:translate(0,0) rotate(-3deg) scale(1)}100%{opacity:1;transform:translate(-14px,-17px) rotate(0) scale(1.04)}}
@keyframes gwbFooterIn{0%,13%{opacity:0;transform:translateY(12px)}38%,100%{opacity:1;transform:none}}
@keyframes gwbFieldScan{to{stroke-dashoffset:-44}}
@keyframes gwbProgress{from{width:0}to{width:100%}}
@keyframes gwbCloseIn{from{opacity:0;transform:translateY(8px) scale(.9)}to{opacity:1;transform:none}}
@keyframes gwbMotionClose{from{opacity:1}to{opacity:0;filter:blur(8px)}}
@keyframes gwbFrameClose{from{opacity:1;transform:scale(1);filter:none}to{opacity:.35;transform:scale(.98);filter:blur(7px)}}
@media(max-width:760px){
 #gifts-layout-workbench-host .gwb-motion-brand{left:7%;top:28%;gap:12px}
 #gifts-layout-workbench-host .gwb-motion-mark{width:62px;height:62px;flex-basis:62px;font-size:37px;border-radius:14px}
 #gifts-layout-workbench-host .gwb-motion-copy strong{font-size:clamp(28px,7vw,44px)}
 #gifts-layout-workbench-host .gwb-motion-copy span{font-size:8px;letter-spacing:.09em}
 #gifts-layout-workbench-host .gwb-motion-copy small{font-size:10px}
 #gifts-layout-workbench-host .gwb-motion-project{top:44%;left:34%;width:64vw;min-width:0;height:42vh;min-height:210px}
 #gifts-layout-workbench-host .gwb-motion-floatcard{left:7%;top:70%;width:210px;padding:9px}
 #gifts-layout-workbench-host .gwb-motion-footer{left:18px;right:18px;bottom:4%;gap:12px}
 #gifts-layout-workbench-host .gwb-motion-footer>span:last-child{display:none}
}`;
