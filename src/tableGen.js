const { boilUpRatio, liqMolFraction, minimumRefluxRatio, productRates, rectifyingOperatingLine, strippingOperatingLine, vapMolFraction, generateColumnData, columnSolver } = require("./column.js");

let output = 'x,result\n'; // CSV header

const propaneConstants = {
    A: 4.53678,
    B: 1149.36,
    C: 24.906
}

const butaneConstants = {
    A: 4.35576,
    B: 1175.581,
    C: -2.071
}

// for (let x = 0; x <= 1.0001; x += 0.01) {
//   const y = vapMolFraction(114.7,x,propaneConstants,butaneConstants);
//   output += `${x.toFixed(2)},${y}\n`;
// }
const feedTray = 6;
const pressure = 114.7;
const distillate = 0.99;
const btms = 1 - distillate;
const reflux = columnSolver(100,0.5,distillate,btms,114.7,feedTray,10,propaneConstants,butaneConstants);
console.log(reflux);
// const reflux = 0.6690944886511554;


const trays = generateColumnData(100, 0.5, distillate, btms, 114.7, feedTray, 10, reflux, propaneConstants, butaneConstants);

for (let i = 0; i < trays.length; i++) {
    console.log(`Tray ${i+1} Temp: ${trays[i].temperature}, X: ${trays[i].liqComp} Y: ${trays[i].vapComp}`)
}