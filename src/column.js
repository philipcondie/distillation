// element variables (browser only)
let form, totalTraysInput, feedTrayInput, columnPressureInput, feedRateInput, feedCompositionInput, distCompositionInput, btmsCompositionInput;
let ids, els, msgs;

// global variables
const MAXITERATIONS = 100;
const TOL = 0.001;
const trayMap = new Map();

const propaneConstants = {
    A: 4.53678,
    B: 1149.36,
    C: 24.906,
    mol_wt: 44.097,
    hVap: 6986.24159
}

const butaneConstants = {
    A: 4.35576,
    B: 1175.581,
    C: -2.071,
    mol_wt: 58.12,
    hVap: 9630.26533
}

if (typeof document !== 'undefined') {
    ids = ['totalTrays', 'feedTray', 'feedComposition', 'distillateComposition', 'bottomsComposition'];
    els = Object.fromEntries(ids.map(id => [id,document.getElementById(id)]));
    msgs = Object.fromEntries(ids.map(id => [id, document.getElementById(id + '-msg')]));
    form = document.getElementById('input-form');
    totalTraysInput = document.getElementById('totalTrays');
    feedTrayInput = document.getElementById('feedTray');
    columnPressureInput = document.getElementById('columnPressure');
    feedRateInput = document.getElementById('feedRate');
    feedCompositionInput = document.getElementById('feedComposition');
    distCompositionInput = document.getElementById('distillateComposition');
    btmsCompositionInput = document.getElementById('bottomsComposition');
}

function molarToMass(molarRate, composition, lightConsts, heavyConsts) {
    const combinedMolWt = composition * lightConsts.mol_wt + (1-composition) * heavyConsts.mol_wt;
    return combinedMolWt * molarRate;
}

function massToMolar(massRate, composition, lightConsts,heavyConsts) {
    const combinedMolWt = composition * lightConsts.mol_wt + (1-composition) * heavyConsts.mol_wt;
    return massRate / combinedMolWt;
}

// function that takes in feed conditions and product specs and outputs the product rates
function productRates(feedRate, feedXp, distillateXp, bottomsXp) {
    const distillateRate = feedRate * (feedXp - bottomsXp) / (distillateXp - bottomsXp);
    const bottomsRate = feedRate - distillateRate;
    return [distillateRate, bottomsRate];
}

function boilUpRatio(refluxRatio, distillateRate, bottomsRate) {
    return (refluxRatio + 1) * distillateRate / bottomsRate;
}

// calculate R min 
// find intersection of q line with VLE curve for saturated liquid feed (x_eq = x_fd). Find the y at the intersection.
// Then find the slope from there to the product point. With that slope solve for the reflux ratio

function minimumRefluxRatio(feedXp, distillateXp, pressure, lightAntConsts, heavyAntConsts){
    const equilibriumYp = vapMolFraction(pressure,feedXp,lightAntConsts,heavyAntConsts);
    // solve for x
    const slope = (distillateXp - equilibriumYp) / (distillateXp - feedXp);
    return slope / (1 - slope); 
}

function minimumTrays(distillateXp, bottomsXp, pressure, lightAntConsts, heavyAntConsts) {
    const topTemp = equilibriumTemperatureFromX(pressure,distillateXp,lightAntConsts,heavyAntConsts);
    const alphaTop = vaporPressure(topTemp,lightAntConsts) / vaporPressure(topTemp, heavyAntConsts);
    const bottomTemp = equilibriumTemperatureFromX(pressure,bottomsXp,lightAntConsts,heavyAntConsts);
    const alphaBottom = vaporPressure(bottomTemp,lightAntConsts) / vaporPressure(bottomTemp, heavyAntConsts);
    const averageAlpha = Math.sqrt(alphaTop * alphaBottom);
    return (Math.log((distillateXp/(1 - distillateXp) * (1-bottomsXp) / bottomsXp)) / Math.log(averageAlpha));
}

function liqMolFraction(pressure, vaporMolFrac, lightAntConsts, heavyAntConsts) {
    const temperature = equilibriumTemperatureFromY(pressure,vaporMolFrac,lightAntConsts,heavyAntConsts);
    return vaporMolFrac * pressure / vaporPressure(temperature,lightAntConsts);
}

