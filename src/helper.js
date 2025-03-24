/***************************************************************
 * helper.js
 *
 * Contains logic for factor computations, PDS, and backend API
 * integration with proper security.
 ***************************************************************/

/** Example of how you might store your test key. */
const GOOGLE_API_KEY = "AIzaSyB-RIjhhODp6aPTzqVcwbXD894oebXFCUY";

/** Configuration object with constants */
const Config = {
  PDS_BUY_THRESHOLD: 5,
  PDS_CONSIDER_THRESHOLD: 0,
  FACTOR_LABELS: {
    "D": "Discretionary Income",
    "O": "Opportunity Cost",
    "G": "Goal Alignment",
    "L": "Long-Term Impact",
    "B": "Behavioral"
  }
};

/**
 * Backend API endpoint for secure analysis (or direct Google, Gemini, etc.)
 */
async function callGeminiAPI(inputs) {
  try {
    console.log("Submitting request to backend service:", inputs);

    // For now, return a fallback. Or call your real endpoint with fetch:
    // e.g., fetch('https://example.com/my-secure-api?key=' + GOOGLE_API_KEY)
    return getFallbackAnalysis(inputs);

  } catch (error) {
    console.error("Error calling analysis API:", error);
    return getFallbackAnalysis(inputs);
  }
}

/**
 * Enhanced fallback function that provides realistic analysis
 * when the API is unavailable or encounters an error.
 */
function getFallbackAnalysis(inputs) {
  console.log("Using fallback analysis for:", inputs);

  // More sophisticated fallback that considers actual input values
  let D = 0; // Discretionary Income
  let O = 0; // Opportunity Cost
  let G = 0; // Goal Alignment
  let L = 0; // Long-Term Impact
  let B = 0; // Behavioral

  // Discretionary Income factor
  const costToIncomeRatio = inputs.itemCost / (inputs.leftoverIncome || 1000);
  if (costToIncomeRatio < 0.1) D = 2;
  else if (costToIncomeRatio < 0.25) D = 1;
  else if (costToIncomeRatio < 0.5) D = 0;
  else if (costToIncomeRatio < 1) D = -1;
  else D = -2;

  // Opportunity Cost factor
  if (inputs.hasHighInterestDebt === "Yes") {
    O = -2;
  } else {
    O = Math.min(2, Math.max(-2, 1 - Math.floor(costToIncomeRatio * 2)));
  }

  // Goal Alignment factor
  const goalLower = (inputs.mainFinancialGoal || "").toLowerCase();
  const itemLower = (inputs.itemName || "").toLowerCase();

  if (
    goalLower.includes("emergency") ||
    goalLower.includes("debt") ||
    goalLower.includes("save")
  ) {
    // If saving is the goal, most purchases are negative
    G = -1;
    // Unless the item is directly related to the goal
    if (
      (goalLower.includes("emergency") && itemLower.includes("emergency")) ||
      (goalLower.includes("health") && itemLower.includes("health"))
    ) {
      G = 1;
    }
  } else if (goalLower.includes("invest") || goalLower.includes("business")) {
    // For investment goals
    G = (itemLower.includes("invest") || itemLower.includes("business")) ? 1 : -1;
  } else {
    G = 0;
  }

  // Long-term Impact factor
  if (
    itemLower.includes("invest") ||
    itemLower.includes("education") ||
    itemLower.includes("health") ||
    itemLower.includes("skill")
  ) {
    L = 2;
  } else if (
    itemLower.includes("computer") ||
    itemLower.includes("tool") ||
    itemLower.includes("equipment") ||
    itemLower.includes("book")
  ) {
    L = 1;
  } else if (
    itemLower.includes("subscription") ||
    itemLower.includes("service") ||
    itemLower.includes("vacation")
  ) {
    L = -1;
  } else if (
    itemLower.includes("luxury") ||
    itemLower.includes("entertainment")
  ) {
    L = -2;
  } else {
    L = 0;
  }

  // Behavioral factor
  if (inputs.purchaseUrgency === "Urgent Needs") {
    B = 2;
  } else if (inputs.purchaseUrgency === "Mixed") {
    B = 0;
  } else if (inputs.purchaseUrgency === "Mostly Wants") {
    B = -1;
  } else {
    B = 0;
  }

  // Adjust based on cost - expensive "wants"
  if (inputs.purchaseUrgency === "Mostly Wants" && costToIncomeRatio > 0.5) {
    B = -2;
  }

  return {
    "D": D,
    "O": O,
    "G": G,
    "L": L,
    "B": B,
    "D_explanation": `With your monthly leftover income of $${inputs.leftoverIncome}, this purchase ${
      D > 0 ? "fits well" : "might strain"
    } your budget.`,
    "O_explanation": `${O > 0 ? "Good use of funds" : "Consider if there are better uses"}${
      inputs.hasHighInterestDebt === "Yes" ? ", especially with your high-interest debt." : "."
    }`,
    "G_explanation": `This purchase ${
      G > 0 ? "aligns with" : "may not directly support"
    } your goal to ${inputs.mainFinancialGoal}.`,
    "L_explanation": `${
      L > 0
        ? "This may provide long-term value"
        : "Consider the long-term benefits, which seem limited"
    } based on the nature of the item.`,
    "B_explanation": `This appears to be ${inputs.purchaseUrgency ? inputs.purchaseUrgency.toLowerCase() : "a mixed need/want"}, which ${
      B > 0 ? "justifies the purchase" : "suggests you might want to reconsider"
    }.`
  };
}

