import { useState, useEffect, useCallback } from "react";

const DAYS_NL=['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const DAYS_SHORT=['Zo','Ma','Di','Wo','Do','Vr','Za'];
const MONTHS_NL=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const MONTHS_SHORT=['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
function getISOWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-ys)/86400000)+1)/7);}
function fmtDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function getTodayStr(){return fmtDate(new Date());}
function getTodayKey(){return `dailyv1:${getTodayStr()}`;}
function getMondayOfWeek(date){const d=new Date(date);d.setHours(0,0,0,0);const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));return d;}
function getWeekDates(date){const mon=getMondayOfWeek(date);return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});}
function getMonthDates(date){const days=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();return Array.from({length:days},(_,i)=>new Date(date.getFullYear(),date.getMonth(),i+1));}

const TDEE=2080;
const WALK_BURN=130;
const SPORT_SCHEDULE={
  0:{emoji:'🏓',name:'Padel',detail:'1u15 padel',burn:530},
  1:{emoji:'🚶',name:'Lange wandeling',detail:'Rustige wandeling ~90 min',burn:320},
  2:{emoji:'🎾',name:'Tennis',detail:'Single tennis — 1u30',burn:630},
  3:{emoji:'🏃',name:'Hardlopen',detail:'6.9 km @ 10 km/h',burn:490},
  4:{emoji:'💪',name:'Krachtsport',detail:'Fitness — 50 min',burn:300},
  5:{emoji:'🏊',name:'Zwemmen',detail:'50 min schoolslag medium',burn:420},
  6:{emoji:'🏃',name:'Hardlopen / Fitness',detail:'Hardlopen of fitness — 50 min',burn:365},
};
const SNACKS=[{id:'wortel',emoji:'🥕',label:'Wortel',kcal:35},{id:'rijstwafel',emoji:'🍫',label:'Rijstwafel + chocola',kcal:80},{id:'paprika',emoji:'🫑',label:'Paprika',kcal:25},{id:'framboos',emoji:'🍓',label:'Framboos + chocola',kcal:60}];
const OFFICE_DAYS=new Set([1,2,4]);
const HAPPY_EMOJI=['','😔','😐','🙂','😊','🥰'];
const HAPPY_LBL=['','Slecht','Matig','Oké','Goed','Geweldig'];
const C={bg:'#F0EAE0',card:'#FDFAF6',dark:'#1A3628',accent:'#C1572F',gold:'#B8872A',green:'#2C7A4F',muted:'#7A7060',border:'#E2DAD0',soft:'#F5F1EA',text:'#1A1A16'};
const MK={ontbijt:250,lunch:560,avondeten:700};

const defaultData=()=>({sleep:{hours:'',mouth:false,snurkApp:false,sleepApp:false,reading:false},morning:{water:false,sunlight:false,exercise:false,meditation:false,breakfast:false,wimHof:false},sport:false,pauseWalk:false,nutrition:{ontbijt:false,lunch:false,avondeten:false,snacks:[],customFoods:[],beer:0},cognitive:{omega3:false,vitD:false,magnesium:false,coldShower:false,water2L:false,noScreenBed:false,deepLearn:false},screen:'',called:{broer:false,ouders:false},happiness:0,notes:'',thoughts:''});

function migrateData(d){
  if(!d)return defaultData();
  if(typeof d.nutrition?.meals==='boolean'){d.nutrition.ontbijt=d.nutrition.meals;d.nutrition.lunch=d.nutrition.meals;d.nutrition.avondeten=d.nutrition.meals;delete d.nutrition.meals;}
  if(!d.nutrition.customFoods)d.nutrition.customFoods=[];
  if(!d.cognitive)d.cognitive={omega3:false,vitD:false,magnesium:false,coldShower:false,water2L:false,noScreenBed:false,deepLearn:false};
  if(d.cognitive.vitD===undefined)d.cognitive.vitD=false;
  if(d.cognitive.magnesium===undefined)d.cognitive.magnesium=false;
  if(!d.sleep.reading)d.sleep.reading=false;
  if(d.thoughts===undefined)d.thoughts='';
  return d;
}

function calcIntake(d){
  if(!d)return 0;
  const m=(d.nutrition.ontbijt?MK.ontbijt:0)+(d.nutrition.lunch?MK.lunch:0)+(d.nutrition.avondeten?MK.avondeten:0);
  const s=(d.nutrition.snacks||[]).reduce((acc,id)=>{const sn=SNACKS.find(x=>x.id===id);return acc+(sn?sn.kcal:0);},0);
  const c=(d.nutrition.customFoods||[]).reduce((acc,f)=>acc+(parseInt(f.kcal)||0),0);
  const b=(d.nutrition.beer||0)*150;
  return m+s+c+b;
}

function calcBurn(d,dateObj){
  if(!d)return{tdee:TDEE,sport:0,walk:0,total:TDEE};
  const dow=dateObj.getDay(),wk=getISOWeek(dateObj),isA=wk%2===0;
  const isWorkFri=dow===5&&isA,isFreeFri=dow===5&&!isA;
  const hasSport=!isFreeFri&&(dow!==5||isWorkFri);
  const isPauseDay=(dow>=1&&dow<=4)||isWorkFri;
  const sportBurn=(hasSport&&d.sport)?(SPORT_SCHEDULE[dow]?.burn||0):0;
  const walkBurn=(isPauseDay&&d.pauseWalk)?WALK_BURN:0;
  return{tdee:TDEE,sport:sportBurn,walk:walkBurn,total:TDEE+sportBurn+walkBurn};
}

function dayScore(d,dateObj){
  if(!d)return null;
  const dow=dateObj.getDay(),isOfficDay=OFFICE_DAYS.has(dow),wk=getISOWeek(dateObj),isA=wk%2===0;
  const isWorkFri=dow===5&&isA,isFreeFri=dow===5&&!isA,hasSport=!isFreeFri&&(dow!==5||isWorkFri),isPauseDay=(dow>=1&&dow<=4)||isWorkFri;
  let done=0,total=0;
  total++;if(parseFloat(d.sleep?.hours||0)>6)done++;
  total++;if(d.sleep?.reading)done++;
  const mKeys=['water','sunlight','exercise','meditation','breakfast',...(!isOfficDay?['wimHof']:[])];
  total+=mKeys.length;done+=mKeys.filter(k=>d.morning?.[k]).length;
  if(hasSport){total++;if(d.sport)done++;}
  if(isPauseDay){total++;if(d.pauseWalk)done++;}
  total++;if(d.happiness>0)done++;
  total++;if(d.screen!==''&&parseFloat(d.screen||99)<2)done++;
  const cogKeys=['omega3','vitD','magnesium','coldShower','water2L','noScreenBed','deepLearn'];
  total+=cogKeys.length;done+=cogKeys.filter(k=>d.cognitive?.[k]).length;
  return Math.round((done/total)*100);
}