function vapMolFraction(pressure,liquidMolFrac, lightAntConsts, heavyAntConsts) {
    const temperature = equilibriumTemperatureFromX(pressure,liquidMolFrac,lightAntConsts,heavyAntConsts);
    return liquidMolFrac * vaporPressure(temperature, lightAntConsts) / pressure;
}

function equilibriumTemperatureFromX(pressure, liquidMolFrac, lightAntConsts, heavyAntConsts) {
    // solve using bisection
    // need to get bracketing temperatures for this pressure
    let maxT = boilingPointTemperature(pressure, lightAntConsts);
    let minT = boilingPointTemperature(pressure, heavyAntConsts);
    let tempGuess= (maxT + minT) / 2;
    let result = 0;
    while (Math.abs(result = binaryequilibriumEquationFromX(tempGuess,pressure,liquidMolFrac,lightAntConsts,heavyAntConsts)) > TOL) {
        // if negative then need to reduce T. if positive need to increase T
        if (result > 0) {
            maxT = tempGuess;
            tempGuess = (minT + tempGuess) / 2;
        } else {
            minT = tempGuess;
            tempGuess = (maxT + tempGuess) / 2;
        }
    }
    return tempGuess;
}

function equilibriumTemperatureFromY(pressure, vaporMolFrac, lightAntConsts, heavyAntConsts) {
    // solve using bisection
    // need to get bracketing temperatures for this pressure
    let maxT = boilingPointTemperature(pressure, lightAntConsts);
    let minT = boilingPointTemperature(pressure, heavyAntConsts);
    let tempGuess= (maxT + minT) / 2;
    let result = 0;
    while (Math.abs(result = binaryequilibriumEquationFromY(tempGuess,pressure,vaporMolFrac,lightAntConsts,heavyAntConsts)) > TOL) {
        // if negative then need to reduce T. if positive need to increase T
        if (result > 0) {
            maxT = tempGuess;
            tempGuess = (minT + tempGuess) / 2;
        } else {
            minT = tempGuess;
            tempGuess = (maxT + tempGuess) / 2;
        }
    }
    return tempGuess;
}

function binaryequilibriumEquationFromX(temperature, pressure, liqMolFrac, lightAntConsts, heavyAntConsts) {
    const param1 = liqMolFrac * vaporPressure(temperature,lightAntConsts);
    const param2 = (1 - liqMolFrac) * vaporPressure(temperature, heavyAntConsts);
    return pressure - (param1 + param2);
}

function binaryequilibriumEquationFromY(temperature, pressure, vaporMolFrac, lightAntConsts, heavyAntConsts) {
    const param1 = vaporMolFrac * pressure / vaporPressure(temperature,lightAntConsts);
    const param2 = (1 - vaporMolFrac) * pressure / vaporPressure(temperature, heavyAntConsts);
    return param1 + param2 - 1;
}

function boilingPointTemperature(pressure, antConsts) {
    // pressure is input in psia. temperature is outputted in F
    // antoine constants are in K and bar
    const pbar = (pressure) / 14.503773773;
    const logP = Math.log10(pbar);
    const tempK = antConsts.B / (antConsts.A - logP)  - antConsts.C;
    return (tempK - 273.15 ) * 9/5 + 32;
}

function vaporPressure(temperature, antConsts) {
    // constants are for equation with units K and bar
    const tempK = (temperature - 32) * 5 / 9 + 273.15;
    const logP = antConsts.A - (antConsts.B / (tempK + antConsts.C));
    const Pbar = 10 ** logP;
    return Pbar * 14.503773773;// return pressure is in psi-a
}

function rectifyingOperatingLine(refluxRatio, distillateMolFrac, liquidMolFrac) {
    return refluxRatio / (refluxRatio + 1) * liquidMolFrac + distillateMolFrac / (refluxRatio + 1);
}

function strippingOperatingLine(boilUpRatio, bottomsMolFrac, vaporMolFraction) {
    return (vaporMolFraction + bottomsMolFrac / boilUpRatio) * boilUpRatio / (boilUpRatio + 1);
}

