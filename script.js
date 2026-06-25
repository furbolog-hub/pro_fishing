'use strict';

const TelegramApp = window.Telegram?.WebApp ?? null;
if (TelegramApp) {
  TelegramApp.ready();
  TelegramApp.expand();
  TelegramApp.onEvent?.('themeChanged', () => document.documentElement.dataset.theme = TelegramApp.colorScheme || 'dark');
}

const SOUND_PATHS = {
  cast: './cast.ogg',
  bonus: './bonus.ogg',
  debuff: './debuff.ogg',
  epic: './epic.ogg',
  legendary: './legendary.ogg',
  achievement: './achievement.ogg',
  angus: './angus.ogg',
  weather: './weather.ogg'
};

const sounds = Object.fromEntries(
  Object.entries(SOUND_PATHS).map(([name, path]) => {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = 0.7;
    return [name, audio];
  })
);
sounds.cast.volume = 0.55;
sounds.weather.volume = 0.6;
sounds.angus.volume = 0.9;
sounds.achievement.volume = 0.9;

let soundEnabled = true;
function playSound(name) {
  if (!soundEnabled || !sounds[name]) return;
  const audio = sounds[name].cloneNode(true);
  audio.volume = sounds[name].volume;
  audio.play().catch(() => {});
}

const DAILY_KEY = 'proFishingDailySessionV2';
const localDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DATA = {
  fish: ['кижуч','плотва','жёлтый окунь','семотилус','солнечник','семга','меланотения','жерех','горчак','ринихт','лосось','щука','каменный окунь','корюшка','малый солнечник','арктический голец','судак','красноперка','золотая форель','моксостома','форелеокунь','палия','зеленый солнечник','белый амур','фундулюс','полосатый окунь','длинноухий солнечник','белый сом','золотая рыбка','подкаменщик','озерный сиг','окунь','карпиодес'],
  giants: ['гигантский усач','озерный осетр','нильский окунь','карп','сом','гигантский судак'],
  trash: ['погнутый крючок','рваный башмак','обрывок газеты','спутанная леска','половина блесны','консервная банка','сломанная ветка','ржавое ведро','пластиковая бутылка','полиэтиленовый пакет','обрывок ткани','пустая ракушка','чей-то обгрызенный плавник','обломок весла','резиновый сапог','комок водорослей','колпачок от ручки','утопленный мобильник','жестяная кружка','зубная щетка','осколок разбитой фары','череп крупной рыбы','размокшее полено'],
  bonuses: ['Подводная маска','Ласты','Акваланг','Счастливый поплавок','Снаряжение дайвера'],
  epics: ['Бездонный ларь','Компас потерянных глубин','Послание в бутылке','Чешуя Левиафана','Эссенция «Великан Океанов»'],
  legendary: ['Глубоководное нечто','Игральная кость','Штурвал Наутилуса','Плавник мегалодона'],
  debuffs: ['Чайка','Рак','Утка','Осьминог','Касатка'],
  weather: {
    sunny: { name:'Солнечно', icon:'☀️', text:'Высока вероятность дебафа «Чайка».' },
    rain: { name:'Дождь', icon:'🌧️', text:'Высока вероятность дебафа «Утка».' },
    calm: { name:'Штиль', icon:'🌊', text:'Высока вероятность дебафа «Рак».' },
    golden: { name:'Золотой час', icon:'🌅', text:'Меньше хлама, бонусов и дебафов. Рыба получает +1–4 кг.' },
    fog: { name:'Туман', icon:'🌫️', text:'Повышен шанс эпических артефактов.' },
    eclipse: { name:'Затмение', icon:'🌑', text:'Повышен шанс легендарных артефактов.' },
    thunder: { name:'Гроза', icon:'⛈️', text:'Больше тяжеловесов и хлама из-за ударов молнии.' },
    storm: { name:'Шторм', icon:'🌪️', text:'Бонусы и дебафы не выпадают. Много хлама, артефакты встречаются чаще.' }
  }
};

