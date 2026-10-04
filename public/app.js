
'use strict';
/* ============================================================
   THERMO-SRP — APPLICATION LOGIC
   Same architecture/state-engine pattern as AeroTwin, re-domained
   for a thermal-mechanical risk-aware heavy-oil well (CSS + SRP).
   ============================================================ */

/* ---------------------------------------------------------
   CONSTANTS
   --------------------------------------------------------- */
const SUBSYSTEM_META = {
  thermal:    { name:'Thermal / Reservoir',  key:'thermal'    },
  production: { name:'Fluid / Production',   key:'production' },
  mechanical: { name:'Rod System',           key:'mechanical' },
  pump:       { name:'Pump',                 key:'pump'       },
  surface:    { name:'Surface Unit',         key:'surface'    },
  sensors:    { name:'Sensors',              key:'sensors'    },
};
const CSS_PHASES = ['INJECTION','HEATING','SOAK','PRODUCTION','COOLING'];
const STAGE_NAMES = ['NORMAL','THERMAL DEGRADATION DETECTED','RISK ESCALATED','ADAPTATION APPROVED'];

/* ---------------------------------------------------------
   FIELD CONTEXT (static — from the supplied problem statement,
   not derived from the live simulation)
   --------------------------------------------------------- */
const FIELD_CONTEXT = {
  field:'Baghewala Field, Rajasthan',
  reservoir:'Jodhpur Sandstone',
  crude:'Heavy Oil',
  apiGravity:'17–19° API',
  reservoirTemp:'46–48°C',
  conditions:[
    'High crude viscosity',
    'High asphaltene content',
    'Low reservoir pressure',
    'Low reservoir temperature',
    'Poor oil mobility',
  ],
};

/* ---------------------------------------------------------
   PS REQUIREMENT COVERAGE — each item maps to a screen that
   actually demonstrates it (not a static checklist).
   --------------------------------------------------------- */
const PS_COVERAGE = [
  {label:'CSS optimization', screen:'whatif'},
  {label:'SRP optimization', screen:'whatif'},
  {label:'Joint CSS + SRP optimization', screen:'whatif'},
  {label:'Reservoir thermal prediction', screen:'welltwin'},
  {label:'Cooling prediction', screen:'operations'},
  {label:'Viscosity estimation', screen:'welltwin'},
  {label:'Production prediction', screen:'operations'},
  {label:'Rod floating detection', screen:'maintenance'},
  {label:'Rod failure risk', screen:'maintenance'},
  {label:'Pump unsetting risk', screen:'maintenance'},
  {label:'Pump efficiency', screen:'welltwin'},
  {label:'Steam optimization', screen:'whatif'},
  {label:'SOR reduction', screen:'operations'},
  {label:'Energy optimization', screen:'whatif'},
  {label:'Equipment reliability', screen:'maintenance'},
  {label:'Data-driven decision support', screen:'overview'},
  {label:'Predictive analytics', screen:'operations'},
  {label:'Dynamic operating envelope', screen:'operations'},
  {label:'Counterfactual simulation', screen:'whatif'},
  {label:'Human-in-the-loop', screen:'overview'},
];

/* ---------------------------------------------------------
   SCENARIO KEYFRAMES (deterministic, reproducible)
   --------------------------------------------------------- */
const STAGES = [
  /* STAGE 0 — NORMAL */
  {
    well:{ temperature:82.0, pressure:43.5, viscosity:1420, oilProduction:118, pumpFillage:78, rodLoad:72, spm:8.0, stroke:2.1, vfdFrequency:42 },
    expected:{ temperature:83.0, pressure:44.0, viscosity:1380, rodLoad:70, pumpFillage:79 },
    css:{ steamVolume:1800, injectionPressure:42, soakTime:36, productionCutoff:95, cyclePhase:'PRODUCTION' },
    health:{ overall:94, trend:'flat', thermal:95, production:93, mechanical:94, pump:92, surface:97, sensors:99 },
    mechanical:{ rodFloatingRisk:'NORMAL', pumpUnsettingRisk:'NORMAL' },
    sor:{ current:7.0 },
    energy:{ current:4100 },
    prognostics:{ failureProb:3, failureLow:1, failureHigh:6, failureConfidence:88, productionLow:114, productionHigh:121, productionConfidence:90, damageTrend:'Stable', damageConfidence:90 },
    risk:{ overallRisk:8, riskLow:4, riskHigh:14, confidence:90, operatingMargin:'HIGH', category:'LOW' },
    production:{ rate:118, low:114, high:121, confidence:90, stabilityPct:95 },
    dataQuality:{ overall:98, temperature:99, pressure:98, vfd:100, srp:97, production:96 },
  },
  /* STAGE 1 — WATCH (thermal decline detected) */
  {
    well:{ temperature:79.0, pressure:43.0, viscosity:1680, oilProduction:115, pumpFillage:75, rodLoad:78, spm:8.0, stroke:2.1, vfdFrequency:42 },
    expected:{ temperature:82.0, pressure:43.5, viscosity:1420, rodLoad:72, pumpFillage:78 },
    css:{ steamVolume:1800, injectionPressure:42, soakTime:36, productionCutoff:95, cyclePhase:'PRODUCTION' },
    health:{ overall:90, trend:'down', thermal:85, production:88, mechanical:87, pump:86, surface:96, sensors:98 },
    mechanical:{ rodFloatingRisk:'WATCH', pumpUnsettingRisk:'WATCH' },
    sor:{ current:7.8 },
    energy:{ current:4300 },
    prognostics:{ failureProb:6, failureLow:3, failureHigh:10, failureConfidence:85, productionLow:110, productionHigh:119, productionConfidence:86, damageTrend:'Gradual increase', damageConfidence:85 },
    risk:{ overallRisk:28, riskLow:20, riskHigh:38, confidence:87, operatingMargin:'WATCH', category:'WATCH' },
    production:{ rate:115, low:110, high:119, confidence:86, stabilityPct:88 },
    dataQuality:{ overall:97, temperature:98, pressure:98, vfd:100, srp:96, production:95 },
    events:[
      { desc:'Thermal state declined', delta:'82°C → 79°C' },
      { desc:'Viscosity increased', delta:'1420 → 1680 cP' },
      { desc:'Rod floating risk', delta:'NORMAL → WATCH' },
      { desc:'Steam-oil ratio', delta:'7.0 → 7.8 bbl/bbl' },
    ],
  },
  /* STAGE 2 — RISK ESCALATED / ACTION REQUIRED */
  {
    well:{ temperature:76.5, pressure:42.1, viscosity:1950, oilProduction:112, pumpFillage:71, rodLoad:84, spm:8.0, stroke:2.1, vfdFrequency:42 },
    expected:{ temperature:79.2, pressure:43.0, viscosity:1750, rodLoad:76, pumpFillage:75 },
    css:{ steamVolume:1800, injectionPressure:42, soakTime:36, productionCutoff:95, cyclePhase:'COOLING' },
    health:{ overall:82, trend:'down', thermal:79, mechanical:72, production:86, pump:81, surface:91, sensors:97 },
    mechanical:{ rodFloatingRisk:'DETECTED', pumpUnsettingRisk:'MODERATE' },
    sor:{ current:8.4 },
    energy:{ current:4500 },
    prognostics:{ failureProb:9, failureLow:6, failureHigh:13, failureConfidence:84, productionLow:108, productionHigh:114, productionConfidence:82, damageTrend:'Moderate increase expected', damageConfidence:77 },
    risk:{ overallRisk:68, riskLow:58, riskHigh:76, confidence:91, operatingMargin:'NARROW', category:'MODERATE' },
    production:{ rate:112, low:108, high:114, confidence:82, stabilityPct:74 },
    dataQuality:{ overall:96, temperature:97, pressure:97, vfd:100, srp:94, production:93 },
    events:[
      { desc:'Rod floating risk', delta:'WATCH → DETECTED' },
      { desc:'Pump unsetting risk', delta:'WATCH → MODERATE' },
      { desc:'Rod-loading trend confirmed', delta:'78% → 84%' },
      { desc:'Steam-oil ratio', delta:'7.8 → 8.4 bbl/bbl' },
      { desc:'Mechanical risk', delta:'WATCH → MODERATE' },
      { desc:'Operating envelope', delta:'NARROWING' },
      { desc:'Joint CSS + SRP recommendation generated', delta:'' },
    ],
    alerts:[
      { level:'warn', title:'Mechanical risk increasing', body:'Rod loading and rod-floating risk are both trending upward as the thermal condition deteriorates.', meta:'Rod load 78% → 84%' },
      { level:'action', title:'ACTION REQUIRED — operating point approaching mechanical boundary', body:'Recommended: coordinate the next CSS cycle and reduce SRP intensity 8.0 → 7.2 SPM.', meta:'Decision Engine · Confidence 89%' },
    ],
    recommendation:{
      type:'MODIFY_CSS_AND_SRP',
      action:'Coordinate CSS and SRP',
      reasons:[
        'Thermal recovery insufficient — temperature 82.0°C → 76.5°C',
        'Viscosity increasing — 1420 cP → 1950 cP',
        'Rod loading increasing and rod floating DETECTED — 72% → 84%',
        'Pump fillage declining — 78% → 71%, pump unsetting risk WATCH → MODERATE',
        'Steam-oil ratio rising — 7.0 → 8.4 bbl/bbl',
        'Operating envelope narrowing',
      ],
      currentCSS:{ steamVolume:1800, injectionPressure:42, soakTime:36, productionCutoff:95 },
      proposedCSS:{ steamVolume:1650, injectionPressure:40, soakTime:30, productionCutoff:100 },
      currentSRP:{ spm:8.0, stroke:2.1, vfdFrequency:42 },
      proposedSRP:{ spm:7.2, stroke:2.1, vfdFrequency:39 },
      predicted:{ production:109, mechRisk:24, riskCategory:'LOW', sor:7.6, energyPct:94, rodLoad:76 },
      confidence:89,
    },
  },
];

/* ---------------------------------------------------------
   APPLICATION STATE
   --------------------------------------------------------- */
const state = {
  screen:'overview',
  engineeringMode:false,
  scenarioStage:0,
  loggedStages:new Set([0]),
  decisionStatus:'nominal',      // nominal | caution | held | resolved
  holdNote:null,
  operationTimeSec: 3*3600 + 42*60 + 18,
  cyclePhaseIndex:3, // index into CSS_PHASES, 3='PRODUCTION'
  connected:true,
  liveJitter:true,
  selectedSubsystem:null,
  whatif:{ steamVolume:1800, injectionPressure:42, soakTime:36, productionCutoff:95, spm:8.0, stroke:2.1, vfdFrequency:42 },
  whatifResult:null,
  comparisonRows:[],
  events:[],
  alerts:[],
  residualHistory:[],
  thermalHistory:[],
  peakViscosity:0,
  adaptationCount:0,
  wellDuration:36, // hours, canonical "current plan" soak reference
  wellBase:null,
};

function loadStage(i, opts){
  opts = opts || {};
  const s = STAGES[i];
  state.scenarioStage = i;
  state.wellBase = Object.assign({}, s.well);
  state.well = Object.assign({}, s.well);
  state.expected = Object.assign({}, s.expected);
  state.css = Object.assign({}, s.css);
  state.health = Object.assign({}, s.health);
  state.mechanical = Object.assign({}, s.mechanical);
  state.sor = Object.assign({}, s.sor);
  state.energy = Object.assign({}, s.energy);
  state.prognostics = Object.assign({}, s.prognostics);
  state.risk = Object.assign({}, s.risk);
  state.production = Object.assign({}, s.production);
  state.dataQuality = Object.assign({}, s.dataQuality);
  state.cyclePhaseIndex = CSS_PHASES.indexOf(s.css.cyclePhase);
  if(i === 2){
    state.recommendation = JSON.parse(JSON.stringify(s.recommendation));
    state.decisionStatus = 'caution';
  } else if(i <= 1){
    state.recommendation = null;
    state.decisionStatus = 'nominal';
  }
  if(!opts.silent && !state.loggedStages.has(i)){
    state.loggedStages.add(i);
    (s.events||[]).forEach(e=>pushEvent(e.desc, e.delta));
    (s.alerts||[]).forEach(a=>pushAlert(a.level, a.title, a.body, a.meta));
  }
  recordHistoryPoint();
}

function resetScenario(){
  state.loggedStages = new Set([0]);
  state.events = [];
  state.alerts = [];
  state.comparisonRows = [];
  state.decisionStatus = 'nominal';
  state.holdNote = null;
  state.whatifResult = null;
  state.operationTimeSec = 3*3600 + 42*60 + 18;
  state.residualHistory = [];
  state.thermalHistory = [];
  state.peakViscosity = 0;
  state.adaptationCount = 0;
  loadStage(0, {silent:true});
  pushEvent('Scenario reset', 'baseline restored');
  render();
}

function advanceScenario(){
  if(state.scenarioStage < 2){
    loadStage(state.scenarioStage + 1);
    render();
  }
}
function previousScenario(){
  if(state.scenarioStage<=0) return;
  const target = Math.min(state.scenarioStage-1, 2);
  loadStage(target, {silent:true});
  render();
}

/* Apply a joint CSS+SRP adaptation — used by both the Well Decision
   Center APPROVE action and the What-If "Apply to operation" action. */
function applyAdaptation(cssPolicy, srpPolicy, predicted, sourceLabel){
  const wasEscalated = state.scenarioStage === 2 && state.decisionStatus === 'caution';
  const prevProd = state.production.rate;
  const prevRodLoad = state.well.rodLoad;
  const prevSpm = state.well.spm;
  const prevSor = state.sor.current;

  state.css.steamVolume = cssPolicy.steamVolume;
  state.css.injectionPressure = cssPolicy.injectionPressure;
  state.css.soakTime = cssPolicy.soakTime;
  state.css.productionCutoff = cssPolicy.productionCutoff;
  state.well.spm = srpPolicy.spm;
  state.well.stroke = srpPolicy.stroke;
  state.well.vfdFrequency = srpPolicy.vfdFrequency;
  state.well.rodLoad = predicted.rodLoad;
  state.production.rate = predicted.production;
  state.production.low = clamp(predicted.production-4,0,999);
  state.production.high = clamp(predicted.production+3,0,999);
  state.sor.current = predicted.sor;
  state.energy.current = Math.round(state.energy.current * (predicted.energyPct/100));
  state.risk.overallRisk = predicted.mechRisk;
  state.risk.category = predicted.riskCategory;
  state.risk.riskLow = clamp(predicted.mechRisk-8,0,100);
  state.risk.riskHigh = clamp(predicted.mechRisk+8,0,100);

  if(wasEscalated){
    state.health.mechanical = clamp(state.health.mechanical+4,0,100);
    state.health.overall = clamp(state.health.overall+2,0,100);
    state.prognostics.failureProb = clamp(state.prognostics.failureProb-2,0,100);
    state.mechanical.rodFloatingRisk = 'WATCH';
    state.mechanical.pumpUnsettingRisk = 'WATCH';
    state.decisionStatus = 'resolved';
    state.scenarioStage = 3;
    state.adaptationCount = (state.adaptationCount||0) + 1;
    pushEvent('Operator approved adaptation', (sourceLabel||'Joint CSS+SRP policy'));
    pushEvent('SPM', prevSpm+' → '+srpPolicy.spm);
    pushEvent('Rod load', prevRodLoad+'% → '+predicted.rodLoad+'%');
    pushEvent('Production', prevProd+' → '+predicted.production+' bbl/d');
    pushEvent('Steam-oil ratio', prevSor+' → '+predicted.sor+' bbl/bbl');
    pushEvent('Mechanical risk', 'MODERATE → '+predicted.riskCategory);
    pushAlert('info','Adaptation applied — monitoring effect','Operating point updated. THERMO-SRP will continue to track residuals against the new setpoint.','Production now '+predicted.production+' bbl/d');
  } else {
    pushEvent('Operator adjusted operating policy', prevSpm+' → '+srpPolicy.spm+' SPM');
  }
  state.wellBase = Object.assign({}, state.well);
  recordHistoryPoint();
  render();
}