// use operating line to get y. use equilibrium to x
// operating line y_(i+1) = R / (R + 1) * x_i + x_D/(R+1)
// operating line y_(i) = (S + 1) / S * x_(i+1) - x_B/S 

function rectifyingSection(refluxRatio, pressure, distillateMolFrac, feedTray, lightAntConsts, heavyAntConsts) {
    let vapMolFrac = distillateMolFrac;
    // first tray do not need to do mass balance
    let liqMolFrac = liqMolFraction(pressure,distillateMolFrac,lightAntConsts,heavyAntConsts);
    for (let i = 2; i <= feedTray; i++) {
        vapMolFrac = rectifyingOperatingLine(refluxRatio,distillateMolFrac,liqMolFrac);
        liqMolFrac = liqMolFraction(pressure,vapMolFrac,lightAntConsts,heavyAntConsts);
    }
    return liqMolFrac;
}

function strippingSection(boilUpRatio, pressure, bottomsMolFrac, feedTray, totalTrays, lightAntConsts, heavyAntConsts) {
    let liqMolFrac = bottomsMolFrac;
    let vapMolFrac = vapMolFraction(pressure,liqMolFrac,lightAntConsts,heavyAntConsts);
    for(let i = totalTrays; i >= feedTray; i--) {
        liqMolFrac = strippingOperatingLine(boilUpRatio,bottomsMolFrac,vapMolFrac);
        vapMolFrac = vapMolFraction(pressure,liqMolFrac,lightAntConsts,heavyAntConsts);
    }
    return liqMolFrac;
}

function columnSolver(feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,lightAntConsts,heavyAntConsts) {
    /*
        Column is fully determined if the reflux rate is found
        Bracket the operating conditions with the minimum reflux ratio and 2 times the min
        Use bisection method to iterate and find the actual reflux ratio
    */
    const [distillateRate, bottomsRate] = productRates(feedRate,xFeed,xDistillate,xBottoms)
    let minR = minimumRefluxRatio(xFeed,xDistillate,pressure,lightAntConsts,heavyAntConsts);
    let maxR = 5 * minR;
    let guessR = (minR + maxR) / 2;
    let error = 0;
    let xRectifying, boilUp, xStripping = 0;
    for (let i = 0; i < MAXITERATIONS; i++) {
        xRectifying = rectifyingSection(guessR,pressure,xDistillate,feedTray,lightAntConsts,heavyAntConsts);
        boilUp = boilUpRatio(guessR,distillateRate,bottomsRate);
        xStripping = strippingSection(boilUp,pressure,xBottoms,feedTray,totalTrays,lightAntConsts,heavyAntConsts);
        error = (xRectifying - xStripping)
        if (Math.abs(error) < TOL) {
            console.log(`Number of iterations: ${i}`);
            return guessR;
        }
        if (error < 0 ) {
            maxR = guessR;
            guessR = (maxR + minR) / 2;
        } else {
            minR = guessR;
            guessR = (maxR + minR) / 2;
        }
    }
    console.log("Reached max iterations");
    return -1; // return -1 to show that it ran out of iterations
}

function createTray(trayNumber,temperature,liqComp,vapComp,refluxRatio,boilUp) {
    return {
        trayNumber,temperature,liqComp,vapComp, refluxRatio, boilUp
    }
}

