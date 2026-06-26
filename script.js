'use strict';

// Реальный Telegram-контекст нельзя определять только по существованию WebApp:
// официальный bridge-скрипт создаёт объект и в обычном Safari.
const TelegramBridge = window.Telegram?.WebApp ?? null;
const telegramLaunchText = `${location.search} ${location.hash}`;
const isRealTelegramContext = Boolean(
  TelegramBridge?.initData ||
  (TelegramBridge?.platform && TelegramBridge.platform !== 'unknown') ||
  /tgWebApp(?:Data|Version|Platform|ThemeParams)/i.test(telegramLaunchText)
);

(function markIPhoneSafariBrowser() {
  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const isPlainIPhoneSafari = isIPhone && isWebKit && !isOtherIOSBrowser && !isRealTelegramContext && !isStandalone;
  document.documentElement.classList.toggle('iphone-safari-browser', isPlainIPhoneSafari);
})();

// Реальная видимая высота окна: защищает нижнюю панель на iPhone Safari
// и не мешает Telegram Mini App использовать собственную stable-height.
let viewportUpdateFrame = 0;
function updateAppViewportHeight() {
  cancelAnimationFrame(viewportUpdateFrame);
  viewportUpdateFrame = requestAnimationFrame(() => {
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height || window.innerHeight;
    const viewportOffsetTop = viewport?.offsetTop || 0;
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      const root = document.documentElement;
      root.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--vv-height', `${Math.round(viewportHeight)}px`);
      root.style.setProperty('--vv-offset-top', `${Math.round(viewportOffsetTop)}px`);
      const panel = document.querySelector('.cast-panel');
      if (panel) {
        root.style.setProperty('--ios-cast-panel-space', `${Math.ceil(panel.getBoundingClientRect().height)}px`);
      }
    }
  });
}
updateAppViewportHeight();
window.addEventListener('resize', updateAppViewportHeight, { passive: true });
window.addEventListener('orientationchange', updateAppViewportHeight, { passive: true });
window.visualViewport?.addEventListener('resize', updateAppViewportHeight, { passive: true });
window.visualViewport?.addEventListener('scroll', updateAppViewportHeight, { passive: true });


const TelegramApp = isRealTelegramContext ? TelegramBridge : null;
if (TelegramApp) {
  document.documentElement.dataset.theme = TelegramApp.colorScheme || 'dark';
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
  weather: './weather.ogg',
  guide: './guide.ogg',
  motion: './motion.ogg'
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
sounds.guide.volume = 0.65;
sounds.motion.volume = 0.65;

let soundEnabled = true;
function playSound(name) {
  if (!soundEnabled || !sounds[name]) return;
  const audio = sounds[name].cloneNode(true);
  audio.volume = sounds[name].volume;
  audio.play().catch(() => {});
}

const MOTION_KEY = 'proFishingReduceMotion';
const storedMotionPreference = localStorage.getItem(MOTION_KEY);
let reduceMotion = storedMotionPreference === null
  ? Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  : storedMotionPreference === '1';
let lastAnimatedHistoryId = null;
let effectTimer = null;

function applyMotionPreference() {
  document.body.classList.toggle('reduce-motion', reduceMotion);
  const button = $('motionBtn');
  if (button) {
    button.classList.toggle('is-reduced', reduceMotion);
    button.textContent = reduceMotion ? '🌙' : '✨';
    button.title = reduceMotion ? 'Включить полные анимации' : 'Уменьшить анимации';
    button.setAttribute('aria-label', button.title);
  }
}
function animateElement(id, className, duration=900) {
  const el=$(id); if (!el || reduceMotion) return;
  el.classList.remove(className); void el.offsetWidth; el.classList.add(className);
  setTimeout(()=>el.classList.remove(className),duration);
}
function showVisualEffect(kind, icon, title, subtitle='', duration=1150, minor=false) {
  if (reduceMotion) return;
  const overlay=$('effectOverlay');
  if (!overlay) return;
  clearTimeout(effectTimer);
  overlay.className=`effect-overlay show ${kind}${minor?' minor':''}`;
  $('effectIcon').textContent=icon;
  $('effectTitle').textContent=title;
  $('effectSubtitle').textContent=subtitle;
  const particles=$('effectParticles'); particles.innerHTML='';
  const particleSymbols = kind==='legendary' ? ['✦','✨','◆','✧'] : kind==='epic' ? ['✦','💜','✧','•'] : kind==='achievement' ? ['🎉','✨','★','✦'] : kind==='giant' ? ['💦','🌊','✦'] : ['•','✦','✨'];
  const count=minor?7:14;
  for(let i=0;i<count;i++) {
    const span=document.createElement('span'); span.className='particle'; span.textContent=pick(particleSymbols);
    const angle=rand(0,Math.PI*2);
    const startDistance=rand(78,118);
    span.style.setProperty('--sx',`${Math.cos(angle)*startDistance}px`);
    span.style.setProperty('--sy',`${Math.sin(angle)*startDistance}px`);
    span.style.setProperty('--r',`${Math.floor(rand(-170,170))}deg`);
    span.style.setProperty('--d',`${Math.floor(rand(95,240))}px`);
    particles.appendChild(span);
  }
  effectTimer=setTimeout(()=>{overlay.className='effect-overlay';particles.innerHTML='';},duration);
}
function showWeatherTransition(weatherKey) {
  if (reduceMotion) return;
  const fx=$('weatherFx'); if (!fx) return;
  fx.className=`weather-fx ${weatherKey} show`;
  animateElement('weatherScene','weather-pop',800);
  setTimeout(()=>fx.className='weather-fx',1200);
}
function animateCast() {
  if (reduceMotion) return;
  animateElement('lakeCard','is-casting',850);
  animateElement('castBtn','is-casting',850);
}

const BUILD_CONFIG = { unlimitedSessions: false };
const DAILY_KEY = 'proFishingDailySessionV3';
const TEST_SESSION_KEY = 'proFishingTestSessionV1';
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

const ENTITY_ICONS = Object.freeze({
  'Подводная маска':'🥽',
  'Ласты':'🩴',
  'Акваланг':'🤿',
  'Счастливый поплавок':'🎈',
  'Снаряжение дайвера':'🧰',
  'Чайка':'🦅',
  'Рак':'🦞',
  'Утка':'🦆',
  'Осьминог':'🐙',
  'Касатка':'🐋',
  'Бездонный ларь':'🧰',
  'Компас потерянных глубин':'🧭',
  'Послание в бутылке':'🍾',
  'Чешуя Левиафана':'🐉',
  'Эссенция «Великан Океанов»':'🧪',
  'Глубоководное нечто':'🦑',
  'Игральная кость':'🎲',
  'Штурвал Наутилуса':'🛳️',
  'Плавник мегалодона':'🦈'
});
function entityIcon(name, fallback='•') { return ENTITY_ICONS[name] || fallback; }

const BASE_WEIGHTS = { normal:58.8, heavy:8, giant:2, trash:18, bonus:8, debuff:4.75, epic:1.2, legendary:0.25 };
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
    receivedDebuffCount:0, receivedDebuffNames:[], bonusArtifactCount:0, artifactCount:0, stormSeen:false,
    weatherSeen:[/* filled after state creation */], fishCaughtTotal:0, heavyCaughtTotal:0,
    giantCaughtTotal:0, smallFishCaught:0, goldenFishCaught:false, exactFortyCaught:false,
    goldenHourFishCount:0, thunderHeavyCaught:false, scubaAppliedTo15:false, seagullStoleHeaviest:false, trashStreak:0, maxTrashStreak:0,
    trashNamesCaught:[], luckyFloatSaves:0, flippersBoostedCount:0, blockedDebuffCount:0,
    recoveredByMessage:false, recoveredByMegalodonCount:0, orcaNeutralized:false, megalodonAfterThreeDebuffs:false,
    bonusAfterOctopus:false, hadAnyFish:false, fishLostToDebuffs:false,
    epicInFog:false, legendaryInEclipse:false, compassWeatherChanged:false,
    diceExtraCasts:false, diceWeightMultiplier:false, deepThingConvertedCount:0,
    nautilusActivatedWithTwoBonuses:false, leviathanFishCount:0,
    angusEncounters:0, angusLegendaryGift:false, angusGiantGift:false, angusFromCompass:false,
    sessionCategories:{bonus:false,debuff:false,epic:false,legendary:false},
    arcadeCaughtCount:0, arcadeLastSpawnCast:-1, sessionDate:null, finalResult:null
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
    const storageKey = BUILD_CONFIG.unlimitedSessions ? TEST_SESSION_KEY : DAILY_KEY;
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (BUILD_CONFIG.unlimitedSessions) {
      if (saved?.state && !JSON.parse(saved.state).finished) return hydrateState(saved.state);
      return initialState();
    }
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
    const storageKey = BUILD_CONFIG.unlimitedSessions ? TEST_SESSION_KEY : DAILY_KEY;
    localStorage.setItem(storageKey, JSON.stringify({date:state.sessionDate, state:serializeState(state)}));
  } catch (error) {
    console.warn('Не удалось сохранить игровую сессию', error);
  }
}

let state = loadDailyState();
if (!Array.isArray(state.weatherSeen)) state.weatherSeen=[];
if (!state.weatherSeen.includes(state.weather)) state.weatherSeen.push(state.weather);
if (state.weather==='storm') state.stormSeen=true;

