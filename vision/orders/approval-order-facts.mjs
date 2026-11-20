/**
 * Local test order facts. This is an intentionally bounded DOM snapshot, NOT
 * hidden input/password/cookie scraping. Customer names are preserved in the
 * PRIVATE evidence file on user request. Never place these records in CI logs.
 */
const limit=(value,n=12000)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,n);
const txt=(root,selector,n)=>limit(root?.querySelector?.(selector)?.textContent,n);
const val=(root,selector,n)=>limit(root?.querySelector?.(selector)?.value,n);
const id=value=>/^\d{1,20}$/.test(value||'')?value:null;
const safeLink=(raw,pattern)=>{
 try{
  const u=new URL(raw,'http://testgifts.local');
  return u.origin==='http://testgifts.local'&&!u.search&&
   !u.username&&!u.password&&pattern.test(u.pathname)?u.href:null;
 }catch{return null}
};
export function extractOrderFacts(doc,orderNumber){
 const root=doc?.querySelector?.('#j_cart_host');
 const number=id(String(orderNumber||''))||null;
 const date=txt(root,'.cart-header-date',160);
 const header=txt(root,'.cart-header-number',3200);
 const order={
  order_number:number,
  internal_order_id:id(root?.getAttribute?.('data-orderid')),
  order_date_display:date||null,
  header_text:header||null,
  customer_display:txt(root,'.cart-header-number .note',1500)||null,
  header_full_text:txt(root,'.cart-header',4000)||null,
  order_status_timeline:limit([...root?.querySelectorAll?.('.cart-log')||[]]
    .map(n=>n.textContent).join(' | '),8000)||null,
  source:'current_native_order_dom',
  facts_verified_with_customer_system:false
 };
 const articles=[];
 for(const li of root?.querySelectorAll?.('li[data-itemid]')||[]){
  if(articles.length>=250)break;
  const item=id(li.getAttribute('data-itemid'));
  if(!item)continue;
  const product=li.querySelector('.cart-tbl-id');
  const code=txt(product,'a.cart-tbl-name',180).replace(/^Артикул\s*/i,'')||null;
  const title=txt(product,'.cart-tbl-lbl.vsbl-dk-lg',800)||
    txt(product,'.cart-tbl-lbl',800)||null;
  const productLink=safeLink(product?.querySelector('a.cart-tbl-name')?.getAttribute('href'),
    /^\/id\/\d+\/?$/);
  const print=li.querySelector('.cart-tbl-imp');
  const quantity=txt(li,'.cart-tbl-qty',2400)||null;
  const article={
   item_id:item,article_code:code,product_name:title,
   product_page:productLink,
   product_description_text:txt(product,'.cart-tbl-id',1200)||limit(product?.textContent,1400),
   quantity_and_pricing_text:quantity,
   imprint_and_technical_requirements_text:limit(print?.textContent,14000)||null,
   order_item_status_text:limit(li.querySelector('.tbl-col.no-wrp')?.textContent,800)||null,
   drawtask_ids:limit(li.getAttribute('data-drawtaskids'),350)||null,
   native_approval_badge:txt(li,'a.j_maketadjusting .gifts-badge',50)||null,
   fact_source:'native_order_item_dom'
  };
  articles.push(article);
 }
 return {
  schema:'printcheck.vision.private-order-facts.v1',
  order,articles,
  capture_status:root&&number?'ORDER_DOM_CAPTURED':'ORDER_DOM_INCOMPLETE',
  private_local_only:true,training_ready:false,production_approved:false
 };
}