function generateColumnData(feedRate,xFeed,xDistillate,xBottoms,pressure,feedTray,totalTrays,refluxRatio,lightAntConsts,heavyAntConsts){
    const [distillateRate, bottomsRate] = productRates(feedRate,xFeed,xDistillate,xBottoms);
    const boilUp = boilUpRatio(refluxRatio,distillateRate,bottomsRate);
    const trays = new Array(totalTrays + 1);
    let vapComp = 0;
    let liqComp = xDistillate;
    let temp = 0;
    // solve trays in rectifying section
    for (let i = 1; i <= feedTray; i++) {
        vapComp = rectifyingOperatingLine(refluxRatio,xDistillate,liqComp);
        liqComp = liqMolFraction(pressure,vapComp,lightAntConsts,heavyAntConsts);
        temp = equilibriumTemperatureFromX(pressure,liqComp,lightAntConsts,heavyAntConsts);
        trays[i-1] = createTray(i,temp,liqComp,vapComp,refluxRatio,boilUp)
    }
    // solve trays in stripping section
    vapComp = xBottoms;
    for (let i = totalTrays + 1; i > feedTray; i--) {
        liqComp = strippingOperatingLine(boilUp,xBottoms,vapComp);
        vapComp = vapMolFraction(pressure,liqComp,lightAntConsts,heavyAntConsts);
        temp = equilibriumTemperatureFromX(pressure,liqComp,lightAntConsts,heavyAntConsts);
        trays[i-1] = createTray(i,temp,liqComp,vapComp,refluxRatio,boilUp);
    }
    return trays;
}

// Page control functions

function createTrayElement(i) {
    const temp = document.getElementById('tray-template');
    const node = temp.content.firstElementChild.cloneNode(true);
    node.dataset.stage = i;
    
    const feedTrayNum = feedTrayInput?.valueAsNumber || 5;
    const title = i === feedTrayNum ? `Tray ${i} (FEED)` : `Tray ${i}`;
    node.querySelector('.title').textContent = title;
    
    return node;
}


function updateFeedInfo() {
    const feedRate = feedRateInput?.valueAsNumber || 0;
    const feedComp = feedCompositionInput?.valueAsNumber || 0;
    
    // // Calculate molar feed rate
    // const molarFeedRate = feedRate > 0 && feedComp > 0 ? 
    //     massToMolar(feedRate, feedComp / 100, propaneConstants, butaneConstants) : 0;
    
    // // Update molar feed rate display
    // const feedRateMolarEl = document.getElementById('feedRateMolar');
    // if (feedRateMolarEl) {
    //     feedRateMolarEl.textContent = molarFeedRate > 0 ? fmt(molarFeedRate, 1) : '--';
    // }

    // Calculate approximate feed temperature (saturated liquid assumption)
    const feedTemp = feedComp > 0 ? 
        equilibriumTemperatureFromX(
            (columnPressureInput?.valueAsNumber || 100) + 14.7,
            feedComp / 100,
            propaneConstants,
            butaneConstants
        ) : 0;
    
    const feedInfoBox = document.querySelector('.feed-info-box');
    if (feedInfoBox) {
        feedInfoBox.querySelector('.feed-rate').textContent = `Rate: ${fmt(feedRate, 0)} lb/hr`;
        feedInfoBox.querySelector('.feed-composition').textContent = `Composition: ${fmt(feedComp, 1)}% propane`;
        feedInfoBox.querySelector('.feed-temp').textContent = `Temperature: ${fmt(feedTemp, 0)} °F`;
    }
}

function updateProductRates(products, lightAntConsts, heavyAntConsts) {
    if (!Number.isFinite(products.distRate) || !Number.isFinite(products.btmsRate) || 
        !Number.isFinite(products.distComp) || !Number.isFinite(products.btmsComp) ||
        !Number.isFinite(products.refluxRate)){

        document.querySelector('#dist-rate').textContent = ``;
        document.querySelector('#btms-rate').textContent = ``;
        document.querySelector('#reflux-rate').textContent = ``; 
        return;
    }
    document.querySelector('#dist-rate').textContent = `${fmt(molarToMass(products.distRate,products.distComp,lightAntConsts, heavyAntConsts),0)}`;
    document.querySelector('#btms-rate').textContent = `${fmt(molarToMass(products.btmsRate,products.btmsComp,lightAntConsts, heavyAntConsts),0)}`;
    document.querySelector('#reflux-rate').textContent = `${fmt(molarToMass(products.refluxRate,products.distComp,lightAntConsts, heavyAntConsts),0)}`;
}

