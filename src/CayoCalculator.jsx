import React, { useState, useEffect } from 'react';
import { Moon, Sun, Download, RotateCcw, AlertCircle } from 'lucide-react';

// Game data based on provided logic
const GAME_DATA = {
  bag_capacity: 1800,
  primary_targets: [
    { name: "Sinsimito Tequila", key: "tequila", value: { standard: 630000, hard: 693000 }, bonus_multiplier: 1.2 },
    { name: "Ruby Necklace", key: "ruby_necklace", value: { standard: 700000, hard: 770000 }, bonus_multiplier: 1.1 },
    { name: "Bearer Bonds", key: "bearer_bonds", value: { standard: 770000, hard: 847000 }, bonus_multiplier: 1.05 },
    { name: "Pink Diamond", key: "pink_diamond", value: { standard: 1300000, hard: 1430000 }, bonus_multiplier: 1 },
    { name: "Panther Statue", key: "panther_statue", value: { standard: 1900000, hard: 2090000 }, bonus_multiplier: 1 }
  ],
  secondary_targets: [
    {
      name: "Gold",
      key: "gold",
      value: { min: 328333, max: 333333 },
      full_table_units: 1200,
      base_value: 330833,
      clicks_per_stack: 7
    },
    {
      name: "Cocaine",
      key: "cocaine",
      value: { min: 198000, max: 202500 },
      full_table_units: 900,
      base_value: 200250,
      clicks_per_stack: 10
    },
    {
      name: "Weed",
      key: "weed",
      value: { min: 130500, max: 135000 },
      full_table_units: 675,
      base_value: 132750,
      clicks_per_stack: 10
    },
    {
      name: "Paintings",
      key: "paintings",
      value: { min: 157500, max: 180000 },
      full_table_units: 900,
      base_value: 168750,
      clicks_per_stack: 4
    },
    {
      name: "Cash",
      key: "cash",
      value: { min: 78750, max: 83250 },
      full_table_units: 450,
      base_value: 81000,
      clicks_per_stack: 10
    }
  ],
  office_safe: 50000,
  elite_challenge: { standard: 50000, hard: 100000 }
};

const CayoCalculator = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [players, setPlayers] = useState(2);
  const [hardMode, setHardMode] = useState(false);
  const [eliteChallenge, setEliteChallenge] = useState(false);
  const [primaryTarget, setPrimaryTarget] = useState("tequila");

  // Secondary targets (number of stacks)
  const [gold, setGold] = useState(0);
  const [cocaine, setCocaine] = useState(0);
  const [weed, setWeed] = useState(0);
  const [paintings, setPaintings] = useState(0);
  const [cash, setCash] = useState(0);

  // Player cuts
  const [cuts, setCuts] = useState([85, 15, 0, 0]);

  // Auto-adjust cuts when players change
  useEffect(() => {
    const newCuts = [0, 0, 0, 0];
    if (players === 1) {
      newCuts[0] = 100;
    } else if (players === 2) {
      newCuts[0] = 85;
      newCuts[1] = 15;
    } else if (players === 3) {
      newCuts[0] = 70;
      newCuts[1] = 15;
      newCuts[2] = 15;
    } else if (players === 4) {
      newCuts[0] = 55;
      newCuts[1] = 15;
      newCuts[2] = 15;
      newCuts[3] = 15;
    }
    setCuts(newCuts);

    if (players < 2) {
      setGold(0);
    }
  }, [players]);

// Bonus multiplier for secondary targets
const getSecondaryBonus = () => {
  if (!eliteChallenge) return 1;
  const primary = GAME_DATA.primary_targets.find(t => t.key === primaryTarget);
  return primary?.bonus_multiplier ?? 1;
};

// Secondary value per stack
const calculateSecondaryValue = (targetKey, stacks) => {
  const target = GAME_DATA.secondary_targets.find(t => t.key === targetKey);
  if (!target || stacks === 0) return 0;

  let value = target.base_value;

  // Gold never gets bonus
  if (eliteChallenge && targetKey !== "gold") {
    value *= getSecondaryBonus();
  }

  return value * stacks;
};

// Total bags (clamped to players)
const getTotalBags = () => {
  const capacityUnits = players * GAME_DATA.bag_capacity;

  const units =
    gold * GAME_DATA.secondary_targets.find(t => t.key === "gold").full_table_units +
    cocaine * GAME_DATA.secondary_targets.find(t => t.key === "cocaine").full_table_units +
    weed * GAME_DATA.secondary_targets.find(t => t.key === "weed").full_table_units +
    cash * GAME_DATA.secondary_targets.find(t => t.key === "cash").full_table_units +
    paintings * (GAME_DATA.bag_capacity * 0.5); // painting = 0.5 bag

  return (Math.min(units, capacityUnits) / GAME_DATA.bag_capacity).toFixed(2);
};