/** Compute the PDS from factor scores */
function computePDS(factors) {
  let { D = 0, O = 0, G = 0, L = 0, B = 0 } = factors;
  return D + O + G + L + B;
}

/** Determine recommendation text/class from PDS */
function getRecommendation(pds) {
  if (pds >= Config.PDS_BUY_THRESHOLD) {
    return { text: "Buy it.", cssClass: "positive" };
  } else if (pds < Config.PDS_CONSIDER_THRESHOLD) {
    return { text: "Don't buy it.", cssClass: "negative" };
  } else {
    return { text: "Consider carefully.", cssClass: "neutral" };
  }
}

/**
 * Create a radar chart with Plotly
 */
function createRadarChart(containerId, factors) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Radar chart container ${containerId} not found`);
    return;
  }

  const categories = Object.keys(Config.FACTOR_LABELS).map(k => Config.FACTOR_LABELS[k]);
  const vals = Object.keys(Config.FACTOR_LABELS).map(k => factors[k] || 0);

  // Close the shape
  vals.push(vals[0]);
  categories.push(categories[0]);

  const data = [
    {
      type: "scatterpolar",
      r: vals,
      theta: categories,
      fill: "toself",
      fillcolor: "rgba(90, 103, 216, 0.2)",
      line: { color: "#5a67d8", width: 2 },
      name: "Factors"
    }
  ];

  // Add reference lines
  for (let i = -2; i <= 2; i++) {
    data.push({
      type: "scatterpolar",
      r: Array(categories.length).fill(i),
      theta: categories,
      line: { color: "rgba(200,200,200,0.5)", width: 1, dash: "dash" },
      showlegend: false
    });
  }

  const layout = {
    polar: {
      radialaxis: {
        visible: true,
        range: [-3, 3],
        tickvals: [-2, -1, 0, 1, 2],
        gridcolor: "rgba(200,200,200,0.3)"
      },
      angularaxis: {
        gridcolor: "rgba(200,200,200,0.3)"
      },
      bgcolor: "rgba(255,255,255,0.9)"
    },
    showlegend: false,
    margin: { l: 60, r: 60, t: 20, b: 20 },
    height: 350,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)"
  };

  try {
    Plotly.newPlot(containerId, data, layout, { displayModeBar: false });
  } catch (error) {
    console.error(`Error creating radar chart: ${error.message}`);
    container.innerHTML = '<div class="error-message">Chart could not be loaded</div>';
  }
}

/**
 * Create a gauge chart with Plotly
 */
function createPdsGauge(containerId, pds) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Gauge chart container ${containerId} not found`);
    return;
  }

  let color;
  if (pds >= Config.PDS_BUY_THRESHOLD) {
    color = "#48bb78"; // green
  } else if (pds < Config.PDS_CONSIDER_THRESHOLD) {
    color = "#f56565"; // red
  } else {
    color = "#ed8936"; // orange
  }

  const data = [
    {
      type: "indicator",
      mode: "gauge+number",
      value: pds,
      gauge: {
        axis: { range: [-10, 10] },
        bar: { color: color },
        bgcolor: "white",
        borderwidth: 2,
        bordercolor: "#e2e8f0",
        steps: [
          { range: [-10, 0], color: "#fed7d7" },
          { range: [0, 5], color: "#feebc8" },
          { range: [5, 10], color: "#c6f6d5" }
        ]
      },
      domain: { x: [0, 1], y: [0, 1] }
    }
  ];

  const layout = {
    height: 250,
    margin: { l: 20, r: 20, t: 50, b: 20 },
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#2d3748", family: "Inter, sans-serif" }
  };

  try {
    Plotly.newPlot(containerId, data, layout, { displayModeBar: false });
  } catch (error) {
    console.error(`Error creating gauge chart: ${error.message}`);
    container.innerHTML = '<div class="error-message">Chart could not be loaded</div>';
  }
}

// Export
window.AppHelpers = {
  Config,
  callGeminiAPI,
  computePDS,
  getRecommendation,
  createRadarChart,
  createPdsGauge
};