function createReboilerElement() {
    const temp = document.getElementById('reboiler-template');
    const node = temp.content.firstElementChild.cloneNode(true);
    node.dataset.stage = 'reboiler';
    return node;
}
function createCondenserElement() {
    const temp = document.getElementById('condenser-template');
    const node = temp.content.firstElementChild.cloneNode(true);
    node.dataset.stage = 'condenser';
    return node;
}
function populateColumnElement(numTrays) {
    const columnEl = document.getElementById('column');
    columnEl.replaceChildren();

    const frag = document.createDocumentFragment();
    
    for (let i = 1; i <= numTrays; i++) {
        const tray = createTrayElement(i);
        frag.appendChild(tray);
    }
    columnEl.appendChild(frag);
}

function populateReboilerElement() {
    const reboilerEl = document.getElementById('reboiler');
    reboilerEl.replaceChildren();
    const reboiler = createReboilerElement();
    reboilerEl.appendChild(reboiler);
}

function populateCondenserElement() {
    const condenserEl = document.getElementById('condenser');
    condenserEl.replaceChildren();
    const condenser = createCondenserElement();
    condenserEl.appendChild(condenser);
}

function fmt(num, decimalPlaces) {
    return (Number.isFinite(num) ? num.toFixed(decimalPlaces) : '-');
}

function renderTrayData(trays, pressure, rateData, lightAntConsts, heavyAntConsts) {
    // do condenser data
    renderCondenserData(trays[0],pressure,rateData,lightAntConsts,heavyAntConsts);
    for (const t of trays) {
        if (t.trayNumber > totalTraysInput.valueAsNumber) {
            renderReboilerData(t, rateData, lightAntConsts, heavyAntConsts);
            continue;
        }
        
        const trayNode = document.querySelector(`[data-stage="${t.trayNumber}"]`);
        if (!trayNode) continue;
        trayNode.querySelector('.x').textContent = fmt(t.liqComp*100, 1) + '%';
        trayNode.querySelector('.y').textContent = fmt(t.vapComp*100, 1) + '%';
        trayNode.querySelector('.T').textContent = fmt(t.temperature, 0);
        
        // Update composition bars (height based on composition, 0-1 scale to 0-100%)
        const xBar = trayNode.querySelector('.x-bar');
        const yBar = trayNode.querySelector('.y-bar');
        if (xBar && Number.isFinite(t.liqComp)) {
            xBar.style.height = `${Math.max(0, Math.min(100, t.liqComp * 100))}%`;
        }
        if (yBar && Number.isFinite(t.vapComp)) {
            yBar.style.height = `${Math.max(0, Math.min(100, t.vapComp * 100))}%`;
        }
    }
}

function renderReboilerData(reboilerData,rateData,lightAntConsts,heavyAntConsts) {
    const reboilerNode = document.querySelector('[data-stage="reboiler"]');
    if (!reboilerNode) return;
    
    reboilerNode.querySelector('.x').textContent = fmt(reboilerData.liqComp*100, 1) + '%';
    reboilerNode.querySelector('.y').textContent = fmt(reboilerData.vapComp*100, 1) + '%';
    reboilerNode.querySelector('.T').textContent = fmt(reboilerData.temperature, 0);
    
    // Update composition bars
    const xBar = reboilerNode.querySelector('.x-bar');
    const yBar = reboilerNode.querySelector('.y-bar');
    if (xBar && Number.isFinite(reboilerData.liqComp)) {
        xBar.style.height = `${Math.max(0, Math.min(100, reboilerData.liqComp * 100))}%`;
    }
    if (yBar && Number.isFinite(reboilerData.vapComp)) {
        yBar.style.height = `${Math.max(0, Math.min(100, reboilerData.vapComp * 100))}%`;
    }
    
    // Calculate and display heat duty (simplified)
    const reboilerFeedRate = rateData.btmsRate * reboilerData.boilUp;
    const heatDuty = calculateDuty(reboilerFeedRate, reboilerData.liqComp, lightAntConsts, heavyAntConsts);
    const dutyValueEl = reboilerNode.querySelector('.duty-value');
    if (dutyValueEl) {
        dutyValueEl.textContent = fmt(heatDuty, 0);
    }
}

