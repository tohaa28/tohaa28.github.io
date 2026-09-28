import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractFieldLabels,extractAnnotationFieldLabels,bindFieldLabels,auditFieldLabels} from '../assets/pdf-field-labels.mjs';
const fields=[{x:20,y:20,w:30,h:20,page:0},{x:20,y:80,w:30,h:20,page:0}];
const labels=[{x:22,y:74,w:20,h:4,text:'лицо [print1]',name:'лицо',printId:'print1'},{x:22,y:14,w:20,h:4,text:'оборот [print2]',name:'оборот',printId:'print2'}];
test('PDF geometry wins over all array orders and print number order',()=>{
  for(const fs of [fields,[...fields].reverse()])for(const ls of [labels,[...labels].reverse()]){
    const result=bindFieldLabels(fs,ls);
    assert.equal(result.find(f=>f.y===20).pdfPlace,'оборот');
    assert.equal(result.find(f=>f.y===80).pdfPlace,'лицо');
    for(const places of [['лицо','оборот'],['оборот','лицо']])assert.equal(auditFieldLabels(result,{places}).ok,true);
  }
});
test('equal counts cannot validate missing, wrong or ambiguous labels',()=>{
  assert.equal(auditFieldLabels(bindFieldLabels(fields,[]),{places:['лицо','оборот']}).ok,false);
  const bound=bindFieldLabels(fields,labels);
  assert.equal(auditFieldLabels(bound,{places:['лицо','сбоку']}).ok,false);
  assert.equal(auditFieldLabels(bound,{places:['лицо [print2]','оборот [print1]']}).ok,false);
  assert.equal(auditFieldLabels(bound,{places:['лицо','оборот'],placeCountReliable:false}).ok,false);
  assert.equal(bindFieldLabels(fields,[{...labels[0],y:58}]).some(f=>f.labelStatus==='matched'),false);
  assert.equal(bindFieldLabels(fields,[...labels,labels[0]])[1].labelStatus,'ambiguous');
  assert.equal(auditFieldLabels(bindFieldLabels(fields,labels.map(l=>({...l,printId:'print1'}))),{places:['лицо','оборот']}).ok,false);
});
test('fragmented Cyrillic text uses coordinates, crop and page rotation',()=>{
  const items=[{str:'[print1]',width:40,height:10,transform:[10,0,0,10,42,100]},{str:'лицо',width:20,height:10,transform:[10,0,0,10,20,100]}];
  const viewport={convertToViewportPoint:(x,y)=>[y-10,x-5]};
  const labels=extractFieldLabels({items},viewport);
  assert.equal(labels.length,1); assert.equal(labels[0].name,'лицо');assert.equal(labels[0].printId,'print1');
  assert.ok(Math.abs(labels[0].x-88*25.4/72)<1e-9);
  assert.equal(extractFieldLabels({items:[{...items[0],str:'print1 print2'}]},viewport).length,0);
});
test('distant labels and duplicate order names require review',()=>{
  assert.equal(bindFieldLabels(fields,[{...labels[0],x:200}]).some(f=>f.labelStatus==='matched'),false);
  assert.equal(auditFieldLabels(bindFieldLabels(fields,labels),{places:['лицо','лицо']}).ok,false);
});
test('plain names and split words do not need an order-derived label',()=>{
  const viewport={convertToViewportPoint:(x,y)=>[x,100-y]};
  const items=[{str:'ли',width:10,height:10,transform:[10,0,0,10,20,90]},{str:'цо',width:10,height:10,transform:[10,0,0,10,30,90]}];
  const extracted=extractFieldLabels({items},viewport);
  assert.equal(extracted[0].name,'лицо');
  assert.equal(extracted[0].printId,null);
});
test('numeric PDF labels map to numbered order places, not array order',()=>{
  const PT_PER_MM=72/25.4;
  const viewport={convertToViewportPoint:(x,y)=>[x*PT_PER_MM,y*PT_PER_MM]};
  const content={items:[
    {str:'2',width:4,height:4,transform:[4,0,0,4,22,82]},
    {str:'1',width:4,height:4,transform:[4,0,0,4,22,22]}
  ]};
  const extracted=extractFieldLabels(content,viewport);
  assert.deepEqual(extracted.map(x=>x.fieldIndex).sort((a,b)=>a-b),[1,2]);

  const bound=bindFieldLabels(fields,extracted);
  const audit=auditFieldLabels(bound,{places:['лицо','оборот'],placeCountReliable:true});
  assert.equal(audit.ok,true);
  assert.equal(bound.find(f=>f.fieldIndex===1).orderPlace,'лицо');
  assert.equal(bound.find(f=>f.fieldIndex===2).orderPlace,'оборот');

  const reversed=bindFieldLabels([...fields].reverse(),[...extracted].reverse());
  assert.equal(auditFieldLabels(reversed,{places:['лицо','оборот'],placeCountReliable:true}).ok,true);
  assert.equal(reversed.find(f=>f.fieldIndex===1).orderPlace,'лицо');
  assert.equal(reversed.find(f=>f.fieldIndex===2).orderPlace,'оборот');

  const duplicate=bindFieldLabels(fields,[
    {x:22,y:22,w:4,h:4,text:'1',name:'1',fieldIndex:1,confidence:2.5},
    {x:22,y:82,w:4,h:4,text:'1',name:'1',fieldIndex:1,confidence:2.5}
  ]);
  assert.equal(auditFieldLabels(duplicate,{places:['лицо','оборот'],placeCountReliable:true}).ok,false);
});