function activeBonuses(name) {
  return state.bonuses.filter(b => b.name === name && !state.disabledBonusIds.has(b.id));
}
function hasBonus(name) { return activeBonuses(name).length > 0; }
function activeDebuff(name) { return state.debuffs.some(d => d.name === name && d.active); }
function addHistory(text,type='event',detail='',meta={}) {
  const row={id:uid(),text,type,detail,...meta};
  state.history.push(row);
  lastAnimatedHistoryId=row.id;
  renderHistory();
  return row;
}
function updateHistoryDetail(rowOrId, detail) {
  const id=typeof rowOrId==='object'?rowOrId?.id:rowOrId;
  const row=state.history.find(item=>item.id===id);
  if (!row) return;
  row.detail=detail;
  renderHistory();
}
function appendLatestHistoryDetail(type, detail) {
  const row=[...state.history].reverse().find(item=>item.type===type);
  if (!row) return;
  const clean=String(detail||'').replace(/^\(|\)$/g,'');
  const previous=String(row.detail||'').replace(/^\(|\)$/g,'');
  row.detail=`(${previous?`${previous} • `:''}${clean})`;
  renderHistory();
}

function appendHistoryDetailById(id, detail) {
  const row=state.history.find(item=>item.id===id);
  if (!row) return;
  const clean=String(detail||'').replace(/^\(|\)$/g,'');
  const previous=String(row.detail||'').replace(/^\(|\)$/g,'');
  row.detail=`(${previous?`${previous} • `:''}${clean})`;
  renderHistory();
}
function attachFishToHistoryRow(rowId, fishId) {
  const row=state.history.find(item=>item.id===rowId);
  if (!row) return;
  if (!Array.isArray(row.embeddedFishIds)) row.embeddedFishIds=[];
  row.embeddedFishIds.push(fishId);
  renderHistory();
}
function fishIsStolen(fish) { return state.stolen.some(item=>item.id===fish.id); }
function fishIsEaten(fish) { return state.eaten.some(item=>item.id===fish.id); }
function fishTitleText(fish) {
  const giant=fish.category==='giant';
  return `${giant?'🏆 ':''}${capitalize(fish.name)}${giant?' 💪🏼':''} — ${kg(fish.weight)}`;
}

function renderEssenceImpact(fish) {
  if (!fish?.essence) return '';
  const e=fish.essence;
  return `<div class="essence-impact"><span class="essence-icon">🧪</span><span><strong>Эссенция «Великан Океанов»</strong>: ${kg(e.before)} → ${kg(e.after)} (×${e.factor})</span></div>`;
}

function renderScubaImpact(fish) {
  if (!fish?.scubaImpact) return '';
  const impact=fish.scubaImpact;
  const gear=impact.count===1?'🤿':`🤿×${impact.count}`;
  const nautilus=impact.nautilus?' <span class="scuba-nautilus">🛳️ усиление Штурвала</span>':'';
  const eaten=impact.eatenAfterBoost?'<span class="scuba-eaten">💀 После усиления съедена Касаткой и не вошла в итоговый вес</span>':'';
  return `<div class="scuba-impact${impact.eatenAfterBoost?' is-eaten':''}"><span class="scuba-icon">${gear}</span><span><strong>Акваланг${impact.count>1?'и':''} ×${impact.factor}</strong>${nautilus}: ${kg(impact.before)} → ${kg(impact.after)}<small>Самая тяжёлая оставшаяся рыба</small>${eaten}</span></div>`;
}

function renderScubaBonusStatus(row) {
  if (row.type!=='bonus' || row.text!=='Акваланг') return '';
  const bonus=state.bonuses.find(item=>item.id===row.bonusId);
  const disabled=bonus && state.disabledBonusIds.has(bonus.id);
  if (disabled) return '<div class="scuba-bonus-status is-disabled">🤿 Бонус отключён Осьминогом и не участвует в финальном расчёте</div>';
  if (row.scubaApplication) {
    const a=row.scubaApplication;
    return `<div class="scuba-bonus-status applied"><strong>${a.nautilus?'🛳️ + ':''}🤿 Акваланг ${a.index} из ${a.count}</strong><span>Цель: ${capitalize(a.targetName)}</span><span>Общий множитель: ×${a.factor}</span><span>${kg(a.before)} → ${kg(a.after)}</span></div>`;
  }
  const activeCount=activeBonuses('Акваланг').length;
  const factor=(state.nautilus?6:3)*Math.max(1,activeCount);
  return `<div class="scuba-bonus-status pending"><strong>${state.nautilus?'🛳️ Штурвал усилил 🤿 Акваланг':'🤿 Ожидает финального расчёта'}</strong><span>Активных Аквалангов: ${activeCount||1} • общий множитель ×${factor}</span></div>`;
}


function renderMaskImpact(fish) {
  if (!fish?.maskImpact) return '';
  const impact=fish.maskImpact;
  const gear=impact.count===1?'🥽':`🥽×${impact.count}`;
  const nautilus=impact.nautilus?' <span class="gear-nautilus">🛳️ усиление Штурвала</span>':'';
  return `<div class="gear-impact mask-impact"><span class="gear-icon">${gear}</span><span><strong>Подводная маска${impact.count>1?'и':''} ×${impact.factor}</strong>${nautilus}: ${kg(impact.before)} → ${kg(impact.after)}<small>Финальное усиление оставшейся рыбы</small></span></div>`;
}

function renderFlipperImpact(fish) {
  if (!fish?.flipperImpact) return '';
  const impact=fish.flipperImpact;
  const gear=impact.count===1?'🩴':`🩴×${impact.count}`;
  const nautilus=impact.nautilus?' <span class="gear-nautilus">🛳️ усиление Штурвала</span>':'';
  return `<div class="gear-impact flipper-impact"><span class="gear-icon">${gear}</span><span><strong>Ласты ×${impact.factor}</strong>${nautilus}: ${kg(impact.before)} → ${kg(impact.after)}<small>Каждая вторая подходящая рыба</small></span></div>`;
}

function renderGearBonusStatus(row) {
  if (row.type!=='bonus' || !['Подводная маска','Ласты'].includes(row.text)) return '';
  const bonus=state.bonuses.find(item=>item.id===row.bonusId);
  const disabled=bonus && state.disabledBonusIds.has(bonus.id);
  const icon=row.text==='Подводная маска'?'🥽':'🩴';
  if (disabled) return `<div class="gear-bonus-status is-disabled">${icon} Бонус отключён Осьминогом и не участвует в расчёте</div>`;
  if (row.text==='Подводная маска') {
    if (row.maskApplication) {
      const a=row.maskApplication;
      return `<div class="gear-bonus-status applied"><strong>${a.nautilus?'🛳️ + ':''}🥽 Маска ${a.index} из ${a.count}</strong><span>Общий множитель: ×${a.factor}</span><span>Усилено рыб: ${a.affectedCount}</span></div>`;
    }
    const count=activeBonuses('Подводная маска').length;
    const factor=Math.pow(state.nautilus?3:1.5,Math.max(1,count));
    return `<div class="gear-bonus-status pending"><strong>${state.nautilus?'🛳️ Штурвал усилил 🥽 Маски':'🥽 Ожидает финального расчёта'}</strong><span>Активных Масок: ${count||1} • общий множитель ×${Number(factor.toFixed(3))}</span></div>`;
  }
  const impacts=state.fish.filter(f=>f.flipperImpact);
  const factors=[...new Set(impacts.map(f=>f.flipperImpact.factor))];
  const count=activeBonuses('Ласты').length;
  const factorText=factors.length?factors.map(x=>`×${x}`).join(', '):`×${Math.pow(state.nautilus?4:2,Math.max(1,count))}`;
  return `<div class="gear-bonus-status ${impacts.length?'applied':'pending'}"><strong>${state.nautilus?'🛳️ + ':''}🩴 Ласты${count>1?` ×${count}`:''}</strong><span>Усилено рыб: ${impacts.length}</span><span>Применённые множители: ${factorText}</span></div>`;
}

function renderTransmutation(row) {
  if (!row.transmutation || !Array.isArray(row.embeddedFishIds) || !row.embeddedFishIds.length) return '';
  const fish=state.fish.find(item=>item.id===row.embeddedFishIds[0]);
  if (!fish) return '';
  const eaten=fishIsEaten(fish);
  const stolen=fishIsStolen(fish);
  const icon=eaten?'💀':stolen?'❌':'🐟';
  const status=eaten?'Съедена Касаткой':stolen?'Украдена Чайкой':'';
  const tags=fish.tags?.length?`<small class="transmutation-tags">${fish.tags.join(' • ')}</small>`:'';
  return `<div class="transmutation-chain">
    <div class="transmutation-source"><span>🔘</span><span class="transmutation-trash-name">${capitalize(row.transmutation.trashName)}</span><span class="transmutation-arrow">→</span></div>
    <div class="transmutation-result${eaten?' is-eaten':''}${stolen?' is-stolen':''}">
      <span class="transmutation-fish-icon">${icon}</span>
      <span class="transmutation-fish-name">${fishTitleText(fish)}</span>
      ${status?`<span class="transmutation-status">${status}</span>`:''}
      ${tags}
      ${renderEssenceImpact(fish)}
      ${renderFlipperImpact(fish)}
      ${renderMaskImpact(fish)}
      ${renderScubaImpact(fish)}
    </div>
  </div>`;
}

function findTrashHistoryRow(trash) {
  if (trash?.historyRowId) {
    const direct=state.history.find(row=>row.id===trash.historyRowId);
    if (direct) return direct;
  }
  return [...state.history].reverse().find(row=>row.type==='trash' && row.text===capitalize(trash.name) && !row.transmutation);
}

