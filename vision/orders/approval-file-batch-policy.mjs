/**
 * Vision AI: explicit TXT scan archives up to 100 APPROVED orders per ZIP.
 * Unapproved/missing/failed IDs are never part of an archive batch.
 * An earlier size-triggered split is required to stay below the verified
 * in-memory ZIP32 bound of 180 MB (the previous staging size limit).
 * Pure helpers keep recovery and UI behavior consistent.
 */
export const APPROVED_ORDERS_PER_ZIP=100;
export const SOFT_BATCH_PAYLOAD_LIMIT=120_000_000;
export function archivePayloadBytes(rows){
 if(!Array.isArray(rows))throw Error('VISION_BATCH_ROWS_INVALID');
 let total=0;
 for(const row of rows){
  if(!Array.isArray(row?.transfers))
   throw Error('VISION_BATCH_ROW_TRANSFERS_INVALID');
  for(const transfer of row.transfers)
   total+=transfer?.data?.byteLength||0;
 }
 return total;
}
export function selectArchiveRows(rows){
 if(!Array.isArray(rows))throw Error('VISION_BATCH_ROWS_INVALID');
 return rows.slice(0,APPROVED_ORDERS_PER_ZIP);
}
export function archiveBatchDue(rows){
 return rows.length>=APPROVED_ORDERS_PER_ZIP||
  (rows.length>0&&archivePayloadBytes(rows)>=SOFT_BATCH_PAYLOAD_LIMIT);
}