// ✅ KNAPSACK (authoritative loot)
const getOptimalLootOrder = () => {
  const maxUnits = players * GAME_DATA.bag_capacity;
  let usedUnits = 0;

  const items = [
    { key: "gold", label: "Gold", stacks: gold },
    { key: "cocaine", label: "Cocaine", stacks: cocaine },
    { key: "weed", label: "Weed", stacks: weed },
    { key: "cash", label: "Cash", stacks: cash },
    { key: "paintings", label: "Painting", stacks: paintings }
  ].filter(i => i.stacks > 0);

  const enriched = items.map(item => {
    const target = GAME_DATA.secondary_targets.find(t => t.key === item.key);
    const isPainting = item.key === "paintings";

    const unitsPerStack = isPainting
      ? GAME_DATA.bag_capacity * 0.5   // 🎨 fixed 0.5 bag
      : target.full_table_units;

    const valuePerStack = calculateSecondaryValue(item.key, 1);

    return {
      ...item,
      unitsPerStack,
      clicksPerStack: target.clicks_per_stack,
      valuePerUnit: valuePerStack / unitsPerStack
    };
  });

  // Best profit first
  enriched.sort((a, b) => b.valuePerUnit - a.valuePerUnit);

  const result = [];

  for (const item of enriched) {
    if (usedUnits >= maxUnits) break;

    const remainingUnits = maxUnits - usedUnits;

    // Paintings: only whole paintings allowed
    let stacksTaken;
    if (item.key === "paintings") {
      stacksTaken =
        remainingUnits >= item.unitsPerStack ? Math.min(1, item.stacks) : 0;
    } else {
      stacksTaken = Math.min(
        item.stacks,
        remainingUnits / item.unitsPerStack
      );
    }

    if (stacksTaken <= 0) continue;

    const takenUnits = stacksTaken * item.unitsPerStack;

    const bags =
      item.key === "paintings"
        ? stacksTaken * 0.5
        : takenUnits / GAME_DATA.bag_capacity;

    const clicks = Math.round(stacksTaken * item.clicksPerStack);

    usedUnits += takenUnits;

    result.push({
      key: item.key,
      label: item.label,
      stacks: stacksTaken,
      bags,
      clicks
    });
  }

  return result;
};

// 🔒 Gross total (STRICTLY knapsack-based)
const calculateGrossTotal = () => {
  const primary =
    GAME_DATA.primary_targets.find(t => t.key === primaryTarget) ??
    GAME_DATA.primary_targets[0];

  const primaryValue = hardMode
    ? primary.value.hard
    : primary.value.standard;

  const secondaryValue = getOptimalLootOrder().reduce((sum, item) => {
    const target = GAME_DATA.secondary_targets.find(t => t.key === item.key);
    if (!target) return sum;

    return sum + calculateSecondaryValue(item.key, item.stacks);
  }, 0);

  return Math.floor(
    primaryValue +
    secondaryValue +
    GAME_DATA.office_safe
  );
};

// Elite challenge bonus per player
const getEliteChallengeBonus = () => {
  return hardMode
    ? GAME_DATA.elite_challenge.hard
    : GAME_DATA.elite_challenge.standard;
};

// Fees & net
const calculateNetTotal = () => {
  const gross = calculateGrossTotal();
  return gross - Math.floor(gross * 0.10) - Math.floor(gross * 0.02);
};

const grossTotal = calculateGrossTotal();
const netTotal = calculateNetTotal();
const fencingFee = Math.floor(grossTotal * 0.10);
const pavelFee = Math.floor(grossTotal * 0.02);
const eliteBonusPerPlayer = getEliteChallengeBonus();

// Payouts
const calculatePayouts = () =>
  cuts.map((cut, idx) =>
    idx >= players ? 0 : Math.floor(netTotal * (cut / 100))
  );

const payouts = calculatePayouts();


// Update cut for a specific player
const updateCut = (index, value) => {
  const newCuts = [...cuts];
  newCuts[index] = Math.max(0, Math.min(100, value));

  const totalCut = newCuts.slice(0, players).reduce((sum, cut) => sum + cut, 0);
  if (totalCut > 100) {
    const excess = totalCut - 100;
    newCuts[index] = Math.max(0, value - excess);
  }

  setCuts(newCuts);
};