const BASE_WEIGHTS = { normal:55, heavy:8, giant:2, trash:17, bonus:8, debuff:6, epic:3, legendary:1 };
const $ = (id) => document.getElementById(id);
const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
const kg = (n) => `${round1(n).toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1})} кг`;
const rand = (min,max) => Math.random() * (max-min) + min;
const rand1 = (min,max) => round1(rand(min,max));
const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];
const chance = (p) => Math.random() < p;
const uid = () => crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function initialState() {
  return {
    castsLeft:10, castClicks:0, weather:pick(Object.keys(DATA.weather)), finished:false,
    fish:[], trash:[], history:[], stolen:[], eaten:[],
    bonuses:[], artifacts:[], debuffs:[], disabledBonusIds:new Set(),
    compassUsed:false, leviathanStep:0, diverPending:false, essenceUsed:false,
    deepThingActive:false, nautilus:false, megalodon:false, diceFinalMultiplier:1,
    directHeavy:false, directGiant:false, angusGift:false, octopusSeen:false,
    receivedDebuffCount:0, bonusArtifactCount:0, artifactCount:0, stormSeen:false,
    sessionDate:null, finalResult:null
  };
}
function serializeState(value) {
  return JSON.stringify({...value, disabledBonusIds:[...value.disabledBonusIds]});
}
function hydrateState(raw) {
  const parsed = JSON.parse(raw);
  return {...initialState(), ...parsed, disabledBonusIds:new Set(parsed.disabledBonusIds || [])};
}
function loadDailyState() {
  try {
    const saved = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
    if (saved?.date === localDayKey() && saved.state) return hydrateState(saved.state);
    if (saved?.date && saved.date !== localDayKey()) localStorage.removeItem(DAILY_KEY);
  } catch (error) {
    console.warn('Не удалось восстановить игровую сессию', error);
  }
  return initialState();
}
function saveDailyState() {
  if (!state.sessionDate) return;
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({date:state.sessionDate, state:serializeState(state)}));
  } catch (error) {
    console.warn('Не удалось сохранить игровую сессию', error);
  }
}

let state = loadDailyState();
if (state.weather==='storm') state.stormSeen=true;

function activeBonuses(name) {
  return state.bonuses.filter(b => b.name === name && !state.disabledBonusIds.has(b.id));
}
function hasBonus(name) { return activeBonuses(name).length > 0; }
function activeDebuff(name) { return state.debuffs.some(d => d.name === name && d.active); }
function addHistory(text,type='event',detail='') {
  const row={id:uid(),text,type,detail}; state.history.push(row); renderHistory();
}
function toast(text) {
  const el=$('toast'); el.textContent=text; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2200);
}
function weightedResult(weights) {
  const entries=Object.entries(weights).filter(([,v])=>v>0); const total=entries.reduce((s,[,v])=>s+v,0);
  let roll=Math.random()*total;
  for (const [key,value] of entries) { roll-=value; if (roll<=0) return key; }
  return entries.at(-1)[0];
}
function currentWeights() {
  const w={...BASE_WEIGHTS};
  if (state.weather==='golden') { w.trash*=.4; w.bonus*=.4; w.debuff*=.4; }
  if (state.weather==='fog') w.epic*=3;
  if (state.weather==='eclipse') w.legendary*=4;
  if (state.weather==='thunder') { w.heavy*=2.5; w.trash*=2; }
  if (state.weather==='storm') { w.bonus=0; w.debuff=0; w.trash*=3; w.epic*=1.5; w.legendary*=1.5; }
  if (activeDebuff('Утка')) w.trash*=3;
  if (state.megalodon) w.giant*=1.5;
  return w;
}
function chooseDebuff() {
  const w={Чайка:1,Рак:1,Утка:1,Осьминог:1,Касатка:1};
  if (state.weather==='sunny') w.Чайка=5;
  if (state.weather==='rain') w.Утка=5;
  if (state.weather==='calm') w.Рак=5;
  return weightedResult(w);
}

