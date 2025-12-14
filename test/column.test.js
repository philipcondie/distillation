const test = require('node:test');
const assert = require('node:assert/strict');

const {binaryequilibriumEquationFromX, binaryequilibriumEquationFromY, boilingPointTemperature, columnSolver, equilibriumTemperatureFromX,equilibriumTemperatureFromY, liqMolFraction, productRates, rectifyingSection, strippingSection, vapMolFraction, vaporPressure} = require('../src/column.js');

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

test('Calculate propane vapor pressure at 100 F', () => {
    const result = vaporPressure(100,propaneConstants);
    const actual = 12.99827 * 14.503773773;
    // console.log(`T=100°F, propane: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2 * actual);
})

test('Calculate propane vapor pressure at 175 F', () => {
    const result = vaporPressure(175,propaneConstants);
    const actual = 31.10826 * 14.503773773;
    // console.log(`T=175°F, propane: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2 * actual);
})

test('Calculate butane vapor pressure at 100 F', () => {
    const result = vaporPressure(100,butaneConstants);
    const actual = 3.525922 * 14.503773773;
    // console.log(`T=100°F, butane: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2 * actual);
})

test('Calculate butane vapor pressure at 175 F', () => {
    const result = vaporPressure(175,butaneConstants);
    const actual = 10.05529 * 14.503773773;
    // console.log(`T=175°F, butane: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2 * actual);
})

test('Calculate product rates feed composition 50/50. Pure component products', () => {
    const [resultDistllate,resultBottoms] = productRates(100,0.5,1.0,0.0);
    assert.equal(resultDistllate, 50);
    assert.equal(resultBottoms,50);
})

test('Calculate product rates feed composition 75/25. 95% pure products', () => {
    const [resultDistllate,resultBottoms] = productRates(100,0.5,0.95,0.01);
    const actualDistillate = 52.1276596
    const actualBottoms = 100 - actualDistillate
    assert.ok(Math.abs(resultDistllate - actualDistillate)<=1e-2*actualDistillate);
    assert.ok(Math.abs(resultBottoms - actualBottoms)<=1e-2*actualBottoms);
})

// boiling point temperature
test('Calculate boiling point temperature for propane', () => {
    const result = boilingPointTemperature(450.40411536528137,propaneConstants);
    const actual = 175.0;
    // console.log(`Propane: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})

test('Calculate boiling point temperature for propane', () => {
    const result = boilingPointTemperature(188.73551724037512,propaneConstants);
    const actual = 100.0;
    // console.log(`Propane: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})
// dew point equation
test('Calculate binary dew point equation from X for equilibrium case', () => {
    const result = binaryequilibriumEquationFromX(100,114.7,0.46089435,propaneConstants,butaneConstants);
    // console.log(`Binary dew point equation from x: result=${result}`);
    assert.ok(Math.abs(result) <= 1e-4);
})
test('Calculate binary dew point equation from Y for equilibrium case', () => {
    const result = binaryequilibriumEquationFromY(100,114.7,0.758388,propaneConstants,butaneConstants);
    // console.log(`Binary dew point equation from y: result=${result}`);
    assert.ok(Math.abs(result) <= 1e-4);
})

// dew point temperature
test('Calculate binary mixture dew point from X', () => {
    const result = equilibriumTemperatureFromX(114.7,0.46089435,propaneConstants,butaneConstants);
    const actual = 100.0;
    // console.log(`Dew point from x: result=${result}, expected=${actual}`);
     assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})
test('Calculate binary mixture dew point from Y', () => {
    const result = equilibriumTemperatureFromY(114.7,0.758388262,propaneConstants,butaneConstants);
    const actual = 100.0;
    // console.log(`Dew point from y: result=${result}, expected=${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})
// liq and vap mol frac
test("Calculate liquid mol frac from vapor mol frac", () => {
    const result = liqMolFraction(114.7,0.758388262,propaneConstants,butaneConstants);
    const actual = 0.46089435;
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})

test('Calculate vapor mol frac from liq mol frac', () => {
    const result = vapMolFraction(114.7,0.46089435,propaneConstants,butaneConstants);
    const actual = 0.758388262;
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})
// sections

test('Check rectifying section feed tray composition', () => {
    const result = rectifyingSection(1.0,114.7,0.95,5,propaneConstants,butaneConstants);
    const actual = 0.3883431001482726;
    // console.log(`Rectifying feed comp: result=${result}, expected=${actual}`)
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})

test('Check rectifying section feed tray composition', () => {
    const result = strippingSection(2,114.7,0.05,1,10,propaneConstants,butaneConstants);
    const actual = 0.5718267662803851;
    // console.log(`Stripping feed comp: result=${result}, expected=${actual}`)
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})

test('Check solver results', () => {
    const actual = 0.685993836771617;
    const result = columnSolver(100,0.5,0.95,0.05,114.7,6,10,propaneConstants,butaneConstants);
    // console.log(`Solved reflux ratio: ${result}, expected:${actual}`);
    assert.ok(Math.abs(result - actual) <= 1e-2*actual);
})