function renderCondenserData(condenserData, pressure, rateData,lightAntConsts,heavyAntConsts) {
    // condenser has same inlet vap and outlet liq composition
    // temperature is based on bubble point of liquid
    const temperature = equilibriumTemperatureFromX(pressure,condenserData.vapComp,lightAntConsts,heavyAntConsts)
    const condenserNode = document.querySelector('[data-stage="condenser"]');
    if (!condenserNode) return;

    condenserNode.querySelector('.x').textContent = fmt(condenserData.vapComp*100, 1) + '%';
    condenserNode.querySelector('.y').textContent = fmt(condenserData.vapComp*100, 1) + '%';
    condenserNode.querySelector('.T').textContent = fmt(temperature, 0);

    // Update composition bars
    const xBar = condenserNode.querySelector('.x-bar');
    const yBar = condenserNode.querySelector('.y-bar');
    if (xBar && Number.isFinite(condenserData.liqComp)) {
        xBar.style.height = `${Math.max(0, Math.min(100, condenserData.liqComp * 100))}%`;
    }
    if (yBar && Number.isFinite(condenserData.vapComp)) {
        yBar.style.height = `${Math.max(0, Math.min(100, condenserData.vapComp * 100))}%`;
    }

    const condenserFeedRate = rateData.distRate * condenserData.refluxRatio;
    const duty = calculateDuty(condenserFeedRate,condenserData.vapComp,lightAntConsts,heavyAntConsts);
    // Calculate and display heat duty (simplified)
    const dutyValueEl = condenserNode.querySelector('.duty-value');
    if (dutyValueEl) {
        dutyValueEl.textContent = fmt(duty, 0);
    }
}



function calculateDuty(feedRate, liqComp, lightAntConsts, heavyAntConsts) {   
    // Approximate duty based on boil-up rate and latent heat
    const approxLatentHeat = liqComp * (lightAntConsts.hVap) + (1-liqComp) * (heavyAntConsts.hVap);
    
    return feedRate * approxLatentHeat / 1000;
}

function setMsgById(id, text) {
    msgs[id].textContent = text || '';
}
function setMsgByObject(element, text) {msgs[element.id].textContent = text || '';}

// function for validating inputs
function validateRawInputs() {
    ids.forEach(id => {els[id].setCustomValidity(''); setMsgById(id,'');});
    // check compositions
    if (Number.isFinite(distCompositionInput.valueAsNumber) && Number.isFinite(btmsCompositionInput.valueAsNumber)) {
        if (distCompositionInput.valueAsNumber <= btmsCompositionInput.valueAsNumber){
            const msg = 'Distillate Composition must be greater than the bottoms composition.';
            distCompositionInput.setCustomValidity(msg);
            setMsgByObject(distCompositionInput,msg);
        }
    }

    if (Number.isFinite(distCompositionInput.valueAsNumber) && Number.isFinite(feedCompositionInput.valueAsNumber)){
        if (distCompositionInput.valueAsNumber <= feedCompositionInput.valueAsNumber){
            const msg = 'Distillate Composition must be greater than the feed composition.';
            distCompositionInput.setCustomValidity(msg);
            setMsgByObject(distCompositionInput,msg);
        }
    }

    if (Number.isFinite(btmsCompositionInput.valueAsNumber) && Number.isFinite(feedCompositionInput.valueAsNumber)){
        if (btmsCompositionInput.valueAsNumber >= feedCompositionInput.valueAsNumber){
            const msg = 'Bottoms Composition must be less than the feed composition.';
            btmsCompositionInput.setCustomValidity(msg);
            setMsgByObject(btmsCompositionInput,msg);
        }
    }

    // check trays
    if (Number.isFinite(feedTrayInput.valueAsNumber) && Number.isFinite(totalTraysInput.valueAsNumber)) {
        if (feedTrayInput.valueAsNumber > totalTraysInput.valueAsNumber || feedTrayInput.valueAsNumber < 1) {
            const msg = `The feed tray must be between 1 and ${totalTraysInput.valueAsNumber}.`;
            feedTrayInput.setCustomValidity(msg);
            setMsgByObject(feedTrayInput,msg);
        }
    }

    const minTrays = Math.ceil(minimumTrays(distCompositionInput.valueAsNumber/100,btmsCompositionInput.valueAsNumber/100,columnPressureInput.valueAsNumber+ 14.7, propaneConstants,butaneConstants));
    if (Number.isFinite(totalTraysInput.valueAsNumber) && totalTraysInput.valueAsNumber +    1 < minTrays){
        const msg = `The total trays must be greater than the minimum required number of trays: ${minTrays}.`
        totalTraysInput.setCustomValidity(msg);
        setMsgByObject(totalTraysInput,msg);
    }
    // check built in handling
    ids.forEach(id => {
        if (!els[id].validity.valid && !msgs[id].textContent) {
            setMsgById(id, els[id].validationMessage);
        }
    });
    populateColumnElement(totalTraysInput.valueAsNumber);
    populateReboilerElement();
    populateCondenserElement();
    updateFeedInfo();
    
    // Auto-run simulation if all inputs are valid
    if (form.checkValidity()) {
        runSimulation();
    }
}