function transmuteTrash(trash, source='Глубоководное нечто') {
  let row=findTrashHistoryRow(trash);
  if (!row) row=addHistory(capitalize(trash.name),'trash','');
  trash.historyRowId=row.id;
  trash.converted=true;
  row.transmutation={trashName:trash.name,source};
  row.detail=`(Трансмутация хлама • ${source})`;
  const fish=makeFish('giant','Трансмутация хлама',false,{parentHistoryId:row.id});
  row.transmutation.fishId=fish.id;
  renderHistory();
  return fish;
}

function renderEmbeddedFishList(row) {
  if (row.transmutation) return '';
  if (!Array.isArray(row.embeddedFishIds) || !row.embeddedFishIds.length) return '';
  const items=row.embeddedFishIds
    .map(id=>state.fish.find(fish=>fish.id===id))
    .filter(Boolean)
    .map(fish=>{
      const eaten=fishIsEaten(fish);
      const stolen=fishIsStolen(fish);
      const icon=eaten?'💀':stolen?'❌':'🐟';
      const status=eaten?'съедена Касаткой':stolen?'украдена Чайкой':'';
      const tags=fish.tags?.length?`<small class="embedded-fish-tags">${fish.tags.join(' • ')}</small>`:'';
      return `<li class="embedded-fish-item${eaten?' is-eaten':''}${stolen?' is-stolen':''}"><div class="embedded-fish-main"><span class="embedded-fish-icon">${icon}</span><span class="embedded-fish-name">${fishTitleText(fish)}</span>${status?`<span class="embedded-fish-status">${status}</span>`:''}</div>${tags}${renderEssenceImpact(fish)}${renderFlipperImpact(fish)}${renderMaskImpact(fish)}${renderScubaImpact(fish)}</li>`;
    })
    .join('');
  return `<ul class="embedded-fish-list">${items}</ul>`;
}
function setFishHistoryEaten(fish, eaten=true) {
  state.history.forEach(row=>{ if (row.type==='fish' && row.fishId===fish.id) row.eaten=eaten; });
}
function setFishHistoryStolen(fish, stolen=true) {
  state.history.forEach(row=>{ if (row.type==='fish' && row.fishId===fish.id) row.stolen=stolen; });
}
function addFishHistory(fish, source) {
  const giant=fish.category==='giant';
  addHistory(`${giant?'🏆 ':''}${capitalize(fish.name)}${giant?' 💪🏼':''} — ${kg(fish.weight)}`,'fish',`${source}${fish.tags.length?` • ${fish.tags.join(' • ')}`:''}`,{fishId:fish.id,eaten:Boolean(fish.removed),arcade:Boolean(fish.arcadeCatch)});
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
  if (state.weather==='fog') w.epic*=2.5;
  if (state.weather==='eclipse') w.legendary*=3;
  if (state.weather==='thunder') { w.heavy*=2.5; w.trash*=2; }
  if (state.weather==='storm') { w.bonus=0; w.debuff=0; w.trash*=3; w.epic*=1.35; w.legendary*=1.35; }
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

function makeFish(category='normal', source='Заброс', direct=true, options={}) {
  const { parentHistoryId=null, arcadeCatch=false } = options;
  const giant=category==='giant';
  let original=giant?rand1(20,40):category==='heavy'?rand1(10,19.9):rand1(.1,9.9);
  const f={id:uid(),name:pick(giant?DATA.giants:DATA.fish),category,originalWeight:original,weight:original,source,direct,removed:false,tags:[],debuffLimited:false,historyParentId:parentHistoryId,arcadeCatch};
  state.fishCaughtTotal++;
  state.hadAnyFish=true;
  state.trashStreak=0;
  if (category==='heavy') state.heavyCaughtTotal++;
  if (category==='giant') state.giantCaughtTotal++;
  if (original<=1) state.smallFishCaught++;
  if (['золотая рыбка','золотая форель'].includes(f.name)) state.goldenFishCaught=true;
  if (original===40) state.exactFortyCaught=true;
  if (state.weather==='golden') state.goldenHourFishCount++;
  if (state.weather==='thunder' && category==='heavy') state.thunderHeavyCaught=true;
  if (state.artifacts.some(a=>a.name==='Чешуя Левиафана')) state.leviathanFishCount++;

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
    if (eligibleCount%2===0) { const factor=Math.pow(state.nautilus?4:2,flippers); const before=f.weight; f.weight=round1(f.weight*factor); f.flipperImpact={before,after:f.weight,factor,count:flippers,nautilus:state.nautilus}; f.tags.push(`Ласты ×${factor}`); state.flippersBoostedCount++; }
  }
  if (activeDebuff('Касатка') && f.weight>=5.5 && !state.megalodon) {
    f.removed=true; state.eaten.push(f); state.fishLostToDebuffs=true;
    state.fish.push(f);
    if (parentHistoryId) attachFishToHistoryRow(parentHistoryId, f.id);
    else addFishHistory(f,source);
    return f;
  }
  state.fish.push(f);
  // Достижения за прямой тяжёлый улов учитывают фактическое состояние рыбы.
  // Если Утка или Рак уже ограничили её вес, она больше не считается
  // полноценным тяжеловесом/гигантом для этих достижений.
  if (direct && category==='heavy' && !f.debuffLimited) state.directHeavy=true;
  if (direct && category==='giant' && !f.debuffLimited) state.directGiant=true;
  if (parentHistoryId) attachFishToHistoryRow(parentHistoryId, f.id);
  else addFishHistory(f,source);
  if (giant) { TelegramApp?.HapticFeedback?.notificationOccurred?.('success'); showVisualEffect('giant','🏆','РЫБА-ГИГАНТ',`${capitalize(f.name)} — ${kg(f.weight)}`,1450); }
  else if (category==='heavy') showVisualEffect('giant','🐟','Тяжеловес!',`${capitalize(f.name)} — ${kg(f.weight)}`,850,true);
  tryResolvePendingEssence();
  return f;
}
function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}

function processTrash() {
  const item=pick(DATA.trash);
  state.trashStreak++;
  state.maxTrashStreak=Math.max(state.maxTrashStreak,state.trashStreak);
  if (!state.trashNamesCaught.includes(item)) state.trashNamesCaught.push(item);

  let detail=state.weather==='thunder'?'⚡ Удар молнии поднял хлам со дна':'';
  if (hasBonus('Счастливый поплавок')) {
    const restore=state.nautilus?2:1;
    state.castsLeft+=restore; state.luckyFloatSaves++;
    detail+=`${detail?' • ':''}Счастливый поплавок вернул ${restore} заброс${restore===1?'':'а'}`;
  }

  const row=addHistory(capitalize(item),'trash',detail?`(${detail})`:'');
  const trash={id:uid(),name:item,converted:false,historyRowId:row.id};
  state.trash.push(trash);

  if (state.deepThingActive) {
    state.deepThingConvertedCount++;
    transmuteTrash(trash,state.nautilus?'Штурвал Наутилуса / Глубоководное нечто':'Глубоководное нечто');
  }
}
function processBonus() {
  const name=pick(DATA.bonuses); playSound('bonus');
  showVisualEffect('bonus',entityIcon(name,'✅'),'БОНУС ПОЛУЧЕН',name,900,true);
  state.bonusArtifactCount++; state.sessionCategories.bonus=true;
  if (name==='Снаряжение дайвера' && state.debuffs.some(d=>['Чайка','Рак','Утка'].includes(d.name))) {
    showChoice('Снаряжение дайвера','Дебаф уже был получен. Выберите замену:', ['Подводная маска','Ласты','Счастливый поплавок'], choice=>grantBonus(choice,`Снаряжение дайвера заменено на «${choice}», поскольку дебаф уже действовал`));
    return;
  }
  grantBonus(name);
}
function grantBonus(name, customDetail='') {
  if (state.octopusSeen) state.bonusAfterOctopus=true;
  const bonus={id:uid(),name,startFishIndex:state.fish.length}; state.bonuses.push(bonus);
  const descriptions={
    'Подводная маска':'Каждая оставшаяся рыба получит множитель ×1,5 в финале',
    'Ласты':'Каждая вторая будущая рыба получает множитель ×2',
    'Акваланг':'В финале самая тяжёлая оставшаяся рыба получает ×3. Несколько Аквалангов складываются линейно: 2 дают ×6, 3 дают ×9. Штурвал Наутилуса удваивает силу каждого Акваланга',
    'Счастливый поплавок':'Хлам сохраняет попытку заброса',
    'Снаряжение дайвера':'Блокирует Чайку, Рака и Утку, полученных после него'
  };
  const row=addHistory(name,'bonus',`(${customDetail||descriptions[name]||'Бонус активирован'})`,{bonusId:bonus.id});
  bonus.historyRowId=row.id;
}
function diverBlocks(name) { return ['Чайка','Рак','Утка'].includes(name) && hasBonus('Снаряжение дайвера'); }
function showDebuffEffect(name) {
  const effects={
    'Чайка':['debuff-seagull','🦅','ЧАЙКА','Перо пронеслось над уловом'],
    'Рак':['debuff-crab','🦞','РАК','Клешни сжимают снасть'],
    'Утка':['debuff-duck','🦆','УТКА','Стая распугивает рыбу'],
    'Осьминог':['debuff-octopus','🐙','ОСЬМИНОГ','Щупальца опутывают бонусы'],
    'Касатка':['debuff-orca','🐋','КАСАТКА','Хищная волна проходит по улову']
  };
  const [kind,icon,title,subtitle]=effects[name]||['debuff','🛑',name,'Неблагоприятное событие'];
  showVisualEffect(kind,icon,title,subtitle,1050,true);
}
function processDebuff(forcedName=null) {
  const name=forcedName||chooseDebuff();
  state.receivedDebuffCount++;
  if(!state.receivedDebuffNames.includes(name))state.receivedDebuffNames.push(name);
  state.sessionCategories.debuff=true;
  if (state.megalodon) { addHistory(name,'debuff','(Плавник мегалодона полностью нейтрализовал действие)'); return; }
  if (diverBlocks(name)) { state.blockedDebuffCount++; addHistory(name,'debuff','(Снаряжение дайвера заблокировало действие)'); return; }
  playSound('debuff'); showDebuffEffect(name);
  const d={id:uid(),name,active:true}; state.debuffs.push(d);
  let detail='';
  if (name==='Чайка') {
    const candidates=state.fish.filter(f=>!f.removed);
    if (!candidates.length) detail='Чайке нечего красть — в улове нет доступной рыбы';
    else {
      const maxWeight=Math.max(...candidates.map(f=>f.weight));
      const victim=pick(candidates); victim.removed=true; state.stolen.push(victim); state.fishLostToDebuffs=true;
      setFishHistoryStolen(victim,true);
      if (victim.weight===maxWeight) state.seagullStoleHeaviest=true;
      detail=`Украла рыбу: ${capitalize(victim.name)} — ${kg(victim.weight)}`;
    }
  }
  if (name==='Рак') detail='Повредил снасть: весь будущий улов ограничен диапазоном 0,1–2,5 кг';
  if (name==='Утка') detail='Распугала рыбу: шанс хлама вырос, вес будущей рыбы ограничен 3 кг';
  if (name==='Осьминог') { state.octopusSeen=true; state.bonuses.forEach(b=>state.disabledBonusIds.add(b.id)); detail='Навсегда отключил все бонусы, полученные до его появления'; }
  if (name==='Касатка') {
    const victims=state.fish.filter(f=>!f.removed&&f.weight>=5.5);
    victims.forEach(f=>{f.removed=true;state.eaten.push(f);state.fishLostToDebuffs=true;setFishHistoryEaten(f,true);});
    detail=`Съела всю рыбу весом от 5,5 кг${victims.length?` — ${victims.length} шт.`:'; подходящей рыбы не было'}`;
  }
  addHistory(name,'debuff',`(${detail})`);
}