function holdCurrentPolicy(note){
  state.holdNote = note || 'Operator elected to continue on the current plan.';
  state.decisionStatus = 'held';
  pushEvent('Operator held current policy', state.holdNote);
  pushAlert('warn','Current policy retained','Operator held the existing CSS/SRP policy. Thermal deterioration is expected to continue; logged for post-operation review.','Mechanical risk expected to increase');
  closeModal();
  render();
}
function reconsiderHold(){
  state.decisionStatus = 'caution';
  state.holdNote = null;
  render();
}

/* ---------------------------------------------------------
   UTILITIES
   --------------------------------------------------------- */
function $(id){ return document.getElementById(id); }
function clamp(n,lo,hi){ return Math.max(lo, Math.min(hi,n)); }
function round1(n){ return Math.round(n*10)/10; }

function fmtClock(sec){
  sec = Math.floor(sec);
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s = String(Math.floor(sec%60)).padStart(2,'0');
  return h+':'+m+':'+s;
}
function fmtShortTime(sec){
  sec = Math.floor(sec);
  const h = String(Math.floor(sec/3600)%24).padStart(2,'0');
  const m = String(Math.floor((sec%3600)/60)).padStart(2,'0');
  return h+':'+m;
}
function riskClass(cat){
  if(cat==='LOW') return 'ok';
  if(cat==='WATCH' || cat==='MODERATE') return 'warn';
  return 'crit';
}
function riskBadge(cat){
  const c = riskClass(cat);
  return `<span class="badge badge--${c}"><span class="dot"></span>${cat}</span>`;
}
function healthColorClass(v){
  if(v>=90) return 'green'; if(v>=75) return 'amber'; return 'red';
}
function trendArrow(dir, goodDir){
  if(dir==='flat') return `<span class="trend trend--flat">→ steady</span>`;
  const isGood = dir === goodDir;
  const cls = isGood ? (dir==='up'?'trend--up-good':'trend--down-good') : (dir==='up'?'trend--up-bad':'trend--down-bad');
  const arrow = dir==='up' ? '↑' : '↓';
  return `<span class="trend ${cls}">${arrow}</span>`;
}
function pushEvent(desc, delta){
  state.events.unshift({ t: fmtClock(state.operationTimeSec), desc, delta });
  if(state.events.length>50) state.events.pop();
}
function pushAlert(level, title, body, meta){
  state.alerts.unshift({ level, title, body, meta, t: fmtShortTime(state.operationTimeSec) });
  if(state.alerts.length>30) state.alerts.pop();
}
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function recordHistoryPoint(){
  if(!state.well || !state.expected) return;
  state.residualHistory.push({ v: round1(state.well.temperature - state.expected.temperature) });
  if(state.residualHistory.length>26) state.residualHistory.shift();
  state.thermalHistory.push({ v: state.well.temperature });
  if(state.thermalHistory.length>26) state.thermalHistory.shift();
  state.peakViscosity = Math.max(state.peakViscosity||0, state.well.viscosity);
}

function openModal(html){
  $('modalBody').innerHTML = html;
  $('modalOverlay').classList.add('open');
}
function closeModal(){
  $('modalOverlay').classList.remove('open');
}
$('modalOverlay') && $('modalOverlay').addEventListener('click', (e)=>{
  if(e.target.id==='modalOverlay') closeModal();
});