function makeFish(category='normal', source='Заброс', direct=true) {
  const giant=category==='giant';
  let original=giant?rand1(20,40):category==='heavy'?rand1(10,19.9):rand1(.1,9.9);
  const f={id:uid(),name:pick(giant?DATA.giants:DATA.fish),category,originalWeight:original,weight:original,source,direct,removed:false,tags:[],debuffLimited:false};

  if (!state.megalodon && (activeDebuff('Рак') || activeDebuff('Утка'))) {
    const max=activeDebuff('Рак')?2.5:3;
    f.weight=rand1(.1,max); f.debuffLimited=true; f.tags.push(`ограничение до ${kg(max)}`);
  }
  if (state.weather==='golden') { const plus=Math.floor(rand(1,5)); f.weight=round1(f.weight+plus); f.tags.push(`<span class="gold-add">+${plus} кг</span>`); }
  if (state.leviathanStep>=0 && state.artifacts.some(a=>a.name==='Чешуя Левиафана')) {
    state.leviathanStep+=1; const plus=state.leviathanStep*5; f.weight=round1(f.weight+plus); f.tags.push(`Чешуя +${plus} кг`);
  }
  const flippers=activeBonuses('Ласты').filter(b=>b.startFishIndex<=state.fish.length).length;
  if (flippers>0) {
    const eligibleCount=state.fish.filter(x=>!x.removed && x.createdAfterFlippers).length+1;
    f.createdAfterFlippers=true;
    if (eligibleCount%2===0) { const factor=Math.pow(state.nautilus?4:2,flippers); f.weight=round1(f.weight*factor); f.tags.push(`Ласты ×${factor}`); }
  }
  if (activeDebuff('Касатка') && f.weight>=5.5 && !state.megalodon) {
    f.removed=true; state.eaten.push(f); addHistory(`🐋 Касатка съела: ${f.name} (${kg(f.weight)})`,'debuff'); return f;
  }
  state.fish.push(f);
  if (direct && category==='heavy') state.directHeavy=true;
  if (direct && category==='giant') state.directGiant=true;
  addHistory(`${giant?'🏆 ':''}${capitalize(f.name)} — ${kg(f.weight)}`,'fish',`${source}${f.tags.length?` • ${f.tags.join(' • ')}`:''}`);
  tryResolvePendingEssence();
  return f;
}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}

function processTrash() {
  const item=pick(DATA.trash);
  if (state.deepThingActive) {
    addHistory(`${capitalize(item)} превратился в гиганта`,'legendary','Глубоководное нечто');
    makeFish('giant','Трансмутация хлама',false); return;
  }
  state.trash.push({id:uid(),name:item,converted:false});
  addHistory(capitalize(item),'trash',state.weather==='thunder'?'⚡ Удар молнии поднял хлам со дна':'' );
  if (hasBonus('Счастливый поплавок')) {
    const restore=state.nautilus?2:1; state.castsLeft+=restore; addHistory(`Счастливый поплавок вернул ${restore} заброс${restore===1?'':'а'}`,'bonus');
  }
}
function processBonus() {
  const name=pick(DATA.bonuses); playSound('bonus'); state.bonusArtifactCount++;
  if (name==='Снаряжение дайвера' && state.debuffs.some(d=>['Чайка','Рак','Утка'].includes(d.name))) {
    addHistory(`${name}: выберите замену`,'bonus');
    showChoice('Снаряжение дайвера','Дебаф уже был получен. Выберите замену:', ['Подводная маска','Ласты','Счастливый поплавок'], choice=>grantBonus(choice));
    return;
  }
  grantBonus(name);
}
function grantBonus(name) {
  const bonus={id:uid(),name,startFishIndex:state.fish.length}; state.bonuses.push(bonus);
  addHistory(name,'bonus',name==='Ласты'?'Действуют только на будущих рыб':'' );
}
function diverBlocks(name) { return ['Чайка','Рак','Утка'].includes(name) && hasBonus('Снаряжение дайвера'); }
function processDebuff(forcedName=null) {
  const name=forcedName||chooseDebuff(); state.receivedDebuffCount++;
  if (state.megalodon) { addHistory(`${name} нейтрализован Плавником мегалодона`,'debuff'); return; }
  if (diverBlocks(name)) { addHistory(`${name} заблокирован Снаряжением дайвера`,'bonus'); return; }
  playSound('debuff');
  const d={id:uid(),name,active:true}; state.debuffs.push(d); addHistory(name,'debuff');
  if (name==='Чайка') {
    const candidates=state.fish.filter(f=>!f.removed);
    if (!candidates.length) { addHistory('Чайке нечего красть','event'); return; }
    const victim=pick(candidates); victim.removed=true; state.stolen.push(victim); addHistory(`Чайка украла: ${victim.name} (${kg(victim.weight)})`,'debuff');
  }
  if (name==='Осьминог') {
    state.octopusSeen=true;
    state.bonuses.forEach(b=>state.disabledBonusIds.add(b.id));
    addHistory('Все ранее полученные бонусы отключены навсегда','debuff');
  }
  if (name==='Касатка') {
    state.fish.filter(f=>!f.removed&&f.weight>=5.5).forEach(f=>{f.removed=true;state.eaten.push(f);});
    addHistory('Касатка съела всю рыбу весом от 5,5 кг','debuff');
  }
}

