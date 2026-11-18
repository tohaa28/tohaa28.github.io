/** Read screenshot candidates from the NATIVE Gifts approval gallery.
 * Live g-gallery moves its image nodes into OPEN shadowRoot. A saved HTML
 * may instead contain a declarative-shadow-DOM template.
 * Only confirmed original <section><picture><img> nodes are considered:
 * nav thumbnails and the designer's profile photo are not attachments.
 */
const imagePath=/^\/maketadjusting\/([0-9]{1,20})\/([0-9]{5,12})\/([0-9]{1,20})\/([^/?#]+)\.(png|jpe?g|webp|gif)$/i;
const safeOriginal=/^[^\\/:*?"<>|\x00-\x1f\x7f]{1,180}$/;
export function verifiedApprovalGalleryImageUrl(raw,{orderNumber,itemId}={}){
 if(typeof raw!=='string'||raw.length>1800||!/^[0-9]{5,12}$/.test(String(orderNumber))||
    !/^[0-9]{1,20}$/.test(String(itemId)))return null;
 try{
  const u=new URL(raw);
  if(u.origin!=='http://files.testgifts.local'||u.search||u.hash||
     u.username||u.password||u.port)return null;
  const m=imagePath.exec(u.pathname);
  if(!m||m[2]!==String(orderNumber)||m[3]!==String(itemId))return null;
  const filename=decodeURIComponent(m[4])+'.'+m[5];
  if(!safeOriginal.test(filename)||/[. ]$/.test(filename))return null;
  return {url:u.href,filename,extension:m[5].toLowerCase()};
 }catch{return null}
}
function galleryOriginals(gallery){
 // Runtime: <g-gallery> has its own rendered Shadow DOM.
 const root=gallery.shadowRoot||
   gallery.querySelector?.('template[shadowrootmode="open"]')?.content;
 return root?[...root.querySelectorAll('section picture img')]:
   [...gallery.querySelectorAll(':scope > img')];
}
export function extractApprovalGalleryImages(messageMain,scope){
 if(!messageMain?.querySelectorAll)return [];
 const found=[],seen=new Set();
 for(const gallery of messageMain.querySelectorAll('g-gallery')){
  for(const image of galleryOriginals(gallery)){
   const raw=image.getAttribute('data-hd')||
     image.getAttribute('src')||image.getAttribute('data-src')||'';
   const candidate=verifiedApprovalGalleryImageUrl(raw,scope);
   if(!candidate||seen.has(candidate.url))continue;
   seen.add(candidate.url);
   const record={source:'native_approval_gallery',attachment_id:null,
     filename:candidate.filename,kind:'image',downloaded:false};
   // The private URL must not appear in a JSON export or a public diagnostic.
   Object.defineProperty(record,'inline_image_url',{value:candidate.url,
     enumerable:false,writable:false});
   found.push(record);
   if(found.length>=40)return found;
  }
 }
 return found;
}
