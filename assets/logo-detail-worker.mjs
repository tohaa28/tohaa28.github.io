import {analyzeDetail} from './logo-detail-engine.mjs?v=20261006-3';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,result:analyzeDetail({...data,data:new Uint8ClampedArray(data.rgba)})});}catch(error){self.postMessage({id:data.id,error:String(error.message||error)});}};