test('same label from text and annotation is de-duplicated, not a hidden conflict',()=>{
  const box=[{x:20,y:20,w:30,h:20}];
  const textLabel={x:22,y:22,w:4,h:4,text:'1',name:'1',fieldIndex:1,confidence:2.75,source:'numeric-item'};
  const annotationLabel={...textLabel,confidence:2.9,source:'annotation'};
  const result=bindFieldLabels(box,[textLabel,annotationLabel]);
  assert.equal(result[0].labelStatus,'matched');
  assert.equal(result[0].fieldIndex,1);
  assert.equal(result[0].labelSource,'annotation');

  const trueConflict=bindFieldLabels(box,[textLabel,{...textLabel,x:23,source:'numeric-item'}]);
  assert.equal(trueConflict[0].labelStatus,'ambiguous');
});

test('annotation numbers map to fields',()=>{
  const k=72/25.4;
  const viewport={
    convertToViewportPoint:(x,y)=>[x*k,y*k],
    convertToViewportRectangle:r=>r.map(v=>v*k)
  };
  const annotations=[
    {contentsObj:{str:'1'},rect:[22,22,26,26]},
    {contents:'2.',rect:[22,82,26,86]}
  ];
  const labels=extractAnnotationFieldLabels(annotations,viewport);
  assert.deepEqual(labels.map(x=>x.fieldIndex),[1,2]);
  const bound=bindFieldLabels(fields,labels);
  const audit=auditFieldLabels(bound,{places:[],placeCount:0,placeCountReliable:false});
  assert.equal(audit.ok,true);
  assert.equal(audit.mode,'pdf-numbered-only');
});

test('standalone numeric items survive line merging and punctuation',()=>{
  const PT_PER_MM=72/25.4;
  const viewport={convertToViewportPoint:(x,y)=>[x*PT_PER_MM,y*PT_PER_MM]};
  const content={items:[
    {str:'1.',width:4,height:4,transform:[4,0,0,4,22,22]},
    {str:'Сумка',width:20,height:4,transform:[4,0,0,4,28,22]},
    {str:'2',width:4,height:4,transform:[4,0,0,4,22,82]}
  ]};
  const extracted=extractFieldLabels(content,viewport);
  const numeric=extracted.filter(x=>Number.isInteger(x.fieldIndex));
  assert.deepEqual(numeric.map(x=>x.fieldIndex).sort((a,b)=>a-b),[1,2]);
  assert.equal(numeric.every(x=>x.source==='numeric-item'),true);
  const bound=bindFieldLabels(fields,extracted);
  const audit=auditFieldLabels(bound,{places:[],placeCount:0,placeCountReliable:false});
  assert.equal(audit.ok,true);
  assert.equal(audit.mode,'pdf-numbered-only');
});

test('numeric frame labels inherit semantic names from distant print table',()=>{
  const boxes=[{x:20,y:20,w:30,h:20},{x:80,y:20,w:30,h:20}];
  const labels=[
    {x:22,y:22,w:3,h:3,text:'1',name:'1',fieldIndex:1,printId:null,confidence:2.75,source:'numeric-item'},
    {x:82,y:22,w:3,h:3,text:'2',name:'2',fieldIndex:2,printId:null,confidence:2.75,source:'numeric-item'},
    {x:10,y:150,w:30,h:4,text:'лицо [print1]',name:'лицо',fieldIndex:null,printId:'print1',confidence:3,source:'assembled-line'},
    {x:50,y:150,w:30,h:4,text:'оборот [print2]',name:'оборот',fieldIndex:null,printId:'print2',confidence:3,source:'assembled-line'}
  ];
  const bound=bindFieldLabels(boxes,labels);
  assert.equal(bound[0].pdfPlace,'лицо');
  assert.equal(bound[0].printId,'print1');
  assert.equal(bound[1].pdfPlace,'оборот');
  assert.equal(bound[1].printId,'print2');

  const entry={
    places:['оборот','лицо'],
    placeBindings:[
      {name:'лицо',taskId:'1',printId:'print1',index:1,method:'LM1: Лазерная гравировка,1',source:'order-application-id+makets-popup'},
      {name:'оборот',taskId:'2',printId:'print2',index:2,method:'LM1: Лазерная гравировка,2',source:'order-application-id+makets-popup'}
    ],
    placeCountReliable:true
  };
  const audit=auditFieldLabels(bound,entry);
  assert.equal(audit.ok,true);
  assert.equal(bound[0].orderPlace,'лицо');
  assert.equal(bound[1].orderPlace,'оборот');
  assert.equal(bound[0].orderMethod,'LM1: Лазерная гравировка,1');
  assert.equal(bound[1].orderMethod,'LM1: Лазерная гравировка,2');
});