function processEpic(name=pick(DATA.epics), fromAngus=false) {
  playSound('epic');
  state.artifacts.push({id:uid(),name,tier:'epic'}); state.artifactCount++; state.bonusArtifactCount++;
  if (fromAngus) state.angusGift=true;
  addHistory(name,'epic',fromAngus?'Дар старины Ангуса':'');
  if (name==='Бездонный ларь') {
    const count=Math.floor(rand(1,6));
    for(let i=0;i<count;i++) makeFish(chance(.01)?'giant':chance(.35)?'heavy':'normal','Бездонный ларь',false);
  }
  if (name==='Компас потерянных глубин') {
    if (!state.compassUsed) {
      state.compassUsed=true;
      showChoice('Компас потерянных глубин','Выберите новую погоду. Лимит забросов станет равен 10.',Object.keys(DATA.weather).map(k=>DATA.weather[k].name),choice=>{
        const key=Object.keys(DATA.weather).find(k=>DATA.weather[k].name===choice); state.weather=key; state.castsLeft=10; playSound('weather'); addHistory(`Компас сменил погоду на «${choice}» и восстановил лимит`,'weather','Компас потерянных глубин'); render();
      });
    } else if (chance(.02)) encounterAngus(true); else addHistory('Компас уже использован и на этот раз молчит','event');
  }
  if (name==='Послание в бутылке') restoreByMessage();
  if (name==='Чешуя Левиафана') { state.castsLeft+=5; state.leviathanStep=0; }
  if (name==='Эссенция «Великан Океанов»') applyEssence();
}
function restoreByMessage() {
  state.stolen.forEach(f=>{f.removed=false; if(!state.fish.includes(f)) state.fish.push(f);});
  const restored=state.stolen.length; state.stolen=[];
  state.fish.filter(f=>!f.removed&&f.debuffLimited).forEach(f=>{f.weight=round1(f.weight*2);f.tags.push('Послание ×2');enforceOrca(f);});
  addHistory(`Послание вернуло украденных рыб: ${restored} и удвоило повреждённый улов`,'epic');
}
function applyEssence() {
  const fishes=state.fish.filter(f=>!f.removed).sort((a,b)=>a.weight-b.weight);
  if (!fishes.length) { state.essencePending=true; addHistory('Эссенция ждёт появления первой рыбы','epic'); return; }
  if (fishes.length===1) { fishes[0].weight=round1(fishes[0].weight*10); fishes[0].tags.push('Эссенция ×10'); enforceOrca(fishes[0]); }
  else fishes.slice(0,2).forEach(f=>{f.weight=round1(f.weight*5);f.tags.push('Эссенция ×5');enforceOrca(f);});
  state.essenceUsed=true; state.essencePending=false;
}
function tryResolvePendingEssence(){ if(state.essencePending) applyEssence(); }
function enforceOrca(f){ if(activeDebuff('Касатка')&&!state.megalodon&&f.weight>=5.5&&!f.removed){f.removed=true;state.eaten.push(f);addHistory(`Касатка съела усиленную рыбу: ${f.name}`,'debuff');} }

function processLegendary(name=pick(DATA.legendary), fromAngus=false) {
  playSound('legendary');
  state.artifacts.push({id:uid(),name,tier:'legendary'}); state.artifactCount++; state.bonusArtifactCount++;
  if (fromAngus) state.angusGift=true;
  addHistory(name,'legendary',fromAngus?'Дар старины Ангуса':'');
  if (name==='Глубоководное нечто') activateDeepThing();
  if (name==='Игральная кость') showChoice('Игральная кость','Выберите один эффект:', ['+5 забросов','×5 финальный вес'], choice=>{ if(choice.startsWith('+'))state.castsLeft+=5;else state.diceFinalMultiplier*=5; addHistory(`Игральная кость: ${choice}`,'legendary');render(); });
  if (name==='Штурвал Наутилуса') { state.nautilus=true; activateDeepThing(); }
  if (name==='Плавник мегалодона') activateMegalodon();
}
function activateDeepThing() {
  state.deepThingActive=true;
  const items=state.trash.filter(t=>!t.converted); items.forEach(t=>{t.converted=true;makeFish('giant','Глубоководное нечто',false);});
  addHistory(`Глубоководное нечто превратило хлам: ${items.length}`,'legendary');
}
function activateMegalodon() {
  state.megalodon=true;
  state.debuffs.forEach(d=>d.active=false);
  [...state.stolen,...state.eaten].forEach(f=>{f.removed=false;f.weight=f.originalWeight;if(!state.fish.includes(f))state.fish.push(f);});
  state.stolen=[];state.eaten=[];
  state.fish.forEach(f=>{if(f.debuffLimited){f.weight=f.originalWeight;f.debuffLimited=false;}});
  addHistory('Все дебафы нейтрализованы, пострадавшая рыба восстановлена','legendary');
}

