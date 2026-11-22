import { defaultProfile } from '../data/seed.js';
import { validateCareRecord } from './careCloud.js';
import { localDateKey } from './nutrition.js';

// Fictional records only; this client never authenticates or contacts Supabase.
export function createDietitianDemo() {
 const updated_at = new Date().toISOString();
 const date = localDateKey();
 const samples = ['Alex Morgan (Demo)', 'Jordan Lee (Demo)', 'Taylor Reed (Demo)'].map((name,index) => {
  const owner_id = `20000000-0000-4000-8000-00000000000${index+1}`;
  const profile = { ...defaultProfile, name, accountRole:'patient', age:40+index*8, sex:'prefer-not-to-say', heightCm:170, weightKg:70, stage:'G3a', treatment:'not-dialysis', sodiumTargetMg:2000, proteinMinG:56, proteinMaxG:70, allergies:[], intolerances:[], onboarding:{step:'complete',completedAt:updated_at} };
  const entries = index === 2 ? [] : [['Breakfast','08:00','Sample oatmeal',280,10,120],['Lunch','12:30','Sample chicken and rice',460,32,index === 1 ? 2100 : 450]].map(([meal,time,name,calories,protein,sodium],n)=>({id:`demo-${index}-${n}`,source:'custom',date,time,meal,servings:1,customFood:{name,calories,protein,sodium,potassium:null,phosphorus:null,method:'unpackaged',methodLabel:'Fictional demo estimate'}}));
  return { owner_id, updated_at, record:validateCareRecord({profile,entries,dayRecords:{}}) };
 });
 const account={id:'10000000-0000-4000-8000-000000000002',email:'dietitian@example.invalid'};
 const unavailable=async()=>{throw Error('Demo only: invitations and account changes are not sent.');};
 const client={
  own:async()=>({updated_at,record:{profile:{...defaultProfile,name:'Demo dietitian',accountRole:'dietitian',onboarding:{step:'complete',completedAt:updated_at}},entries:[],dayRecords:{}}}),
  rdAccess:async action=>{if(action!=='status')return unavailable();return {approved:true,isAdmin:false,email:account.email,emailVerified:true};},
  shared:async()=>samples.map(row=>({owner_id:row.owner_id,updated_at,profile:row.record.profile})),
  read:async id=>{const row=samples.find(row=>row.owner_id===id);if(!row)throw Error('Demo patient not found.');return structuredClone(row);},
  invitations:async(action='list')=>action==='list'?[]:unavailable(),
  grants:async()=>[],save:unavailable,grant:unavailable,revoke:unavailable,sendInvitationEmail:unavailable,signOut:async()=>{},accessToken:()=>null,
 };
 return {account,client,accessToken:null,demo:true};
}