// Reset all settings
const resetSettings = () => {
  setPlayers(2);
  setHardMode(false);
  setEliteChallenge(false);
  setPrimaryTarget("tequila");
  setGold(0);
  setCocaine(0);
  setWeed(0);
  setPaintings(0);
  setCash(0);
  setCuts([85, 15, 0, 0]);
};

// Build result text (shared)
const buildResultText = () => {
  const primary =
    GAME_DATA.primary_targets.find(t => t.key === primaryTarget) ??
    GAME_DATA.primary_targets[0];

  const secondaryLoot = getOptimalLootOrder();

  const playerPayouts = cuts.slice(0, players).map((cut, idx) =>
    `${idx === 0 ? "Leader" : `Member ${idx}`}: ${cut}% - $${payouts[idx].toLocaleString()}`
  ).join("\n");

  return `
╔══════════════════════════════════════════╗
║                                          ║
║   ██████╗  █████╗ ██╗   ██╗ ██████╗      ║
║  ██╔════╝ ██╔══██╗╚██╗ ██╔╝██╔═══██╗     ║
║  ██║      ███████║ ╚████╔╝ ██║   ██║     ║
║  ██║      ██╔══██║  ╚██╔╝  ██║   ██║     ║
║  ╚██████╗ ██║  ██║   ██║   ╚██████╔╝     ║
║   ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝      ║
║                                          ║
║      CAYO PERICO HEIST CALCULATOR        ║
║          by Yash Chandankhede            ║
║                                          ║
╚══════════════════════════════════════════╝

HEIST SETUP:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Players: ${players}
Difficulty: ${hardMode ? "Hard Mode" : "Normal Mode"}
72h Bonus: ${eliteChallenge ? "Yes" : "No"}
Primary Target: ${primary.name}

SECONDARY TARGETS (OPTIMAL ORDER):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${secondaryLoot.length
      ? secondaryLoot.map(item =>
        `${item.stacks.toFixed(2)} ${item.label} bags - ${item.clicks} clicks - $${Math.floor(item.value).toLocaleString()}`
      ).join("\n")
      : "None"}

FINANCIAL BREAKDOWN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gross Total: $${grossTotal.toLocaleString()}
- Fencing Fee (10%): $${fencingFee.toLocaleString()}
- Pavel Fee (2%): $${pavelFee.toLocaleString()}
Net Total: $${netTotal.toLocaleString()}
${eliteChallenge ? `+ Elite Challenge Bonus: $${eliteBonusPerPlayer.toLocaleString()} per player` : ""}

PLAYER PAYOUTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${playerPayouts}

Bags Sum: ${getTotalBags()}

═══════════════════════════════════════════
Generated: ${new Date().toLocaleString()}
═══════════════════════════════════════════

═══════════════════════════════════════════
<> Yash Chandankhede
© 2026 Yash Chandankhede. All rights reserved.
✉ Email: yashchandankhede@gmail.com
═══════════════════════════════════════════

`;
};

// Copy to clipboard
const copyLinkWithSettings = () => {
  const text = buildResultText();

  navigator.clipboard.writeText(text)
    .then(() => alert("Results copied to clipboard!"))
    .catch(() => alert("Failed to copy results"));
};