function processEpic(name=pick(DATA.epics), fromAngus=false) {
  playSound('epic');
  showVisualEffect('epic',entityIcon(name,'💜'),'ЭПИЧЕСКИЙ АРТЕФАКТ',name,1350);
  state.artifacts.push({id:uid(),name,tier:'epic'}); state.artifactCount++; state.bonusArtifactCount++; state.sessionCategories.epic=true; if(state.weather==='fog') state.epicInFog=true;
  if (fromAngus) state.angusGift=true;
  const epicRow = addHistory(name,'epic',fromAngus?'(Дар старины Ангуса)':'');
  if (name==='Бездонный ларь') {
    appendHistoryDetailById(epicRow.id,'Содержит от 1 до 5 случайных рыб');
    const count=Math.floor(rand(1,6));
    for(let i=0;i<count;i++) makeFish(chance(.01)?'giant':chance(.35)?'heavy':'normal','Бездонный ларь',false,{ parentHistoryId: epicRow.id });
  }
  if (name==='Компас потерянных глубин') {
    if (!state.compassUsed) {
      state.compassUsed=true;
      showChoice('Компас потерянных глубин','Выберите новую погоду. Лимит забросов станет равен 10.',Object.keys(DATA.weather).map(k=>DATA.weather[k].name),choice=>{
        const key=Object.keys(DATA.weather).find(k=>DATA.weather[k].name===choice); state.weather=key; state.castsLeft=10; state.compassWeatherChanged=true; showWeatherTransition(key); playSound('weather'); if(!state.weatherSeen.includes(key))state.weatherSeen.push(key); if(key==='storm')state.stormSeen=true; playSound('weather'); addHistory(`Погода изменилась: ${choice}`,'weather','(Компас потерянных глубин восстановил лимит до 10)',{weatherKey:key}); render();
      });
    } else if (chance(.02)) encounterAngus(true); else appendLatestHistoryDetail('epic','Компас уже использован и на этот раз молчит');
  }
  if (name==='Послание в бутылке') restoreByMessage();
  if (name==='Чешуя Левиафана') { state.castsLeft+=5; state.leviathanStep=0; }
  if (name==='Эссенция «Великан Океанов»') applyEssence();
}
function restoreByMessage() {
  state.stolen.forEach(f=>{f.removed=false; setFishHistoryStolen(f,false); if(!state.fish.includes(f)) state.fish.push(f);});
  const restored=state.stolen.length; if(restored>0)state.recoveredByMessage=true; state.stolen=[];
  state.fish.filter(f=>!f.removed&&f.debuffLimited).forEach(f=>{f.weight=round1(f.weight*2);f.tags.push('Послание ×2');enforceOrca(f);});
  appendLatestHistoryDetail('epic',`Вернуло украденных рыб: ${restored}; удвоило повреждённый улов`);
}
function applyEssence() {
  const fishes=state.fish.filter(f=>!f.removed).sort((a,b)=>a.weight-b.weight);
  if (!fishes.length) { state.essencePending=true; appendLatestHistoryDetail('epic','🧪 Эссенция ждёт появления первой рыбы'); return; }
  const targets=fishes.length===1?fishes.slice(0,1):fishes.slice(0,2);
  const factor=fishes.length===1?10:5;
  targets.forEach(f=>{
    const before=f.weight;
    f.weight=round1(f.weight*factor);
    f.essence={before,after:f.weight,factor};
    f.tags.push(`🧪 Эссенция ×${factor}`);
    enforceOrca(f);
  });
  appendLatestHistoryDetail('epic',`🧪 Применена к: ${targets.map(f=>capitalize(f.name)).join(', ')}`);
  state.essenceUsed=true; state.essencePending=false;
  renderHistory();
}
function tryResolvePendingEssence(){ if(state.essencePending) applyEssence(); }
function enforceOrca(f){ if(activeDebuff('Касатка')&&!state.megalodon&&f.weight>=5.5&&!f.removed){f.removed=true;state.eaten.push(f);state.fishLostToDebuffs=true;setFishHistoryEaten(f,true);} }

function processLegendary(name=pick(DATA.legendary), fromAngus=false) {
  playSound('legendary');
  showVisualEffect('legendary',entityIcon(name,'🧡'),'ЛЕГЕНДАРНЫЙ АРТЕФАКТ',name,1650);
  state.artifacts.push({id:uid(),name,tier:'legendary'}); state.artifactCount++; state.bonusArtifactCount++; state.sessionCategories.legendary=true; if(state.weather==='eclipse') state.legendaryInEclipse=true;
  if (fromAngus) state.angusGift=true;
  addHistory(name,'legendary',fromAngus?'(Дар старины Ангуса)':'');
  if (name==='Глубоководное нечто') activateDeepThing('Глубоководное нечто');
  if (name==='Игральная кость') showChoice('Игральная кость','Выберите один эффект:', ['+5 забросов','×5 финальный вес'], choice=>{ if(choice.startsWith('+')){state.castsLeft+=5;state.diceExtraCasts=true;}else{state.diceFinalMultiplier*=5;state.diceWeightMultiplier=true;} appendLatestHistoryDetail('legendary',`Выбран эффект: ${choice}`);render(); });
  if (name==='Штурвал Наутилуса') { state.nautilus=true; state.nautilusActivatedWithTwoBonuses=activeBonuses('Подводная маска').length+activeBonuses('Ласты').length+activeBonuses('Акваланг').length+activeBonuses('Счастливый поплавок').length+activeBonuses('Снаряжение дайвера').length>=2; activateDeepThing('Штурвал Наутилуса / Глубоководное нечто'); }
  if (name==='Плавник мегалодона') activateMegalodon();
}
function activateDeepThing(source='Глубоководное нечто') {
  state.deepThingActive=true;
  const items=state.trash.filter(t=>!t.converted);
  state.deepThingConvertedCount+=items.length;
  items.forEach(item=>transmuteTrash(item,source));
  appendLatestHistoryDetail('legendary',`Превращено единиц хлама в гигантов: ${items.length}`);
}
function activateMegalodon() {
  if (state.receivedDebuffCount>=3) state.megalodonAfterThreeDebuffs=true;
  const recoveryCount=state.stolen.length+state.eaten.length+state.fish.filter(f=>f.debuffLimited).length;
  if (activeDebuff('Касатка') || state.eaten.length) state.orcaNeutralized=true;
  state.recoveredByMegalodonCount+=recoveryCount;
  state.megalodon=true;
  state.debuffs.forEach(d=>d.active=false);
  [...state.stolen,...state.eaten].forEach(f=>{f.removed=false;f.weight=f.originalWeight;if(!state.fish.includes(f))state.fish.push(f);setFishHistoryEaten(f,false);setFishHistoryStolen(f,false);});
  state.stolen=[];state.eaten=[];
  state.fish.forEach(f=>{if(f.debuffLimited){f.weight=f.originalWeight;f.debuffLimited=false;}});
  appendLatestHistoryDetail('legendary',`Все дебафы нейтрализованы; восстановлено рыб: ${recoveryCount}`);
}