function navigate(screen){
  state.screen = screen;
  if(screen==='whatif' && state.whatifResult===null){
    state.whatif.steamVolume = state.css.steamVolume;
    state.whatif.injectionPressure = state.css.injectionPressure;
    state.whatif.soakTime = state.css.soakTime;
    state.whatif.productionCutoff = state.css.productionCutoff;
    state.whatif.spm = state.well.spm;
    state.whatif.stroke = state.well.stroke;
    state.whatif.vfdFrequency = state.well.vfdFrequency;
  }
  render();
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ---------------------------------------------------------
   JOINT CSS + SRP COUNTERFACTUAL ENGINE
   Deterministic weighted model — same "prototype calculation"
   philosophy as the AeroTwin What-If predictor, extended to
   couple CSS policy (steam/pressure/soak/cutoff) with SRP
   policy (spm/stroke/vfd) into one evaluation.
   --------------------------------------------------------- */
function getEnvelopeBoundaries(){
  // SPM ceiling as a function of stroke, narrowed when rod-floating risk escalates.
  const key = state.mechanical.rodFloatingRisk;
  const table = {
    'NORMAL':   { redAtLowStroke:10.6, redAtHighStroke:9.2 },
    'WATCH':    { redAtLowStroke:9.8,  redAtHighStroke:8.4 },
    'DETECTED': { redAtLowStroke:8.6,  redAtHighStroke:7.2 },
    'HIGH RISK':{ redAtLowStroke:7.6,  redAtHighStroke:6.4 },
  };
  return table[key] || table['NORMAL'];
}
function validatePolicy(spm, stroke){
  const b = getEnvelopeBoundaries();
  const tMin=1.5, tMax=2.4;
  const frac = clamp((stroke-tMin)/(tMax-tMin),0,1);
  const redCeiling = b.redAtLowStroke + (b.redAtHighStroke-b.redAtLowStroke)*frac;
  if(spm > redCeiling){
    return { allowed:false, severity:'RESTRICTED',
      reason:`Predicted rod loading exceeds the acceptable mechanical operating boundary at ${stroke} m stroke (SPM ceiling ≈ ${round1(redCeiling)} given current rod-floating risk: ${state.mechanical.rodFloatingRisk}).` };
  }
  if(spm > redCeiling-0.8){
    return { allowed:true, severity:'WARNING',
      reason:'This operating point sits close to the mechanical boundary — proceed with caution.' };
  }
  return { allowed:true, severity:'OK', reason:null };
}
function estimateEnergy(steamVolume, spm, vfdFrequency, injectionPressure){
  return steamVolume*0.3 + spm*180 + vfdFrequency*8 + injectionPressure*10;
}
function predictJointOutcome(css, srp){
  const baseSteam=1800, basePressure=42, baseSoak=36, baseCutoff=95;
  const baseSpm=8.0;
  const dSteam = css.steamVolume-baseSteam, dPressure = css.injectionPressure-basePressure;
  const dSoak = css.soakTime-baseSoak, dCutoff = css.productionCutoff-baseCutoff;
  const dSpm = srp.spm-baseSpm;

  let production = 112 + dSpm*4 + dSteam*0.004 + dSoak*0.1 + dCutoff*0.3 + dPressure*0.2;
  production = clamp(Math.round(production), 40, 140);

  let mechRisk = 68 + dSpm/0.8*30 + dSteam/150*5 + dSoak/6*3 + dPressure/2*2 - dCutoff/5*4;
  mechRisk = clamp(Math.round(mechRisk), 3, 97);

  let sor = 8.4 + dSteam/150*0.3 + dPressure/2*0.1 + dSoak/6*0.15 - dCutoff/5*0.15 - dSpm/0.8*0.1;
  sor = clamp(round1(sor), 4.5, 12);

  let rodLoad = 84 + dSpm*10 + dSoak*0.05 + dSteam*0.002;
  rodLoad = clamp(Math.round(rodLoad), 30, 99);

  const currentEnergy = estimateEnergy(state.css.steamVolume, state.well.spm, state.well.vfdFrequency, state.css.injectionPressure);
  const simEnergy = estimateEnergy(css.steamVolume, srp.spm, srp.vfdFrequency, css.injectionPressure);
  const energyPct = clamp(Math.round(simEnergy/currentEnergy*100), 50, 150);

  let riskCategory = 'LOW';
  if(mechRisk>=70) riskCategory='HIGH'; else if(mechRisk>=45) riskCategory='MODERATE'; else if(mechRisk>=25) riskCategory='WATCH';

  const costIndex = clamp(Math.round(energyPct*0.6 + (sor/8.4*100)*0.4), 40, 160);

  return { production, mechRisk, riskCategory, sor, rodLoad, energyPct, costIndex };
}
function getAnomalyCount(){
  if(state.scenarioStage>=2) return 3;
  if(state.scenarioStage===1) return 1;
  return 0;
}

/* ---------------------------------------------------------
   TOP BAR
   --------------------------------------------------------- */
function renderTopbar(){
  const w = state.well;
  const connDot = state.connected ? 'ok' : 'crit';
  const telDot = state.dataQuality.overall>=95 ? 'ok' : state.dataQuality.overall>=85 ? 'warn' : 'crit';
  return `
    <div class="topbar__brand"><span class="mark"></span>THERMO-SRP</div>
    <div class="topbar__group">
      <div class="topbar__item"><b>BGW-042</b></div>
      <div class="topbar__item"><span class="faint">FIELD</span> <b>BAGHEWALA</b></div>
      <div class="topbar__item"><span class="topbar__dot ${connDot}"></span><b>${state.connected?'CONNECTED':'LOST'}</b></div>
      <div class="topbar__item"><span class="topbar__dot ${telDot}"></span><span class="faint">DATA QUALITY</span> <b>${state.dataQuality.overall}%</b></div>
    </div>
    <div class="topbar__phase">MODE · PRODUCTION</div>
    <div class="topbar__spacer"></div>
    <div class="topbar__group">
      <div class="topbar__item"><span class="faint">TEMP</span> <b>${round1(w.temperature)}°C</b></div>
      <div class="topbar__item"><span class="faint">PRESS</span> <b>${round1(w.pressure)} bar</b></div>
      <div class="topbar__item"><span class="faint">SPM</span> <b>${w.spm}</b></div>
      <div class="topbar__item topbar__clock"><span class="faint mono">T</span> ${fmtClock(state.operationTimeSec)}</div>
    </div>
    <button class="btn btn--sm btn--ghost" onclick="openFieldContext()" aria-label="Field context">FIELD CONTEXT</button>
    <button class="btn btn--sm btn--ghost" onclick="openPSCoverage()" aria-label="PS requirement coverage">PS COVERAGE</button>
    <div class="eng-toggle ${state.engineeringMode?'on':''}" tabindex="0" role="button" aria-label="Toggle engineering mode" onclick="toggleEngineeringMode()">
      <span>ENGINEERING MODE</span><span class="eng-toggle__switch"></span>
    </div>
  `;
}
function toggleEngineeringMode(){ state.engineeringMode = !state.engineeringMode; render(); }

/* ---------------------------------------------------------
   NAV
   --------------------------------------------------------- */
const NAV_ITEMS = [
  {id:'overview', num:'01', label:'OVERVIEW'},
  {id:'welltwin', num:'02', label:'WELL TWIN'},
  {id:'operations', num:'03', label:'OPERATIONS'},
  {id:'whatif', num:'04', label:'WHAT-IF'},
  {id:'maintenance', num:'05', label:'MAINTENANCE'},
];
function renderNav(){
  return NAV_ITEMS.map(item=>{
    const active = state.screen===item.id ? 'active' : '';
    let flag = '';
    if(item.id==='overview'){
      const issue = getActiveIssue();
      if(issue && (issue.severity==='crit'||issue.severity==='warn')) flag = '<span class="flag"></span>';
    }
    return `<button class="nav__tab ${active}" onclick="navigate('${item.id}')"><span class="num">${item.num}</span>${item.label}${flag}</button>`;
  }).join('');
}

/* ---------------------------------------------------------
   DEMO CONTROL STRIP
   --------------------------------------------------------- */
function renderDemoBar(){
  const step = state.scenarioStage+1;
  const stageName = STAGE_NAMES[state.scenarioStage];
  let advanceBtn;
  if(state.scenarioStage < 2){
    advanceBtn = `<button class="btn btn--xs btn--primary" onclick="advanceScenario()">ADVANCE →</button>`;
  } else if(state.scenarioStage === 2 && state.decisionStatus==='caution'){
    advanceBtn = `<button class="btn btn--xs" disabled>AWAITING DECISION</button>`;
  } else if(state.scenarioStage === 2 && state.decisionStatus==='held'){
    advanceBtn = `<button class="btn btn--xs" onclick="reconsiderHold()">RECONSIDER</button>`;
  } else {
    advanceBtn = `<button class="btn btn--xs" disabled>COMPLETE</button>`;
  }
  return `
    <span class="demo-strip__label">◆ DEMO MODE</span>
    <span class="demo-strip__step">STEP ${step}/4 — ${stageName}</span>
    <div class="demo-strip__spacer"></div>
    <button class="btn btn--xs" onclick="previousScenario()" ${state.scenarioStage===0?'disabled':''}>← PREVIOUS</button>
    ${advanceBtn}
    <button class="btn btn--xs btn--ghost" onclick="resetScenario()">RESET</button>
    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:11px;">
      <input type="checkbox" ${state.liveJitter?'checked':''} onchange="toggleJitter(this.checked)"> LIVE TELEMETRY
    </label>
  `;
}
function toggleJitter(v){ state.liveJitter = v; }

/* ---------------------------------------------------------
   FIELD CONTEXT / PS COVERAGE MODALS
   --------------------------------------------------------- */
function openFieldContext(){
  openModal(`
    <div class="modal__head">
      <div class="modal__title">Field Context</div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="kv-row"><span class="k">Field</span><span class="v">${FIELD_CONTEXT.field}</span></div>
    <div class="kv-row"><span class="k">Reservoir</span><span class="v">${FIELD_CONTEXT.reservoir}</span></div>
    <div class="kv-row"><span class="k">Crude</span><span class="v">${FIELD_CONTEXT.crude}</span></div>
    <div class="kv-row"><span class="k">API gravity</span><span class="v">${FIELD_CONTEXT.apiGravity}</span></div>
    <div class="kv-row"><span class="k">Reservoir temperature</span><span class="v">${FIELD_CONTEXT.reservoirTemp}</span></div>
    <div class="decision-center__why-title" style="margin-top:14px;">KEY CONDITIONS</div>
    <ul class="why-list">${FIELD_CONTEXT.conditions.map(c=>`<li>${c}</li>`).join('')}</ul>
    <div class="dim" style="font-size:12px; margin-top:14px; line-height:1.5;">Field and reservoir description per the supplied problem statement. All live operating values shown elsewhere in this prototype are <b style="color:var(--text)">synthetic demonstration data</b>, not measured Baghewala field data.</div>
  `);
}
function openPSCoverage(){
  openModal(`
    <div class="modal__head">
      <div class="modal__title">PS Requirement Coverage</div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="dim" style="font-size:12.5px; margin-bottom:12px;">Each item below is demonstrated by actual prototype behaviour, not a static claim. Tap one to open the screen that demonstrates it.</div>
    ${PS_COVERAGE.map(item=>`
      <div class="event-item" tabindex="0" role="button" aria-label="${esc(item.label)}" style="grid-template-columns:22px 1fr auto;" onclick="closeModal(); navigate('${item.screen}');">
        <div style="color:var(--green);">✓</div>
        <div class="event-item__desc">${esc(item.label)}</div>
        <div class="event-item__delta faint">${item.screen.toUpperCase()} →</div>
      </div>`).join('')}
  `);
}

/* ---------------------------------------------------------
   WELL DIGITAL TWIN — SCHEMATIC (pumpjack / wellbore / reservoir)
   --------------------------------------------------------- */
function subsystemStatus(key){
  const v = state.health[key];
  let cls, label, emoji;
  if(v>=93){ cls='ok'; label = (key==='sensors')?'HEALTHY':'NORMAL'; emoji='🟢'; }
  else if(v>=85){ cls='warn'; label = (key==='sensors')?'DEGRADED':'WATCH'; emoji='🟡'; }
  else if(v>=70){ cls='warn'; label='WARNING'; emoji='🟡'; }
  else { cls='crit'; label='CRITICAL'; emoji='🔴'; }
  return {cls,label,value:v,emoji};
}
function dotColor(cls){ return cls==='ok' ? 'var(--green)' : cls==='warn' ? 'var(--amber)' : 'var(--red)'; }

function buildWellSVG(){
  const c = {
    surface: subsystemStatus('surface'),
    mechanical: subsystemStatus('mechanical'),
    sensors: subsystemStatus('sensors'),
    pump: subsystemStatus('pump'),
    thermal: subsystemStatus('thermal'),
    production: subsystemStatus('production'),
  };
  const node = (key)=>`onclick="openSubsystem('${key}')" tabindex="0" role="button" aria-label="${SUBSYSTEM_META[key].name}"`;

  return `
  <svg viewBox="0 0 460 520" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;max-height:460px;">
    <!-- ground -->
    <line x1="60" y1="132" x2="400" y2="132" stroke="#2a3444" stroke-width="2"/>

    <!-- ===== SURFACE UNIT (pumpjack) ===== -->
    <g class="twin-node" ${node('surface')}>
      <rect x="194" y="58" width="12" height="74" fill="${dotColor(c.surface.cls)}" fill-opacity="0.14" stroke="${dotColor(c.surface.cls)}" stroke-width="1.6"/>
      <line x1="128" y1="74" x2="312" y2="58" stroke="${dotColor(c.surface.cls)}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="128" cy="74" r="11" fill="none" stroke="${dotColor(c.surface.cls)}" stroke-width="3"/>
      <rect x="296" y="56" width="26" height="20" rx="2" fill="${dotColor(c.surface.cls)}" fill-opacity="0.25" stroke="${dotColor(c.surface.cls)}" stroke-width="1.6"/>
      <circle cx="340" cy="90" r="5" fill="${dotColor(c.surface.cls)}"/>
      <text x="352" y="94" class="twin-label" fill="${dotColor(c.surface.cls)}">${c.surface.label}</text>
      <text x="128" y="40" class="twin-label-name">Surface Unit</text>
    </g>

    <!-- wellhead + casing (decorative, non-interactive) -->
    <rect x="183" y="128" width="30" height="14" fill="#161d27" stroke="#2a3444" stroke-width="1.5"/>
    <rect x="188" y="142" width="20" height="300" fill="#0c1017" stroke="#232c3a" stroke-width="1.4"/>

    <!-- ===== MECHANICAL (rod string) ===== -->
    <g class="twin-node" ${node('mechanical')}>
      <line x1="198" y1="150" x2="198" y2="428" stroke="${dotColor(c.mechanical.cls)}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="340" cy="260" r="5" fill="${dotColor(c.mechanical.cls)}"/>
      <text x="352" y="264" class="twin-label" fill="${dotColor(c.mechanical.cls)}">${c.mechanical.label}</text>
      <text x="222" y="264" class="twin-label-name">Rod System</text>
    </g>

    <!-- ===== SENSORS (along wellbore) ===== -->
    <g class="twin-node" ${node('sensors')}>
      ${[190,280,370].map(y=>`<circle cx="208" cy="${y}" r="3.6" fill="${dotColor(c.sensors.cls)}"/>`).join('')}
      <circle cx="340" cy="190" r="5" fill="${dotColor(c.sensors.cls)}"/>
      <text x="352" y="194" class="twin-label" fill="${dotColor(c.sensors.cls)}">${c.sensors.label}</text>
      <text x="222" y="194" class="twin-label-name">Sensor network</text>
    </g>

    <!-- ===== PUMP ===== -->
    <g class="twin-node" ${node('pump')}>
      <rect x="180" y="415" width="36" height="28" rx="2" fill="${dotColor(c.pump.cls)}" fill-opacity="0.18" stroke="${dotColor(c.pump.cls)}" stroke-width="1.6"/>
      <circle cx="340" cy="429" r="5" fill="${dotColor(c.pump.cls)}"/>
      <text x="352" y="433" class="twin-label" fill="${dotColor(c.pump.cls)}">${c.pump.label}</text>
      <text x="222" y="433" class="twin-label-name">Pump</text>
    </g>

    <!-- ===== THERMAL ZONE ===== -->
    <g class="twin-node" ${node('thermal')}>
      <ellipse cx="198" cy="466" rx="66" ry="22" fill="${dotColor(c.thermal.cls)}" fill-opacity="0.16" stroke="${dotColor(c.thermal.cls)}" stroke-width="1.6"/>
      <circle cx="340" cy="466" r="5" fill="${dotColor(c.thermal.cls)}"/>
      <text x="352" y="470" class="twin-label" fill="${dotColor(c.thermal.cls)}">${c.thermal.label}</text>
      <text x="140" y="500" class="twin-label-name">Thermal zone</text>
    </g>

    <!-- ===== PRODUCTION / FLUID (reservoir) ===== -->
    <g class="twin-node" ${node('production')}>
      <path d="M90 492 Q198 512 310 492 L310 512 Q198 530 90 512 Z" fill="${dotColor(c.production.cls)}" fill-opacity="0.18" stroke="${dotColor(c.production.cls)}" stroke-width="1.6"/>
      <circle cx="340" cy="505" r="5" fill="${dotColor(c.production.cls)}"/>
      <text x="352" y="509" class="twin-label" fill="${dotColor(c.production.cls)}">${c.production.label}</text>
      <text x="90" y="486" class="twin-label-name">Reservoir / fluid</text>
    </g>
  </svg>`;
}

function subsystemDetail(key){
  const meta = SUBSYSTEM_META[key];
  const st = subsystemStatus(key);
  const w = state.well, x = state.expected, m = state.mechanical;
  let rows = [];
  let assessment = 'Nominal — operating within physics-model expectation.';
  let confidence = 95;

  if(key==='thermal'){
    rows = [
      {k:'Temperature (actual)', v:round1(w.temperature)+'°C'}, {k:'Temperature (expected)', v:x.temperature+'°C'},
      {k:'Deviation', v:(round1(w.temperature-x.temperature)>=0?'+':'')+round1(w.temperature-x.temperature)+'°C'},
      {k:'Viscosity', v:w.viscosity+' cP'},
      {k:'Reservoir temperature (field range)', v:FIELD_CONTEXT.reservoirTemp},
    ];
    if(st.cls!=='ok'){ assessment='Thermal decline — wellbore temperature is tracking below the physics-model expectation, consistent with reduced steam-stimulation benefit and rising viscosity.'; confidence=91; }
  } else if(key==='production'){
    rows = [
      {k:'Oil production (actual)', v:w.oilProduction+' bbl/d'},
      {k:'Expected range', v:state.production.low+'–'+state.production.high+' bbl/d'},
      {k:'Pump fillage', v:w.pumpFillage+'%'}, {k:'Pump fillage (expected)', v:x.pumpFillage+'%'},
      {k:'Steam-oil ratio', v:state.sor.current+' bbl/bbl'},
    ];
    if(st.cls!=='ok'){ assessment='Fluid mobility declining — rising viscosity is reducing inflow and pump fillage, with steam-oil ratio trending unfavourably.'; confidence=86; }
  } else if(key==='mechanical'){
    rows = [
      {k:'Rod load (actual)', v:w.rodLoad+'%'}, {k:'Rod load (expected)', v:x.rodLoad+'%'},
      {k:'Deviation', v:(w.rodLoad-x.rodLoad>=0?'+':'')+(w.rodLoad-x.rodLoad)+'%'},
      {k:'Rod floating risk', v:m.rodFloatingRisk},
      {k:'SPM / Stroke', v:w.spm+' / '+w.stroke+' m'},
    ];
    if(m.rodFloatingRisk==='DETECTED' || m.rodFloatingRisk==='HIGH RISK'){
      assessment='Rod floating detected — abnormal rod-load pattern with reduced effective pump loading and cyclic load instability under the current heavy-fluid condition. Increases impact-loading risk and mechanical stress.'; confidence=93;
    } else if(st.cls!=='ok'){
      assessment='Mechanical loading increasing as the thermal state deteriorates and viscosity rises.'; confidence=90;
    }
  } else if(key==='pump'){
    rows = [
      {k:'Pump fillage', v:w.pumpFillage+'%'}, {k:'Pump fillage (expected)', v:x.pumpFillage+'%'},
      {k:'Pump unsetting risk', v:m.pumpUnsettingRisk},
      {k:'Pump health score', v:state.health.pump+'%'},
    ];
    if(m.pumpUnsettingRisk!=='NORMAL'){ assessment='Pump unsetting risk elevated — contributing factors include high mechanical loading, reduced fillage, and changing fluid properties under an unstable operating condition.'; confidence=88; }
  } else if(key==='surface'){
    rows = [
      {k:'VFD frequency', v:w.vfdFrequency+' Hz'},
      {k:'Surface unit health', v:state.health.surface+'%'},
      {k:'Stroke', v:w.stroke+' m'},
    ];
  } else if(key==='sensors'){
    rows = [
      {k:'Data quality (overall)', v:state.dataQuality.overall+'%'},
      {k:'Temperature sensor', v:state.dataQuality.temperature+'%'},
      {k:'Pressure sensor', v:state.dataQuality.pressure+'%'},
      {k:'VFD telemetry', v:state.dataQuality.vfd+'%'},
      {k:'SRP telemetry', v:state.dataQuality.srp+'%'},
      {k:'Production telemetry', v:state.dataQuality.production+'%'},
    ];
    if(state.dataQuality.srp<96){ assessment='Prediction confidence slightly reduced — SRP telemetry quality below nominal.'; confidence=state.dataQuality.srp; }
  }

  const rowsHtml = rows.map(r=>`<div class="kv-row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`).join('');
  return `
    <div class="modal__head">
      <div>
        <div class="modal__title">${meta.name}</div>
        <div style="margin-top:6px;"><span class="badge badge--${st.cls}"><span class="dot"></span>${st.label} · ${st.value}%</span></div>
      </div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    ${rowsHtml}
    <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-soft);">
      <div style="font-size:11px;letter-spacing:.1em;color:var(--text-faint);font-weight:700;margin-bottom:6px;">AI / DIGITAL TWIN ASSESSMENT</div>
      <div style="font-size:13.5px;color:var(--text-dim);line-height:1.55;">${assessment}</div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--text-faint);">Confidence: <span class="mono" style="color:var(--text)">${confidence}%</span></div>
    </div>
  `;
}
function openSubsystem(key){
  state.selectedSubsystem = key;
  openModal(subsystemDetail(key));
}
function renderTwinStrip(){
  return `<div class="twin-strip">${Object.keys(SUBSYSTEM_META).map(key=>{
    const st = subsystemStatus(key);
    return `
      <div class="twin-chip" tabindex="0" role="button" aria-label="${SUBSYSTEM_META[key].name}: ${st.label}" onclick="openSubsystem('${key}')">
        <span class="twin-chip__emoji">${st.emoji}</span>
        <div class="twin-chip__body">
          <span class="twin-chip__name">${SUBSYSTEM_META[key].name}</span>
          <span class="twin-chip__status" style="color:${dotColor(st.cls)}">${st.label}</span>
        </div>
      </div>`;
  }).join('')}</div>`;
}

/* ---------------------------------------------------------
   WELL DECISION CENTER
   --------------------------------------------------------- */
function renderDecisionCenter(){
  const r = state.risk, h = state.health;
  let statusColor='var(--green)', statusIcon='✓', statusText='NORMAL — OPERATING AS PLANNED';
  if(state.decisionStatus==='caution'){ statusColor='var(--red)'; statusIcon='🔴'; statusText='ACTION REQUIRED'; }
  if(state.decisionStatus==='held'){ statusColor='var(--amber)'; statusIcon='⚠'; statusText='POLICY HELD — OPERATOR MONITORING'; }
  if(state.decisionStatus==='resolved'){ statusColor='var(--cyan)'; statusIcon='✓'; statusText='ADAPTATION ACTIVE — MONITORING'; }

  const metrics = `
    <div class="decision-center__metrics">
      <div><div class="dc-metric__value" style="color:${riskClass(r.category)==='ok'?'var(--green)':riskClass(r.category)==='warn'?'var(--amber)':'var(--red)'}">${r.overallRisk}%</div><div class="dc-metric__label">MECHANICAL RISK</div></div>
      <div><div class="dc-metric__value" style="color:${healthColorClass(h.overall)==='green'?'var(--green)':healthColorClass(h.overall)==='amber'?'var(--amber)':'var(--red)'}">${h.overall}%</div><div class="dc-metric__label">WELL HEALTH</div></div>
      <div><div class="dc-metric__value" style="color:var(--text)">${r.confidence}%</div><div class="dc-metric__label">PREDICTION CONFIDENCE</div></div>
    </div>`;

  let why='', plan='', rec='', actions='';

  if(state.decisionStatus==='caution' && state.recommendation){
    const rc = state.recommendation;
    why = `
      <div class="decision-center__why">
        <div class="decision-center__why-title">WHY?</div>
        <ul class="why-list">${rc.reasons.map(x=>`<li>${x}</li>`).join('')}</ul>
      </div>`;
    plan = `
      <div class="decision-center__plan">
        <div><div class="plan-item__label">SPM</div>${rc.currentSRP.spm}</div>
        <div><div class="plan-item__label">STROKE</div>${rc.currentSRP.stroke} m</div>
        <div><div class="plan-item__label">STEAM VOLUME</div>${rc.currentCSS.steamVolume.toLocaleString()} bbl</div>
      </div>`;
    rec = `
      <div class="decision-center__rec">
        <div class="rec__title">RECOMMENDED ADAPTATION — ${rc.action.toUpperCase()}</div>
        <div class="rec__change">SPM ${rc.currentSRP.spm} <span class="rec__arrow">→</span> ${rc.proposedSRP.spm} &nbsp;·&nbsp; Steam ${rc.currentCSS.steamVolume} <span class="rec__arrow">→</span> ${rc.proposedCSS.steamVolume} bbl</div>
        <div class="rec__effect">Mechanical risk: <b>${r.overallRisk}% → ${rc.predicted.mechRisk}% (${rc.predicted.riskCategory})</b> &nbsp;·&nbsp; Production: <b>${state.production.rate} → ${rc.predicted.production} bbl/d</b> &nbsp;·&nbsp; SOR: <b>${state.sor.current} → ${rc.predicted.sor}</b> &nbsp;·&nbsp; Confidence ${rc.confidence}%</div>
      </div>`;
    actions = `
      <div class="decision-center__actions">
        <button class="btn" onclick="simulateFromDecisionCenter()">SIMULATE</button>
        <button class="btn btn--primary" onclick="approveRecommendation()">APPROVE</button>
        <button class="btn btn--danger" onclick="openHoldModal()">HOLD</button>
      </div>`;
  } else if(state.decisionStatus==='held'){
    plan = `<div style="margin-top:16px; font-size:13.5px; color:var(--text-dim);">Operator continued on the existing CSS/SRP policy. Expected consequence: thermal deterioration continues and mechanical risk is expected to increase over the forecast horizon. Logged for post-operation review.</div>`;
    actions = `<div class="decision-center__actions"><button class="btn" onclick="reconsiderHold()">RETURN TO DECISION</button></div>`;
  } else if(state.decisionStatus==='resolved'){
    plan = `
      <div class="decision-center__plan">
        <div><div class="plan-item__label">SPM</div>${state.well.spm}</div>
        <div><div class="plan-item__label">STEAM VOLUME</div>${state.css.steamVolume.toLocaleString()} bbl</div>
        <div><div class="plan-item__label">SOR</div>${state.sor.current} bbl/bbl</div>
      </div>
      <div style="margin-top:12px; font-size:13.5px; color:var(--text-dim);">Adaptation applied. SRP change is in effect immediately; the CSS adjustment will take effect on the next cycle. THERMO-SRP is monitoring the response.</div>`;
  } else {
    plan = `
      <div class="decision-center__plan">
        <div><div class="plan-item__label">SPM</div>${state.well.spm}</div>
        <div><div class="plan-item__label">STEAM VOLUME</div>${state.css.steamVolume.toLocaleString()} bbl</div>
        <div><div class="plan-item__label">RISK</div>${r.category}</div>
      </div>
      <div style="margin-top:12px; font-size:13.5px; color:var(--text-dim);">No adaptation required. Well condition supports the current CSS/SRP policy.</div>`;
  }

  return `
    <div class="decision-center" style="--status-color:${statusColor}">
      <div class="decision-center__top">
        <div>
          <div class="decision-center__label">WELL DECISION</div>
          <div class="decision-center__status" style="color:${statusColor}">${statusIcon} ${statusText}</div>
        </div>
      </div>
      ${metrics}
      ${why}
      <div class="section-label" style="margin:16px 0 8px;">CURRENT OPERATION</div>
      ${plan}
      ${rec}
      ${actions}
    </div>`;
}
function simulateFromDecisionCenter(){
  const rc = state.recommendation;
  state.whatif.steamVolume = rc.proposedCSS.steamVolume;
  state.whatif.injectionPressure = rc.proposedCSS.injectionPressure;
  state.whatif.soakTime = rc.proposedCSS.soakTime;
  state.whatif.productionCutoff = rc.proposedCSS.productionCutoff;
  state.whatif.spm = rc.proposedSRP.spm;
  state.whatif.stroke = rc.proposedSRP.stroke;
  state.whatif.vfdFrequency = rc.proposedSRP.vfdFrequency;
  runWhatIfSimulation();
  navigate('whatif');
}
function approveRecommendation(){
  const rc = state.recommendation;
  applyAdaptation(rc.proposedCSS, rc.proposedSRP, rc.predicted, rc.action);
}
function openHoldModal(){
  openModal(`
    <div class="modal__head">
      <div class="modal__title">Hold current policy</div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div style="font-size:13.5px;color:var(--text-dim);line-height:1.5;">Current policy will be retained instead of approving the recommendation.</div>
    <div class="decision-center__rec" style="margin-top:14px;">
      <div class="rec__title">EXPECTED CONSEQUENCE</div>
      <div style="font-size:13.5px;color:var(--text-dim);line-height:1.5;">Thermal deterioration is expected to continue. Mechanical risk is expected to increase over the forecast horizon.</div>
    </div>
    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn--danger" onclick="holdCurrentPolicy()">CONFIRM HOLD</button>
      <button class="btn btn--ghost" onclick="closeModal()">CANCEL</button>
    </div>
  `);
}

/* ---------------------------------------------------------
   ACTIVE ISSUE — single consolidated root-cause card
   --------------------------------------------------------- */
function getActiveIssue(){
  const stage = state.scenarioStage, ds = state.decisionStatus;
  if(stage===0) return null;

  const tempRes = round1(state.well.temperature - state.expected.temperature);
  const viscRes = state.well.viscosity - state.expected.viscosity;

  if(stage===1){
    return {
      severity:'info', icon:'🔵', eyebrow:'1 ACTIVE ISSUE — MONITORING',
      title:'Thermal decline — reservoir cooling',
      evidence:[
        `Temperature ${tempRes>=0?'+':''}${tempRes}°C vs. physics-model expectation`,
        `Viscosity increasing — ${state.expected.viscosity} → ${state.well.viscosity} cP`,
        `Rod floating risk NORMAL → WATCH`,
      ],
      missionImpact:`Production trending down (118 → ${state.well.oilProduction} bbl/d), SOR rising (7.0 → ${state.sor.current})`,
      recommendedAction:null,
    };
  }
  if(ds==='resolved'){
    return {
      severity:'ok', icon:'🟢', eyebrow:'ADAPTATION ACTIVE — MONITORING',
      title:'Thermal / mechanical issue — mitigated',
      evidence:[
        `SPM reduced to ${state.well.spm} to lower rod loading`,
        `CSS policy adjusted for next cycle (steam ${state.css.steamVolume} bbl, soak ${state.css.soakTime} hr)`,
        `Rod floating risk improved to ${state.mechanical.rodFloatingRisk}`,
      ],
      missionImpact:`Production ${state.production.rate} bbl/d · SOR ${state.sor.current} · mechanical risk ${state.risk.category}`,
      recommendedAction:null,
    };
  }
  const issue = {
    severity: ds==='held' ? 'warn' : 'crit',
    icon: ds==='held' ? '🟡' : '🔴',
    eyebrow: ds==='held' ? '1 ACTIVE ISSUE — HELD' : '1 ACTIVE ISSUE',
    title:'Thermal / mechanical degradation — rod floating detected',
    evidence:[
      `Temperature ${tempRes>=0?'+':''}${tempRes}°C vs. expectation (82.0 → ${round1(state.well.temperature)}°C)`,
      `Viscosity increasing — 1420 → ${state.well.viscosity} cP`,
      `Rod floating risk: ${state.mechanical.rodFloatingRisk} · Pump unsetting risk: ${state.mechanical.pumpUnsettingRisk}`,
      `Steam-oil ratio rising — 7.0 → ${state.sor.current} bbl/bbl`,
    ],
    missionImpact:`Mechanical risk LOW → ${state.risk.category} (${state.risk.overallRisk}%)`,
    recommendedAction: state.recommendation ? `${state.recommendation.action} — SPM ${state.recommendation.currentSRP.spm}→${state.recommendation.proposedSRP.spm}, steam ${state.recommendation.currentCSS.steamVolume}→${state.recommendation.proposedCSS.steamVolume} bbl` : null,
  };
  if(ds==='held'){
    issue.note = `Operator held current policy. ${state.holdNote||''} Logged for post-operation review.`;
  }
  return issue;
}
function renderActiveIssueCard(){
  const issue = getActiveIssue();
  if(!issue){
    return `
      <div class="active-issue sev-ok" tabindex="0" role="button" aria-label="No active issues" onclick="navigate('welltwin')">
        <div class="active-issue__icon">🟢</div>
        <div>
          <div class="active-issue__eyebrow">NO ACTIVE ISSUES</div>
          <div class="active-issue__title">All systems normal</div>
          <div class="active-issue__sub">No adaptation required at this time.</div>
        </div>
      </div>`;
  }
  return `
    <div class="active-issue sev-${issue.severity}" tabindex="0" role="button" aria-label="${esc(issue.title)}" onclick="openActiveIssueModal()">
      <div class="active-issue__icon">${issue.icon}</div>
      <div>
        <div class="active-issue__eyebrow">${issue.eyebrow}</div>
        <div class="active-issue__title">${esc(issue.title)}</div>
        <div class="active-issue__sub">${esc(issue.missionImpact)}</div>
      </div>
    </div>`;
}
function openActiveIssueModal(){
  const issue = getActiveIssue();
  if(!issue) return;
  const badgeClass = issue.severity==='crit'?'crit':issue.severity==='warn'?'warn':issue.severity==='ok'?'ok':'info';
  openModal(`
    <div class="modal__head">
      <div>
        <div class="modal__title">${issue.icon} ${esc(issue.title)}</div>
        <div style="margin-top:8px;"><span class="badge badge--${badgeClass}"><span class="dot"></span>${issue.eyebrow}</span></div>
      </div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="decision-center__why-title" style="margin-top:14px;">SUPPORTING EVIDENCE</div>
    <ul class="why-list">${issue.evidence.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>
    <div class="kv-row" style="margin-top:12px;"><span class="k">Impact</span><span class="v" style="text-align:right;">${esc(issue.missionImpact)}</span></div>
    ${issue.recommendedAction ? `<div class="kv-row"><span class="k">Recommended action</span><span class="v" style="text-align:right;">${esc(issue.recommendedAction)}</span></div>` : ''}
    ${issue.note ? `<div style="margin-top:14px;font-size:13.5px;color:var(--text-dim);line-height:1.5;">${esc(issue.note)}</div>` : ''}
    ${issue.recommendedAction ? `<div class="btn-row" style="margin-top:16px;"><button class="btn btn--primary" onclick="closeModal(); navigate('overview');">REVIEW RECOMMENDATION</button></div>` : ''}
  `);
}

/* ---------------------------------------------------------
   KEY TELEMETRY
   --------------------------------------------------------- */
const TELEMETRY_PARAMS = [
  {key:'temperature', label:'Temperature', unit:'°C', hasExpected:true},
  {key:'pressure', label:'Pressure', unit:' bar', hasExpected:true},
  {key:'viscosity', label:'Viscosity', unit:' cP', hasExpected:true},
  {key:'oilProduction', label:'Oil Production', unit:' bbl/d', hasExpected:false},
  {key:'pumpFillage', label:'Pump Fillage', unit:'%', hasExpected:true},
  {key:'rodLoad', label:'Rod Load', unit:'%', hasExpected:true},
  {key:'spm', label:'SPM', unit:'', hasExpected:false},
  {key:'stroke', label:'Stroke', unit:' m', hasExpected:false},
  {key:'vfdFrequency', label:'VFD', unit:' Hz', hasExpected:false},
];
function paramStatus(p){
  if(!p.hasExpected) return {cls:'ok', label:'NORMAL'};
  const actual = state.well[p.key], exp = state.expected[p.key];
  const dev = Math.abs(actual-exp)/Math.max(exp,0.1);
  if(dev>0.08) return {cls:'crit', label:'CRITICAL'};
  if(dev>0.03) return {cls:'warn', label:'WARNING TREND'};
  return {cls:'ok', label:'NORMAL'};
}
function renderKeyTelemetry(){
  return TELEMETRY_PARAMS.map(p=>{
    const val = p.key==='temperature' ? round1(state.well[p.key]) : state.well[p.key];
    const st = paramStatus(p);
    return `
      <div class="telemetry-row" tabindex="0" role="button" aria-label="${p.label}: ${val}${p.unit}" onclick="openTelemetryDetail('${p.key}')">
        <div class="telemetry-row__name">${p.label}</div>
        <div class="telemetry-row__value">${val}<span class="unit">${p.unit}</span></div>
        <span class="status-dot ${st.cls}"></span>
      </div>`;
  }).join('') + `
    <div class="telemetry-row" tabindex="0" role="button" aria-label="Steam-oil ratio ${state.sor.current}" onclick="openSORDetail()">
      <div class="telemetry-row__name">Steam-Oil Ratio</div>
      <div class="telemetry-row__value">${state.sor.current}<span class="unit"> bbl/bbl</span></div>
      <span class="status-dot ${state.sor.current>8?'warn':'ok'}"></span>
    </div>
    <div class="telemetry-row" tabindex="0" role="button" aria-label="Energy ${state.energy.current} kWh per day" onclick="openEnergyDetail()">
      <div class="telemetry-row__name">Energy</div>
      <div class="telemetry-row__value">${state.energy.current.toLocaleString()}<span class="unit"> kWh/d</span></div>
      <span class="status-dot ok"></span>
    </div>`;
}
function openTelemetryDetail(key){
  const p = TELEMETRY_PARAMS.find(x=>x.key===key);
  const actual = p.key==='temperature' ? round1(state.well[key]) : state.well[key];
  const st = paramStatus(p);
  let body;
  if(p.hasExpected){
    const exp = state.expected[key];
    const dev = round1(actual-exp);
    body = `
      <div class="kv-row"><span class="k">Current</span><span class="v">${actual}${p.unit}</span></div>
      <div class="kv-row"><span class="k">Expected (physics model)</span><span class="v">${exp}${p.unit}</span></div>
      <div class="kv-row"><span class="k">Residual</span><span class="v">${dev>=0?'+':''}${dev}${p.unit}</span></div>`;
  } else {
    body = `<div class="kv-row"><span class="k">Current</span><span class="v">${actual}${p.unit}</span></div>`;
  }
  openModal(`
    <div class="modal__head">
      <div>
        <div class="modal__title">${p.label}</div>
        <div style="margin-top:6px;"><span class="badge badge--${st.cls}"><span class="dot"></span>${st.label}</span></div>
      </div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    ${body}
  `);
}
function openSORDetail(){
  openModal(`
    <div class="modal__head"><div class="modal__title">Steam-Oil Ratio</div><button class="modal__close" onclick="closeModal()">✕</button></div>
    <div class="kv-row"><span class="k">Current SOR</span><span class="v">${state.sor.current} bbl/bbl</span></div>
    <div class="kv-row"><span class="k">Steam volume</span><span class="v">${state.css.steamVolume.toLocaleString()} bbl</span></div>
    <div class="kv-row"><span class="k">Oil production</span><span class="v">${state.well.oilProduction} bbl/d</span></div>
    <div class="dim" style="font-size:12px;margin-top:12px;">Prototype calculation — SOR derived deterministically from steam volume, injection parameters and current production within the simulation model, not an independently hardcoded figure.</div>
  `);
}
function openEnergyDetail(){
  openModal(`
    <div class="modal__head"><div class="modal__title">Energy Consumption</div><button class="modal__close" onclick="closeModal()">✕</button></div>
    <div class="kv-row"><span class="k">Current</span><span class="v">${state.energy.current.toLocaleString()} kWh/day</span></div>
    <div class="kv-row"><span class="k">Energy / barrel</span><span class="v">${round1(state.energy.current/state.well.oilProduction)} kWh/bbl</span></div>
    <div class="dim" style="font-size:12px;margin-top:12px;">Prototype calculation — responds to steam requirement, SPM and VFD frequency. Not a field-validated energy audit.</div>
  `);
}

/* ---------------------------------------------------------
   EVENTS
   --------------------------------------------------------- */
function renderEventLog(limit){
  if(!state.events.length) return `<div class="empty-note">No changes logged yet.</div>`;
  return state.events.slice(0, limit||8).map((e,i)=>`
    <div class="event-item" tabindex="0" role="button" aria-label="Timeline entry: ${esc(e.desc)}" onclick="openEventDetail(${i})">
      <div class="event-item__time mono">${e.t}</div>
      <div class="event-item__desc">${esc(e.desc)}</div>
      <div class="event-item__delta">${esc(e.delta)}</div>
    </div>`).join('');
}
function openEventDetail(i){
  const e = state.events[i];
  if(!e) return;
  openModal(`
    <div class="modal__head">
      <div class="modal__title">Operation timeline entry</div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="kv-row"><span class="k">Operation time</span><span class="v">${e.t}</span></div>
    <div class="kv-row"><span class="k">Event</span><span class="v" style="text-align:right;">${esc(e.desc)}</span></div>
    <div class="kv-row"><span class="k">Change</span><span class="v">${esc(e.delta)}</span></div>
  `);
}

/* ---------------------------------------------------------
   RISK HORIZON — projects MECHANICAL RISK forward.
   --------------------------------------------------------- */
function getRiskHorizon(){
  const key = state.decisionStatus+':'+state.scenarioStage;
  const table = {
    'nominal:0': [['NOW',8,'LOW'],['+6h',10,'LOW'],['+12h',13,'LOW'],['+24h',17,'LOW']],
    'nominal:1': [['NOW',28,'WATCH'],['+6h',34,'WATCH'],['+12h',42,'MODERATE'],['+24h',54,'MODERATE']],
    'caution:2': [['NOW',68,'MODERATE'],['+6h',74,'HIGH'],['+12h',80,'HIGH'],['+24h',86,'HIGH']],
    'held:2':    [['NOW',68,'MODERATE'],['+6h',78,'HIGH'],['+12h',85,'HIGH'],['+24h',91,'HIGH']],
    'resolved:3':[['NOW',24,'LOW'],['+6h',22,'LOW'],['+12h',20,'LOW'],['+24h',19,'LOW']],
  };
  const rows = table[key] || table['nominal:0'];
  return rows.map(r=>({t:r[0], risk:r[1], category:r[2]}));
}
function renderRiskHorizon(compact){
  const pts = getRiskHorizon();
  const w = 560, hgt = compact?122:156, pad=34;
  const values = pts.map(p=>p.risk);
  const maxV = Math.max(100, ...values)+5, minV = 0;
  const xs = pts.map((_,i)=> pad + i*((w-2*pad)/(pts.length-1)));
  const ys = pts.map(p=> hgt-34 - ((p.risk-minV)/(maxV-minV))*(hgt-66));
  const path = xs.map((x,i)=>`${i===0?'M':'L'}${x},${ys[i]}`).join(' ');
  const dots = xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="4.5" fill="${dotColor(riskClass(pts[i].category))}" stroke="#0a0d12" stroke-width="1.5"/>`).join('');
  const labels = xs.map((x,i)=>`
      <text x="${x}" y="${hgt-8}" text-anchor="middle" class="twin-label" fill="var(--text-faint)">${pts[i].t}</text>
      <text x="${x}" y="${ys[i]-13}" text-anchor="middle" class="twin-label mono" fill="var(--text)" font-size="13" font-weight="700">${pts[i].risk}%</text>
  `).join('');
  const catLabels = xs.map((x,i)=>`<text x="${x}" y="${hgt-19}" text-anchor="middle" class="twin-label" fill="${dotColor(riskClass(pts[i].category))}" font-weight="700" font-size="11">${pts[i].category}</text>`).join('');
  let escalateNote = '';
  const firstHigh = pts.findIndex(p=>p.category==='HIGH');
  if(firstHigh>0){
    const hours = firstHigh===1?'~6h':firstHigh===2?'~12h':'~24h';
    escalateNote = `<div style="margin-top:8px;font-size:12.5px;color:var(--text-faint);">Projected risk escalation under current operating conditions: approximately ${hours}.</div>`;
  }
  return `
    <div style="font-size:11px;letter-spacing:.1em;color:var(--text-faint);font-weight:700;margin-bottom:8px;">MECHANICAL RISK</div>
    <svg viewBox="0 0 ${w} ${hgt}" style="width:100%;height:auto;display:block;">
      <line x1="${pad}" y1="${hgt-42}" x2="${w-pad}" y2="${hgt-42}" stroke="var(--border)" stroke-width="1"/>
      <path d="${path}" fill="none" stroke="var(--cyan)" stroke-width="2.5"/>
      ${dots}
      ${labels}
      ${catLabels}
    </svg>
    ${escalateNote}
  `;
}

/* ---------------------------------------------------------
   DYNAMIC OPERATING ENVELOPE — SPM (y) vs Stroke (x)
   --------------------------------------------------------- */
function buildEnvelopeChart(points){
  const x0=76,x1=560,y0=22,y1=224;
  const sMin=1.5,sMax=2.4, pMin=5,pMax=11;
  const sX = s => x0 + (s-sMin)/(sMax-sMin)*(x1-x0);
  const pY = p => y1 - (p-pMin)/(pMax-pMin)*(y1-y0);
  const b = getEnvelopeBoundaries();
  const redYLow=pY(b.redAtLowStroke), redYHigh=pY(b.redAtHighStroke);
  const amberYLow=pY(b.redAtLowStroke-1.0), amberYHigh=pY(b.redAtHighStroke-1.0);

  const greenPoly = `${sX(sMin)},${y1} ${sX(sMin)},${amberYLow} ${sX(sMax)},${amberYHigh} ${sX(sMax)},${y1}`;
  const amberPoly = `${sX(sMin)},${amberYLow} ${sX(sMin)},${redYLow} ${sX(sMax)},${redYHigh} ${sX(sMax)},${amberYHigh}`;
  const redPoly = `${sX(sMin)},${redYLow} ${sX(sMin)},${y0} ${sX(sMax)},${y0} ${sX(sMax)},${redYHigh}`;

  const sTicks=[1.5,1.8,2.1,2.4];
  const pTicks=[5,6,7,8,9,10,11];

  const markers = points.map(p=>{
    const px=sX(p.stroke), py=pY(p.spm);
    if(p.kind==='current'){
      return `<g><circle cx="${px}" cy="${py}" r="7" fill="#0c1017" stroke="#fff" stroke-width="2.5"/>
        <text x="${px}" y="${py-13}" text-anchor="middle" class="twin-label" fill="#fff" font-weight="700">${p.label}</text></g>`;
    }
    if(p.kind==='recommended'){
      return `<g><circle cx="${px}" cy="${py}" r="7" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-dasharray="3,2"/>
        <text x="${px}" y="${py-13}" text-anchor="middle" class="twin-label" fill="var(--green)" font-weight="700">${p.label}</text></g>`;
    }
    return `<g><rect x="${px-6}" y="${py-6}" width="12" height="12" fill="var(--amber)" stroke="#0c1017" stroke-width="1.5" transform="rotate(45 ${px} ${py})"/>
      <text x="${px}" y="${py-13}" text-anchor="middle" class="twin-label" fill="var(--amber)" font-weight="700">${p.label}</text></g>`;
  }).join('');

  return `
    <svg viewBox="0 0 636 250" style="width:100%;height:auto;display:block;">
      <polygon points="${greenPoly}" fill="var(--green)" fill-opacity="0.16"/>
      <polygon points="${amberPoly}" fill="var(--amber)" fill-opacity="0.16"/>
      <polygon points="${redPoly}" fill="var(--red)" fill-opacity="0.16"/>
      <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="var(--border-strong)"/>
      <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="var(--border-strong)"/>
      ${sTicks.map(t=>`<text x="${sX(t)}" y="${y1+16}" text-anchor="middle" class="twin-label" fill="var(--text-faint)">${t}</text>`).join('')}
      ${pTicks.map(p=>`<text x="${x0-8}" y="${pY(p)+3}" text-anchor="end" class="twin-label" fill="var(--text-faint)">${p}</text>`).join('')}
      <text x="${(x0+x1)/2}" y="248" text-anchor="middle" class="twin-label" fill="var(--text-dim)">STROKE (m)</text>
      <text x="14" y="${(y0+y1)/2}" text-anchor="middle" class="twin-label" fill="var(--text-dim)" transform="rotate(-90 14 ${(y0+y1)/2})">SPM</text>
      ${markers}
    </svg>
    <div style="display:flex; gap:18px; flex-wrap:wrap; font-size:12.5px; margin-top:8px; font-weight:600;" class="dim">
      <span><span style="color:var(--green);">■</span> SAFE</span>
      <span><span style="color:var(--amber);">◆</span> CAUTION</span>
      <span><span style="color:var(--red);">■</span> RESTRICTED</span>
    </div>
    <div style="margin-top:10px; border-top:1px solid var(--border-soft); padding-top:6px;">
      ${points.map(p=>`<div class="kv-row"><span class="k">${esc(p.label)}</span><span class="v">${p.spm} SPM / ${p.stroke} m</span></div>`).join('')}
    </div>
    <div class="dim" style="font-size:12px; margin-top:8px;">The safe region narrows automatically as rod-floating risk increases — this is why the same SPM can move from safe to restricted over the course of an operation.</div>
  `;
}

/* ---------------------------------------------------------
   OVERVIEW SCREEN
   --------------------------------------------------------- */
function renderOverview(){
  const h = state.health, r = state.risk;
  return `
    ${renderDecisionCenter()}

    <div class="grid grid-3" style="margin-top:var(--gap);">
      ${renderActiveIssueCard()}
      <div class="card card--click" tabindex="0" role="button" aria-label="Well health ${h.overall} percent" onclick="navigate('welltwin')">
        <div class="card__head"><div class="card__title">WELL HEALTH</div>${trendArrow(h.trend==='flat'?'flat':(h.trend==='down'?'down':'up'),'up')}</div>
        <div class="stat-card__value-row"><div class="stat-card__value ${healthColorClass(h.overall)}">${h.overall}%</div></div>
        <div class="stat-card__sub">${h.overall>=90?'NORMAL':h.overall>=75?'WATCH / MODERATE DEGRADATION':'DEGRADED'}</div>
        <div class="stat-card__foot"><span>Thermal ${h.thermal}%</span><span>Mechanical ${h.mechanical}%</span></div>
      </div>
      <div class="card card--click" tabindex="0" role="button" aria-label="Mechanical risk ${r.category}" onclick="navigate('operations')">
        <div class="card__head"><div class="card__title">MECHANICAL RISK</div>${riskBadge(r.category)}</div>
        <div class="stat-card__value-row"><div class="stat-card__value ${riskClass(r.category)==='ok'?'green':riskClass(r.category)==='warn'?'amber':'red'}">${r.overallRisk}%</div></div>
        <div class="stat-card__sub">Range ${r.riskLow}–${r.riskHigh}% · Operating margin ${r.operatingMargin}</div>
        <div class="stat-card__foot"><span>Confidence ${r.confidence}%</span><span>Production ${state.well.oilProduction} bbl/d</span></div>
      </div>
    </div>

    <div class="section-label">WELL DIGITAL TWIN</div>
    <div class="card">
      <div class="card__head"><div class="card__title"><span class="icon">◈</span>WELL SUBSYSTEMS — LIVE STATE</div>
        <button class="btn btn--sm btn--ghost" onclick="navigate('welltwin')">FULL DIAGNOSTICS →</button></div>
      ${renderTwinStrip()}
    </div>

    <div class="grid grid-2" style="margin-top:var(--gap);">
      <div class="card">
        <div class="card__head"><div class="card__title">KEY TELEMETRY</div></div>
        <div>${renderKeyTelemetry()}</div>
      </div>
      <div class="card">
        <div class="card__head"><div class="card__title">RISK HORIZON</div><button class="btn btn--sm btn--ghost" onclick="navigate('operations')">OPERATIONS →</button></div>
        ${renderRiskHorizon(true)}
      </div>
    </div>

    <div class="section-label">WHAT CHANGED?</div>
    <div class="card"><div class="event-log">${renderEventLog(6)}</div></div>

    <div class="empty-note">Raw sensor diagnostics, physics-model residuals and recalibration data live in <b style="color:var(--text-dim)">ENGINEERING MODE</b> (top bar) and the Well Twin page — kept off this screen so the operator view stays decision-first. See <b style="color:var(--text-dim)">PS COVERAGE</b> (top bar) for the full requirement-to-feature map.</div>
  `;
}

/* ---------------------------------------------------------
   WELL TWIN SCREEN
   --------------------------------------------------------- */
function renderSubsystemPanel(){
  return Object.keys(SUBSYSTEM_META).map(key=>{
    const st = subsystemStatus(key);
    return `
      <div class="subsystem-item" tabindex="0" role="button" aria-label="${SUBSYSTEM_META[key].name}: ${st.label}" onclick="openSubsystem('${key}')">
        <div class="subsystem-item__name">${st.emoji} ${SUBSYSTEM_META[key].name}</div>
        <div class="subsystem-item__status"><span class="status-dot ${st.cls}"></span>${st.label} · ${st.value}%</div>
      </div>`;
  }).join('');
}
function renderHealthBreakdown(){
  const h = state.health;
  const rows = [
    ['thermal','Thermal'],['production','Production / Fluid'],['mechanical','Rod System'],
    ['pump','Pump'],['surface','Surface Unit'],['sensors','Sensors'],
  ];
  return rows.map(([k,label])=>{
    const v = h[k];
    const color = healthColorClass(v);
    const barColor = color==='green'?'var(--green)':color==='amber'?'var(--amber)':'var(--red)';
    return `
      <div class="card--click" tabindex="0" role="button" aria-label="${label}: ${v}%" style="cursor:pointer; padding:9px 4px; border-bottom:1px solid var(--border-soft);" onclick="openSubsystem('${k}')">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
          <span>${label}</span><span class="mono" style="font-weight:600;">${v}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${v}%; background:${barColor};"></div></div>
      </div>`;
  }).join('');
}
function renderExpectedVsActual(){
  const w = state.well, x = state.expected;
  const rows = [
    ['Temperature', round1(w.temperature), x.temperature, '°C'],
    ['Pressure', round1(w.pressure), x.pressure, ' bar'],
    ['Viscosity', w.viscosity, x.viscosity, ' cP'],
    ['Rod Load', w.rodLoad, x.rodLoad, '%'],
    ['Pump Fillage', w.pumpFillage, x.pumpFillage, '%'],
  ];
  return `
    <table>
      <thead><tr><th>Parameter</th><th class="num-cell">Expected</th><th class="num-cell">Actual</th><th class="num-cell">Residual</th></tr></thead>
      <tbody>
      ${rows.map(([label,actual,exp,unit])=>{
        const res = round1(actual-exp);
        const thresh = unit==='°C'?2.5:unit===' bar'?0.6:unit===' cP'?100:4;
        const warnThresh = thresh/2;
        const badColor = Math.abs(res) > thresh ? 'var(--red)' : Math.abs(res) > warnThresh ? 'var(--amber)' : 'var(--green)';
        return `<tr>
          <td class="label-cell">${label}</td>
          <td class="num-cell">${exp}${unit}</td>
          <td class="num-cell">${actual}${unit}</td>
          <td class="num-cell" style="color:${badColor}; font-weight:600;">${res>=0?'+':''}${res}${unit}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>
    <div class="dim" style="font-size:11px; margin-top:10px; display:flex; gap:18px; flex-wrap:wrap;">
      <span><span style="color:var(--cyan);">●</span> Physics / Digital Twin = expected</span>
      <span><span style="color:var(--text);">●</span> Sensors / operational data = actual</span>
      <span><span style="color:var(--amber);">●</span> AI = interpretation of the gap</span>
    </div>
  `;
}
function renderResidualChart(){
  const hist = state.residualHistory || [];
  if(hist.length<2) return `<div class="empty-note">Accumulating residual history…</div>`;
  const w=560,hgt=120,pad=30;
  const vals = hist.map(p=>p.v);
  const maxV = Math.max(4, ...vals)+1, minV = Math.min(-4,...vals)-1;
  const xs = hist.map((_,i)=> pad + i*((w-2*pad)/Math.max(hist.length-1,1)));
  const ys = hist.map(p=> hgt-22 - ((p.v-minV)/(maxV-minV))*(hgt-40));
  const path = xs.map((x,i)=>`${i===0?'M':'L'}${x},${ys[i]}`).join(' ');
  const zeroY = hgt-22 - ((0-minV)/(maxV-minV))*(hgt-40);
  const dots = xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="3.2" fill="${Math.abs(hist[i].v)>4?'var(--red)':Math.abs(hist[i].v)>2?'var(--amber)':'var(--green)'}"/>`).join('');
  return `
    <svg viewBox="0 0 ${w} ${hgt}" style="width:100%;height:auto;display:block;">
      <line x1="${pad}" y1="${zeroY}" x2="${w-pad}" y2="${zeroY}" stroke="var(--border)" stroke-dasharray="3,3"/>
      <text x="${pad-6}" y="${zeroY+4}" text-anchor="end" class="twin-label" fill="var(--text-faint)">0°C</text>
      <path d="${path}" fill="none" stroke="var(--cyan)" stroke-width="2"/>
      ${dots}
      <text x="${pad}" y="${hgt-6}" class="twin-label" fill="var(--text-faint)">EARLIER</text>
      <text x="${w-pad}" y="${hgt-6}" text-anchor="end" class="twin-label" fill="var(--text-faint)">NOW</text>
    </svg>
    <div class="dim" style="font-size:12px;">Temperature residual trend (expected vs. actual)</div>
  `;
}
function renderThermalTrend(){
  const hist = state.thermalHistory || [];
  if(hist.length<2) return `<div class="empty-note">Accumulating thermal history…</div>`;
  const w=560,hgt=110,pad=30;
  const vals = hist.map(p=>p.v);
  const maxV = Math.max(...vals)+2, minV = Math.min(...vals)-2;
  const xs = hist.map((_,i)=> pad + i*((w-2*pad)/Math.max(hist.length-1,1)));
  const ys = hist.map(p=> hgt-22 - ((p.v-minV)/(maxV-minV))*(hgt-38));
  const path = xs.map((x,i)=>`${i===0?'M':'L'}${x},${ys[i]}`).join(' ');
  const dots = xs.map((x,i)=>`<circle cx="${x}" cy="${ys[i]}" r="3.2" fill="var(--cyan)"/>`).join('');
  return `
    <div style="display:flex; gap:28px; margin-bottom:12px; flex-wrap:wrap;">
      <div><div class="mono" style="font-size:26px;font-weight:600;">82.0°C</div><div class="dim" style="font-size:11.5px;">BASELINE</div></div>
      <div><div class="mono" style="font-size:26px;font-weight:600;color:${state.well.temperature<80?'var(--amber)':'var(--green)'}">${round1(state.well.temperature)}°C</div><div class="dim" style="font-size:11.5px;">CURRENT</div></div>
      <div>${trendArrow(state.well.temperature<81?'down':'flat','up')}<div class="dim" style="font-size:11.5px;">TREND</div></div>
    </div>
    <svg viewBox="0 0 ${w} ${hgt}" style="width:100%;height:auto;display:block;">
      <path d="${path}" fill="none" stroke="var(--cyan)" stroke-width="2.5"/>
      ${dots}
      <text x="${pad}" y="${hgt-6}" class="twin-label" fill="var(--text-faint)">EARLIER</text>
      <text x="${w-pad}" y="${hgt-6}" text-anchor="end" class="twin-label" fill="var(--text-faint)">NOW</text>
    </svg>
  `;
}
function renderDataQualityPanel(){
  const dq = state.dataQuality;
  const rows = [['Temperature','temperature'],['Pressure','pressure'],['VFD','vfd'],['SRP','srp'],['Production','production']];
  const warn = dq.srp<96;
  return `
    <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:10px;">
      <div class="mono" style="font-size:30px; font-weight:600;">${dq.overall}%</div>
      <div class="dim" style="font-size:12px;">overall data quality</div>
    </div>
    ${rows.map(([label,k])=>`
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:13px;">
        <span class="dim">${label}</span><span class="mono">${dq[k]}%</span>
      </div>`).join('')}
    ${warn ? `<div class="badge badge--warn" style="margin-top:10px;"><span class="dot"></span>Prediction confidence reduced — SRP telemetry quality ${dq.srp}%</div>` : ''}
  `;
}
function renderEquipmentRiskCard(){
  const m = state.mechanical;
  const fCls = m.rodFloatingRisk==='NORMAL'?'ok':m.rodFloatingRisk==='HIGH RISK'?'crit':'warn';
  const uCls = m.pumpUnsettingRisk==='NORMAL'?'ok':m.pumpUnsettingRisk==='HIGH'?'crit':'warn';
  return `
    <div class="grid grid-2b">
      <div class="card--click" tabindex="0" role="button" aria-label="Rod floating ${m.rodFloatingRisk}" style="cursor:pointer;" onclick="openRodFloatingDetail()">
        <div class="card__title" style="margin-bottom:8px;">ROD FLOATING STATUS</div>
        <span class="badge badge--${fCls}"><span class="dot"></span>${m.rodFloatingRisk}</span>
      </div>
      <div class="card--click" tabindex="0" role="button" aria-label="Pump unsetting ${m.pumpUnsettingRisk}" style="cursor:pointer;" onclick="openPumpUnsettingDetail()">
        <div class="card__title" style="margin-bottom:8px;">PUMP UNSETTING RISK</div>
        <span class="badge badge--${uCls}"><span class="dot"></span>${m.pumpUnsettingRisk}</span>
      </div>
    </div>
  `;
}
function openRodFloatingDetail(){
  const m = state.mechanical;
  const isIssue = m.rodFloatingRisk==='DETECTED' || m.rodFloatingRisk==='HIGH RISK';
  openModal(`
    <div class="modal__head">
      <div>
        <div class="modal__title">Rod Floating ${isIssue?'Detected':'Status'}</div>
        <div style="margin-top:6px;"><span class="badge badge--${m.rodFloatingRisk==='NORMAL'?'ok':m.rodFloatingRisk==='HIGH RISK'?'crit':'warn'}"><span class="dot"></span>${m.rodFloatingRisk}</span></div>
      </div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="kv-row"><span class="k">Rod load</span><span class="v">${state.well.rodLoad}%</span></div>
    <div class="kv-row"><span class="k">Pump fillage</span><span class="v">${state.well.pumpFillage}%</span></div>
    <div class="decision-center__why-title" style="margin-top:14px;">EVIDENCE</div>
    <ul class="why-list">
      <li>Abnormal rod-load pattern</li>
      <li>Reduced effective pump loading</li>
      <li>Cyclic load instability</li>
      <li>Heavy-fluid operating condition (viscosity ${state.well.viscosity} cP)</li>
    </ul>
    ${isIssue ? `
    <div class="decision-center__why-title" style="margin-top:14px;">IMPACT</div>
    <ul class="why-list">
      <li>Pump efficiency degradation</li>
      <li>Impact loading risk</li>
      <li>Increased mechanical stress</li>
      <li>Potential rod failure if unaddressed</li>
    </ul>` : ''}
    <div class="dim" style="font-size:12px;margin-top:14px;">Prototype simulation — synthetic demonstration data, not a field-validated rod-floating detector.</div>
  `);
}
function openPumpUnsettingDetail(){
  const m = state.mechanical;
  openModal(`
    <div class="modal__head">
      <div>
        <div class="modal__title">Pump Unsetting Risk</div>
        <div style="margin-top:6px;"><span class="badge badge--${m.pumpUnsettingRisk==='NORMAL'?'ok':m.pumpUnsettingRisk==='HIGH'?'crit':'warn'}"><span class="dot"></span>${m.pumpUnsettingRisk}</span></div>
      </div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="kv-row"><span class="k">Risk trend</span><span class="v">${state.health.trend==='down'?'↑ Increasing':'→ Stable'}</span></div>
    <div class="kv-row"><span class="k">Pump fillage</span><span class="v">${state.well.pumpFillage}%</span></div>
    <div class="decision-center__why-title" style="margin-top:14px;">CONTRIBUTING FACTORS</div>
    <ul class="why-list">
      <li>High mechanical loading</li>
      <li>Reduced fillage</li>
      <li>Changing fluid properties</li>
      <li>Unstable operating condition</li>
    </ul>
    <div class="dim" style="font-size:12px;margin-top:14px;">Pump-unsetting history is one of the inputs the equipment-risk model is designed to consume (see Maintenance → PS Data Availability).</div>
  `);
}
function renderEngineeringPanel(){
  const h = state.health, p = state.prognostics, w = state.well, x = state.expected;
  const anomalyScore = clamp(round1((100-h.mechanical)*1.1),0,100);
  const predErrTemp = round1(w.temperature - x.temperature);
  return `
    <div class="section-label">ENGINEERING MODE — RAW MODEL OUTPUT</div>
    <div class="grid grid-3">
      <div class="card card--tight">
        <div class="card__title" style="margin-bottom:10px;">ML ANOMALY SCORE</div>
        <div class="mono" style="font-size:26px;font-weight:600;">${anomalyScore}</div>
        <div class="dim" style="font-size:11px;margin-top:4px;">0–100 · mechanical residual classifier</div>
      </div>
      <div class="card card--tight">
        <div class="card__title" style="margin-bottom:10px;">EQUIPMENT FAILURE RISK (24h)</div>
        <div class="mono" style="font-size:26px;font-weight:600;">${p.failureProb}%</div>
        <div class="dim" style="font-size:11px;margin-top:4px;">range ${p.failureLow}–${p.failureHigh}% · prototype simulation</div>
      </div>
      <div class="card card--tight">
        <div class="card__title" style="margin-bottom:10px;">PREDICTION ERROR (TEMP)</div>
        <div class="mono" style="font-size:26px;font-weight:600;">${predErrTemp>=0?'+':''}${predErrTemp}°C</div>
        <div class="dim" style="font-size:11px;margin-top:4px;">last-cycle physics model vs. sensor</div>
      </div>
    </div>
    <div class="card" style="margin-top:var(--gap);">
      <div class="card__title" style="margin-bottom:10px;">MODEL CONFIDENCE / RECALIBRATION</div>
      <div class="kv-row"><span class="k">Failure-risk model confidence</span><span class="v">${p.failureConfidence}%</span></div>
      <div class="kv-row"><span class="k">Degradation model</span><span class="v">Weighted physics residual + thermal-mechanical coupling</span></div>
      <div class="kv-row"><span class="k">Recalibration status</span><span class="v">${Math.abs(predErrTemp)>2.5?'RECOMMENDED':'NOT REQUIRED'}</span></div>
    </div>
  `;
}

function renderWellTwin(){
  return `
    <div class="section-label">WELL DIGITAL TWIN</div>
    <div class="twin-wrap">
      <div class="twin-svg-box">${buildWellSVG()}</div>
      <div class="subsystem-list">${renderSubsystemPanel()}</div>
    </div>

    <div class="section-label">ROD FLOATING / PUMP UNSETTING</div>
    ${renderEquipmentRiskCard()}

    <div class="grid grid-2" style="margin-top:var(--gap);">
      <div class="card">
        <div class="card__head"><div class="card__title">WELL HEALTH — SUBSYSTEM BREAKDOWN</div><span class="mono" style="font-size:22px;font-weight:600;">${state.health.overall}%</span></div>
        ${renderHealthBreakdown()}
      </div>
      <div class="card">
        <div class="card__head"><div class="card__title">DATA QUALITY</div></div>
        ${renderDataQualityPanel()}
      </div>
    </div>

    <div class="section-label">EXPECTED VS. ACTUAL — RESIDUAL ANALYSIS</div>
    <div class="grid grid-2">
      <div class="card">${renderExpectedVsActual()}</div>
      <div class="card">${renderResidualChart()}</div>
    </div>

    <div class="section-label">THERMAL STATE TREND</div>
    <div class="card">${renderThermalTrend()}</div>

    ${state.engineeringMode ? renderEngineeringPanel() : `<div class="empty-note">Switch on <b>ENGINEERING MODE</b> in the top bar for raw sensor diagnostics, ML anomaly scores, and model recalibration data.</div>`}
  `;
}

/* ---------------------------------------------------------
   OPERATIONS SCREEN
   --------------------------------------------------------- */
function buildCSSPhaseStepper(){
  return `
    <div style="display:flex; align-items:center; justify-content:space-between; position:relative; padding:20px 10px;">
      <div style="position:absolute; left:40px; right:40px; top:34px; height:2px; background:var(--border-strong); z-index:0;"></div>
      ${CSS_PHASES.map((p,i)=>{
        const done = i<state.cyclePhaseIndex, current = i===state.cyclePhaseIndex;
        const color = current ? 'var(--cyan)' : done ? 'var(--text-dim)' : 'var(--text-faint)';
        const fill = current ? 'var(--cyan)' : done ? 'var(--panel-alt)' : 'var(--panel-inset)';
        return `
        <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; gap:8px; flex:1;">
          <div style="width:15px;height:15px;border-radius:50%; background:${fill}; border:2px solid ${color}; ${current?'box-shadow:0 0 10px var(--cyan);':''}"></div>
          <div class="mono" style="font-size:10.5px; letter-spacing:.06em; color:${color}; font-weight:600;">${done?'✓ ':current?'● ':'○ '}${p}</div>
        </div>`;
      }).join('')}
    </div>`;
}
function renderCSSCyclePanel(){
  const c = state.css;
  const rec = state.recommendation;
  const cols = [{ label:'CURRENT', steamVolume:c.steamVolume, injectionPressure:c.injectionPressure, soakTime:c.soakTime, productionCutoff:c.productionCutoff }];
  if(rec){ cols.push({ label:'RECOMMENDED', ...rec.proposedCSS }); }
  return `
    ${buildCSSPhaseStepper()}
    <div class="scrollx" style="margin-top:12px;"><table>
      <thead><tr><th></th>${cols.map(col=>`<th class="num-cell">${col.label}</th>`).join('')}</tr></thead>
      <tbody>
        <tr><td class="label-cell">Steam Volume</td>${cols.map(c2=>`<td class="num-cell">${c2.steamVolume.toLocaleString()} bbl</td>`).join('')}</tr>
        <tr><td class="label-cell">Injection Pressure</td>${cols.map(c2=>`<td class="num-cell">${c2.injectionPressure} bar</td>`).join('')}</tr>
        <tr><td class="label-cell">Soak Time</td>${cols.map(c2=>`<td class="num-cell">${c2.soakTime} hr</td>`).join('')}</tr>
        <tr><td class="label-cell">Production Cut-Off</td>${cols.map(c2=>`<td class="num-cell">${c2.productionCutoff} bbl/d</td>`).join('')}</tr>
      </tbody>
    </table></div>
    <div class="dim" style="font-size:12px; margin-top:10px;">Synthetic demonstration values — not actual Baghewala CSS operating limits. <button class="btn btn--sm btn--ghost" style="margin-left:8px;" onclick="navigate('whatif')">ADJUST IN WHAT-IF →</button></div>
  `;
}
function renderOperationalReliability(){
  const r = state.risk, p = state.prognostics;
  return `
    <div class="kv-row"><span class="k">Production stability</span><span class="v">${state.production.stabilityPct}%</span></div>
    <div class="kv-row"><span class="k">Mechanical reliability</span><span class="v">${clamp(100-r.overallRisk,0,100)}%</span></div>
    <div class="kv-row"><span class="k">Thermal condition</span><span class="v">${state.health.thermal>=90?'STABLE':state.health.thermal>=78?'WATCH':'DECLINING'}</span></div>
    <div class="kv-row"><span class="k">Current risk</span><span class="v">${r.category}</span></div>
    <div class="kv-row"><span class="k">Operating margin</span><span class="v" style="color:var(--cyan);">${r.operatingMargin}</span></div>
    <div class="kv-row"><span class="k">Confidence</span><span class="v">${r.confidence>=85?'HIGH':r.confidence>=70?'MODERATE':'LOW'}</span></div>
  `;
}
function renderWellHealthSummary(){
  const h = state.health, r = state.risk;
  return `
    <div class="kv-row"><span class="k">Well</span><span class="v">BGW-042</span></div>
    <div class="kv-row"><span class="k">Well health</span><span class="v">${h.overall}%</span></div>
    <div class="kv-row"><span class="k">Oil production</span><span class="v">${state.well.oilProduction} bbl/d</span></div>
    <div class="kv-row"><span class="k">Detected anomalies</span><span class="v">${getAnomalyCount()}</span></div>
    <div class="kv-row"><span class="k">Current risk</span><span class="v">${r.category}</span></div>
    <div class="kv-row"><span class="k">Steam-oil ratio</span><span class="v">${state.sor.current} bbl/bbl</span></div>
  `;
}

const REPLAY_STEPS = [
  {label:'CSS HEATING', detail:'Steam injection complete; wellbore and reservoir warm toward peak thermal condition for this cycle.'},
  {label:'THERMAL RESPONSE', detail:'Temperature peaks, viscosity falls, mobility improves — well health 94%, production 118 bbl/d, mechanical risk LOW.'},
  {label:'PRODUCTION START', detail:'CSS cycle enters the production phase. Thermal benefit is actively supporting inflow and pump fillage.'},
  {label:'COOLING', detail:'Reservoir and wellbore begin cooling. Temperature trends down (82°C → 76.5°C) and viscosity rises (1420 → 1950 cP).'},
  {label:'RISK ESCALATION', detail:'Rod floating risk reaches DETECTED, pump unsetting risk reaches MODERATE, mechanical risk rises to 68% (MODERATE) and the operating envelope narrows.'},
  {label:'RECOMMENDATION', detail:'The Decision Engine proposes a joint CSS + SRP adaptation: steam 1800 → 1650 bbl, soak 36 → 30 hr, SPM 8.0 → 7.2 — predicting mechanical risk 68% → 24% and production 112 → 109 bbl/d.'},
  {label:'OPERATOR DECISION', detail:'The operator reviews the evidence in the Well Decision Center and approves the recommendation (or holds the current policy, with the consequence logged).'},
  {label:'OBSERVED RESPONSE', detail:'Rod load and SOR move toward the predicted values; THERMO-SRP compares predicted vs. observed to recalibrate the Digital Twin.'},
];
function renderOperationReplay(){
  return REPLAY_STEPS.map((s,i)=>`
    <div class="event-item" tabindex="0" role="button" aria-label="Replay step ${i+1}: ${s.label}" style="grid-template-columns:28px 150px 1fr;" onclick="openReplayStep(${i})">
      <div class="event-item__time mono">${i+1}</div>
      <div class="event-item__desc" style="font-weight:700; letter-spacing:.03em;">${s.label}</div>
      <div class="event-item__desc" style="color:var(--text-faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(s.detail)}</div>
    </div>`).join('');
}
function openReplayStep(i){
  const s = REPLAY_STEPS[i];
  if(!s) return;
  openModal(`
    <div class="modal__head">
      <div>
        <div style="font-size:11px;letter-spacing:.1em;color:var(--text-faint);font-weight:700;">OPERATION REPLAY · STEP ${i+1}/${REPLAY_STEPS.length}</div>
        <div class="modal__title" style="margin-top:5px;">${s.label}</div>
      </div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div style="font-size:14px; color:var(--text-dim); line-height:1.6;">${esc(s.detail)}</div>
    <div class="btn-row" style="margin-top:16px;">
      ${i>0 ? `<button class="btn btn--sm" onclick="openReplayStep(${i-1})">← PREVIOUS STEP</button>` : ''}
      ${i<REPLAY_STEPS.length-1 ? `<button class="btn btn--sm" onclick="openReplayStep(${i+1})">NEXT STEP →</button>` : ''}
    </div>
  `);
}
function openWellHealthReport(){
  const h = state.health, r = state.risk, p = state.prognostics;
  openModal(`
    <div class="modal__head">
      <div class="modal__title">Well Health Report</div>
      <button class="modal__close" onclick="closeModal()">✕</button>
    </div>
    <div class="kv-row"><span class="k">Well</span><span class="v">BGW-042</span></div>
    <div class="kv-row"><span class="k">Period</span><span class="v">${fmtClock(state.operationTimeSec)} (session)</span></div>
    <div class="kv-row"><span class="k">Well health</span><span class="v">${h.overall}%</span></div>
    <div class="kv-row"><span class="k">Peak viscosity</span><span class="v">${state.peakViscosity} cP</span></div>
    <div class="kv-row"><span class="k">Mechanical risk</span><span class="v">${r.category} (${r.overallRisk}%)</span></div>
    <div class="kv-row"><span class="k">Oil production</span><span class="v">${state.well.oilProduction} bbl/d</span></div>
    <div class="kv-row"><span class="k">Steam-oil ratio</span><span class="v">${state.sor.current} bbl/bbl</span></div>
    <div class="kv-row"><span class="k">Detected anomalies</span><span class="v">${getAnomalyCount()}</span></div>
    <div class="kv-row"><span class="k">Adaptations approved</span><span class="v">${state.adaptationCount||0}</span></div>
    <div class="kv-row"><span class="k">Failure risk</span><span class="v">${p.failureProb}% <span class="faint">(${p.failureLow}–${p.failureHigh}%)</span></span></div>
    <div class="dim" style="font-size:12px; margin-top:14px;">Generated from live Digital Twin state at operation time ${fmtClock(state.operationTimeSec)}. Prototype simulation — synthetic demonstration data.</div>
  `);
}

function renderOperations(){
  const p = state.prognostics;
  return `
    <div class="section-label">WELL PROFILE</div>
    <div class="grid grid-3">
      <div class="card"><div class="card__title" style="margin-bottom:8px;">WELL</div><div style="font-size:17px;font-weight:600;">BGW-042</div><div class="dim" style="font-size:12.5px;margin-top:4px;">Baghewala Field · CSS / SRP</div></div>
      <div class="card"><div class="card__title" style="margin-bottom:8px;">OPERATION TIME</div><div class="mono" style="font-size:21px;font-weight:600;">${fmtClock(state.operationTimeSec)}</div><div class="dim" style="font-size:12.5px;margin-top:4px;">Elapsed this session</div></div>
      <div class="card"><div class="card__title" style="margin-bottom:8px;">EXPECTED PRODUCTION</div><div class="mono" style="font-size:21px;font-weight:600;">${p.productionLow}–${p.productionHigh} bbl/d</div><div class="dim" style="font-size:12.5px;margin-top:4px;">Confidence ${p.productionConfidence}%</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:var(--gap);">
      <div class="card">
        <div class="card__head"><div class="card__title">WELL HEALTH SUMMARY</div></div>
        ${renderWellHealthSummary()}
      </div>
      <div class="card">
        <div class="card__head"><div class="card__title">THERMAL STATE TREND</div><button class="btn btn--sm btn--ghost" onclick="navigate('welltwin')">FULL ANALYSIS →</button></div>
        ${renderThermalTrend()}
      </div>
    </div>

    <div class="section-label">CSS CYCLE</div>
    <div class="card">${renderCSSCyclePanel()}</div>

    <div class="grid grid-2" style="margin-top:var(--gap);">
      <div class="card">
        <div class="card__head"><div class="card__title">RISK HORIZON</div></div>
        ${renderRiskHorizon(false)}
      </div>
      <div class="card">
        <div class="card__head"><div class="card__title">OPERATIONAL RELIABILITY</div></div>
        ${renderOperationalReliability()}
      </div>
    </div>

    <div class="section-label">DYNAMIC OPERATING ENVELOPE</div>
    <div class="card">
      ${buildEnvelopeChart([
        {spm:state.well.spm, stroke:state.well.stroke, kind:'current', label:'CURRENT'},
        ...(state.decisionStatus==='caution' && state.recommendation ? [{spm:state.recommendation.proposedSRP.spm, stroke:state.recommendation.proposedSRP.stroke, kind:'recommended', label:'RECOMMENDED'}] : [])
      ])}
    </div>

    <div class="section-label">OPERATION REPLAY</div>
    <div class="card">${renderOperationReplay()}</div>

    <div class="section-label">WHAT CHANGED?</div>
    <div class="card"><div class="event-log">${renderEventLog(10)}</div></div>

    <div class="section-label">WELL HEALTH REPORT</div>
    <div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap;">
      <div class="dim" style="font-size:13px;">Generate a point-in-time summary of well health, production, SOR, anomalies and failure risk for post-operation review.</div>
      <button class="btn btn--primary" onclick="openWellHealthReport()">GENERATE REPORT</button>
    </div>
  `;
}

/* ---------------------------------------------------------
   WHAT-IF SCREEN — joint CSS + SRP counterfactual simulator
   --------------------------------------------------------- */
function onWhatifSliderInput(field, value, decimals){
  value = parseFloat(value);
  state.whatif[field] = value;
  const el = $('whatif'+field.charAt(0).toUpperCase()+field.slice(1)+'Val');
  if(el) el.textContent = decimals===0 ? Math.round(value).toLocaleString() : value;
}
function runWhatIfSimulation(){
  const w = state.whatif;
  const css = { steamVolume:w.steamVolume, injectionPressure:w.injectionPressure, soakTime:w.soakTime, productionCutoff:w.productionCutoff };
  const srp = { spm:w.spm, stroke:w.stroke, vfdFrequency:w.vfdFrequency };
  const gate = validatePolicy(srp.spm, srp.stroke);
  if(!gate.allowed){
    state.whatifResult = { restricted:true, reason:gate.reason };
  } else {
    const outcome = predictJointOutcome(css, srp);
    state.whatifResult = Object.assign({ restricted:false, warning: gate.severity==='WARNING' ? gate.reason : null }, outcome);
  }
  render();
}
function applyWhatIfToMission(){
  const w = state.whatif, r = state.whatifResult;
  if(!r || r.restricted) return;
  const css = { steamVolume:w.steamVolume, injectionPressure:w.injectionPressure, soakTime:w.soakTime, productionCutoff:w.productionCutoff };
  const srp = { spm:w.spm, stroke:w.stroke, vfdFrequency:w.vfdFrequency };
  applyAdaptation(css, srp, { production:r.production, mechRisk:r.mechRisk, riskCategory:r.riskCategory, sor:r.sor, energyPct:r.energyPct, rodLoad:r.rodLoad }, 'Joint CSS+SRP policy (What-If)');
  navigate('overview');
}
function saveComparisonOption(){
  const w = state.whatif, r = state.whatifResult;
  if(!r || r.restricted) return;
  const label = state.comparisonRows.length===0 ? 'ALTERNATIVE' : ('ALTERNATIVE '+(state.comparisonRows.length+1));
  state.comparisonRows.push({ label, steamVolume:w.steamVolume, injectionPressure:w.injectionPressure, soakTime:w.soakTime, productionCutoff:w.productionCutoff,
    spm:w.spm, stroke:w.stroke, vfdFrequency:w.vfdFrequency,
    production:r.production, sor:r.sor, energyPct:r.energyPct, rodLoad:r.rodLoad, riskCategory:r.riskCategory });
  if(state.comparisonRows.length>2) state.comparisonRows.shift();
  render();
}
function removeComparisonOption(idx){ state.comparisonRows.splice(idx,1); render(); }

function renderCurrentPlanCard(){
  const r = state.risk;
  return `
    <div class="decision-center__plan" style="margin-top:0;">
      <div><div class="plan-item__label">STEAM VOLUME</div>${state.css.steamVolume.toLocaleString()} bbl</div>
      <div><div class="plan-item__label">SOAK TIME</div>${state.css.soakTime} hr</div>
      <div><div class="plan-item__label">SPM</div>${state.well.spm}</div>
      <div><div class="plan-item__label">STROKE</div>${state.well.stroke} m</div>
    </div>
    <div class="decision-center__metrics" style="margin-top:16px;">
      <div><div class="dc-metric__value" style="color:${riskClass(r.category)==='ok'?'var(--green)':riskClass(r.category)==='warn'?'var(--amber)':'var(--red)'}; font-size:26px;">${r.overallRisk}%</div><div class="dc-metric__label">MECHANICAL RISK</div></div>
      <div><div class="dc-metric__value" style="font-size:26px;">${state.sor.current}</div><div class="dc-metric__label">STEAM-OIL RATIO</div></div>
      <div><div class="dc-metric__value" style="font-size:26px;">${state.well.oilProduction}</div><div class="dc-metric__label">PRODUCTION bbl/d</div></div>
    </div>
  `;
}
function renderWhatIfResult(){
  if(!state.whatifResult){
    return `<div class="empty-note">Adjust the CSS and SRP parameters and click <b style="color:var(--text)">SIMULATE</b> to preview the operational impact.</div>`;
  }
  const r = state.whatifResult;
  if(r.restricted){
    return `
      <div class="decision-center" style="--status-color:var(--red); padding:16px 18px;">
        <div class="decision-center__status" style="color:var(--red); font-size:16px;">🔴 POLICY NOT AVAILABLE</div>
        <div style="font-size:13.5px; color:var(--text-dim); margin-top:10px; line-height:1.5;">${esc(r.reason)}</div>
        <div class="dim" style="font-size:12px; margin-top:12px;">This candidate failed the mechanical safety check and is restricted — it is not shown as an equivalent option. Choose another policy.</div>
      </div>`;
  }
  const curEnergy = estimateEnergy(state.css.steamVolume, state.well.spm, state.well.vfdFrequency, state.css.injectionPressure);
  const prodDelta = r.production - state.well.oilProduction;
  const prodColor = prodDelta>=0?'var(--green)':'var(--amber)';
  return `
    ${r.warning ? `<div class="badge badge--warn" style="margin-bottom:14px;"><span class="dot"></span>${esc(r.warning)}</div>` : ''}
    <div class="decision-center__metrics" style="margin-top:0;">
      <div><div class="dc-metric__value" style="color:${riskClass(r.riskCategory)==='ok'?'var(--green)':riskClass(r.riskCategory)==='warn'?'var(--amber)':'var(--red)'}">${r.production}</div><div class="dc-metric__label">OIL PRODUCTION bbl/d</div></div>
      <div><div class="dc-metric__value">${r.mechRisk}%</div><div class="dc-metric__label">MECHANICAL RISK (${r.riskCategory})</div></div>
      <div><div class="dc-metric__value" style="font-size:22px;">${r.sor}</div><div class="dc-metric__label">STEAM-OIL RATIO</div></div>
    </div>
    <div class="kv-row" style="margin-top:14px;"><span class="k">Rod load</span><span class="v">${r.rodLoad}%</span></div>
    <div class="kv-row"><span class="k">Energy</span><span class="v">${r.energyPct}% of current</span></div>
    <div class="kv-row"><span class="k">Relative operating cost index</span><span class="v">${r.costIndex}</span></div>

    <div class="decision-center__why-title" style="margin-top:16px;">CHANGE FROM CURRENT</div>
    <div class="kv-row"><span class="k">Production</span><span class="v" style="color:${prodColor}">${prodDelta>=0?'+':''}${prodDelta} bbl/d</span></div>
    <div class="kv-row"><span class="k">Steam-oil ratio</span><span class="v">${state.sor.current} → ${r.sor}</span></div>
    <div class="kv-row"><span class="k">Mechanical risk</span><span class="v">${state.risk.category} → ${r.riskCategory}</span></div>
    <div class="kv-row"><span class="k">Energy</span><span class="v">100% → ${r.energyPct}%</span></div>

    <div class="btn-row" style="margin-top:16px;">
      <button class="btn btn--primary" onclick="applyWhatIfToMission()">APPLY TO OPERATION</button>
      <button class="btn" onclick="saveComparisonOption()" ${state.comparisonRows.length>=2?'disabled':''}>SAVE AS ALTERNATIVE</button>
    </div>
  `;
}
function renderComparisonTable(){
  const cur = {
    label:'CURRENT', steamVolume:state.css.steamVolume, injectionPressure:state.css.injectionPressure, soakTime:state.css.soakTime, productionCutoff:state.css.productionCutoff,
    spm:state.well.spm, stroke:state.well.stroke, vfdFrequency:state.well.vfdFrequency,
    production:state.well.oilProduction, sor:state.sor.current, energyPct:100, rodLoad:state.well.rodLoad, riskCategory:state.risk.category,
  };
  const cols = [cur];
  if(state.recommendation){
    const rc = state.recommendation;
    cols.push({
      label:'RECOMMENDED', ...rc.proposedCSS, ...rc.proposedSRP,
      production:rc.predicted.production, sor:rc.predicted.sor, energyPct:rc.predicted.energyPct, rodLoad:rc.predicted.rodLoad, riskCategory:rc.predicted.riskCategory,
      derived:true,
    });
  }
  cols.push(...state.comparisonRows);
  const rows = [
    ['Steam Volume', c=>c.steamVolume.toLocaleString()+' bbl'],
    ['Injection Pressure', c=>c.injectionPressure+' bar'],
    ['Soak Time', c=>c.soakTime+' hr'],
    ['Production Cut-Off', c=>c.productionCutoff+' bbl/d'],
    ['SPM', c=>c.spm],
    ['Stroke', c=>c.stroke+' m'],
    ['VFD', c=>c.vfdFrequency+' Hz'],
    ['Production', c=>c.production+' bbl/d'],
    ['SOR', c=>c.sor],
    ['Energy', c=>c.energyPct+'%'],
    ['Rod Load', c=>c.rodLoad+'%'],
    ['Mechanical Risk', c=>c.riskCategory],
  ];
  return `<div class="scrollx"><table>
    <thead><tr><th></th>${cols.map((c)=>{
      const removable = !c.derived && c.label!=='CURRENT';
      const idx = removable ? state.comparisonRows.indexOf(c) : -1;
      return `<th class="num-cell">${c.label}${removable?` <span tabindex="0" role="button" aria-label="Remove ${c.label}" onclick="removeComparisonOption(${idx})" style="cursor:pointer;color:var(--text-faint);" title="Remove">✕</span>`:''}</th>`;
    }).join('')}</tr></thead>
    <tbody>${rows.map(([label,fn])=>`<tr><td class="label-cell">${label}</td>${cols.map(c=>`<td class="num-cell">${fn(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  ${!state.recommendation ? `<div class="dim" style="font-size:12px;margin-top:8px;">A RECOMMENDED column appears automatically once THERMO-SRP issues an active recommendation.</div>` : ''}`;
}
function renderWhatIf(){
  const w = state.whatif;
  return `
    <div class="section-label">CURRENT PLAN</div>
    <div class="card">${renderCurrentPlanCard()}</div>

    <div class="section-label">JOINT CSS + SRP COUNTERFACTUAL SIMULATION</div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card__head"><div class="card__title">CSS POLICY</div></div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">Steam Volume</span><span class="slider-group__value"><span id="whatifSteamVolumeVal">${w.steamVolume.toLocaleString()}</span> bbl</span></div>
          <input type="range" min="1200" max="2200" step="50" value="${w.steamVolume}" oninput="onWhatifSliderInput('steamVolume', this.value, 0)">
          <div class="range-ticks"><span>1,200</span><span>2,200</span></div>
        </div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">Injection Pressure</span><span class="slider-group__value"><span id="whatifInjectionPressureVal">${w.injectionPressure}</span> bar</span></div>
          <input type="range" min="32" max="48" step="1" value="${w.injectionPressure}" oninput="onWhatifSliderInput('injectionPressure', this.value, 1)">
          <div class="range-ticks"><span>32 bar</span><span>48 bar</span></div>
        </div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">Soak Time</span><span class="slider-group__value"><span id="whatifSoakTimeVal">${w.soakTime}</span> hr</span></div>
          <input type="range" min="12" max="48" step="2" value="${w.soakTime}" oninput="onWhatifSliderInput('soakTime', this.value, 1)">
          <div class="range-ticks"><span>12h</span><span>48h</span></div>
        </div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">Production Cut-Off</span><span class="slider-group__value"><span id="whatifProductionCutoffVal">${w.productionCutoff}</span> bbl/d</span></div>
          <input type="range" min="70" max="115" step="1" value="${w.productionCutoff}" oninput="onWhatifSliderInput('productionCutoff', this.value, 1)">
          <div class="range-ticks"><span>70</span><span>115</span></div>
        </div>
        <div class="dim" style="font-size:11.5px;">Lower cut-off = produce longer before the next CSS cycle; higher cut-off = transition sooner, typically improving SOR.</div>
      </div>

      <div class="card">
        <div class="card__head"><div class="card__title">SRP POLICY</div></div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">SPM</span><span class="slider-group__value"><span id="whatifSpmVal">${w.spm}</span></span></div>
          <input type="range" min="5" max="11" step="0.2" value="${w.spm}" oninput="onWhatifSliderInput('spm', this.value, 1)">
          <div class="range-ticks"><span>5.0</span><span>11.0</span></div>
        </div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">Stroke</span><span class="slider-group__value"><span id="whatifStrokeVal">${w.stroke}</span> m</span></div>
          <input type="range" min="1.5" max="2.4" step="0.1" value="${w.stroke}" oninput="onWhatifSliderInput('stroke', this.value, 1)">
          <div class="range-ticks"><span>1.5m</span><span>2.4m</span></div>
        </div>
        <div class="slider-group">
          <div class="slider-group__head"><span class="slider-group__label">VFD Frequency</span><span class="slider-group__value"><span id="whatifVfdFrequencyVal">${w.vfdFrequency}</span> Hz</span></div>
          <input type="range" min="30" max="50" step="1" value="${w.vfdFrequency}" oninput="onWhatifSliderInput('vfdFrequency', this.value, 1)">
          <div class="range-ticks"><span>30 Hz</span><span>50 Hz</span></div>
        </div>
        <button class="btn btn--primary" style="width:100%; justify-content:center; margin-top:8px;" onclick="runWhatIfSimulation()">SIMULATE</button>
      </div>
    </div>

    <div class="section-label">PREDICTED RESULT</div>
    <div class="card">${renderWhatIfResult()}</div>

    <div class="section-label">DYNAMIC OPERATING ENVELOPE — PREVIEW</div>
    <div class="card">
      ${buildEnvelopeChart([
        {spm:state.well.spm, stroke:state.well.stroke, kind:'current', label:'CURRENT'},
        ...(state.recommendation ? [{spm:state.recommendation.proposedSRP.spm, stroke:state.recommendation.proposedSRP.stroke, kind:'recommended', label:'RECOMMENDED'}] : []),
        {spm:w.spm, stroke:w.stroke, kind:'preview', label:'SIMULATED'},
      ])}
    </div>

    <div class="section-label">SCENARIO COMPARISON</div>
    <div class="card">
      ${renderComparisonTable()}
      ${!state.comparisonRows.length ? `<div class="dim" style="font-size:12px;margin-top:10px;">Run a simulation and click <b style="color:var(--text)">Save as alternative</b> to add a trade-off comparison.</div>` : ''}
    </div>
  `;
}

/* ---------------------------------------------------------
   MAINTENANCE SCREEN
   --------------------------------------------------------- */
const PS_DATA_AVAILABILITY = [
  'Production history', 'CSS cycle records', 'Steam injection parameters', 'VFD / SRP operating data',
  'Rod failure history', 'Pump unsetting history', 'Well completion data', 'Reservoir data',
  'Fluid properties', 'Pressure data',
];
const OPERATING_EVENTS = [
  { well:'BGW-038', desc:'Rod floating detected during cooling phase — SPM reduced proactively, no failure', tag:'RESOLVED' },
  { well:'BGW-031', desc:'Pump unsetting risk flagged — workover scheduled ahead of failure', tag:'MAINTENANCE' },
  { well:'BGW-025', desc:'Scheduled CSS cycle review completed — no findings', tag:'INSPECTION' },
];
function renderComponentHealth(){
  const h = state.health, m = state.mechanical;
  const rows = [
    ['Rod System', h.mechanical, state.scenarioStage>=1?'down':'flat'],
    ['Pump', h.pump, state.scenarioStage>=2?'down':'flat'],
    ['Surface Unit', h.surface, 'flat'],
    ['Thermal / Reservoir', h.thermal, state.scenarioStage>=1?'down':'flat'],
    ['Sensors', h.sensors, 'flat'],
  ];
  return `<table>
    <thead><tr><th>Component</th><th class="num-cell">Health</th><th class="num-cell">Trend</th></tr></thead>
    <tbody>
    ${rows.map(([label,v,trend])=>`
      <tr>
        <td class="label-cell">${label}</td>
        <td class="num-cell">${v}%</td>
        <td class="num-cell">${trendArrow(trend,'up')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}
function renderPredictedMaintenance(){
  if(state.health.mechanical>=90){
    return `<div class="empty-note">No maintenance action currently predicted. All components are tracking within expected wear bounds.</div>`;
  }
  return `
    <div class="kv-row"><span class="k">Component</span><span class="v">Rod System</span></div>
    <div class="decision-center__why" style="margin-top:10px; padding-top:0; border-top:none;">
      <div class="decision-center__why-title">EVIDENCE</div>
      <ul class="why-list">
        <li>Increasing cyclic load</li>
        <li>Reduced operating margin</li>
        <li>Rod floating risk: ${state.mechanical.rodFloatingRisk}</li>
        <li>Damage trajectory: ${state.prognostics.damageTrend}</li>
      </ul>
    </div>
    <div class="kv-row" style="margin-top:10px;"><span class="k">Recommended inspection</span><span class="v">Before extended high-load operation</span></div>
    <div class="kv-row"><span class="k">Confidence</span><span class="v">86%</span></div>
    <div class="kv-row"><span class="k">Potential operational impact</span><span class="v" style="text-align:right;">Reduced preferred operating range</span></div>
  `;
}
function renderRecalibration(){
  const predErr = round1(state.well.temperature - state.expected.temperature);
  const needsRecal = Math.abs(predErr) > 2.5;
  return `
    <div class="kv-row"><span class="k">Predicted temperature</span><span class="v">${state.expected.temperature}°C</span></div>
    <div class="kv-row"><span class="k">Actual temperature</span><span class="v">${round1(state.well.temperature)}°C</span></div>
    <div class="kv-row"><span class="k">Prediction error</span><span class="v" style="color:${needsRecal?'var(--amber)':'var(--green)'}">${predErr>=0?'+':''}${predErr}°C</span></div>
    <div class="kv-row"><span class="k">Twin recalibration</span><span class="v" style="color:${needsRecal?'var(--amber)':'var(--green)'}">${needsRecal?'RECOMMENDED':'NOT REQUIRED'}</span></div>
    <div class="dim" style="font-size:11px; margin-top:12px; line-height:1.9;">
      Prediction → Actual operation → Prediction error → Model monitoring → Recalibration → Improved Digital Twin
    </div>
  `;
}
function renderPSDataAvailability(){
  return `<div class="grid grid-2b">${PS_DATA_AVAILABILITY.map(d=>`
    <div class="kv-row"><span class="k">${d}</span><span class="v" style="color:var(--green);">✓ SYNTHETIC DEMO DATA</span></div>
  `).join('')}</div>
  <div class="dim" style="font-size:12px; margin-top:12px;">The Digital Twin is designed to consume each of these data classes. This prototype uses deterministic synthetic data for demonstration — not a live field-data connection.</div>`;
}
function renderMaintenance(){
  const p = state.prognostics, m = state.mechanical;
  return `
    <div class="section-label">MAINTENANCE INTELLIGENCE</div>
    <div class="grid grid-2">
      <div class="card"><div class="card__head"><div class="card__title">COMPONENT HEALTH</div></div>${renderComponentHealth()}</div>
      <div class="card"><div class="card__head"><div class="card__title">PREDICTED MAINTENANCE NEED</div></div>${renderPredictedMaintenance()}</div>
    </div>

    <div class="section-label">EQUIPMENT RISK — ROD FLOATING / PUMP UNSETTING</div>
    ${renderEquipmentRiskCard()}

    <div class="grid grid-3" style="margin-top:var(--gap);">
      <div class="card">
        <div class="card__title" style="margin-bottom:10px;">ROD DAMAGE TRAJECTORY</div>
        <div class="mono" style="font-size:20px;font-weight:600;">${p.damageTrend}</div>
        <div class="dim" style="font-size:11.5px;margin-top:4px;">Confidence ${p.damageConfidence}%</div>
      </div>
      <div class="card">
        <div class="card__title" style="margin-bottom:10px;">EQUIPMENT FAILURE RISK</div>
        <div class="mono" style="font-size:26px;font-weight:600;">${p.failureProb}%</div>
        <div class="dim" style="font-size:11.5px;margin-top:4px;">range ${p.failureLow}–${p.failureHigh}%</div>
      </div>
      <div class="card">
        <div class="card__title" style="margin-bottom:10px;">WELL HEALTH</div>
        <div class="mono" style="font-size:26px;font-weight:600;">${state.health.overall}%</div>
        <div class="dim" style="font-size:11.5px;margin-top:4px;">${state.health.overall>=90?'Normal':'Watch / degraded'}</div>
      </div>
    </div>

    <div class="section-label">CONTINUOUS LEARNING / RECALIBRATION</div>
    <div class="card">${renderRecalibration()}</div>

    <div class="section-label">OPERATING EVENT HISTORY</div>
    <div class="card">
      ${OPERATING_EVENTS.map(f=>`
        <div class="kv-row">
          <span class="k">${f.well} — ${f.desc}</span>
          <span class="v"><span class="badge badge--neutral">${f.tag}</span></span>
        </div>`).join('')}
    </div>

    <div class="section-label">PS DATA AVAILABILITY</div>
    <div class="card">${renderPSDataAvailability()}</div>
  `;
}

/* ============================================================
   MASTER RENDER + INIT
   ============================================================ */
const SCREEN_RENDERERS = {
  overview: renderOverview,
  welltwin: renderWellTwin,
  operations: renderOperations,
  whatif: renderWhatIf,
  maintenance: renderMaintenance,
};

function render(){
  $('topbar').innerHTML = renderTopbar();
  $('nav').innerHTML = renderNav();
  $('demoBar').innerHTML = renderDemoBar();
  Object.keys(SCREEN_RENDERERS).forEach(id=>{
    const el = $('screen-'+id);
    if(id === state.screen){
      el.innerHTML = SCREEN_RENDERERS[id]();
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function jitterTick(){
  if(!state.liveJitter || !state.wellBase) return;
  const b = state.wellBase;
  state.well.temperature = round1(b.temperature + (Math.random()-0.5)*0.6);
  state.well.pressure = round1(b.pressure + (Math.random()-0.5)*0.4);
  state.well.viscosity = Math.round(b.viscosity + (Math.random()-0.5)*20);
  state.well.oilProduction = Math.round(b.oilProduction + (Math.random()-0.5)*2);
  state.well.pumpFillage = Math.round(b.pumpFillage + (Math.random()-0.5)*2);
  state.well.rodLoad = Math.round(b.rodLoad + (Math.random()-0.5)*1.5);
  state.operationTimeSec += 6;
  recordHistoryPoint();
  render();
}

function init(){
  loadStage(0, {silent:true});
  pushEvent('Well telemetry link established', 'BGW-042 · Baghewala');
  window.state = state; // expose for debugging/introspection
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){ closeModal(); return; }
    if((e.key==='Enter' || e.key===' ') && document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('role')==='button'){
      e.preventDefault();
      document.activeElement.click();
    }
  });
  render();
  setInterval(jitterTick, 3000);
}
init();