function runSimulation() {
    const molarFeedRate = massToMolar(feedRateInput.valueAsNumber,feedCompositionInput.valueAsNumber/100,propaneConstants,butaneConstants);
    const refluxRatio = columnSolver(
        molarFeedRate,
        feedCompositionInput.valueAsNumber/100,
        distCompositionInput.valueAsNumber/100,
        btmsCompositionInput.valueAsNumber/100,
        columnPressureInput.valueAsNumber+ 14.7,
        feedTrayInput.valueAsNumber,
        totalTraysInput.valueAsNumber + 1,
        propaneConstants,
        butaneConstants
    );

    if (refluxRatio < 0) {
        const columnEl = document.getElementById('column');
        columnEl.innerHTML = '<h2>WARNING!</h2><p class="error">The specified conditions are not feasible. Please adjust your inputs.</p>';
        return;
    }

    const trays = generateColumnData(
        molarFeedRate,
        feedCompositionInput.valueAsNumber/100,
        distCompositionInput.valueAsNumber/100,
        btmsCompositionInput.valueAsNumber/100,
        columnPressureInput.valueAsNumber+14.7,
        feedTrayInput.valueAsNumber,
        totalTraysInput.valueAsNumber,
        refluxRatio,
        propaneConstants,
        butaneConstants
    );
    const rates = productRates(molarFeedRate,feedCompositionInput.valueAsNumber/100,distCompositionInput.valueAsNumber/100,btmsCompositionInput.valueAsNumber/100);
    const refluxRate = rates[0]*refluxRatio;
    const rateData = {
        "feedRate" : molarFeedRate,
        "distRate" : rates[0],
        "btmsRate" : rates[1],
        "distComp": distCompositionInput.valueAsNumber/100,
        "btmsComp":  btmsCompositionInput.valueAsNumber/100,
        "refluxRate": refluxRate
    }
    updateProductRates(rateData,propaneConstants,butaneConstants);
    renderTrayData(trays, columnPressureInput.valueAsNumber+14.7, rateData, propaneConstants, butaneConstants);
}

// function for rendering the page
// function onSubmit(e) {
//     e.preventDefault();
//     validateRawInputs();
//     if (!form.checkValidity()) {
//         form.reportValidity();
//         return;
//     }
//     runSimulation();
// }

function initializePage() {
    populateColumnElement(totalTraysInput.valueAsNumber || 8);
    populateReboilerElement();
    populateCondenserElement();
    updateFeedInfo();
    validateRawInputs();
}

// Only add event listener in browser environment
if (typeof document !== 'undefined' && form) {
    form.addEventListener('input', validateRawInputs);
    // form.addEventListener("submit",onSubmit);
    initializePage();
    // document.getElementById('testButton').addEventListener('click',populateColumnWrapper);
}

// Conditional exports for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        binaryequilibriumEquationFromX,
        binaryequilibriumEquationFromY,
        boilingPointTemperature,
        boilUpRatio,
        columnSolver,
        equilibriumTemperatureFromX,
        equilibriumTemperatureFromY,
        generateColumnData,
        liqMolFraction,
        minimumRefluxRatio,
        productRates,
        rectifyingOperatingLine,
        rectifyingSection,
        strippingOperatingLine,
        strippingSection,
        vapMolFraction,
        vaporPressure
    };
}