function encounterAngus(fromCompass=false) {
  playSound('angus'); showVisualEffect('angus','🧔','Старина Ангус','Опытный рыбак появился у берега',1450); state.angusEncounters++; if(fromCompass)state.angusFromCompass=true;
  addHistory('Появился старина Ангус','angus',fromCompass?'Призван повторным Компасом':'Случайная встреча');
  if (chance(.05)) {
    if (chance(.85)) processEpic(pick(DATA.epics),true); else {state.angusLegendaryGift=true; processLegendary(pick(DATA.legendary),true);}
  } else {
    state.angusGiantGift=true; appendLatestHistoryDetail('angus','Артефакта нет — Ангус добавил рыбу-гиганта'); makeFish('giant','Старина Ангус',false);
  }
}


let arcadeTimer=null;
let arcadeStatusTimer=null;
let activeArcadeFish=null;
const ARCADE_MAX_CATCHES=2;
const ARCADE_TRIGGER_CHANCE=.08;
const ARCADE_PITY_CHANCE=.12;
const ARCADE_ORCA_CHANCE=.05;

function chooseArcadeFishCategory() {
  const roll=Math.random();
  if (roll<0.002) return 'giant';
  if (roll<0.03) return 'heavy';
  return 'normal';
}
function maybeScheduleArcadeAfterCast() {
  clearTimeout(arcadeTimer);
  if (state.finished || activeArcadeFish || state.arcadeCaughtCount>=ARCADE_MAX_CATCHES) return;
  if (state.castsLeft<=0) return; // последний заброс не запускает событие, которое не успеет показаться
  const castsSinceSpawn=state.castClicks-(state.arcadeLastSpawnCast ?? -1);
  if (castsSinceSpawn < 2) return;
  const triggerChance=castsSinceSpawn>=6?ARCADE_PITY_CHANCE:ARCADE_TRIGGER_CHANCE;
  if (!chance(triggerChance)) return;
  const delay=400+Math.random()*1000;
  arcadeTimer=setTimeout(()=>{
    if (!state.finished && state.sessionDate && !activeArcadeFish && !document.hidden && state.arcadeCaughtCount<ARCADE_MAX_CATCHES) {
      spawnArcadeCreature();
    }
  },delay);
}
function spawnArcadeCreature() {
  const layer=$('arcadeLayer');
  if (!layer || activeArcadeFish || state.finished || state.arcadeCaughtCount>=ARCADE_MAX_CATCHES) return;
  const direction=chance(.5)?'left-to-right':'right-to-left';
  const isOrca=chance(ARCADE_ORCA_CHANCE);
  const category=isOrca?null:chooseArcadeFishCategory();
  const duration=isOrca?rand(3.5,4.2):rand(3.5,5);
  const el=document.createElement('button');
  el.type='button';
  el.className=`arcade-fish ${direction} ${isOrca?'arcade-orca':`category-${category}`}`;
  el.setAttribute('aria-label',isOrca?'Касатка в аркадной дорожке':'Поймать проплывающую рыбу');
  el.innerHTML=isOrca
    ? '<span class="arcade-orca-body"><span class="arcade-orca-fin"></span></span>'
    : '<span class="arcade-fish-body"><span class="arcade-fish-eye"></span></span>';
  el.style.setProperty('--arcade-y','50%');
  el.style.setProperty('--arcade-duration',`${duration.toFixed(2)}s`);
  const token={el,category,isOrca,caught:false};
  activeArcadeFish=token;
  state.arcadeLastSpawnCast=state.castClicks;
  el.addEventListener('click',()=>catchArcadeCreature(token),{once:true});
  el.addEventListener('animationend',()=>removeArcadeCreature(token));
  layer.appendChild(el);
}
function removeArcadeCreature(token) {
  token?.el?.remove();
  if (activeArcadeFish===token) activeArcadeFish=null;
}
function showArcadeCatchStatus() {
  const status=$('arcadeStatus');
  if (!status) return;
  clearTimeout(arcadeStatusTimer);
  status.textContent=`🐠 Аркадный улов: ${state.arcadeCaughtCount} из ${ARCADE_MAX_CATCHES}`;
  status.classList.remove('show');
  void status.offsetWidth;
  status.classList.add('show');
  arcadeStatusTimer=setTimeout(()=>status.classList.remove('show'),4000);
}
function catchArcadeCreature(token) {
  if (!token || token.caught || state.finished) return;
  token.caught=true;
  token.el.classList.add('caught');
  if (token.isOrca) {
    TelegramApp?.HapticFeedback?.notificationOccurred?.('error');
    processDebuff('Касатка');
    appendLatestHistoryDetail('debuff','Поймана в аркадной дорожке и атаковала улов');
  } else {
    if (state.arcadeCaughtCount>=ARCADE_MAX_CATCHES) { removeArcadeCreature(token); return; }
    state.arcadeCaughtCount++;
    TelegramApp?.HapticFeedback?.notificationOccurred?.('success');
    makeFish(token.category,'Аркадный улов',false,{arcadeCatch:true});
    showArcadeCatchStatus();
  }
  render();
  setTimeout(()=>removeArcadeCreature(token),220);
}

function castLine() {
  if (state.finished || state.castsLeft<=0 || $('choiceDialog').open) return;
  TelegramApp?.HapticFeedback?.impactOccurred?.('medium');
  if (!state.sessionDate) state.sessionDate=localDayKey();
  playSound('cast');
  animateCast();
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
  maybeScheduleArcadeAfterCast();
  if (state.castsLeft<=0 && !$('choiceDialog').open) finishGame();
  render();
}
function changeWeatherRandomly() {
  const options=Object.keys(DATA.weather).filter(k=>k!==state.weather); state.weather=pick(options);
  if (!state.weatherSeen.includes(state.weather)) state.weatherSeen.push(state.weather);
  if (state.weather==='storm') state.stormSeen=true;
  playSound('weather');
  showWeatherTransition(state.weather);
  addHistory(`Погода изменилась: ${DATA.weather[state.weather].name}`,'weather',`(${DATA.weather[state.weather].text})`,{weatherKey:state.weather});
}

