import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
const N8N='https://n8n.iatende.sbs';
const KEY=process.env.N8N_PUBLIC_API;
const sb=createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const hdr={'X-N8N-API-KEY':KEY,accept:'application/json'};
const STORE='st-cae5b9ed-d4e6-405f-9151-1c80542992ec';
const CHANNEL='6ab8e2d9-9173-4635-b894-c9d8b1e8d7e9';

// template lead for store/channel
const {data:tmpl}=await sb.from('crm_leads').select('*').eq('phone','+558899990507').limit(1).single();

const cases=[
  'Quero comprar o iPhone 16 Pro 256GB.',
  'Tem iPhone 15 disponível?',
  'Queria o 16 Pro Max 256, qual o valor?'
];

async function poll(convId, since){
  const deadline=Date.now()+180000; let count=0,last=Date.now(),rows=[];
  while(Date.now()<deadline){
    const {data}=await sb.from('crm_messages').select('content,created_at,direction,sender_type').eq('conversation_id',convId).gte('created_at',since).eq('direction','outbound').eq('sender_type','ai_inbound').order('created_at');
    rows=data||[];
    if(rows.length!==count){count=rows.length;last=Date.now();}
    if(rows.length>0 && Date.now()-last>=12000) break;
    await new Promise(r=>setTimeout(r,4000));
  }
  return rows;
}

for(const [i,text] of cases.entries()){
  const uniq=`${Date.now().toString().slice(-8)}${i}`;
  const leadId=`xtr-${uniq}-${crypto.randomUUID().slice(0,6)}`;
  const jid=`5588${uniq}@s.whatsapp.net`;
  const convId=crypto.randomUUID();
  await sb.from('crm_leads').insert({id:leadId,store_id:STORE,phone:`+5588${uniq}`,name:`XTR ${i}`,contact_id:jid,entity_id:tmpl.entity_id,source_channel_id:CHANNEL,tags:['repasse_v2_scenario_audit']});
  await sb.from('crm_conversations').insert({id:convId,store_id:STORE,lead_id:leadId,channel_id:CHANNEL,talk_id:jid,status:'ai_handling',ai_enabled:true});
  const now=Date.now();
  const payload={event:'inbound_message',instanceName:String(tmpl.entity_id||'crm'),type:'text',lead_id:leadId,store_id:STORE,
    body:{sender:jid,message:{messageTimestamp:now,text,senderName:`XTR ${i}`,messageid:`x-${now}`,fromMe:false,edited:'',owner:'',chatid:jid,content:text},BaseUrl:'x',EventType:'messages',chatid:jid,mediaType:''},
    lead:{summary_short:'',instagram_user_id:null,instagram_username:null},
    lead_detail:{id:leadId,store_id:STORE,phone:`+5588${uniq}`,name:`XTR ${i}`,contact_id:jid,is_customer:false,purchase_count:0,attendance_owner:'ia',conversation_status:'em_atendimento_ia',sales_stage:'entrada'},
    media:{URL:null,mimetype:null,mediaKey:null},
    meta:{source:'repasse_v2_scenario_audit',conversation_id:convId,channel_id:CHANNEL,message_id:`x-${now}`,scenario_id:`xtr-${i}`,scenario_category:'extraction',scenario_turn:1},
    raw_inbound:{source:'repasse_v2_scenario_audit',message:{type:'text',messageType:'conversation',id:`x-${now}`}}};
  const since=new Date().toISOString();
  await fetch(`${N8N}/webhook/repasse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const rows=await poll(convId,since);
  // fetch the execution to read buffer + router + extracted state
  await new Promise(r=>setTimeout(r,1500));
  const ex=await (await fetch(`${N8N}/api/v1/executions?workflowId=Cr4fPWe0prwS6XjI&limit=4&includeData=false`,{headers:hdr})).json();
  let bufSeen='?',routerIntent='?',extracted='?';
  for(const e of ex.data){
    const d=await (await fetch(`${N8N}/api/v1/executions/${e.id}?includeData=true`,{headers:hdr})).json();
    const run=d.data?.resultData?.runData||{};
    const wh=run['Webhook']?.[0]?.data?.main?.[0]?.[0]?.json;
    if(wh?.body?.body?.message?.text!==text) continue;
    bufSeen=run['Load Buffer Final']?.[0]?.data?.main?.[0]?.[0]?.json?.buffer?.message_buffered;
    const r=run['Router Agent']?.[0]?.data?.main?.[0]?.[0]?.json;
    routerIntent=(JSON.stringify(r?.output||r?.text||'').match(/intent_primary"?:\s*"?([a-z_]+)/i)||[])[1]||'(n/a)';
    const pm=run['Parse Memory']?.[0]?.data?.main?.[0]?.[0]?.json;
    const mem=pm?.memory||pm?.state||pm;
    extracted=JSON.stringify({model:mem?.model_interest??mem?.target_model??mem?.modelo??mem?.product_model,cap:mem?.capacity??mem?.capacidade,nba:mem?.next_best_action}).slice(0,160);
    break;
  }
  console.log(`\n=== CASE ${i}: "${text}"`);
  console.log('  buffer visto pela IA:', JSON.stringify(bufSeen));
  console.log('  router intent_primary:', routerIntent);
  console.log('  estado extraído:', extracted);
  console.log('  RESPOSTA(s):', JSON.stringify(rows.map(r=>r.content)));
  // cleanup
  await sb.from('crm_messages').delete().eq('conversation_id',convId);
  await sb.from('crm_conversations').delete().eq('id',convId);
  await sb.from('crm_leads').delete().eq('id',leadId);
}
console.log('\nDONE');
