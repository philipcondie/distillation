# Distillation Column Simulator

A browser-based simulator for binary distillation columns. Enter column parameters and feed conditions to calculate tray-by-tray compositions, temperatures, product rates, and heat duties in real time.

Visit a live demo of the project [here](https://philipcondie.github.io/distillation/).

Design aesthetics inspired by Honeywell TDC 3000 control system.

## System

Simulates separation of a **propane/butane** binary mixture using:

- McCabe-Thiele method (operating lines for rectifying and stripping sections)
- Raoult's Law for vapor-liquid equilibrium
- Antoine equation for vapor pressure and bubble/dew point calculations
- Bisection method to solve for the required reflux ratio

## Usage

Open `src/simulator.html` in a browser. No build step or server required.

**Inputs:**
- Column pressure (psig)
- Number of trays and feed tray location
- Feed rate (lb/hr), feed composition (mol% propane)
- Distillate and bottoms compositions (mol% propane)

**Outputs:**
- Per-tray liquid/vapor compositions and temperature
- Distillate, bottoms, and reflux rates
- Condenser and reboiler heat duties

## Project Structure

```
src/
  column.js       # Core thermodynamic and distillation calculations
  app.js          # Browser UI logic and DOM updates
  simulator.html  # Main simulation page
  simulator.css   # Styles
test/
  column.test.js  # Unit tests for column.js
```

## Running Tests

```bash
npm test
```

Tests use Node's built-in test runner (`node --test`).