function finalFishSnapshot() {
  state.fish.forEach(item=>{ delete item.scubaImpact; delete item.maskImpact; });
  state.history.forEach(row=>{ delete row.scubaApplication; delete row.maskApplication; });
  const fish=state.fish.filter(f=>!f.removed).map(f=>({...f}));
  const maskBonuses=activeBonuses('Подводная маска');
  const masks=maskBonuses.length;
  if (masks) {
    const factor=Math.pow(state.nautilus?3:1.5,masks);
    fish.forEach(f=>{
      const before=f.weight;
      f.weight=round1(f.weight*factor);
      const original=state.fish.find(item=>item.id===f.id);
      if (original) original.maskImpact={before,after:f.weight,factor:Number(factor.toFixed(3)),count:masks,nautilus:state.nautilus};
    });
    maskBonuses.forEach((bonus,index)=>{
      const row=state.history.find(item=>item.id===bonus.historyRowId) || state.history.find(item=>item.type==='bonus'&&item.text==='Подводная маска'&&item.bonusId===bonus.id);
      if (row) row.maskApplication={index:index+1,count:masks,factor:Number(factor.toFixed(3)),affectedCount:fish.length,nautilus:state.nautilus};
    });
  }
  const scubaBonuses=activeBonuses('Акваланг');
  const tanks=scubaBonuses.length;
  if (tanks) {
    const target=fish.filter(f=>!f.removed).sort((a,b)=>b.weight-a.weight)[0];
    if (target) {
      const before=target.weight;
      if (before>=15) state.scubaAppliedTo15=true;
      const powerPerTank=state.nautilus?6:3;
      const scubaFactor=powerPerTank*tanks;
      target.weight=round1(before*scubaFactor);
      const original=state.fish.find(item=>item.id===target.id);
      const eatenAfterBoost=activeDebuff('Касатка')&&!state.megalodon&&target.weight>=5.5;
      if (original) original.scubaImpact={before,after:target.weight,factor:scubaFactor,count:tanks,nautilus:state.nautilus,eatenAfterBoost};
      scubaBonuses.forEach((bonus,index)=>{
        const row=state.history.find(item=>item.id===bonus.historyRowId) || state.history.find(item=>item.type==='bonus'&&item.text==='Акваланг'&&item.bonusId===bonus.id);
        if (row) row.scubaApplication={index:index+1,count:tanks,targetId:target.id,targetName:target.name,before,after:target.weight,factor:scubaFactor,nautilus:state.nautilus,eatenAfterBoost};
      });
    }
  }
  if (state.diceFinalMultiplier>1) fish.forEach(f=>f.weight=round1(f.weight*state.diceFinalMultiplier));
  fish.forEach(f=>{ if(activeDebuff('Касатка')&&!state.megalodon&&f.weight>=5.5) f.removed=true; });
  return fish.filter(f=>!f.removed);
}
function achievements(finalFish,total) {
  const a=[];
  const activeTrash=state.trash.filter(t=>!t.converted);
  const giantFinal=finalFish.filter(f=>f.category==='giant');
  const uniqueBonusNames=new Set(state.bonuses.map(b=>b.name));
  const uniqueArtifactNames=new Set(state.artifacts.map(x=>x.name));
  const epicCount=state.artifacts.filter(x=>x.tier==='epic').length;
  const legendaryCount=state.artifacts.filter(x=>x.tier==='legendary').length;
  const activeCoreGear=hasBonus('Подводная маска')&&hasBonus('Ласты')&&hasBonus('Акваланг');
  const trashNames=new Set(state.trashNamesCaught||[]);

  // Базовые достижения
  if (!finalFish.length && activeTrash.length>0) a.push('Трепетный эколог');
  if (finalFish.length && finalFish.every(f=>f.weight<=2.5)) a.push('Аквариумный мастер');
  if (state.bonusArtifactCount>=5) a.push('Любимчик Фортуны');
  if (!state.stormSeen && state.receivedDebuffCount===0 && state.castClicks>=10) a.push('Неуловимый');
  if (state.directHeavy) a.push('Везунчик');
  if (state.directGiant) a.push('Первобытный триумф');
  if (total>=150&&total<300) a.push('Гроза океана');
  if (total>=300) a.push('Повелитель глубин');
  if (state.artifactCount>=3) a.push('Благословение семи морей');
  if (state.castClicks>=15) a.push('Марафонец');
  if (giantFinal.length>=3) a.push('Мастер крупных форм');
  if (state.essenceUsed) a.push('Трансмутатор');
  if (state.angusGift) a.push('Дар великого мастера');

  // Рыба и вес
  if (state.fish.filter(f=>['золотая рыбка','золотая форель'].includes(f.name)).length>=2) a.push('Золотая чешуя');
  if (state.heavyCaughtTotal>=4) a.push('Тяжёлая артиллерия');
  if (state.exactFortyCaught) a.push('Легенда озера');
  if (total>=99&&total<100) a.push('На волоске');
  if (total===100) a.push('Идеальный баланс');
  if (state.smallFishCaught>=7) a.push('Мелочь, а приятно');
  if (finalFish.length>=12) a.push('Рыбное изобилие');
  if (finalFish.length===1&&finalFish[0].weight>=20) a.push('Один, но могучий');

  // Погода
  if ((state.weatherSeen||[]).length>=5) a.push('Синоптик');
  if (state.compassWeatherChanged) a.push('Повелитель стихий');
  if (state.legendaryInEclipse) a.push('Рыбак во мраке');
  if (state.epicInFog) a.push('Сквозь туман');
  if (state.thunderHeavyCaught) a.push('Гроза не помеха');
  if (state.weather==='storm'&&total>=100) a.push('Штормовой капитан');
  if (state.goldenHourFishCount>=5) a.push('Золотой улов');

  // Бонусы
  if (['Подводная маска','Ласты','Акваланг'].every(x=>uniqueBonusNames.has(x))) a.push('Полное снаряжение');
  if (state.blockedDebuffCount>=2) a.push('Под защитой');
  if (state.luckyFloatSaves>=2) a.push('Вторая попытка');
  if (state.flippersBoostedCount>=4) a.push('Ускоритель глубин');
  if (state.scubaAppliedTo15) a.push('Глубокое погружение');
  if (activeCoreGear) a.push('Морская машина');
  if (state.bonuses.filter(b=>b.name==='Акваланг').length>=3) a.push('Тройное погружение');
  if (uniqueBonusNames.size>=4) a.push('Арсенал рыбака');

  // Дебафы и восстановление
  if ((state.receivedDebuffNames||[]).length>=4&&total>=100) a.push('Переживший бурю');
  if (state.recoveredByMessage) a.push('Возвращение пропажи');
  if (state.orcaNeutralized) a.push('Не сегодня, касатка');
  if (state.bonusAfterOctopus) a.push('Освобождение от пут');
  if (state.recoveredByMegalodonCount>=2) a.push('Полная реабилитация');
  if (state.megalodonAfterThreeDebuffs) a.push('Последняя надежда');

  // Артефакты
  if (uniqueArtifactNames.size>=4) a.push('Коллекционер глубин');
  if (epicCount>=3) a.push('Эпическое путешествие');
  if (legendaryCount>=2) a.push('Легендарный рыбак');
  if (state.diceWeightMultiplier) a.push('Воля случая');
  if (state.diceExtraCasts) a.push('Ещё один заброс');
  if (state.deepThingConvertedCount>=2) a.push('Бездна ответила');
  if (state.nautilusActivatedWithTwoBonuses) a.push('Капитан Наутилуса');
  if (state.leviathanFishCount>=5) a.push('Дар Левиафана');
  if (epicCount>0&&legendaryCount>0) a.push('Власть над океаном');

  // Ангус
  if (state.angusEncounters>=2) a.push('Старые друзья');
  if (state.angusLegendaryGift) a.push('Щедрость Ангуса');
  if (state.angusGiantGift) a.push('Совет бывалого');
  if (state.angusFromCompass) a.push('Зов Компаса');
  if (state.angusGift&&total>=100) a.push('Наследник рыбака');

  // Шуточные и редкие ситуации
  if (state.trash.length>=7) a.push('Мусорный магнат');
  if (trashNames.has('рваный башмак')&&trashNames.has('резиновый сапог')) a.push('Обувной магазин');
  if (trashNames.has('утопленный мобильник')) a.push('Плохой сигнал');
  if (state.seagullStoleHeaviest) a.push('Ужин чайки');
  if (!finalFish.length&&state.hadAnyFish&&state.fishLostToDebuffs) a.push('Рыба ушла');
  if (state.maxTrashStreak>=4) a.push('Не мой день');
  if (state.deepThingConvertedCount>=3) a.push('Вот это поворот');
  if (Object.values(state.sessionCategories||{}).every(Boolean)) a.push('Морской хаос');

  // Достижение, зависящее от наличия другого достижения после встречи с Касаткой.
  if ((state.receivedDebuffNames||[]).includes('Касатка')&&a.length>0) a.push('Несмотря ни на что');
  return [...new Set(a)];
}
function finishGame() {
  state.finished=true;
  const finalFish=finalFishSnapshot();
  let total=round1(finalFish.reduce((s,f)=>s+f.weight,0));
  const earned=achievements(finalFish,total);
  const ended=new Date();
  state.finalResult={total,earned,finishedAt:ended.toISOString()};
  renderResultCard();
  if (earned.length) { playSound('achievement'); showVisualEffect('achievement','🎉','Достижения открыты',`${earned.length} за эту сессию`,1500); }
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
    <div class="result-bubbles" aria-hidden="true">${Array.from({length:10},(_,i)=>`<span style="--i:${i}"></span>`).join('')}</div>
    <h3>Итоговый вес: <span class="result-total-number" data-total="${total}">${kg(total)}</span></h3>
    <div class="result-achievements-title">🚀 Достижения</div>
    ${earned.length
      ? `<ul class="result-achievements">${earned.map((x,i)=>`<li style="--i:${i}">${x}</li>`).join('')}</ul>`
      : '<p class="result-none">В этой сессии достижений нет.</p>'}
    <div class="result-date">Дата и время завершения: ${ended.toLocaleString('ru-RU')}</div>`;
  $('resultCard').classList.remove('hidden');
  if (!reduceMotion && !$('resultCard').dataset.animated) {
    $('resultCard').dataset.animated='1'; $('resultCard').classList.add('is-revealing');
    const number=$('resultCard').querySelector('.result-total-number');
    const target=Number(number?.dataset.total||0); const start=performance.now(); const duration=900;
    const tick=(now)=>{ const progress=Math.min(1,(now-start)/duration); const eased=1-Math.pow(1-progress,3); if(number)number.textContent=kg(target*eased); if(progress<1)requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(()=>$('resultCard').classList.remove('is-revealing'),1800);
  }
}

function render() {
  document.body.classList.toggle('test-build', BUILD_CONFIG.unlimitedSessions);
  document.body.classList.toggle('game-finished', Boolean(state.finished));
  const weather=DATA.weather[state.weather];
  document.body.dataset.weather=state.weather;
  $('weatherLabel').textContent=weather.name; $('weatherTitle').textContent=weather.name; $('weatherDescription').textContent=weather.text; $('weatherScene').textContent=weather.icon;
  $('castsLabel').textContent=state.castsLeft; $('weightLabel').textContent=kg(state.fish.filter(f=>!f.removed).reduce((s,f)=>s+f.weight,0));
  $('castBtn').disabled=state.finished||state.castsLeft<=0; $('castBtn').textContent=state.finished?'Сессия завершена':'🎣 Забросить удочку';
  $('restartBtn').disabled=!BUILD_CONFIG.unlimitedSessions && Boolean(state.sessionDate);
  $('restartBtn').title=(!BUILD_CONFIG.unlimitedSessions && state.sessionDate)?'В сутки доступна только одна игровая сессия':'';
  const effects=[];
  activeBonuses('').forEach(()=>{});
  state.bonuses.forEach(b=>effects.push({label:`${entityIcon(b.name,'✅')} ${b.name}${state.disabledBonusIds.has(b.id)?' (отключён)':''}`,kind:'bonus'}));
  state.artifacts.forEach(a=>effects.push({label:`${entityIcon(a.name,a.tier==='legendary'?'🧡':'💜')} ${a.name}`,kind:a.tier}));
  state.debuffs.forEach(d=>effects.push({label:`${entityIcon(d.name,'🛑')} ${d.name}${d.active?'':' (нейтрализован)'}`,kind:'debuff'}));
  $('effectsList').innerHTML=effects.length?effects.map(e=>`<span class="chip effect-${e.kind}">${e.label}</span>`).join(''):'<span class="muted">Пока нет</span>';
  $('effectCount').textContent=effects.length;
  const inventory=document.querySelector('.inventory');
  const kinds=new Set(effects.map(e=>e.kind));
  inventory.classList.toggle('has-effects',effects.length>0);
  inventory.classList.toggle('glow-bonus',kinds.has('bonus'));
  inventory.classList.toggle('glow-debuff',kinds.has('debuff'));
  inventory.classList.toggle('glow-epic',kinds.has('epic'));
  inventory.classList.toggle('glow-legendary',kinds.has('legendary'));
  renderHistory();
  renderResultCard();
  saveDailyState();
}

function historyAmbientMarkup(h) {
  if (h.type==='fish' && !h.eaten && !h.stolen) {
    return '<span class="history-ambient catch-fish-shadow" data-duration="1900" aria-hidden="true"></span>';
  }
  if (h.type==='bonus') return `<span class="history-ambient bonus-ambient" data-duration="1500" aria-hidden="true">${entityIcon(h.text,'✨')}</span>`;
  if (h.type==='epic') return `<span class="history-ambient epic-ambient" data-duration="1650" aria-hidden="true">${entityIcon(h.text,'◈')}</span>`;
  if (h.type==='legendary') return `<span class="history-ambient legendary-ambient" data-duration="1750" aria-hidden="true">${entityIcon(h.text,'✦')}</span>`;
  if (h.type==='debuff') {
    const map = {
      'Чайка': ['debuff-ambient','debuff-seagull-ambient','🦅','1450'],
      'Рак': ['debuff-ambient','debuff-crab-ambient','🦞','1700'],
      'Утка': ['debuff-ambient','debuff-duck-ambient','🦆','1600'],
      'Осьминог': ['debuff-ambient','debuff-octopus-ambient','🐙','1750'],
      'Касатка': ['debuff-ambient','debuff-orca-ambient','🐋','1800']
    };
    const [base, cls, icon, duration] = map[h.text] || ['debuff-ambient','debuff-generic-ambient','🛑','1500'];
    return `<span class="history-ambient ${base} ${cls}" data-duration="${duration}" aria-hidden="true">${icon}</span>`;
  }
  return '';
}

function renderHistory() {
  const icons={fish:'🐟',bonus:'✅',debuff:'🛑',epic:'💜',legendary:'🧡',trash:'🔘',weather:'⚠️',angus:'🧔'};
  $('historyCount').textContent=state.history.length;
  $('emptyHistory').classList.toggle('hidden',state.history.length>0);
  $('historyList').innerHTML=state.history.map((h,i)=>{
    const fish= h.type==='fish' && h.fishId ? state.fish.find(item=>item.id===h.fishId) : null;
    const entityBasedIcon=['bonus','debuff','epic','legendary'].includes(h.type)?entityIcon(h.text,icons[h.type]):null;
    const icon=h.type==='fish'&&h.eaten?'💀':h.type==='fish'&&h.stolen?'❌':h.type==='fish'&&h.arcade?'🐠':(entityBasedIcon||icons[h.type]||'');
    const weatherClass=h.type==='weather'&&h.weatherKey?` weather-${h.weatherKey}`:'';
    const rowAmbient=historyAmbientMarkup(h);
    const embeddedFish=renderEmbeddedFishList(h);
    const transmutation=renderTransmutation(h);
    const impactNote=h.type==='fish'&&h.eaten?'(Съедена Касаткой)':h.type==='fish'&&h.stolen?'(Украдена Чайкой)':'';
    const visibleText=fish?fishTitleText(fish):h.text;
    const essenceImpact=fish?renderEssenceImpact(fish):'';
    const mainLine=h.transmutation?`${i+1}. 🧡 Трансмутация хлама`:`${i+1}. ${icon} ${visibleText}`;
    const flipperImpact=fish?renderFlipperImpact(fish):'';
    const maskImpact=fish?renderMaskImpact(fish):'';
    const scubaImpact=fish?renderScubaImpact(fish):'';
    const gearBonusStatus=renderGearBonusStatus(h);
    const scubaBonusStatus=renderScubaBonusStatus(h);
    return `<li data-history-id="${h.id}" class="history-item type-${h.type}${h.eaten?' is-eaten':''}${h.stolen?' is-stolen':''}${h.transmutation?' is-transmutation':''}${weatherClass}${h.id===lastAnimatedHistoryId?' is-new':''}"><strong>${mainLine}</strong>${h.detail?`<small class="history-detail">${h.detail}</small>`:''}${impactNote?`<small class="history-impact-note">${impactNote}</small>`:''}${essenceImpact}${flipperImpact}${maskImpact}${scubaImpact}${gearBonusStatus}${scubaBonusStatus}${transmutation}${embeddedFish}${rowAmbient}</li>`;
  }).join('');
  if (lastAnimatedHistoryId) {
    const latest=$('historyList').querySelector(`[data-history-id="${lastAnimatedHistoryId}"]`);
    const scroller=$('historyScroll');
    if (scroller) scroller.scrollTo({top:scroller.scrollHeight,behavior:reduceMotion?'auto':'smooth'});
    setTimeout(()=>latest?.classList.remove('is-new'),700);
    lastAnimatedHistoryId=null;
  }
}

let fishShadowTimer=null;
function startHistoryAmbient(ambient, delay=0) {
  setTimeout(()=>{
    if (reduceMotion || document.hidden || !ambient?.isConnected || ambient.classList.contains('swim')) return;
    ambient.classList.toggle('from-left', Math.random()<.5);
    ambient.classList.toggle('from-bottom', Math.random()<.5);
    const duration=Number(ambient.dataset.duration||1700);
    ambient.classList.add('swim');
    setTimeout(()=>ambient.classList.remove('swim','from-left','from-bottom'),duration);
  },delay);
}
function scheduleFishShadow() {
  clearTimeout(fishShadowTimer);
  fishShadowTimer=setTimeout(()=>{
    if (!reduceMotion && !document.hidden) {
      const ambients=[...document.querySelectorAll('.history-ambient:not(.swim)')];
      if (ambients.length) {
        const max=Math.min(3,ambients.length);
        const count=1+Math.floor(Math.random()*max);
        const pool=[...ambients];
        for(let i=0;i<count;i++) {
          const index=Math.floor(Math.random()*pool.length);
          const ambient=pool.splice(index,1)[0];
          startHistoryAmbient(ambient,Math.random()*700);
        }
      }
    }
    scheduleFishShadow();
  },850+Math.random()*1450);
}

function showChoice(title,text,options,onSelect) {
  $('choiceTitle').textContent=title; $('choiceText').textContent=text; const box=$('choiceButtons'); box.innerHTML='';
  options.forEach(option=>{const b=document.createElement('button');b.textContent=option;b.onclick=()=>{$('choiceDialog').close();onSelect(option);render();if(state.castsLeft<=0&&!state.finished)finishGame();};box.appendChild(b);});
  $('choiceDialog').showModal();
}

const GUIDE = {
  'Погода': Object.values(DATA.weather).map(x=>[`${x.icon} ${x.name}`,x.text]),
  'Бонусы': [
    ['Подводная маска','Каждая оставшаяся рыба в финале ×1,5. Несколько масок складываются. В хронологии показываются исходный вес, общий множитель и результат для каждой затронутой рыбы.'],
    ['Ласты','Каждая вторая будущая рыба ×2. Несколько ласт складываются. В строке усиленной рыбы показываются исходный вес, множитель и результат.'],
    ['Акваланг','В финале усиливает одну самую тяжёлую оставшуюся рыбу. Акваланги складываются линейно: 1 — ×3, 2 — ×6, 3 — ×9. Штурвал Наутилуса удваивает силу каждого: 1 — ×6, 2 — ×12, 3 — ×18. Усиление применяется один раз.'],
    ['Счастливый поплавок','Хлам не расходует заброс.'],
    ['Снаряжение дайвера','Блокирует Чайку, Рака и Утку, если получено раньше них.'],
    ['🧔 Старина Ангус','После любого заброса имеет 2% шанс появиться без расхода дополнительной попытки. С вероятностью 5% приносит артефакт: эпический в 85% случаев или легендарный в 15%. Если артефакта нет, гарантированно добавляет случайную рыбу-гиганта. Повторный Компас имеет отдельный шанс 2% призвать Ангуса.','angus-guide']
  ],
  'Дебафы': [
    ['Чайка','Крадёт случайную рыбу.'],['Рак','Ограничивает весь будущий улов диапазоном 0,1–2,5 кг.'],['Утка','Повышает шанс хлама и ограничивает рыбу 3 кг.'],['Осьминог','Навсегда отключает все бонусы, полученные до его появления.'],['Касатка','Удаляет и не допускает рыбу весом от 5,5 кг.']
  ],
  'Эпические': [
    ['Бездонный ларь','Даёт 1–5 рыб до 19,9 кг с очень низким шансом гиганта.'],['Компас потерянных глубин','Один раз меняет погоду и возвращает лимит к 10. Повторный имеет 2% шанс призвать Ангуса.'],['Послание в бутылке','Возвращает украденную Чайкой рыбу и удваивает повреждённый Раком/Уткой улов.'],['Чешуя Левиафана','+5 забросов; будущие рыбы получают +5, +10, +15 кг и далее.'],['Эссенция «Великан Океанов»','🧪 Две самые лёгкие рыбы ×5 или одна рыба ×10. В строках затронутых рыб показываются исходный вес, новый вес и множитель.']
  ],
  'Легендарные': [
    ['Глубоководное нечто','Превращает весь хлам в рыб-гигантов.'],['Игральная кость','Выбор: +5 забросов или ×5 финальный вес.'],['Штурвал Наутилуса','Удваивает силу бонусов и призывает Глубоководное нечто.'],['Плавник мегалодона','Нейтрализует дебафы, восстанавливает улов и повышает шанс гиганта на 50%.']
  ],
  'Достижения': [
    ['Трепетный эколог','В итоговом улове нет рыбы, но остался хотя бы один предмет хлама.'],
    ['Аквариумный мастер','Все оставшиеся рыбы весят не более 2,5 кг.'],
    ['Любимчик Фортуны','Получить не менее 5 бонусов и/или артефактов.'],
    ['Неуловимый','Совершить не менее 10 забросов и не получить ни одного дебафа; недоступно, если за сессию был Шторм.'],
    ['Везунчик','Напрямую выловить рыбу-тяжеловеса без помощи бонусов и артефактов. Рыба не должна быть ограничена Уткой или Раком.'],
    ['Первобытный триумф','Напрямую выловить рыбу-гиганта без помощи бонусов и артефактов. Рыба не должна быть ограничена Уткой или Раком.'],
    ['Гроза океана','Получить итоговый вес от 150 до 299,9 кг.'],
    ['Повелитель глубин','Получить итоговый вес от 300 кг.'],
    ['Благословение семи морей','Получить не менее 3 артефактов.'],
    ['Марафонец','Совершить не менее 15 фактических забросов за одну игру.'],
    ['Мастер крупных форм','Сохранить в итоговом улове не менее 3 гигантов.'],
    ['Трансмутатор','Успешно применить Эссенцию «Великан Океанов».'],
    ['Дар великого мастера','Получить артефакт от Ангуса.'],
    ['Золотая чешуя','Поймать суммарно не менее 2 золотых рыбок и/или золотых форелей.'],
    ['Тяжёлая артиллерия','Поймать не менее 4 рыб-тяжеловесов за сессию.'],
    ['Легенда озера','Поймать рыбу с исходным весом ровно 40 кг.'],
    ['На волоске','Завершить игру с итоговым весом от 99 до 99,9 кг.'],
    ['Идеальный баланс','Получить итоговый вес ровно 100 кг.'],
    ['Мелочь, а приятно','Поймать не менее 7 рыб с исходным весом до 1 кг.'],
    ['Рыбное изобилие','Сохранить в итоговом улове не менее 12 рыб.'],
    ['Один, но могучий','Завершить игру с одной-единственной рыбой весом не менее 20 кг.'],
    ['Синоптик','Увидеть не менее 5 разных погодных режимов за сессию.'],
    ['Повелитель стихий','Сменить погоду с помощью Компаса потерянных глубин.'],
    ['Рыбак во мраке','Получить легендарный артефакт во время Затмения.'],
    ['Сквозь туман','Получить эпический артефакт во время Тумана.'],
    ['Гроза не помеха','Поймать тяжеловеса во время Грозы.'],
    ['Штормовой капитан','Завершить игру во время Шторма с весом не менее 100 кг.'],
    ['Золотой улов','Поймать не менее 5 рыб во время Золотого часа.'],
    ['Полное снаряжение','Получить Маску, Ласты и Акваланг за одну игру.'],
    ['Под защитой','Заблокировать не менее 2 дебафов Снаряжением дайвера.'],
    ['Вторая попытка','Сохранить не менее 2 забросов благодаря Счастливому поплавку.'],
    ['Ускоритель глубин','Усилить Ластами не менее 4 рыб.'],
    ['Глубокое погружение','Применить Акваланг к рыбе весом не менее 15 кг до усиления.'],
    ['Морская машина','Завершить игру с одновременно активными Маской, Ластами и Аквалангом.'],
    ['Тройное погружение','Получить не менее 3 Аквалангов за одну игру. Их общий множитель без Штурвала составит ×9, со Штурвалом — ×18.'],
    ['Арсенал рыбака','Получить не менее 4 разных бонусов.'],
    ['Переживший бурю','Получить не менее 4 разных дебафов и завершить игру с весом от 100 кг.'],
    ['Возвращение пропажи','Вернуть украденную Чайкой рыбу Посланием в бутылке.'],
    ['Не сегодня, касатка','Нейтрализовать Касатку Плавником мегалодона.'],
    ['Освобождение от пут','После Осьминога получить новый работающий бонус.'],
    ['Несмотря ни на что','После получения Касатки выполнить хотя бы одно другое достижение.'],
    ['Полная реабилитация','Восстановить Плавником мегалодона не менее 2 последствий дебафов.'],
    ['Последняя надежда','Получить Плавник мегалодона после 3 или более дебафов.'],
    ['Коллекционер глубин','Получить не менее 4 разных артефактов.'],
    ['Эпическое путешествие','Получить не менее 3 эпических артефактов.'],
    ['Легендарный рыбак','Получить не менее 2 легендарных артефактов.'],
    ['Воля случая','Выбрать у Игральной кости умножение финального веса ×5.'],
    ['Ещё один заброс','Выбрать у Игральной кости дополнительные 5 забросов.'],
    ['Бездна ответила','Превратить не менее 2 единиц хлама в гигантов с помощью Глубоководного нечто.'],
    ['Капитан Наутилуса','Получить Штурвал при наличии не менее 2 активных бонусов.'],
    ['Дар Левиафана','Поймать не менее 5 рыб после получения Чешуи Левиафана.'],
    ['Власть над океаном','Получить за одну игру эпический и легендарный артефакты.'],
    ['Старые друзья','Встретить Ангуса не менее 2 раз.'],
    ['Щедрость Ангуса','Получить от Ангуса легендарный артефакт.'],
    ['Совет бывалого','Получить от Ангуса рыбу-гиганта.'],
    ['Зов Компаса','Призвать Ангуса повторным Компасом.'],
    ['Наследник рыбака','Получить артефакт от Ангуса и завершить игру с весом не менее 100 кг.'],
    ['Мусорный магнат','Выловить не менее 7 единиц хлама.'],
    ['Обувной магазин','Выловить рваный башмак и резиновый сапог.'],
    ['Плохой сигнал','Выловить утопленный мобильник.'],
    ['Ужин чайки','Чайка должна украсть самую тяжёлую на тот момент рыбу.'],
    ['Рыба ушла','Поймать рыбу, но завершить игру без рыбы из-за дебафов.'],
    ['Не мой день','Получить хлам 4 раза подряд.'],
    ['Вот это поворот','Превратить не менее 3 единиц хлама в гигантов.'],
    ['Морской хаос','Получить за сессию бонус, дебаф, эпический и легендарный артефакт.']
  ]
};
function openGuide(tab='Погода') {
  $('guideTabs').innerHTML=Object.keys(GUIDE).map(k=>`<button data-tab="${k}" class="${k===tab?'active':''}">${k}</button>`).join('');
  const colorClass={
    'Бонусы':'guide-bonus',
    'Дебафы':'guide-debuff',
    'Эпические':'guide-epic',
    'Легендарные':'guide-legendary',
    'Достижения':'guide-achievement'
  }[tab]||'';
  const renderItems=(query='')=>{
    const q=query.trim().toLocaleLowerCase('ru-RU');
    const items=GUIDE[tab].filter(([title,text])=>!q||`${title} ${text}`.toLocaleLowerCase('ru-RU').includes(q));
    const cards=items.map(([title,text,extraClass])=>{
      const guideIcon=['Бонусы','Дебафы','Эпические','Легендарные'].includes(tab)?entityIcon(title,''):'';
      return `<article class="${extraClass||''}"><h3 class="${colorClass}">${guideIcon?`${guideIcon} `:''}${title}</h3><p>${text}</p></article>`;
    }).join('');
    const empty=items.length?'':`<div class="guide-search-empty">Ничего не найдено.</div>`;
    const counter=tab==='Достижения'?`<span class="guide-search-count">Найдено: ${items.length}</span>`:'';
    return `${cards}${empty}${counter}`;
  };
  if(tab==='Достижения') {
    $('guideContent').innerHTML=`<div class="guide-search"><label><span aria-hidden="true">⌕</span><input id="achievementSearch" type="search" placeholder="Найти достижение" autocomplete="off" aria-label="Поиск достижения"></label></div><div id="guideResults">${renderItems()}</div>`;
    const input=$('achievementSearch');
    input.addEventListener('input',()=>{$('guideResults').innerHTML=renderItems(input.value);});
  } else {
    $('guideContent').innerHTML=renderItems();
  }
  $('guideTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>openGuide(b.dataset.tab));
  if(!$('guideDialog').open)$('guideDialog').showModal();
}


$('castBtn').addEventListener('click',castLine);
$('motionBtn').addEventListener('click',()=>{playSound('motion');reduceMotion=!reduceMotion;localStorage.setItem(MOTION_KEY,reduceMotion?'1':'0');applyMotionPreference();toast(reduceMotion?'Интенсивные анимации уменьшены':'Полные анимации включены');});
$('restartBtn').addEventListener('click',()=>{if(!BUILD_CONFIG.unlimitedSessions&&state.sessionDate){toast('Доступна только одна игровая сессия в сутки');return;}removeArcadeCreature(activeArcadeFish);state=initialState();state.weatherSeen=[state.weather];if(state.weather==='storm')state.stormSeen=true;if(BUILD_CONFIG.unlimitedSessions)localStorage.removeItem(TEST_SESSION_KEY);render();toast('Началась новая игровая сессия');});
$('guideBtn').addEventListener('click',()=>{playSound('guide');openGuide();});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('guideDialog').addEventListener('click',e=>{if(e.target===$('guideDialog'))$('guideDialog').close();});
applyMotionPreference();
render();


scheduleFishShadow();