test('explicit page place numbers map PDF digits to exact names, not array order',()=>{
  const boxes=[{x:20,y:20,w:30,h:20},{x:20,y:80,w:30,h:20}];
  const numeric=[
    {x:22,y:22,w:4,h:4,text:'1',name:'1',fieldIndex:1,confidence:2.9,source:'numeric-item'},
    {x:22,y:82,w:4,h:4,text:'2',name:'2',fieldIndex:2,confidence:2.9,source:'numeric-item'}
  ];
  const bound=bindFieldLabels(boxes,numeric);
  const entry={
    places:['дно','боковая сторона'],
    placeBindings:[
      {name:'боковая сторона',index:1,source:'makets-popup-place'},
      {name:'дно',index:2,source:'makets-popup-place'}
    ],
    placeCountReliable:true
  };
  const audit=auditFieldLabels(bound,entry);
  assert.equal(audit.ok,true);
  assert.equal(bound.find(f=>f.fieldIndex===1).orderPlace,'боковая сторона');
  assert.equal(bound.find(f=>f.fieldIndex===2).orderPlace,'дно');
  assert.equal(bound.find(f=>f.fieldIndex===1).orderPlaceBindingSource,'makets-popup-place');
});

test('complete numeric PDF fields are usable when order has no place names',()=>{
  const boxes=[{x:20,y:20,w:30,h:20,page:0},{x:20,y:80,w:30,h:20,page:0}];
  const numeric=[
    {x:22,y:22,w:4,h:4,text:'1',name:'1',fieldIndex:1,confidence:2.5},
    {x:22,y:82,w:4,h:4,text:'2',name:'2',fieldIndex:2,confidence:2.5}
  ];
  const bound=bindFieldLabels(boxes,numeric);
  const audit=auditFieldLabels(bound,{places:[],place:'',placeCount:0,placeCountReliable:false});
  assert.equal(audit.ok,true);
  assert.equal(audit.mode,'pdf-numbered-only');
  assert.equal(audit.placeCount,2);
  assert.deepEqual(audit.numberedFields,[1,2]);
  assert.equal(bound.find(f=>f.fieldIndex===1).orderPlace,'Место 1');
  assert.equal(bound.find(f=>f.fieldIndex===2).orderPlace,'Место 2');

  const missing=bindFieldLabels(boxes,[numeric[0]]);
  const missingAudit=auditFieldLabels(missing,{places:[],placeCount:0,placeCountReliable:false});
  assert.equal(missingAudit.ok,false);
  assert.equal(missingAudit.mode,'pdf-numbered-incomplete');

  const outside=bindFieldLabels([boxes[0]],[{...numeric[0],x:5,y:5}]);
  assert.notEqual(outside[0].labelStatus,'matched');
});

test('explicit print label wins over unrelated nearby plain text',()=>{
  const box=[{x:20,y:20,w:30,h:20,page:0}];
  const strong={x:22,y:16,w:20,h:4,text:'лицо [print1]',name:'лицо',printId:'print1',confidence:3};
  const weak={x:24,y:18,w:18,h:4,text:'Брелок',name:'Брелок',printId:null,confidence:0};
  const bound=bindFieldLabels(box,[weak,strong]);
  assert.equal(bound[0].labelStatus,'matched');
  assert.equal(bound[0].pdfPlace,'лицо');
  assert.equal(auditFieldLabels(bound,{places:['лицо']}).ok,true);
  const duplicateStrong=bindFieldLabels(box,[strong,{...strong,text:'лицо [print2]',printId:'print2'}]);
  assert.equal(duplicateStrong[0].labelStatus,'ambiguous');
});

test('nearby competing rectangles are ambiguous; pages bind separately',()=>{
  const boxes=[{x:0,y:0,w:10,h:10},{x:20,y:0,w:10,h:10}];
  const label={...labels[0],x:13,y:2,w:4,h:4};
  assert.deepEqual(bindFieldLabels(boxes,[label]).map(f=>f.labelStatus),['ambiguous','ambiguous']);
  const first=bindFieldLabels([fields[0]],[labels[1]]).map(f=>({...f,page:0}));
  const second=bindFieldLabels([fields[1]],[labels[0]]).map(f=>({...f,page:1}));
  assert.equal(auditFieldLabels([...second,...first],{places:['оборот','лицо']}).ok,true);
});
