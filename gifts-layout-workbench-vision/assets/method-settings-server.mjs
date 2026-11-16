// Central method settings backend, shared by every operator. GitHub Pages is
// static: reading is public, and writing requires a GitHub Contents-write PAT.
// Never bundle, persist or log a credential in the distributed application.
export const METHOD_SETTINGS_SOURCE='https://raw.githubusercontent.com/tohaa28/tohaa28.github.io/gifts-layout-workbench-mockups-source/method-settings.json';
export const METHOD_SETTINGS_PUBLISHED='https://tohaa28.github.io/gifts-layout-workbench-mockups/method-settings.json';
export const METHOD_SETTINGS_API='https://api.github.com/repos/tohaa28/tohaa28.github.io/contents/method-settings.json';
export const METHOD_SETTINGS_BRANCH='gifts-layout-workbench-mockups-source';
const stamp=()=>'?_='+Date.now();
const bytesToBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const base64ToText=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g,'')),c=>c.charCodeAt(0)));
const signature=value=>JSON.stringify(value);
export async function fetchMethodSettings({fetcher=globalThis.fetch}={}){
 let lastError;
 for(const url of [METHOD_SETTINGS_SOURCE,METHOD_SETTINGS_PUBLISHED]){
   try{
     const response=await fetcher(url+stamp(),{cache:'no-store'});
     if(!response.ok)throw Error('HTTP '+response.status);
     const value=await response.json();
     if(value?.version!==1||!value?.methods||typeof value.methods!=='object'||Array.isArray(value.methods))throw Error('Неправильный формат настроек сервера.');
     return value;
   }catch(error){lastError=error;}
 }
 throw Error('Не удалось получить общие настройки с сервера: '+String(lastError?.message||lastError));
}
export async function commitMethodSettings(value,{token,previous,validate,fetcher=globalThis.fetch}={}){
 if(typeof token!=='string'||!token.trim())throw Error('Для записи на сервер требуется GitHub token с правами Contents: Read and write.');
 if(typeof validate!=='function')throw Error('Не задана проверка формата настроек.');
 const next=validate(value),prior=validate(previous);
 const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token.trim(),
   'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
 const get=await fetcher(METHOD_SETTINGS_API+'?ref='+encodeURIComponent(METHOD_SETTINGS_BRANCH)+'&t='+Date.now(),{headers,cache:'no-store'});
 if(!get.ok)throw Error(get.status===401||get.status===403?'GitHub отклонил токен или доступ к репозиторию.':'Не удалось прочитать актуальную версию настроек GitHub (HTTP '+get.status+').');
 const meta=await get.json();
 if(!meta.sha||typeof meta.content!=='string')throw Error('GitHub не вернул версию серверного файла.');
 const remote=validate(JSON.parse(base64ToText(meta.content)));
 if(signature(remote)!==signature(prior))throw Error('Настройки уже изменились на сервере другим администратором. Обновите их и повторите изменения; перезапись отменена.');
 const response=await fetcher(METHOD_SETTINGS_API,{
   method:'PUT',headers,
   body:JSON.stringify({
     message:'Update shared print-method requirements',
     branch:METHOD_SETTINGS_BRANCH,sha:meta.sha,
     content:bytesToBase64(new TextEncoder().encode(JSON.stringify(next,null,2)+'\n'))
   })
 });
 if(!response.ok){
   if(response.status===409||response.status===422)throw Error('Конфликт версий GitHub: обновите настройки и повторите сохранение.');
   if(response.status===401||response.status===403)throw Error('GitHub отклонил токен или недостаточно прав Contents: Read and write.');
   throw Error('GitHub не сохранил общие настройки (HTTP '+response.status+').');
 }
 const result=await response.json();
 if(!result?.commit?.sha)throw Error('GitHub не подтвердил сохранение настроек.');
 return {settings:next,commit:result.commit.sha};
}