function encounterAngus(fromCompass=false) {
  playSound('angus');
  addHistory('Появился старина Ангус','angus',fromCompass?'Призван повторным Компасом':'Случайная встреча');
  if (chance(.05)) {
    if (chance(.85)) processEpic(pick(DATA.epics),true); else processLegendary(pick(DATA.legendary),true);
  } else {
    addHistory('У Ангуса нет артефакта, но он добавляет гиганта','event'); makeFish('giant','Старина Ангус',false);
  }
}

function castLine() {
  if (state.finished || state.castsLeft<=0 || $('choiceDialog').open) return;
  TelegramApp?.HapticFeedback?.impactOccurred?.('medium');
  if (!state.sessionDate) state.sessionDate=localDayKey();
  playSound('cast');
  state.castClicks++; state.castsLeft--;
  const type=weightedResult(currentWeights());
  if (type==='normal'||type==='heavy'||type==='giant') makeFish(type,'Заброс',true);
  if (type==='trash') processTrash();
  if (type==='bonus') processBonus();
  if (type==='debuff') processDebuff();
  if (type==='epic') processEpic();
  if (type==='legendary') processLegendary();
  if (chance(.02)) encounterAngus();
  if (chance(.10)) changeWeatherRandomly();
  if (state.castsLeft<=0 && !$('choiceDialog').open) finishGame();
  render();
}
function changeWeatherRandomly() {
  const options=Object.keys(DATA.weather).filter(k=>k!==state.weather); state.weather=pick(options);
  if (state.weather==='storm') state.stormSeen=true;
  playSound('weather');
  addHistory(`Погода изменилась: ${DATA.weather[state.weather].name}`,'weather');
}

function finalFishSnapshot() {
  const fish=state.fish.filter(f=>!f.removed).map(f=>({...f}));
  const masks=activeBonuses('Подводная маска').length;
  if (masks) { const factor=Math.pow(state.nautilus?3:1.5,masks); fish.forEach(f=>f.weight=round1(f.weight*factor)); }
  const tanks=activeBonuses('Акваланг').length;
  if (tanks) {
    const target=fish.filter(f=>!f.removed).sort((a,b)=>b.weight-a.weight)[0];
    if (target) target.weight=round1(target.weight*((state.nautilus?6:3)*tanks));
  }
  if (state.diceFinalMultiplier>1) fish.forEach(f=>f.weight=round1(f.weight*state.diceFinalMultiplier));
  fish.forEach(f=>{ if(activeDebuff('Касатка')&&!state.megalodon&&f.weight>=5.5) f.removed=true; });
  return fish.filter(f=>!f.removed);
}
function achievements(finalFish,total) {
  const a=[]; const activeTrash=state.trash.filter(t=>!t.converted);
  if (!finalFish.length && activeTrash.length>0) a.push('Трепетный эколог');
  if (finalFish.length && finalFish.every(f=>f.weight<=2.5)) a.push('Аквариумный мастер');
  if (state.bonusArtifactCount>=3) a.push('Любимчик Фортуны');
  if (!state.stormSeen && state.receivedDebuffCount===0) a.push('Неуловимый');
  if (state.directHeavy) a.push('Везунчик');
  if (state.directGiant) a.push('Первобытный триумф');
  if (total>=100&&total<200) a.push('Гроза океана');
  if (total>=200) a.push('Повелитель глубин');
  if (state.artifactCount>=2) a.push('Благословение семи морей');
  if (state.castClicks>=10) a.push('Марафонец');
  if (finalFish.filter(f=>f.category==='giant').length>=2) a.push('Мастер крупных форм');
  if (state.essenceUsed) a.push('Трансмутатор');
  if (state.angusGift) a.push('Дар великого мастера');
  return a;
}
function finishGame() {
  state.finished=true;
  const finalFish=finalFishSnapshot();
  let total=round1(finalFish.reduce((s,f)=>s+f.weight,0));
  const earned=achievements(finalFish,total);
  const ended=new Date();
  state.finalResult={total,earned,finishedAt:ended.toISOString()};
  renderResultCard();
  if (earned.length) playSound('achievement');
  addHistory('Игровая сессия завершена','event');
  TelegramApp?.HapticFeedback?.notificationOccurred?.('success');
  const payload={game:'pro-fishing',totalWeight:total,achievements:earned,finishedAt:ended.toISOString(),casts:state.castClicks};
  try { if (TelegramApp?.initData && typeof TelegramApp.sendData==='function') TelegramApp.sendData(JSON.stringify(payload)); } catch(e){ console.warn('sendData недоступен для этого способа запуска',e); }
  saveDailyState();
}