// Download as text file
const downloadResults = () => {
  const text = buildResultText();

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `cayo-perico-heist-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const totalCutPercentage = cuts.slice(0, players).reduce((sum, cut) => sum + cut, 0);

return (
  <div className="relative min-h-screen text-gray-200">

    {/* BACKGROUND IMAGE */}
    <div
      className="fixed inset-0 -z-10 bg-cover bg-center"
      style={{ backgroundImage: "url('/gta-bg.jpg')" }}
    />

    {/* DARK OVERLAY */}
    <div className="fixed inset-0 -z-10 bg-black/60 pointer-events-none" />

    {/* HEADER */}
    <header className="sticky top-0 z-50 h-[80px] bg-black/80 backdrop-blur-md border-b border-green-500/30">
      <div className="container mx-auto px-4 h-full flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-black tracking-wider text-green-500">
          GTA 5 CAYO PERICO PAYOUT CALCULATOR
        </h1>

        <div className="flex gap-2">
          <button
            onClick={resetSettings}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded font-semibold"
          >
            Reset
          </button>

          <button
            onClick={downloadResults}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold"
          >
            Download
          </button>
        </div>
      </div>
    </header>

    {/* MAIN */}
    <main className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

        {/* LEFT PANEL */}
        <div className="lg:col-span-5">
          <div className="h-full overflow-y-auto rounded-lg p-5 bg-gray-900/80 border border-gray-800">

            {/* LEFT CONTENT (inputs, selects, tables) */}
            {/* ⬇️ YOUR LEFT PANEL CONTENT STAYS EXACTLY THE SAME ⬇️ */}
            
              {/* Hard Mode */}
            <div className="mb-4">
              <label className="block text-lg font-bold mb-2">Hard mode:</label>
              <select
                value={hardMode ? "Yes" : "No"}
                onChange={(e) => setHardMode(e.target.value === "Yes")}
                className={`w-full p-2 rounded font-semibold ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-300'
                  } border`}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {/* Elite Challenge */}
            <div className="mb-4">
              <label className="block text-lg font-bold mb-2">Within 72h bonus:</label>
              <select
                value={eliteChallenge ? "Yes" : "No"}
                onChange={(e) => setEliteChallenge(e.target.value === "Yes")}
                className={`w-full p-2 rounded font-semibold ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-300'
                  } border`}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {/* Main Target */}
            <div className="mb-4">
              <label className="block text-lg font-bold mb-2">Main Target:</label>
              <select
                value={primaryTarget}
                onChange={(e) => setPrimaryTarget(e.target.value)}
                className={`w-full p-2 rounded font-semibold ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-300'
                  } border`}
              >
                {GAME_DATA.primary_targets.map(target => (
                  <option key={target.key} value={target.key}>{target.name}</option>
                ))}
              </select>
            </div>

            {/* Players */}
            <div className="mb-4">
              <label className="block text-lg font-bold mb-2">Amount of players:</label>
              <select
                value={players}
                onChange={(e) => setPlayers(parseInt(e.target.value))}
                className={`w-full p-2 rounded font-semibold ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-300'
                  } border`}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>

            {/* Secondary Targets */}
            {[
              { label: 'Gold stacks:', value: gold, setter: setGold, key: 'gold' },
              { label: 'Cocaine stacks:', value: cocaine, setter: setCocaine, key: 'cocaine' },
              { label: 'Weed stacks:', value: weed, setter: setWeed, key: 'weed' },
              { label: 'Paintings:', value: paintings, setter: setPaintings, key: 'paintings' },
              { label: 'Cash stacks:', value: cash, setter: setCash, key: 'cash' }
            ].map((item, idx) => {
              const isGold = item.key === 'gold';
              const isDisabled = isGold && players < 2;

              return (
                <div key={idx} className="mb-4">
                  <label className="block text-lg font-bold mb-2">{item.label}</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={item.value}
                    onChange={(e) => !isDisabled && item.setter(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                    disabled={isDisabled}
                    className={`w-full p-2 rounded font-semibold ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-300'
                      } border ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                  {isGold && isDisabled && (
                    <p className="text-yellow-500 text-sm mt-1">Requires 2+ players</p>
                  )}
                </div>
              );
            })}
{/* FOOTER */}
<footer className="mt-6 pb-4 text-center text-sm text-gray-400 bg-black/30 backdrop-blur-sm rounded-lg">
  <div className="flex flex-col items-center gap-2">

    {/* Name */}
    <div className="text-gray-300">
      &lt;&gt; <span className="font-bold">Yash Chandankhede</span>
    </div>

    {/* Copyright */}
    <div>
      © 2026 <span className="font-semibold">Yash Chandankhede</span>. All rights reserved.
    </div>

    {/* Email */}
    <a
      href="mailto:yashchandankhede207@gmail.com"
      className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8h18V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <span>Email</span>
    </a>

  </div>
