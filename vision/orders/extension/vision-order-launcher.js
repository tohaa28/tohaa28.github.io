/**
 * Visible launcher on any authorized page of the TWO existing test portals.
 * The scanner remains in one canonical psk /devorders tab so its IndexedDB
 * queue survives navigation between sites and never forks by web origin.
 * No script injection from the site, no cross-origin data access.
 */
(()=>{
 'use strict';
 if(typeof chrome==='undefined'||!chrome.runtime?.sendMessage)return;
 if(location.protocol!=='http:'||
  !['psk.testgifts.local','testgifts.local'].includes(location.hostname)||
  window.top!==window)return;
 if(/^\/devorders(?:\/|$)/.test(location.pathname)&&
   location.hostname==='psk.testgifts.local')return;
 const excluded=/\/(?:login|logout|signin|signout|auth|register|password|captcha)(?:\/|$)/i;
 if(excluded.test(location.pathname))return;
 const id='vision-ai-scan-launcher';
 if(document.getElementById(id))return;
 // Do not show a scanner launcher on a login/unauthorized response.
 // Site authentication is still enforced by normal browser cookies/server.
 const loginScreen=()=>!!document.querySelector(
  'form[name="authform"],form#loginform,input[type="password"]');
 if(loginScreen())return;
 const button=document.createElement('button');
 button.id=id;button.type='button';
 button.textContent='Vision AI · заказы';
 button.title='Открыть или активировать единую вкладку Vision AI со списком заказов';
 button.style.cssText='position:fixed!important;right:14px!important;bottom:14px!important;'+
  'z-index:2147483620!important;border:1px solid #98b2a7!important;'+
  'border-radius:10px!important;background:#24383c!important;color:#f5fff9!important;'+
  'padding:10px 14px!important;box-shadow:0 3px 15px #1118!important;'+
  'font:600 13px system-ui,sans-serif!important;cursor:pointer!important;';
 button.addEventListener('click',async event=>{
  event.preventDefault();event.stopPropagation();
  if(button.disabled)return;
  button.disabled=true;button.textContent='Открытие Vision AI…';
  try{
   const result=await chrome.runtime.sendMessage({op:'vision-open-scanner-v1'});
   if(result?.status!=='VISION_SCANNER_OPENED')
    throw Error(result?.status||'VISION_SCANNER_OPEN_FAILED');
  }catch{
   button.title='Не удалось открыть тестовый сканер: проверьте разрешения расширения';
  }finally{
   button.disabled=false;button.textContent='Vision AI · заказы';
  }
 });
 (document.body||document.documentElement).append(button);
})();