function renderResultCard() {
  if (!state.finalResult) {
    $('resultCard').classList.add('hidden');
    $('resultCard').innerHTML='';
    return;
  }
  const {total, earned, finishedAt}=state.finalResult;
  const ended=new Date(finishedAt);
  $('resultCard').innerHTML=`
    <h3>Итоговый вес: ${kg(total)}</h3>
    <div class="result-achievements-title">🚀 Достижения</div>
    ${earned.length
      ? `<ul class="result-achievements">${earned.map(x=>`<li>🎉 ${x}</li>`).join('')}</ul>`
      : '<p class="result-none">В этой сессии достижений нет.</p>'}
    <div class="result-date">${ended.toLocaleString('ru-RU')}</div>`;
  $('resultCard').classList.remove('hidden');
}

function render() {
  const weather=DATA.weather[state.weather];
  $('weatherLabel').textContent=weather.name; $('weatherTitle').textContent=weather.name; $('weatherDescription').textContent=weather.text; $('weatherScene').textContent=weather.icon;
  $('castsLabel').textContent=state.castsLeft; $('weightLabel').textContent=kg(state.fish.filter(f=>!f.removed).reduce((s,f)=>s+f.weight,0));
  $('castBtn').disabled=state.finished||state.castsLeft<=0; $('castBtn').textContent=state.finished?'Сессия завершена':'🎣 Забросить удочку';
  $('restartBtn').disabled=Boolean(state.sessionDate);
  $('restartBtn').title=state.sessionDate?'В сутки доступна только одна игровая сессия':'';
  const effects=[];
  activeBonuses('').forEach(()=>{});
  state.bonuses.forEach(b=>effects.push({label:`🎁 ${b.name}${state.disabledBonusIds.has(b.id)?' (отключён)':''}`}));
  state.artifacts.forEach(a=>effects.push({label:`${a.tier==='legendary'?'🟠':'🟣'} ${a.name}`}));
  state.debuffs.forEach(d=>effects.push({label:`🔴 ${d.name}${d.active?'':' (нейтрализован)'}`}));
  $('effectsList').innerHTML=effects.length?effects.map(e=>`<span class="chip">${e.label}</span>`).join(''):'<span class="muted">Пока нет</span>';
  $('effectCount').textContent=effects.length;
  renderHistory();
  renderResultCard();
  saveDailyState();
}
function renderHistory() {
  const icons={fish:'🐟',bonus:'✅',debuff:'🛑',epic:'💜',legendary:'🧡',trash:'🔘',weather:'⚠️',angus:'🧔'};
  $('historyCount').textContent=state.history.length; $('emptyHistory').classList.toggle('hidden',state.history.length>0);
  $('historyList').innerHTML=state.history.map((h,i)=>`<li class="history-item type-${h.type}"><strong>${i+1}. ${icons[h.type] || ''} ${h.text}</strong>${h.detail?`<small>${h.detail}</small>`:''}</li>`).join('');
}