</footer>
          </div>
        </div>
         

        {/* RIGHT PANEL */}
        <div className="lg:col-span-7">
          <div className="h-full overflow-y-auto rounded-lg p-5 bg-gray-900/80 border border-gray-800">

            {/* Static Bonuses */}
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>+ Office safe:</span>
                <span className="font-semibold">$50,000</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>- Fencing fee [10%]:</span>
                <span>${fencingFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>- Pavel fee [2%]:</span>
                <span>${pavelFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Elite Challenge:</span>
                <span className="font-semibold">
                  ${eliteBonusPerPlayer.toLocaleString()} for every player*
                </span>
              </div>
            </div>

            <hr className="my-4 border-gray-800" />

            {/* Player Cuts */}
            {cuts.slice(0, players).map((cut, idx) => (
              <div key={idx} className="mb-3">
                <div className="flex justify-between items-center">
                  <label className="text-lg font-bold">
                    {idx === 0 ? "Leader" : `Member ${idx}`}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={cut}
                      onChange={(e) =>
                        updateCut(idx, parseInt(e.target.value) || 0)
                      }
                      className="w-16 p-1 text-center rounded bg-gray-800 border border-gray-700"
                    />
                    <span className="text-green-500 font-black">
                      ${payouts[idx].toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <hr className="my-4 border-gray-800" />

            {/* Max Profit */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-bold">Max possible profit:</span>
              <span className="text-3xl font-black text-green-500">
                ${netTotal.toLocaleString()}
              </span>
            </div>

            <hr className="my-4 border-gray-800" />

            {/* Loot Order */}
            {(gold || cocaine || weed || paintings || cash) > 0 && (
              <div className="mb-4">
                <p className="text-lg font-bold mb-2">
                  You can take [in profit order]:
                </p>
                {getOptimalLootOrder().map((item, idx) => (
                  <p key={idx}>
                    <span className="text-red-500 font-bold">
                      {item.bags.toFixed(2)}
                    </span>{" "}
                    {item.label} – {item.clicks} clicks
                  </p>
                ))}
              </div>
            )}

            <hr className="my-4 border-gray-800" />

            {/* Bags Sum */}
            <p className="text-lg mb-4">
              <span className="font-bold">Bags sum:</span>{" "}
              {getTotalBags()}
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={resetSettings}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded"
              >
                Reset settings
              </button>
              <button
                onClick={copyLinkWithSettings}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded"
              >
                Copy link
              </button>
            </div>

            <p className="text-sm mt-4 text-gray-500">
              * not included in max possible profit
            </p>
             {/* Primary Target Values Table */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3">Primary target values:</h3>
              <div className={`rounded overflow-hidden border ${darkMode ? 'border-gray-800' : 'border-gray-300'}`}>
                <table className="w-full text-sm">
                  <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-200'}>
                    <tr>
                      <th className="text-left p-2 font-bold">Target</th>
                      <th className="text-right p-2 font-bold">Normal</th>
                      <th className="text-right p-2 font-bold">Hard</th>
                    </tr>
                  </thead>
                  <tbody className={darkMode ? 'bg-gray-900/50' : 'bg-white'}>
                    {GAME_DATA.primary_targets.map((target, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? (darkMode ? 'bg-gray-900/30' : 'bg-gray-50') : ''}>
                        <td className="p-2 font-semibold">{target.name}</td>
                        <td className="text-right p-2">${target.value.standard.toLocaleString()}</td>
                        <td className="text-right p-2">${target.value.hard.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Secondary Targets Table */}
            <div className="mt-6">
              <h3 className="text-lg font-bold mb-3">Secondary targets average values:</h3>
              <div className={`rounded overflow-hidden border ${darkMode ? 'border-gray-800' : 'border-gray-300'}`}>
                <table className="w-full text-sm">
                  <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-200'}>
                    <tr>
                      <th className="text-left p-2 font-bold">Target</th>
                      <th className="text-right p-2 font-bold">Stack value</th>
                      <th className="text-right p-2 font-bold">Full bag</th>
                      <th className="text-right p-2 font-bold">Bag fill %</th>
                    </tr>
                  </thead>
                  <tbody className={darkMode ? 'bg-gray-900/50' : 'bg-white'}>
                    {GAME_DATA.secondary_targets.map((target, idx) => {
                      let stackValue = target.base_value;

                      // Apply bonus if 72h is active and not gold
                      if (eliteChallenge && target.key !== 'gold') {
                        const bonus = getSecondaryBonus();
                        stackValue = stackValue * bonus;
                      }

                      const fullBagValue = stackValue * (GAME_DATA.bag_capacity / target.full_table_units);
                      const bagFillPercent = (target.full_table_units / GAME_DATA.bag_capacity) * 100;

                      return (
                        <tr key={idx} className={idx % 2 === 0 ? (darkMode ? 'bg-gray-900/30' : 'bg-gray-50') : ''}>
                          <td className="p-2 font-semibold">{target.name}</td>
                          <td className="text-right p-2">${Math.floor(stackValue).toLocaleString()}</td>
                          <td className="text-right p-2">${Math.floor(fullBagValue).toLocaleString()}</td>
                          <td className="text-right p-2">{bagFillPercent.toFixed(2)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  </div>
);
};

export default CayoCalculator;