function Check({on,toggle,children}){return(<div onClick={toggle} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${C.border}`,cursor:'pointer'}}><div style={{width:22,height:22,borderRadius:6,flexShrink:0,border:`2px solid ${on?C.green:C.border}`,background:on?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .18s'}}>{on&&<span style={{color:'white',fontSize:13,fontWeight:700}}>✓</span>}</div><span style={{fontFamily:'DM Sans,sans-serif',fontSize:14,color:on?C.muted:C.text,textDecoration:on?'line-through':'none',transition:'all .18s'}}>{children}</span></div>);}
function Card({title,icon,stripe,children}){return(<div style={{background:C.card,borderRadius:16,overflow:'hidden',marginBottom:14,boxShadow:'0 2px 14px rgba(0,0,0,.05)',border:`1px solid ${C.border}`}}><div style={{display:'flex',alignItems:'center',gap:9,padding:'14px 18px 12px',borderBottom:`3px solid ${stripe||C.dark}`}}><span style={{fontSize:17}}>{icon}</span><h2 style={{margin:0,fontFamily:'Playfair Display,serif',fontSize:13,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:C.dark}}>{title}</h2></div><div style={{padding:'12px 18px 16px'}}>{children}</div></div>);}
function NumInput({value,onChange,step=0.5,unit,okWhen}){const ok=value!==''&&okWhen(parseFloat(value));return(<div style={{display:'flex',alignItems:'center',gap:10}}><input type="number" step={step} min={0} value={value} onChange={e=>onChange(e.target.value)} placeholder="—" style={{width:68,padding:'7px 10px',borderRadius:8,outline:'none',border:`2px solid ${value?(ok?C.green:C.accent):C.border}`,background:value&&ok?'#EBF5F0':'white',fontFamily:'DM Sans,sans-serif',fontSize:15,fontWeight:700,color:value&&ok?C.green:C.text,transition:'all .18s'}}/><span style={{fontSize:13,color:C.muted}}>{unit}</span>{value&&ok&&<span style={{fontSize:16}}>✅</span>}{value&&!ok&&<span style={{fontSize:12,color:C.accent}}>Doel niet gehaald</span>}</div>);}
function StatBox({emoji,label,val,ok}){return(<div style={{background:C.soft,borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:20}}>{emoji}</span><div><p style={{margin:0,fontSize:11,color:C.muted}}>{label}</p><p style={{margin:0,fontSize:15,fontWeight:700,color:ok===null?C.text:ok?C.green:C.accent}}>{val}</p></div></div>);}
function MealBtn({label,emoji,kcal,on,toggle}){return(<div onClick={toggle} style={{flex:1,borderRadius:12,border:`2px solid ${on?C.green:C.border}`,background:on?'#EBF5F0':C.soft,padding:'10px 8px',cursor:'pointer',textAlign:'center',transition:'all .2s'}}><div style={{fontSize:22,marginBottom:3}}>{emoji}</div><p style={{margin:0,fontSize:12,fontWeight:600,color:on?C.green:C.text}}>{label}</p><p style={{margin:'2px 0 0',fontSize:10,color:C.muted}}>{kcal} kcal</p>{on&&<div style={{fontSize:11,color:C.green,marginTop:2,fontWeight:700}}>✓</div>}</div>);}

// ── Energie Balans Card ───────────────────────────────────────────────────
function EnergieBalans({intake,burn,hasSport,sport,isPauseDay,pauseWalk,sportDone}){
  const netto=intake-burn.total;
  const isDeficit=netto<=0;
  return(<div style={{background:C.card,borderRadius:16,overflow:'hidden',marginBottom:14,boxShadow:'0 2px 14px rgba(0,0,0,.05)',border:`1px solid ${C.border}`}}>
    <div style={{display:'flex',alignItems:'center',gap:9,padding:'14px 18px 12px',borderBottom:`3px solid #E67E22`}}>
      <span style={{fontSize:17}}>🔥</span>
      <h2 style={{margin:0,fontFamily:'Playfair Display,serif',fontSize:13,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',color:C.dark}}>Energie Balans</h2>
    </div>
    <div style={{padding:'14px 18px 16px'}}>
      <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,color:C.muted}}>
          <span>📋 Inname</span>
          <span style={{fontWeight:600,color:C.text}}>{intake} kcal</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,color:C.muted}}>
          <span>🧍 TDEE (basis)</span>
          <span style={{fontWeight:600,color:C.text}}>−{TDEE} kcal</span>
        </div>
        {hasSport&&sportDone&&sport&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,color:C.muted}}>
            <span>{sport.emoji} {sport.name}</span>
            <span style={{fontWeight:600,color:C.green}}>−{sport.burn} kcal</span>
          </div>
        )}
        {isPauseDay&&pauseWalk&&(
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:13,color:C.muted}}>
            <span>🚶 Pauze wandeling</span>
            <span style={{fontWeight:600,color:C.green}}>−{WALK_BURN} kcal</span>
          </div>
        )}
        <div style={{height:1,background:C.border,margin:'4px 0'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:14,fontWeight:700,color:C.dark}}>Netto</span>
          <span style={{fontSize:18,fontWeight:800,color:isDeficit?C.green:C.accent}}>
            {isDeficit?'':'+'}{ netto} kcal
          </span>
        </div>
      </div>
      <div style={{borderRadius:10,padding:'10px 14px',background:isDeficit?'rgba(44,122,79,.08)':'rgba(193,87,47,.08)',border:`1px solid ${isDeficit?'rgba(44,122,79,.2)':'rgba(193,87,47,.2)'}`}}>
        <p style={{margin:0,fontSize:12,color:isDeficit?C.green:C.accent,fontWeight:600}}>
          {isDeficit
            ? `✓ Tekort van ${Math.abs(netto)} kcal — je verbrandt meer dan je eet`
            : `▲ Surplus van ${netto} kcal — je eet meer dan je verbrandt`}
        </p>
        <p style={{margin:'4px 0 0',fontSize:10,color:C.muted}}>Schatting op basis van ~80 kg · TDEE {TDEE} kcal</p>
      </div>
    </div>
  </div>);
}

