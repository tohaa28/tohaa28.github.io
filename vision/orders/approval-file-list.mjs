/**
 * Explicit, user-supplied order list. Strict seven-digit IDs only.
 * This mode is independent of the bounded numeric range enumerator:
 * the older archived orders below 3200000 are not silently dropped.
 * Files and parsed numbers never leave the local test browser.
 */
export const ORDER_LIST_MIN=1_000_000;
export const ORDER_LIST_MAX=9_999_999;
export const ORDER_LIST_MAX_COUNT=1_000_000;
export const ORDER_LIST_MAX_BYTES=20_000_000;

export function explicitListOrderUrl(order){
 if(!Number.isSafeInteger(order)||order<ORDER_LIST_MIN||order>ORDER_LIST_MAX)
  throw Error('MANUAL_ORDER_LIST_ID_INVALID');
 return 'http://testgifts.local/private/order/'+order;
}
export function parseOrderListText(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>ORDER_LIST_MAX_BYTES)
  throw Error('MANUAL_ORDER_LIST_TOO_LARGE');
 const seen=new Set(),numbers=[];
 const rows=text.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/);
 let duplicates=0,empty=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i].trim();
  if(!row){empty++;continue}
  if(!/^[0-9]{7}$/.test(row))
   throw Error('MANUAL_ORDER_LIST_INVALID_LINE_'+(i+1));
  const id=Number(row);
  if(id<ORDER_LIST_MIN||id>ORDER_LIST_MAX)
   throw Error('MANUAL_ORDER_LIST_ID_INVALID');
  if(seen.has(id)){duplicates++;continue}
  if(numbers.length>=ORDER_LIST_MAX_COUNT)
   throw Error('MANUAL_ORDER_LIST_TOO_MANY_NUMBERS');
  seen.add(id);numbers.push(id);
 }
 if(!numbers.length)throw Error('MANUAL_ORDER_LIST_EMPTY');
 return {numbers,duplicates,empty,source_lines:rows.length};
}