function showChoice(title,text,options,onSelect) {
  $('choiceTitle').textContent=title; $('choiceText').textContent=text; const box=$('choiceButtons'); box.innerHTML='';
  options.forEach(option=>{const b=document.createElement('button');b.textContent=option;b.onclick=()=>{$('choiceDialog').close();onSelect(option);render();if(state.castsLeft<=0&&!state.finished)finishGame();};box.appendChild(b);});
  $('choiceDialog').showModal();
}

const GUIDE = {
  'Погода': Object.values(DATA.weather).map(x=>[`${x.icon} ${x.name}`,x.text]),
  'Бонусы': [
    ['Подводная маска','Каждая оставшаяся рыба в финале ×1,5. Несколько масок складываются.'],
    ['Ласты','Каждая вторая будущая рыба ×2. Несколько ласт складываются.'],
    ['Акваланг','В финале самая тяжёлая рыба ×3 за каждый акваланг.'],
    ['Счастливый поплавок','Хлам не расходует заброс.'],
    ['Снаряжение дайвера','Блокирует Чайку, Рака и Утку, если получено раньше них.']
  ],
  'Дебафы': [
    ['Чайка','Крадёт случайную рыбу.'],['Рак','Ограничивает весь будущий улов диапазоном 0,1–2,5 кг.'],['Утка','Повышает шанс хлама и ограничивает рыбу 3 кг.'],['Осьминог','Навсегда отключает все бонусы, полученные до его появления.'],['Касатка','Удаляет и не допускает рыбу весом от 5,5 кг.']
  ],
  'Эпические': [
    ['Бездонный ларь','Даёт 1–5 рыб до 19,9 кг с очень низким шансом гиганта.'],['Компас потерянных глубин','Один раз меняет погоду и возвращает лимит к 10. Повторный имеет 2% шанс призвать Ангуса.'],['Послание в бутылке','Возвращает украденную Чайкой рыбу и удваивает повреждённый Раком/Уткой улов.'],['Чешуя Левиафана','+5 забросов; будущие рыбы получают +5, +10, +15 кг и далее.'],['Эссенция «Великан Океанов»','Две самые лёгкие рыбы ×5 или одна рыба ×10.']
  ],
  'Легендарные': [
    ['Глубоководное нечто','Превращает весь хлам в рыб-гигантов.'],['Игральная кость','Выбор: +5 забросов или ×5 финальный вес.'],['Штурвал Наутилуса','Удваивает силу бонусов и призывает Глубоководное нечто.'],['Плавник мегалодона','Нейтрализует дебафы, восстанавливает улов и повышает шанс гиганта на 50%.']
  ],
  'Достижения': [
    ['Трепетный эколог','В улове только хлам.'],['Аквариумный мастер','Все оставшиеся рыбы не тяжелее 2,5 кг.'],['Любимчик Фортуны','Получено не менее 3 бонусов и/или артефактов.'],['Неуловимый','Нет дебафов; недоступно при Шторме.'],['Везунчик','Прямой улов тяжеловеса без помощи.'],['Первобытный триумф','Прямой улов гиганта без помощи.'],['Гроза океана','Финальный вес 100–199,9 кг.'],['Повелитель глубин','Финальный вес от 200 кг.'],['Благословение семи морей','Не менее 2 артефактов.'],['Марафонец','Не менее 10 нажатий «Забросить».'],['Мастер крупных форм','Не менее 2 гигантов.'],['Трансмутатор','Успешно применить Эссенцию.'],['Дар великого мастера','Получить артефакт от Ангуса.']
  ]
};
function openGuide(tab='Погода') {
  $('guideTabs').innerHTML=Object.keys(GUIDE).map(k=>`<button data-tab="${k}" class="${k===tab?'active':''}">${k}</button>`).join('');
  $('guideContent').innerHTML=GUIDE[tab].map(([title,text])=>`<article><h3>${title}</h3><p>${text}</p></article>`).join('');
  $('guideTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>openGuide(b.dataset.tab));
  if(!$('guideDialog').open)$('guideDialog').showModal();
}

$('castBtn').addEventListener('click',castLine);
$('restartBtn').addEventListener('click',()=>{if(state.sessionDate){toast('Доступна только одна игровая сессия в сутки');return;}state=initialState();if(state.weather==='storm')state.stormSeen=true;render();toast('Началась новая игровая сессия');});
$('guideBtn').addEventListener('click',()=>openGuide());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('guideDialog').addEventListener('click',e=>{if(e.target===$('guideDialog'))$('guideDialog').close();});
render();