// ── Backup Panel ──────────────────────────────────────────────────────────
const BB={padding:'5px 11px',borderRadius:8,border:'1px solid #E2DAD0',cursor:'pointer',fontSize:11,fontFamily:'DM Sans,sans-serif',fontWeight:600,color:'#1A3628',background:'#F5F1EA',whiteSpace:'nowrap'};
function BackupPanel({onGetData,onSetData}){
  const [open,setOpen]=useState(null);
  const [txt,setTxt]=useState('');
  const [pastedTxt,setPastedTxt]=useState('');
  const [copied,setCopied]=useState(false);
  const [msg,setMsg]=useState('');
  const openExp=async()=>{const d=await onGetData();setTxt(JSON.stringify(d,null,2));setOpen('export');setCopied(false);};
  const doCopy=()=>{try{navigator.clipboard.writeText(txt);setCopied(true);setTimeout(()=>setCopied(false),2500);}catch{}};
  const doLoad=async()=>{try{const p=JSON.parse(pastedTxt.trim());if(typeof p!=='object'||Array.isArray(p))throw new Error();await onSetData(p);setMsg('✓ '+Object.keys(p).length+' dagen geladen');setTimeout(()=>{setOpen(null);setPastedTxt('');setMsg('');},1800);}catch{setMsg('✗ Ongeldige JSON');}};
  const close=()=>{setOpen(null);setPastedTxt('');setMsg('');};
  return(<>
    <div style={{background:'#EAE4DA',borderBottom:'1px solid #E2DAD0',padding:'7px 16px'}}>
      <div style={{maxWidth:500,margin:'0 auto',display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
        <span style={{fontSize:9,color:'#7A7060',fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>📦 Backup</span>
        <button onClick={openExp} style={BB}>⬇ Exporteer</button>
        <button onClick={()=>{setMsg('');setOpen('import');}} style={BB}>⬆ Importeer</button>
        <span style={{fontSize:10,color:'#7A7060',fontStyle:'italic'}}>Kopieer of plak je JSON-backup</span>
      </div>
    </div>
    {open&&(<div onClick={close} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#FDFAF6',borderRadius:20,width:'100%',maxWidth:480,boxShadow:'0 24px 64px rgba(0,0,0,.3)',overflow:'hidden'}}>
        <div style={{background:'#1A3628',padding:'15px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0,color:'white',fontFamily:'Playfair Display,serif',fontSize:15,fontWeight:700}}>{open==='export'?'📋 Exporteer data':'📥 Importeer data'}</h3>
          <button onClick={close} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,padding:'4px 11px',color:'white',cursor:'pointer',fontSize:15}}>✕</button>
        </div>
        <div style={{padding:'16px 20px 20px'}}>
          {open==='export'&&(<>
            <p style={{margin:'0 0 10px',fontSize:12,color:'#7A7060',lineHeight:1.6}}>Kopieer de JSON en bewaar hem in Google Keep, Notes of een bestand. Plak hem terug via Importeer om je data te herstellen.</p>
            <textarea readOnly value={txt} rows={10} onFocus={e=>e.target.select()} style={{width:'100%',border:'1px solid #E2DAD0',borderRadius:10,padding:'10px 12px',fontFamily:'monospace',fontSize:10,resize:'none',outline:'none',background:'#F5F1EA',boxSizing:'border-box',lineHeight:1.5}}/>
            <button onClick={doCopy} style={{marginTop:10,width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:'pointer',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:700,background:copied?'#2C7A4F':'#1A3628',color:'white',transition:'background .25s'}}>{copied?'✓ Gekopieerd!':'Kopieer alles naar klembord'}</button>
          </>)}
          {open==='import'&&(<>
            <p style={{margin:'0 0 10px',fontSize:12,color:'#7A7060',lineHeight:1.6}}>Plak je eerder geëxporteerde JSON hieronder en klik Laden.</p>
            <textarea value={pastedTxt} onChange={e=>setPastedTxt(e.target.value)} rows={10} placeholder="Plak hier je JSON-backup..." style={{width:'100%',border:'1px solid #E2DAD0',borderRadius:10,padding:'10px 12px',fontFamily:'monospace',fontSize:10,resize:'none',outline:'none',background:'white',boxSizing:'border-box',lineHeight:1.5}}/>
            {msg&&<p style={{margin:'8px 0 0',fontSize:12,fontWeight:600,color:msg.startsWith('✓')?'#2C7A4F':'#C1572F'}}>{msg}</p>}
            <button onClick={doLoad} disabled={!pastedTxt.trim()} style={{marginTop:10,width:'100%',padding:'12px',borderRadius:10,border:'none',cursor:pastedTxt.trim()?'pointer':'default',fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:700,background:pastedTxt.trim()?'#1A3628':'#E2DAD0',color:pastedTxt.trim()?'white':'#7A7060',transition:'all .2s'}}>Laden</button>
          </>)}
        </div>
      </div>
    </div>)}
  </>);
}

const TOPICS=[
  {o:"De Zwarte Dood: hoe een plaag Europa heruitvond",v:"Geschiedenis",i:"De builenpest van 1347-1353 doodde een derde van Europa. Arbeiders eisten hogere lonen, de kerk verloor gezag, wetenschappelijk denken bloeide op. De ramp versnelde het einde van het feodalisme.",ins:"De Zwarte Dood was de grootste onbedoelde motor van sociale gelijkheid in de Europese geschiedenis.",q:"Hoe anders zou Europa er nu uitzien als de pest nooit had plaatsgevonden?"},
  {o:"Compound interest: waarom mensen het slecht begrijpen",v:"Economie",i:"Samengestelde rente betekent dat je rendement ook rendement genereert. 1000 euro bij 7% groeit na 10 jaar naar 1967 euro, maar na 40 jaar naar 14974 euro. Ons brein denkt lineair, maar geld groeit exponentieel.",ins:"De helft van Warren Buffetts vermogen werd opgebouwd na zijn 65e — puur door decennia lang niets te doen.",q:"Welk deel van jouw leven profiteert al van samengestelde groei — en welk deel niet?"},
  {o:"Stoicisme: de filosofie van controle",v:"Filosofie",i:"De Stoicijnen maakten onderscheid: wat is van jou (gedachten, reacties) en wat niet (het weer, anderen, de toekomst). Energie steken in wat buiten je controle ligt is de voornaamste oorzaak van lijden.",ins:"Epictetus was een slaaf — en schreef toch een van de meest invloedrijke teksten over innerlijke vrijheid.",q:"Waar in jouw leven spend je energie aan dingen die je niet kunt controleren?"},
  {o:"De wetenschap van slaap: 7-8 uur is geen luxe",v:"Wetenschap",i:"Tijdens slaap verwijdert je brein afvalstoffen, consolideert het herinneringen, en herstelt het je immuunsysteem. Slechts 6 uur slaap heeft hetzelfde cognitieve effect als twee nachten doorhalen.",ins:"Na 17 uur wakker verslechteren je reactiesnelheid en oordeel evenveel als bij 0.5 promille alcohol.",q:"Hoe serieus neem jij slaap als prestatiemiddel?"},
  {o:"Het Marshallplan: hoe Amerika Europa herbouwde",v:"Geschiedenis",i:"Na WWII pompte de VS 13 miljard dollar in verwoest West-Europa. Officieel uit altruisme, maar ook strategisch: een welvarend Europa was een buffer tegen communisme en een afzetmarkt.",ins:"Het Marshallplan was tegelijk de meest genereuze en slimste geopolitieke investering van de 20e eeuw.",q:"Bestaat ware filantropie op staatsniveau, of is er altijd eigenbelang?"},
  {o:"Dopamine: verwachting, niet plezier",v:"Psychologie",i:"Dopamine geeft geen gevoel van plezier maar van verwachting en motivatie. Het stijgt het sterkst bij onzekerheid over een beloning. Sociale media activeren precies dit systeem.",ins:"Ratten met beschadigd dopamine-systeem sterven van honger naast eten — geen motivatie, maar ze genieten nog wel als je het in hun mond legt.",q:"Welke gewoontes spelen in op dit systeem — bewust of onbewust?"},
  {o:"Japan's verloren decennium",v:"Economie",i:"In de jaren 80 stegen Japanse aandelen en vastgoed tot absurde hoogten. Toen de bubbel barstte in 1990, volgden twintig jaar stagnatie. Deflatie zette in — mensen wachtten met kopen omdat prijzen toch daalden.",ins:"Op het hoogtepunt was de grond onder het keizerlijk paleis meer waard dan heel Californie.",q:"Welke bubbels zijn er nu zichtbaar in de economie?"},
  {o:"Hoe taal je denken vormt",v:"Psychologie",i:"De taal die je spreekt beinvloedt hoe je de wereld ervaart. Het Russisch heeft aparte woorden voor licht- en donkerblauw — Russischsprekenden onderscheiden die tinten ook sneller.",ins:"Sommige inheemse talen gebruiken geen links/rechts maar altijd kompasrichtingen — sprekers hebben een extreem scherp richtingsgevoel.",q:"Welke concepten zou je anders ervaren in een andere taal?"},
  {o:"De Industriele Revolutie: het moment dat alles versnelde",v:"Geschiedenis",i:"Voor 1800 groeide de levensstandaard nauwelijks. Daarna explodeerde productiviteit, levensverwachting en bevolking. De stoommachine maakte het mogelijk dat een persoon de arbeid van honderd kon doen.",ins:"In 1800 leefde 90% in extreme armoede. In 2024 is dat minder dan 10%.",q:"Leven we nu in een vergelijkbaar omslagpunt met AI als de stoommachine?"},
  {o:"Intermittent fasting: wat de wetenschap zegt",v:"Wetenschap",i:"Vasten activeert autofagie — het opruimen van beschadigde cellen. Maar recent onderzoek nuanceert: de meeste voordelen komen door calorierestrictie, niet de timing zelf.",ins:"Muizen leven 30-40% langer bij calorierestreptie — of dit voor mensen geldt is onduidelijk.",q:"Pas jij voedingsprincipes toe op basis van bewijs of op basis van populariteit?"},
  {o:"De Koude Oorlog: twee supermachten, een angst",v:"Geschiedenis",i:"Van 1947 tot 1991 stonden de VS en USSR tegenover elkaar zonder ooit direct te vechten — maar ze bevochten elkaar via Korea, Vietnam, Angola en tientallen andere conflicten.",ins:"De Cubaanse Raketcrisis werd mogelijk voorkomen door een Russische onderzeeerofficier die weigerde het nucleaire torpedo af te vuren.",q:"Is de huidige geopolitiek fundamenteel anders dan de Koude Oorlog?"},
  {o:"Cognitieve dissonantie: overtuigingen verdedigen als ze fout zijn",v:"Psychologie",i:"Wanneer nieuwe informatie botst met bestaande overtuigingen, verwerpt ons brein liever de informatie dan de overtuiging aan te passen. Hoe meer investering, hoe sterker de weerstand.",ins:"Mensen die fout voorspellen dat de wereld eindigt, worden daarna juist fanatieker — ze rechtvaardigen de investering.",q:"Welke overtuigingen houd je vast omdat ze kloppen, en welke omdat loslaten te pijnlijk is?"},
  {o:"Hoe muziek werkt in je brein",v:"Wetenschap",i:"Muziek activeert meer hersengebieden tegelijk dan vrijwel elke andere activiteit. Muziek uit je tienerjaren raakt je sterk omdat die periode samenvalt met intense emotionele ontwikkeling.",ins:"Mensen met ernstige dementie herkennen nog muziek uit hun jeugd terwijl ze gezichten van familieleden niet meer kennen.",q:"Welke muziek brengt jou terug naar een specifiek moment?"},
  {o:"De Renaissance: waarom Florence de wereld veranderde",v:"Kunst",i:"In 15e-eeuws Florence financierde de Medici-familie kunstenaars, filosofen en wetenschappers. Da Vinci, Michelangelo en Botticelli werkten tegelijk in dezelfde stad.",ins:"Leonardo da Vincis dagboeken bevatten ontwerpen voor een helikopter, tank en zonnecollector — 400 jaar voor hun uitvinding.",q:"Wat zijn de moderne equivalenten van Florence die creatief talent samenbrengen?"},
  {o:"Gewoontes: de habit loop",v:"Psychologie",i:"Charles Duhigg beschreef de gewoontelus: cue, routine, beloning. Kleine omgevingsaanpassingen zijn krachtiger dan wilskracht.",ins:"Tot 40% van ons dagelijks gedrag is automatisch gewoontegedrag, geen bewuste keuze.",q:"Welke gewoonte wil je vervangen — en wat is de cue die hem triggert?"},
  {o:"Zwarte gaten: wat er echt gebeurt",v:"Wetenschap",i:"Bij een zwart gat is de ontsnappingssnelheid groter dan de lichtsnelheid. Voor een waarnemer die erin valt is er geen dramatisch moment — ze vallen gewoon door. Pas later trekken getijdenkrachten hen uit elkaar.",ins:"Door tijddilatatie zou een astronaut die in een zwart gat valt vanuit ons perspectief bevroren lijken — voor altijd.",q:"Wat zegt het over realiteit dat tijd en ruimte buigbaar zijn door massa?"},
  {o:"Globalisering: winnaars, verliezers en wat verzwegen werd",v:"Economie",i:"Vrijhandel haalde honderden miljoenen uit armoede in Azie. Maar de productiearbeider in Amerika of Nederland verloor zijn baan. Economen onderschatten de concentratie van de verliezen.",ins:"De opkomst van populisme correleert sterk met gebieden waar fabrieken sloten door Chinese concurrentie.",q:"Is vrijhandel netto goed of slecht — en voor wie stel jij die vraag?"},
  {o:"Meditatie en het brein",v:"Wetenschap",i:"Na acht weken meditatie laat MRI aantoonbare veranderingen zien: de amygdala krimpt, de prefrontale cortex verdikt. Dit zijn structurele, niet tijdelijke veranderingen.",ins:"Tibetaanse monniken met 10.000 meditatie-uren produceren gamma-hersengolven op een niveau dat nooit eerder gemeten was.",q:"Als meditatie aantoonbaar je brein herstructureert — waarom behandelen mensen het nog als ontspanning?"},
  {o:"De val van Rome: langzaam en dan ineens",v:"Geschiedenis",i:"Rome viel niet op een dag. Militaire overextensie, inflatie, ongelijkheid en instabiliteit erodeerden het rijk over eeuwen van binnenuit.",ins:"De Oost-Romeinse Rijk bleef nog 1000 jaar na de val van Rome bestaan — tot 1453.",q:"Welke tekenen van verval zijn herkenbaar in hedendaagse democratieen?"},
  {o:"Olie en wereldpolitiek",v:"Economie",i:"Olie is niet alleen brandstof maar macht. Wanneer de olieprijs stijgt, krijgen autocratische regimes meer speelruimte. De VS produceerde zich in de 2010s naar energieonafhankelijkheid.",ins:"De OPEC-crisis van 1973 leidde direct tot de 55 mph-limiet in de VS en eerste investeringen in zonne-energie.",q:"Als Europa morgen volledig energieonafhankelijk zou zijn — hoe anders zou de buitenlandpolitiek eruitzien?"},
  {o:"Evolutie van samenwerking",v:"Wetenschap",i:"Puur zelfzuchtig gedrag wordt ondermijnd door tit-for-tat: samenwerken totdat de ander vals speelt, dan vergelden. Groepen die samenwerkten versloegen groepen die dat niet deden.",ins:"In simulaties wint de simpelste strategie altijd: begin vriendelijk, straf vals spel, vergeef snel.",q:"Wanneer is het rationeel om iemand te vertrouwen die je eerder teleurstelde?"},
  {o:"De Verlichting: rede boven geloof",v:"Filosofie",i:"In de 17e en 18e eeuw betoogden Locke, Voltaire en Kant dat rede de basis moest zijn voor politiek en ethiek. Dit leidde tot de Amerikaanse en Franse Revolutie.",ins:"Kant schreef zijn bekendste werken pas na zijn 57e — hij was voorheen een onopvallende professor.",q:"Leven we nog in het tijdperk van de Verlichting — of is er een reactie gaande?"},
  {o:"Slaap consolideert je geheugen",v:"Wetenschap",i:"Tijdens REM-slaap herhaalt je brein wat je overdag leerde — selectief. Slaap direct na het leren verhoogt retentie met 20-40%. Dit is een actief herstelproces.",ins:"Slapen op een probleem is letterlijk effectief: het slapende brein herorganiseert informatie op manieren het wakker brein niet kan.",q:"Verander jij je leerroutine als je weet dat slaap een actief onderdeel is van geheugenvorming?"},
  {o:"De mythe van multitasking",v:"Psychologie",i:"Mensen multitasken niet echt — ze schakelen snel tussen taken. Mensen die zichzelf als goede multitaskers beschouwen, presteren in tests juist slechter.",ins:"Na een onderbreking duurt het gemiddeld 23 minuten om volledig terug in een complexe taak te komen.",q:"Hoeveel van jouw productieve dag bestaat uit gefragmenteerd aandachtwisselen?"},
  {o:"Keynes vs Hayek",v:"Economie",i:"Keynes betoogde dat overheden moeten ingrijpen bij neergang. Hayek waarschuwde dat dit marktsignalen verstoort. Beiden hadden deels gelijk.",ins:"Keynes verloor zijn fortuin twee keer door de markt te onderschatten — terwijl hij zijn hoofdwerk schreef.",q:"Wanneer moet een overheid de economie sturen, en wanneer uit de weg gaan?"},
  {o:"Psychologie van geld",v:"Psychologie",i:"Boven een bepaald inkomen verbetert geluk nauwelijks. Wat bepalend blijft: autonomie, relaties en zingeving — los van inkomen.",ins:"Lottowinnaar zijn even gelukkig als ernstig gewonden, een jaar na het incident — we passen ons aan.",q:"Welke financiele beslissing heeft jouw leven het meest verbeterd?"},
  {o:"DNA: het meest compacte informatiesysteem",v:"Wetenschap",i:"Een gram DNA kan theoretisch 215 petabyte opslaan. Je hele genoom past in elke cel. Uitgerold is het 2 meter lang maar een miljoen keer dunner dan een haar.",ins:"Al het menselijk DNA ooit geproduceerd past in een schoenendoos — met de blauwdruk van alle acht miljard mensen.",q:"Als DNA zo efficiënt is — wat kunnen we leren voor hoe wij informatie opslaan?"},
  {o:"WOII: hoe het kon beginnen",v:"Geschiedenis",i:"Hitlers opkomst was geen onvermijdelijkheid maar een reeks keuzes: vernedering na WWI, hyperinflatie, werkloosheid, en politici die dachten hem te kunnen temmen.",ins:"In 1928 behaalde de NSDAP slechts 2.6% van de stemmen. Vier jaar later was Hitler kanselier.",q:"Welke waarschuwingssignalen in democratieen worden vandaag onderschat?"},
  {o:"Steden als innovatiemotor",v:"Wetenschap",i:"Elke keer als een stad twee keer zo groot wordt, stijgt innovatie met 115%. Meer mensen op kleine ruimte betekent meer onverwachte ontmoetingen en ideëencombinaties.",ins:"Een stad van 10 miljoen produceert per hoofd 50% meer innovatie dan een stad van een miljoen — wereldwijd.",q:"Waarom wonen mensen in kleine steden — en wat verliezen ze, wat winnen ze?"},
  {o:"Existentialisme: veroordeeld tot vrijheid",v:"Filosofie",i:"Sartre betoogde dat mensen geen vaste essentie hebben — we zijn vrij om onszelf te definiëren door keuzes. Dat brengt existentiele angst: de last van volledige verantwoordelijkheid.",ins:"Sartre schreef zijn hoofdwerk in een Parijse cafe tijdens de Nazi-bezetting — hij weigerde de bezetting als excuus te gebruiken.",q:"Op welke gebieden maak jij jezelf wijs dat je geen keuze hebt?"},
  {o:"De microbioom: darmbacteriën sturen je gedrag",v:"Wetenschap",i:"Je hebt meer bacteriën in je darmen dan cellen in je lichaam. Deze bacteriën produceren 90% van je serotonine. De darm-hersen-as is een echte bidirectionele verbinding.",ins:"Mensen die antibiotica krijgen hebben significant hogere kansen op depressie — door het vernietigen van darmbacteriën.",q:"Hoe verander jij wat je eet als je weet dat het direct je stemming beinvloedt?"},
  {o:"De ruimterace: de maan was politiek",v:"Geschiedenis",i:"De ruimterace was propaganda. Spoetnik (1957) en Gagarin (1961) waren bewijs van communistische superioriteit. Armstrongs maanlanding was een geopolitieke overwinning.",ins:"NASA's budget in 1966 was 4.4% van het federale budget — vandaag is het 0.5%. Angst was de motivatie, niet nieuwsgierigheid.",q:"Welke grote collectieve inspanningen zijn vandaag mogelijk als we ze als gemeenschappelijke vijand behandelen?"},
  {o:"Wat is bewustzijn — en waarom weten we het niet",v:"Filosofie",i:"Het harde probleem van bewustzijn: waarom bestaat er subjectieve ervaring? We begrijpen hoe neuronen vuren, maar niet waarom dat gepaard gaat met het gevoel van iets te zijn.",ins:"Octopussen hebben neuronen over hun armen — elke arm heeft deels autonoom bewustzijn. Wat dit betekent weten we niet.",q:"Als een AI zegt ervaringen te hebben — hoe zou jij ooit weten of dat waar is?"},
];

function getDailyTopic(){const d=new Date(),s=new Date(d.getFullYear(),0,0);return TOPICS[Math.floor((d-s)/86400000)%TOPICS.length];}

function DailyTopic({done,onDone}){
  const t=getDailyTopic();
  const [exp,setExp]=useState(false);
  const FC={Geschiedenis:'#6B3A2A',Economie:'#1E5C3A',Filosofie:'#4A3570',Psychologie:'#8B3A1A',Wetenschap:'#1A3F6B',Kunst:'#7A2340'};
  const col=FC[t.v]||'#2A3A4A';
  return(<div style={{background:C.soft,borderRadius:12,overflow:'hidden',border:`1px solid ${C.border}`}}>
    <div style={{background:col,padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
      <div style={{flex:1,marginRight:10}}>
        <p style={{margin:'0 0 2px',fontSize:9,color:'rgba(255,255,255,.6)',letterSpacing:2,textTransform:'uppercase',fontWeight:600}}>{t.v}</p>
        <p style={{margin:0,fontSize:14,fontWeight:700,color:'white',lineHeight:1.3}}>{t.o}</p>
      </div>
      <button onClick={()=>setExp(e=>!e)} style={{background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,padding:'5px 12px',color:'white',fontSize:11,cursor:'pointer',flexShrink:0,fontFamily:'DM Sans,sans-serif',fontWeight:600}}>{exp?'Inklappen':'Lees meer'}</button>
    </div>
    {exp&&(<div style={{padding:'14px 16px'}}>
      <p style={{margin:'0 0 12px',fontSize:13,color:C.text,lineHeight:1.7}}>{t.i}</p>
      <div style={{background:'rgba(44,122,79,.08)',borderLeft:`3px solid ${C.green}`,borderRadius:'0 8px 8px 0',padding:'8px 12px',marginBottom:10}}>
        <p style={{margin:0,fontSize:10,fontWeight:700,color:C.green,letterSpacing:.5,textTransform:'uppercase',marginBottom:3}}>Verrassend inzicht</p>
        <p style={{margin:0,fontSize:13,color:C.text}}>{t.ins}</p>
      </div>
      <div style={{background:C.soft,borderRadius:8,padding:'8px 12px',border:`1px solid ${C.border}`}}>
        <p style={{margin:0,fontSize:10,fontWeight:700,color:C.muted,letterSpacing:.5,textTransform:'uppercase',marginBottom:3}}>Vraag</p>
        <p style={{margin:0,fontSize:13,color:C.text,fontStyle:'italic'}}>{t.q}</p>
      </div>
    </div>)}
    <div style={{padding:'10px 16px',borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <span style={{fontSize:11,color:C.muted}}>⏱ 15 minuten lezen</span>
      <div onClick={onDone} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
        <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${done?C.green:C.border}`,background:done?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .18s'}}>{done&&<span style={{color:'white',fontSize:11,fontWeight:700}}>✓</span>}</div>
        <span style={{fontSize:12,fontWeight:600,color:done?C.green:C.muted}}>Gelezen</span>
      </div>
    </div>
  </div>);
}

// ── Week netto helper ──────────────────────────────────────────────────────
function NettoStatBox({nettoTotal,days}){
  const avg=days>0?Math.round(nettoTotal/days):0;
  const isDeficit=nettoTotal<=0;
  return(<div style={{background:C.soft,borderRadius:10,padding:'12px 14px',border:`1px solid ${isDeficit?'rgba(44,122,79,.25)':'rgba(193,87,47,.25)'}`,background:isDeficit?'rgba(44,122,79,.06)':'rgba(193,87,47,.06)'}}>
    <p style={{margin:'0 0 6px',fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>🔥 Energie balans</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
      <div><p style={{margin:0,fontSize:11,color:C.muted}}>Netto totaal</p><p style={{margin:0,fontSize:16,fontWeight:800,color:isDeficit?C.green:C.accent}}>{isDeficit?'':'+'}{ nettoTotal} kcal</p></div>
      <div><p style={{margin:0,fontSize:11,color:C.muted}}>Gem. per dag</p><p style={{margin:0,fontSize:16,fontWeight:800,color:isDeficit?C.green:C.accent}}>{avg>0?'+':''}{avg} kcal</p></div>
    </div>
    <p style={{margin:'6px 0 0',fontSize:11,color:isDeficit?C.green:C.accent,fontWeight:600}}>{isDeficit?`✓ Totaal tekort van ${Math.abs(nettoTotal)} kcal over ${days} dagen`:`▲ Totaal surplus van ${nettoTotal} kcal over ${days} dagen`}</p>
  </div>);
}

function WeekView({history}){
  const today=new Date();const [offset,setOffset]=useState(0);
  const ref=new Date(today);ref.setDate(today.getDate()+offset*7);
  const dates=getWeekDates(ref),todayStr=getTodayStr(),week=getISOWeek(ref),isA=week%2===0;
  const withData=dates.filter(d=>history[fmtDate(d)]);
  const avg=(arr,fn)=>arr.length?(arr.reduce((s,x)=>s+fn(x),0)/arr.length):null;
  const avgSleep=avg(withData.filter(d=>parseFloat(history[fmtDate(d)]?.sleep?.hours||0)>0),d=>parseFloat(history[fmtDate(d)].sleep.hours));
  const avgHappy=avg(withData.filter(d=>history[fmtDate(d)]?.happiness>0),d=>history[fmtDate(d)].happiness);
  const sportDays=withData.filter(d=>history[fmtDate(d)]?.sport).length;
  const totalBeer=withData.reduce((s,d)=>s+(history[fmtDate(d)]?.nutrition?.beer||0),0);
  const avgScreen=avg(withData.filter(d=>history[fmtDate(d)]?.screen),d=>parseFloat(history[fmtDate(d)].screen||0));
  const sleepOk=withData.filter(d=>parseFloat(history[fmtDate(d)]?.sleep?.hours||0)>6).length;
  // netto
  const nettoTotal=withData.reduce((s,d)=>{const dobj=new Date(fmtDate(d));const intake=calcIntake(history[fmtDate(d)]);const burn=calcBurn(history[fmtDate(d)],dobj);return s+(intake-burn.total);},0);
  const s=dates[0],e=dates[6];
  const rangeLabel=s.getMonth()===e.getMonth()?`${s.getDate()}-${e.getDate()} ${MONTHS_NL[s.getMonth()]} ${s.getFullYear()}`:`${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} - ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  return(<div style={{padding:'16px 14px 60px',maxWidth:500,margin:'0 auto'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <button onClick={()=>setOffset(o=>o-1)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:18,color:C.dark}}>‹</button>
      <div style={{textAlign:'center'}}><p style={{margin:0,fontFamily:'Playfair Display,serif',fontSize:15,fontWeight:700,color:C.dark}}>Week {week} — {isA?'A':'B'}{offset===0?' · Huidig':''}</p><p style={{margin:0,fontSize:11,color:C.muted}}>{rangeLabel}</p></div>
      <button onClick={()=>setOffset(o=>o+1)} disabled={offset>=0} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',cursor:offset>=0?'default':'pointer',fontSize:18,color:offset>=0?C.border:C.dark}}>›</button>
    </div>
    <div style={{background:C.card,borderRadius:16,overflow:'hidden',marginBottom:14,border:`1px solid ${C.border}`,boxShadow:'0 2px 14px rgba(0,0,0,.05)'}}>
      {dates.map((dateObj,i)=>{
        const ds=fmtDate(dateObj),d=history[ds],isToday=ds===todayStr,isFuture=dateObj>today&&!isToday;
        const sc=d?dayScore(d,dateObj):null,sl=d?parseFloat(d.sleep?.hours||0):null,hp=d?.happiness||0;
        const intake=d?calcIntake(d):0;
        const burn=d?calcBurn(d,dateObj):{total:0};
        const netto=d?intake-burn.total:null;
        return(<div key={ds} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:i<6?`1px solid ${C.border}`:'none',background:isToday?'rgba(44,122,79,.05)':'transparent'}}>
          <div style={{minWidth:46}}><p style={{margin:0,fontSize:12,fontWeight:700,color:isToday?C.green:C.dark}}>{DAYS_SHORT[dateObj.getDay()]}</p><p style={{margin:0,fontSize:10,color:C.muted}}>{dateObj.getDate()} {MONTHS_SHORT[dateObj.getMonth()]}</p></div>
          {isFuture?<span style={{fontSize:11,color:C.border,flex:1,fontStyle:'italic'}}>nog niet</span>:!d?<span style={{fontSize:11,color:C.border,flex:1,fontStyle:'italic'}}>geen data</span>:(<>
            <span style={{fontSize:20,minWidth:26}}>{hp>0?HAPPY_EMOJI[hp]:'—'}</span>
            <div style={{minWidth:44}}><p style={{margin:0,fontSize:12,fontWeight:700,color:sl&&sl>6?C.green:sl?C.accent:C.muted}}>{sl?`${sl}u`:'—'}</p><p style={{margin:0,fontSize:10,color:C.muted}}>slaap</p></div>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:4,flexWrap:'wrap',fontSize:12}}>{d.sport&&<span>🏃</span>}{d.pauseWalk&&<span>🚶</span>}{d.morning?.meditation&&<span>🧘</span>}{d.sleep?.reading&&<span>📖</span>}{d.cognitive?.deepLearn&&<span>🧠</span>}</div>
              {netto!==null&&<p style={{margin:'2px 0 0',fontSize:10,fontWeight:700,color:netto<=0?C.green:C.accent}}>{netto<=0?'':'+'}{ netto} kcal</p>}
            </div>
            <div style={{minWidth:50,textAlign:'right'}}><p style={{margin:'0 0 3px',fontSize:12,fontWeight:700,color:sc>=80?C.green:sc>=60?C.gold:C.accent}}>{sc}%</p><div style={{background:C.border,borderRadius:3,height:4,overflow:'hidden'}}><div style={{height:'100%',borderRadius:3,background:sc>=80?C.green:sc>=60?C.gold:C.accent,width:`${sc}%`}}/></div></div>
          </>)}
        </div>);
      })}
    </div>
    {withData.length>0&&(<div style={{background:C.card,borderRadius:16,padding:'16px 18px',border:`1px solid ${C.border}`,boxShadow:'0 2px 14px rgba(0,0,0,.05)'}}>
      <h3 style={{margin:'0 0 14px',fontFamily:'Playfair Display,serif',fontSize:13,letterSpacing:1.5,textTransform:'uppercase',color:C.dark}}>Weekanalyse — {withData.length} {withData.length===1?'dag':'dagen'}</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <StatBox emoji="🌙" label="Gem. slaap" val={avgSleep?`${avgSleep.toFixed(1)}u`:'—'} ok={avgSleep?avgSleep>6:null}/>
        <StatBox emoji="💚" label="Gem. geluk" val={avgHappy?`${avgHappy.toFixed(1)}/5`:'—'} ok={avgHappy?avgHappy>=3:null}/>
        <StatBox emoji="🏃" label="Sport" val={`${sportDays} / ${withData.length} dgn`} ok={sportDays>=Math.floor(withData.length*.6)}/>
        <StatBox emoji="😴" label="Slaap >6u" val={`${sleepOk} / ${withData.length} dgn`} ok={sleepOk>=Math.floor(withData.length*.8)}/>
        <StatBox emoji="📱" label="Gem. scherm" val={avgScreen!==null?`${avgScreen.toFixed(1)}u`:'—'} ok={avgScreen!==null?avgScreen<2:null}/>
        <StatBox emoji="🍺" label="Totaal bier" val={`${totalBeer} (doel ≤7)`} ok={totalBeer<=7}/>
      </div>
      <NettoStatBox nettoTotal={Math.round(nettoTotal)} days={withData.length}/>
    </div>)}
    {withData.length===0&&<p style={{textAlign:'center',color:C.muted,fontSize:13,fontStyle:'italic',marginTop:20}}>Nog geen data voor deze week.</p>}
  </div>);
}

function MonthView({history}){
  const today=new Date();const [offset,setOffset]=useState(0);
  const ref=new Date(today.getFullYear(),today.getMonth()+offset,1);
  const dates=getMonthDates(ref),todayStr=getTodayStr(),firstDow=(dates[0].getDay()+6)%7;
  const cells=[...Array(firstDow).fill(null),...dates];
  const withData=dates.filter(d=>history[fmtDate(d)]);
  const avg=(arr,fn)=>arr.length?(arr.reduce((s,x)=>s+fn(x),0)/arr.length):null;
  const avgSleep=avg(withData.filter(d=>parseFloat(history[fmtDate(d)]?.sleep?.hours||0)>0),d=>parseFloat(history[fmtDate(d)].sleep.hours));
  const avgHappy=avg(withData.filter(d=>history[fmtDate(d)]?.happiness>0),d=>history[fmtDate(d)].happiness);
  const sportDays=withData.filter(d=>history[fmtDate(d)]?.sport).length;
  const totalBeer=withData.reduce((s,d)=>s+(history[fmtDate(d)]?.nutrition?.beer||0),0);
  const avgScreen=avg(withData.filter(d=>history[fmtDate(d)]?.screen),d=>parseFloat(history[fmtDate(d)].screen||0));
  const sleepOk=withData.filter(d=>parseFloat(history[fmtDate(d)]?.sleep?.hours||0)>6).length;
  const nettoTotal=withData.reduce((s,d)=>{const dobj=new Date(fmtDate(d));const intake=calcIntake(history[fmtDate(d)]);const burn=calcBurn(history[fmtDate(d)],dobj);return s+(intake-burn.total);},0);
  const hBg=(h)=>!h?C.border:h>=4?'#7DCA9E':h>=3?'#B8D4A0':h>=2?'#E8C97A':'#E89A7A';
  const hTxt=(h)=>h>=3?'#1A4A2D':'#6B2020';
  return(<div style={{padding:'16px 14px 60px',maxWidth:500,margin:'0 auto'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <button onClick={()=>setOffset(o=>o-1)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',cursor:'pointer',fontSize:18,color:C.dark}}>‹</button>
      <p style={{margin:0,fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:700,color:C.dark,textTransform:'capitalize'}}>{MONTHS_NL[ref.getMonth()]} {ref.getFullYear()}</p>
      <button onClick={()=>setOffset(o=>o+1)} disabled={offset>=0} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'6px 14px',cursor:offset>=0?'default':'pointer',fontSize:18,color:offset>=0?C.border:C.dark}}>›</button>
    </div>
    <div style={{background:C.card,borderRadius:16,padding:'16px',marginBottom:14,border:`1px solid ${C.border}`,boxShadow:'0 2px 14px rgba(0,0,0,.05)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:6}}>{['Ma','Di','Wo','Do','Vr','Za','Zo'].map(d=><div key={d} style={{textAlign:'center',fontSize:9,color:C.muted,fontWeight:600,letterSpacing:.5}}>{d}</div>)}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {cells.map((dateObj,i)=>{
          if(!dateObj)return <div key={`e${i}`}/>;
          const ds=fmtDate(dateObj),d=history[ds],isToday=ds===todayStr,isFuture=dateObj>today&&!isToday;
          const hp=d?.happiness||0,sc=d?dayScore(d,dateObj):null;
          return(<div key={ds} title={d?`${DAYS_NL[dateObj.getDay()]} ${dateObj.getDate()} — ${HAPPY_LBL[hp]||'geen'} — ${sc}%`:''}
            style={{aspectRatio:'1',borderRadius:7,background:isFuture?'transparent':d?hBg(hp):C.soft,border:`2px solid ${isToday?C.dark:'transparent'}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1}}>
            <span style={{fontSize:9,fontWeight:700,color:d?(hp>0?hTxt(hp):C.muted):C.muted}}>{dateObj.getDate()}</span>
            {d&&sc!==null&&<div style={{width:'65%',height:2,borderRadius:1,background:'rgba(0,0,0,.12)'}}><div style={{height:'100%',width:`${sc}%`,borderRadius:1,background:'rgba(0,0,0,.2)'}}/></div>}
          </div>);
        })}
      </div>
      <div style={{display:'flex',gap:6,marginTop:12,justifyContent:'center',alignItems:'center'}}>
        <span style={{fontSize:10,color:C.muted}}>Geluk:</span>
        {[['😔','#E89A7A'],['😐','#E8C97A'],['🙂','#B8D4A0'],['😊','#7DCA9E'],['🥰','#4DB87A']].map(([em,col])=>(<div key={em} style={{display:'flex',alignItems:'center',gap:2}}><div style={{width:9,height:9,borderRadius:2,background:col}}/><span style={{fontSize:10}}>{em}</span></div>))}
      </div>
    </div>
    {withData.length>0&&(<div style={{background:C.card,borderRadius:16,padding:'16px 18px',marginBottom:14,border:`1px solid ${C.border}`,boxShadow:'0 2px 14px rgba(0,0,0,.05)'}}>
      <h3 style={{margin:'0 0 14px',fontFamily:'Playfair Display,serif',fontSize:13,letterSpacing:1.5,textTransform:'uppercase',color:C.dark}}>Maandanalyse — {withData.length} dagen</h3>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
        <StatBox emoji="🌙" label="Gem. slaap" val={avgSleep?`${avgSleep.toFixed(1)}u`:'—'} ok={avgSleep?avgSleep>6:null}/>
        <StatBox emoji="💚" label="Gem. geluk" val={avgHappy?`${avgHappy.toFixed(1)}/5`:'—'} ok={avgHappy?avgHappy>=3:null}/>
        <StatBox emoji="🏃" label="Sport sessies" val={`${sportDays} keer`} ok={sportDays>=Math.floor(withData.length*.6)}/>
        <StatBox emoji="😴" label="Slaap >6u" val={`${sleepOk} / ${withData.length} dgn`} ok={sleepOk>=Math.floor(withData.length*.8)}/>
        <StatBox emoji="📱" label="Gem. scherm" val={avgScreen!==null?`${avgScreen.toFixed(1)}u`:'—'} ok={avgScreen!==null?avgScreen<2:null}/>
        <StatBox emoji="🍺" label="Totaal bier" val={`${totalBeer} (doel ≤${Math.round(withData.length/7)*7})`} ok={totalBeer<=Math.round(withData.length/7)*7}/>
      </div>
      <NettoStatBox nettoTotal={Math.round(nettoTotal)} days={withData.length}/>
      {withData.filter(d=>history[fmtDate(d)]?.happiness>0).length>=5&&(<>
        <p style={{margin:'14px 0 8px',fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>Geluk per dag</p>
        <div style={{display:'flex',alignItems:'flex-end',gap:2,height:52,marginBottom:4}}>{dates.map(dobj=>{const ds=fmtDate(dobj),h=history[ds]?.happiness||0;return(<div key={ds} style={{flex:1,borderRadius:'3px 3px 0 0',background:h>0?hBg(h):C.border,height:h>0?`${(h/5)*44+8}px`:'4px',transition:'height .3s'}}/>);})}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.muted,marginBottom:12}}><span>1</span><span>{MONTHS_SHORT[ref.getMonth()]}</span><span>{dates.length}</span></div>
      </>)}
      {withData.filter(d=>parseFloat(history[fmtDate(d)]?.sleep?.hours||0)>0).length>=5&&(<>
        <p style={{margin:'0 0 8px',fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>Slaap per dag</p>
        <div style={{display:'flex',alignItems:'flex-end',gap:2,height:52,marginBottom:4}}>{dates.map(dobj=>{const ds=fmtDate(dobj),h=parseFloat(history[ds]?.sleep?.hours||0);return(<div key={ds} style={{flex:1,borderRadius:'3px 3px 0 0',background:h>0?(h>6?'#7DCA9E':'#E8C97A'):C.border,height:h>0?`${Math.min(1,(h/9))*44+6}px`:'4px',transition:'height .3s'}}/>);})}</div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.muted}}><span>1</span><span style={{fontSize:9}}>Groen &gt;6u · Geel ≤6u</span><span>{dates.length}</span></div>
      </>)}
    </div>)}
    {withData.length===0&&<p style={{textAlign:'center',color:C.muted,fontSize:13,fontStyle:'italic',marginTop:20}}>Nog geen data voor deze maand.</p>}
  </div>);
}

export default function DailyPlanner(){
  const today=new Date(),dow=today.getDay(),week=getISOWeek(today),isA=week%2===0;
  const isOfficDay=OFFICE_DAYS.has(dow),isWorkFri=dow===5&&isA,isFreeFri=dow===5&&!isA;
  const hasSport=!isFreeFri&&(dow!==5||isWorkFri),isPauseDay=(dow>=1&&dow<=4)||isWorkFri;
  const callBroer=(isA&&dow===3)||(!isA&&dow===2),callOuders=(isA&&dow===2)||(!isA&&dow===3),hasCall=callBroer||callOuders;
  const [tab,setTab]=useState('today');
  const [data,setData]=useState(null);
  const [history,setHistory]=useState({});
  const [loaded,setLoaded]=useState(false);
  const [histLoaded,setHistLoaded]=useState(false);
  const [flash,setFlash]=useState(false);
  const [newFood,setNewFood]=useState({name:'',kcal:''});

  useEffect(()=>{if(document.getElementById('dp-fonts'))return;const l=document.createElement('link');l.id='dp-fonts';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap';document.head.appendChild(l);},[]);
  useEffect(()=>{(async()=>{try{const r=await window.storage.get(getTodayKey());setData(r?migrateData(JSON.parse(r.value)):defaultData());}catch{setData(defaultData());}setLoaded(true);})();},[]);
  useEffect(()=>{if(tab==='today'||histLoaded)return;(async()=>{try{const keys=await window.storage.list('dailyv1:');const entries={};for(const key of(keys?.keys||[])){try{const r=await window.storage.get(key);if(r)entries[key.replace('dailyv1:','')]=migrateData(JSON.parse(r.value));}catch{}}setHistory(entries);}catch{}setHistLoaded(true);})();},[tab,histLoaded]);
  const save=useCallback(async(d)=>{try{await window.storage.set(getTodayKey(),JSON.stringify(d));setHistory(h=>({...h,[getTodayStr()]:d}));}catch{}setFlash(true);setTimeout(()=>setFlash(false),700);},[]);
  const upd=useCallback((fn)=>{setData(prev=>{const next=fn(JSON.parse(JSON.stringify(prev)));save(next);return next;});},[save]);
  const getAllData=useCallback(async()=>{const keys=await window.storage.list('dailyv1:');const out={};for(const k of(keys?.keys||[])){try{const r=await window.storage.get(k);if(r)out[k.replace('dailyv1:','')]=migrateData(JSON.parse(r.value));}catch{}}if(data)out[getTodayStr()]=data;return out;},[data]);
  const setAllData=useCallback(async(imp)=>{for(const [ds,dd] of Object.entries(imp))await window.storage.set(`dailyv1:${ds}`,JSON.stringify(dd));setHistory(imp);const td=imp[getTodayStr()];if(td)setData(migrateData(JSON.parse(JSON.stringify(td))));},[]);

  if(!loaded||!data)return(<div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:C.bg,fontFamily:'DM Sans,sans-serif',color:C.dark}}>Laden...</div>);

  const totalIntake=calcIntake(data);
  const todayObj=new Date();
  const todayBurn=calcBurn(data,todayObj);
  const sport=hasSport?SPORT_SCHEDULE[dow]:null;
  const morningKeys=['water','sunlight','exercise','meditation','breakfast',...(!isOfficDay?['wimHof']:[])];
  const morningDone=morningKeys.filter(k=>data.morning[k]).length;
  const dateLabel=`${DAYS_NL[dow]} ${today.getDate()} ${MONTHS_NL[today.getMonth()]} ${today.getFullYear()}`;
  const combined={...history,[getTodayStr()]:data};
  const addCustomFood=()=>{if(!newFood.name||!newFood.kcal)return;upd(d=>{d.nutrition.customFoods.push({name:newFood.name,kcal:parseInt(newFood.kcal)});return d;});setNewFood({name:'',kcal:''});};

  return(<div style={{minHeight:'100vh',background:C.bg,fontFamily:'DM Sans,sans-serif'}}>
    <div style={{background:C.dark,padding:'24px 20px 20px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',right:-40,top:-40,width:160,height:160,borderRadius:'50%',border:'2px solid rgba(255,255,255,.05)'}}/>
      <div style={{maxWidth:500,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <p style={{margin:'0 0 3px',fontSize:10,color:'rgba(255,255,255,.4)',letterSpacing:2.5,textTransform:'uppercase',fontWeight:500}}>Week {week} — {isA?'A':'B'} · {isFreeFri?'Vrije dag':isOfficDay?'Kantoor':'Thuis'}</p>
            <h1 style={{margin:'0 0 5px',fontFamily:'Playfair Display,serif',fontSize:20,fontWeight:700,color:'white',lineHeight:1.2}}>{dateLabel}</h1>
            <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,.5)'}}>{hasSport?`${sport.emoji} ${sport.name} · ${sport.detail} · ~${sport.burn} kcal`:'🌿 Hersteldag'}</p>
          </div>
          <span style={{fontSize:10,color:flash?'#7DCA9E':'rgba(255,255,255,.2)',letterSpacing:1,textTransform:'uppercase',paddingTop:4,transition:'color .3s'}}>{flash?'✓ Opgeslagen':'Auto-save'}</span>
        </div>
        {tab==='today'&&(<div style={{marginTop:14,display:'flex',gap:5,flexWrap:'wrap'}}>
          {[{lbl:'Slaap',on:parseFloat(data.sleep.hours||0)>6},{lbl:'Ritueel',on:morningDone===morningKeys.length},{lbl:'Sport',on:!hasSport||data.sport},{lbl:'Pauze',on:!isPauseDay||data.pauseWalk},{lbl:'Eten',on:data.nutrition.ontbijt&&data.nutrition.lunch&&data.nutrition.avondeten},{lbl:'Scherm',on:data.screen!==''&&parseFloat(data.screen)<2},{lbl:'Brein',on:Object.values(data.cognitive).filter(Boolean).length>=3},{lbl:'Geluk',on:data.happiness>0}].map(({lbl,on})=>(
            <div key={lbl} style={{padding:'3px 9px',borderRadius:20,fontSize:10,fontWeight:500,background:on?'rgba(125,202,158,.22)':'rgba(255,255,255,.07)',color:on?'#7DCA9E':'rgba(255,255,255,.3)',border:`1px solid ${on?'rgba(125,202,158,.35)':'rgba(255,255,255,.07)'}`,transition:'all .3s'}}>{on?'✓ ':''}{lbl}</div>
          ))}
        </div>)}
      </div>
    </div>

    <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,display:'flex',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 8px rgba(0,0,0,.06)'}}>
      {[['today','📅 Vandaag'],['week','📊 Week'],['month','📆 Maand']].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'13px 4px',border:'none',cursor:'pointer',background:'none',fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,color:tab===id?C.dark:C.muted,borderBottom:`3px solid ${tab===id?C.dark:'transparent'}`,transition:'all .2s'}}>{lbl}</button>
      ))}
    </div>
    <BackupPanel onGetData={getAllData} onSetData={setAllData}/>

    {tab==='week'&&(histLoaded?<WeekView history={combined}/>:<div style={{padding:40,textAlign:'center',color:C.muted,fontSize:13}}>Historie laden...</div>)}
    {tab==='month'&&(histLoaded?<MonthView history={combined}/>:<div style={{padding:40,textAlign:'center',color:C.muted,fontSize:13}}>Historie laden...</div>)}

    {tab==='today'&&(<div style={{maxWidth:500,margin:'0 auto',padding:'18px 14px 60px'}}>

      <Card title="Slaap" icon="🌙" stripe={C.dark}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <span style={{fontSize:13,color:C.muted}}>Uren geslapen</span>
          <NumInput value={data.sleep.hours} onChange={v=>upd(d=>{d.sleep.hours=v;return d;})} step={0.5} unit="uur" okWhen={v=>v>6}/>
        </div>
        {[['mouth','😮‍💨','Sticker op mond (neusademhaling)'],['snurkApp','📱','Snurk app bijgehouden'],['sleepApp','⌚','Slaap app + horloge bijgehouden'],['reading','📖','30 min gelezen voor het slapengaan']].map(([k,em,lb])=>(<Check key={k} on={data.sleep[k]} toggle={()=>upd(d=>{d.sleep[k]=!d.sleep[k];return d;})}>{em} {lb}</Check>))}
      </Card>

      <Card title="Ochtend Ritueel" icon="🌅" stripe={C.gold}>
        <div style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}><span style={{fontSize:11,color:C.muted}}>Voortgang</span><span style={{fontSize:11,color:C.muted,fontWeight:600}}>{morningDone}/{morningKeys.length}</span></div>
          <div style={{background:C.border,borderRadius:4,height:5}}><div style={{height:'100%',borderRadius:4,background:C.gold,width:`${morningKeys.length?(morningDone/morningKeys.length)*100:0}%`,transition:'width .4s'}}/></div>
        </div>
        {[['water','💧','Glas water drinken'],['sunlight','☀️','Direct zonlicht buiten'],['exercise','🤸','Push-ups · Sit-ups · Squats'],['meditation','🧘','Meditatie — 10 min'],['breakfast','🍳','3 eieren + kip + Heinz ketchup zero'],...(!isOfficDay?[['wimHof','🌬️','Wim Hof ademhaling']]:[])].map(([k,em,lb])=>(<Check key={k} on={data.morning[k]} toggle={()=>upd(d=>{d.morning[k]=!d.morning[k];return d;})}>{em} {lb}</Check>))}
        {!isOfficDay&&<p style={{margin:'10px 0 0',fontSize:11,color:C.muted,fontStyle:'italic',borderTop:`1px dashed ${C.border}`,paddingTop:8}}>{isFreeFri?'🏖️ Vrije dag — geniet ervan!':'🏠 Thuisdag — Wim Hof erbij'}</p>}
      </Card>

      <Card title="Dagelijkse Verdieping" icon="🧠" stripe="#4A6FA5">
        <p style={{margin:'0 0 12px',fontSize:12,color:C.muted}}>15 minuten iets nieuws leren — elke dag een ander onderwerp</p>
        <DailyTopic done={data.cognitive.deepLearn} onDone={()=>upd(d=>{d.cognitive.deepLearn=!d.cognitive.deepLearn;return d;})}/>
      </Card>

      {hasSport&&(<Card title="Sport" icon="🏃" stripe={C.accent}>
        <div onClick={()=>upd(d=>{d.sport=!d.sport;return d;})} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderRadius:12,cursor:'pointer',background:data.sport?'#EBF5F0':C.soft,border:`2px solid ${data.sport?C.green:C.border}`,transition:'all .2s'}}>
          <div>
            <div style={{fontSize:26,lineHeight:1,marginBottom:4}}>{sport.emoji}</div>
            <p style={{margin:0,fontWeight:600,fontSize:15,color:C.text}}>{sport.name}</p>
            <p style={{margin:'2px 0 0',fontSize:12,color:C.muted}}>{sport.detail}</p>
            <p style={{margin:'2px 0 0',fontSize:11,color:data.sport?C.green:'#B8872A',fontWeight:600}}>🔥 ~{sport.burn} kcal verbranding</p>
          </div>
          <div style={{width:34,height:34,borderRadius:10,flexShrink:0,border:`2px solid ${data.sport?C.green:C.border}`,background:data.sport?C.green:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>{data.sport&&<span style={{color:'white',fontWeight:800,fontSize:16}}>✓</span>}</div>
        </div>
      </Card>)}

      {isPauseDay&&(<Card title="Pauze Wandeling" icon="🌳" stripe="#5B8C5A">
        <Check on={data.pauseWalk} toggle={()=>upd(d=>{d.pauseWalk=!d.pauseWalk;return d;})}>🚶 30 minuten wandelen in pauze · <span style={{color:C.green,fontWeight:600}}>~{WALK_BURN} kcal</span></Check>
      </Card>)}

      <Card title="Cognitief & Gezondheid" icon="⚡" stripe="#5B4FCF">
        <p style={{margin:'0 0 8px',fontSize:11,color:C.muted,fontStyle:'italic'}}>Kleine gewoontes met groot effect op focus, geheugen en helderheid</p>
        {[['omega3','🐟','Omega-3 genomen (hersenfunctie + focus)'],['vitD','☀️','Vitamine D genomen (immuun, stemming, slaap)'],['magnesium','💊','Magnesium glycinaat genomen (slaap, brain fog)'],['water2L','💧','2 liter water gedronken (minder brain fog)'],['noScreenBed','📵','Geen scherm 30 min voor bed (slaapkwaliteit)']].map(([k,em,lb])=>(<Check key={k} on={data.cognitive[k]} toggle={()=>upd(d=>{d.cognitive[k]=!d.cognitive[k];return d;})}>{em} {lb}</Check>))}
      </Card>

      <Card title="Voeding" icon="🥗" stripe={C.dark}>
        <p style={{margin:'0 0 10px',fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>Maaltijden</p>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <MealBtn label="Ontbijt" emoji="🍳" kcal={MK.ontbijt} on={data.nutrition.ontbijt} toggle={()=>upd(d=>{d.nutrition.ontbijt=!d.nutrition.ontbijt;return d;})}/>
          <MealBtn label="Lunch" emoji="🥙" kcal={MK.lunch} on={data.nutrition.lunch} toggle={()=>upd(d=>{d.nutrition.lunch=!d.nutrition.lunch;return d;})}/>
          <MealBtn label="Avondeten" emoji="🍽️" kcal={MK.avondeten} on={data.nutrition.avondeten} toggle={()=>upd(d=>{d.nutrition.avondeten=!d.nutrition.avondeten;return d;})}/>
        </div>
        <p style={{margin:'0 0 8px',fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>Standaard snacks</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {SNACKS.map(sn=>{const on=(data.nutrition.snacks||[]).includes(sn.id);return(<button key={sn.id} onClick={()=>upd(d=>{const i=d.nutrition.snacks.indexOf(sn.id);i===-1?d.nutrition.snacks.push(sn.id):d.nutrition.snacks.splice(i,1);return d;})} style={{padding:'6px 12px',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'DM Sans,sans-serif',transition:'all .18s',border:`1.5px solid ${on?C.dark:C.border}`,background:on?C.dark:'white',color:on?'white':C.text}}>{sn.emoji} {sn.label} <span style={{opacity:.6}}>({sn.kcal})</span></button>);})}
        </div>
        <p style={{margin:'0 0 8px',fontSize:11,color:C.muted,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase'}}>Extra voeding toevoegen</p>
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          <input value={newFood.name} onChange={e=>setNewFood(f=>({...f,name:e.target.value}))} placeholder="Naam" style={{flex:2,padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontFamily:'DM Sans,sans-serif',fontSize:13,outline:'none'}}/>
          <input type="number" value={newFood.kcal} onChange={e=>setNewFood(f=>({...f,kcal:e.target.value}))} placeholder="kcal" style={{flex:1,padding:'8px 10px',borderRadius:8,border:`1px solid ${C.border}`,fontFamily:'DM Sans,sans-serif',fontSize:13,outline:'none'}}/>
          <button onClick={addCustomFood} style={{padding:'8px 14px',borderRadius:8,background:C.dark,color:'white',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>+</button>
        </div>
        {(data.nutrition.customFoods||[]).length>0&&(<div style={{marginBottom:14}}>{data.nutrition.customFoods.map((f,i)=>(<div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.text}}>🍴 {f.name}</span><div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:12,color:C.muted}}>{f.kcal} kcal</span><button onClick={()=>upd(d=>{d.nutrition.customFoods.splice(i,1);return d;})} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:C.accent}}>✕</button></div></div>))}</div>)}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <span style={{fontSize:13,color:C.muted,minWidth:90}}>🍺 Bier vandaag</span>
          {['-',null,'+'].map((lbl,i)=>lbl?(<button key={i} onClick={()=>upd(d=>{d.nutrition.beer=Math.max(0,d.nutrition.beer+(lbl==='+'?1:-1));return d;})} style={{width:30,height:30,borderRadius:8,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',fontSize:16,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:C.dark}}>{lbl}</button>):(<span key={i} style={{fontWeight:700,fontSize:17,minWidth:28,textAlign:'center',color:C.dark}}>{data.nutrition.beer}</span>))}
          {data.nutrition.beer>0&&<span style={{fontSize:11,color:C.muted}}>+{(data.nutrition.beer||0)*150} kcal</span>}
        </div>
        <div style={{background:C.soft,borderRadius:10,padding:'10px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{fontSize:12,color:C.muted}}>Totaal inname</span><span style={{fontSize:13,fontWeight:700,color:totalIntake>1850?C.accent:C.green}}>{totalIntake} / 1850 kcal</span></div>
          <div style={{background:C.border,borderRadius:4,height:6,overflow:'hidden'}}><div style={{height:'100%',borderRadius:4,background:totalIntake>1850?C.accent:C.green,width:`${Math.min(100,(totalIntake/1850)*100)}%`,transition:'width .4s'}}/></div>
        </div>
      </Card>

      <EnergieBalans
        intake={totalIntake}
        burn={todayBurn}
        hasSport={hasSport}
        sport={sport}
        isPauseDay={isPauseDay}
        pauseWalk={data.pauseWalk}
        sportDone={data.sport}
      />

      <Card title="Schermtijd" icon="📱" stripe="#6B5B95">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{fontSize:13,color:C.muted}}>Schermtijd vandaag (Brick)</span>
          <NumInput value={data.screen} onChange={v=>upd(d=>{d.screen=v;return d;})} step={0.1} unit="uur" okWhen={v=>v<2}/>
        </div>
        <p style={{margin:'6px 0 0',fontSize:11,color:C.muted}}>Doel: onder de 2 uur blijven</p>
      </Card>

      {hasCall&&(<Card title="Bellen vandaag" icon="📞" stripe={C.gold}>
        <p style={{margin:'0 0 8px',fontSize:11,color:C.muted}}>Week {week} — {isA?'A':'B'}</p>
        {callBroer&&<Check on={data.called.broer} toggle={()=>upd(d=>{d.called.broer=!d.called.broer;return d;})}>👦 Bellen met broer</Check>}
        {callOuders&&<Check on={data.called.ouders} toggle={()=>upd(d=>{d.called.ouders=!d.called.ouders;return d;})}>👨‍👩‍👦 Bellen met ouders</Check>}
      </Card>)}

      <Card title="Gedachten & Onderbewuste" icon="💭" stripe="#7B8FA1">
        <p style={{margin:'0 0 10px',fontSize:12,color:C.muted,fontStyle:'italic',lineHeight:1.5}}>Schrijf op wat er in je hoofd speelt. Gewoon laten landen.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
          {['Wat houdt mij bezig?','Waar maak ik mij zorgen over?','Wat wil ik niet vergeten?','Wat wil ik loslaten?'].map(q=>(<button key={q} onClick={()=>upd(d=>{d.thoughts=(d.thoughts?d.thoughts+'\n\n':'')+q+'\n';return d;})} style={{padding:'4px 10px',borderRadius:16,fontSize:11,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',color:C.muted,fontFamily:'DM Sans,sans-serif'}}>+ {q}</button>))}
        </div>
        <textarea value={data.thoughts} onChange={e=>upd(d=>{d.thoughts=e.target.value;return d;})} placeholder="Typ hier vrij..." rows={5} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.text,resize:'vertical',outline:'none',background:'#FAFAF7',lineHeight:1.7,boxSizing:'border-box'}}/>
      </Card>

      <Card title="Hoe voel ik me vandaag?" icon="💚" stripe={C.green}>
        <div style={{display:'flex',gap:8,padding:'4px 0 10px'}}>
          {[1,2,3,4,5].map(n=>(<button key={n} onClick={()=>upd(d=>{d.happiness=d.happiness===n?0:n;return d;})} style={{flex:1,padding:'12px 4px',borderRadius:12,border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:data.happiness===n?C.dark:C.soft,transform:data.happiness===n?'scale(1.06)':'scale(1)',transition:'all .2s',boxShadow:data.happiness===n?'0 4px 12px rgba(0,0,0,.12)':'none'}}><span style={{fontSize:24}}>{HAPPY_EMOJI[n]}</span><span style={{fontSize:10,fontFamily:'DM Sans,sans-serif',color:data.happiness===n?'white':C.muted,fontWeight:500}}>{HAPPY_LBL[n]}</span></button>))}
        </div>
        {data.happiness>0&&data.happiness<=2&&<p style={{margin:'4px 0 0',fontSize:12,color:C.muted,fontStyle:'italic',borderTop:`1px dashed ${C.border}`,paddingTop:10}}>🌱 Morgen is een nieuwe dag. Wat kan jij vandaag nog goed doen voor jezelf?</p>}
        {data.happiness>=4&&<p style={{margin:'4px 0 0',fontSize:12,color:C.green,fontStyle:'italic',borderTop:`1px dashed ${C.border}`,paddingTop:10}}>✨ Goed bezig — onthoud dit gevoel.</p>}
      </Card>

      <Card title="Notities & Reflectie" icon="📝" stripe={C.muted}>
        <textarea value={data.notes} onChange={e=>upd(d=>{d.notes=e.target.value;return d;})} placeholder="Gedachten, intenties, reflecties..." rows={4} style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',fontFamily:'DM Sans,sans-serif',fontSize:13,color:C.text,resize:'vertical',outline:'none',background:'#FAFAF7',lineHeight:1.7,boxSizing:'border-box'}}/>
      </Card>

    </div>)}
  </div>);
}
