/***************************************************************
 * helper.js
 *
 * Contains logic for factor computations, PDS, and calls to
 * the .api/AnalyzeImage function for real Gemini-based image detection.
 ***************************************************************/

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
 * Main function to call "Gemini" or fallback logic.
 * If `inputs.imageBase64` is provided, we attempt a real Gemini call
 * to /api/analyze-image to detect item name & cost. Then we proceed with
 * normal factor calculations.
 */
async function callGeminiAPI(inputs) {
  try {
    // If there's an image, let's call the serverless function to do real Gemini detection
    if (inputs.imageBase64) {
      console.log("Calling Gemini AI with image...");
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: inputs.imageBase64 })
      });
      
      if (!response.ok) {
        throw new Error(`AnalyzeImage call failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Gemini AI response:", data);

      // If user typed a name/cost, that takes priority over the recognized version
      if ((!inputs.itemName || inputs.itemName === "Unnamed") && data.name) {
        inputs.itemName = data.name;
      }
      if ((!inputs.itemCost || inputs.itemCost <= 0) && data.cost) {
        inputs.itemCost = data.cost;
      }
    }

    // Now do the factor computations
    return getFallbackAnalysis(inputs);
  } catch (error) {
    console.error("Error calling Gemini image detection, falling back:", error);
    // Fallback if the image call fails for any reason
    return getFallbackAnalysis(inputs);
  }
}

/**
 * The factor analysis / fallback logic is still used
 * once we have the final itemName & itemCost.
 */
function getFallbackAnalysis(inputs) {
  console.log("Running factor analysis on:", inputs);

  let D = 0;
  let O = 0;
  let G = 0;
  let L = 0;
  let B = 0;

  const costToIncomeRatio = inputs.itemCost / (inputs.leftoverIncome || 1000);
  if (costToIncomeRatio < 0.1) D = 2;
  else if (costToIncomeRatio < 0.25) D = 1;
  else if (costToIncomeRatio < 0.5) D = 0;
  else if (costToIncomeRatio < 1) D = -1;
  else D = -2;

  if (inputs.hasHighInterestDebt === "Yes") {
    O = -2;
  } else {
    O = Math.min(2, Math.max(-2, 1 - Math.floor(costToIncomeRatio * 2)));
  }

  const goalLower = (inputs.mainFinancialGoal || "").toLowerCase();
  const itemLower = (inputs.itemName || "").toLowerCase();
  if (
    goalLower.includes("emergency") ||
    goalLower.includes("debt") ||
    goalLower.includes("save")
  ) {
    G = -1;
    if (
      (goalLower.includes("emergency") && itemLower.includes("emergency")) ||
      (goalLower.includes("health") && itemLower.includes("health"))
    ) {
      G = 1;
    }
  } else if (goalLower.includes("invest") || goalLower.includes("business")) {
    G = (itemLower.includes("invest") || itemLower.includes("business")) ? 1 : -1;
  } else {
    G = 0;
  }

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

  if (inputs.purchaseUrgency === "Urgent Needs") B = 2;
  else if (inputs.purchaseUrgency === "Mixed") B = 0;
  else if (inputs.purchaseUrgency === "Mostly Wants") B = -1;
  else B = 0;

  if (inputs.purchaseUrgency === "Mostly Wants" && costToIncomeRatio > 0.5) {
    B = -2;
  }

  return {
    ...inputs, // include itemName, itemCost, etc. for the front-end
    D,
    O,
    G,
    L,
    B,
    "D_explanation": `With your monthly leftover income of $${inputs.leftoverIncome}, this purchase ${
      D > 0 ? "fits well" : "might strain"
    } your budget.`,
    "O_explanation": `${O > 0 ? "Good use of funds" : "Consider better uses"}${
      inputs.hasHighInterestDebt === "Yes" ? ", especially with high-interest debt." : "."
    }`,
    "G_explanation": `This purchase ${
      G > 0 ? "aligns with" : "may not directly support"
    } your goal to ${inputs.mainFinancialGoal}.`,
    "L_explanation": `${
      L > 0 ? "Could provide long-term value" : "Consider the limited long-term benefits"
    } based on the item type.`,
    "B_explanation": `This appears to be ${inputs.purchaseUrgency?.toLowerCase() || "a mixed need/want"}, which ${
      B > 0 ? "justifies" : "suggests reconsideration of"
    } the purchase.`
  };
}

/** Summation of factor scores => PDS */
function computePDS(factors) {
  const { D=0, O=0, G=0, L=0, B=0 } = factors;
  return D + O + G + L + B;
}

/** Determine recommendation from PDS */
function getRecommendation(pds) {
  if (pds >= Config.PDS_BUY_THRESHOLD) {
    return { text: "Buy it.", cssClass: "positive" };
  } else if (pds < Config.PDS_CONSIDER_THRESHOLD) {
    return { text: "Don't buy it.", cssClass: "negative" };
  } else {
    return { text: "Consider carefully.", cssClass: "neutral" };
  }
}

/** Plotly chart: Radar */
function createRadarChart(containerId, factors) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const categories = Object.keys(Config.FACTOR_LABELS).map(k => Config.FACTOR_LABELS[k]);
  const vals = Object.keys(Config.FACTOR_LABELS).map(k => factors[k] || 0);
  vals.push(vals[0]);
  categories.push(categories[0]);

  const data = [{
    type: "scatterpolar",
    r: vals,
    theta: categories,
    fill: "toself",
    fillcolor: "rgba(90, 103, 216, 0.2)",
    line: { color: "#5a67d8", width: 2 }
  }];

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
        tickvals: [-2, -1, 0, 1, 2]
      }
    },
    showlegend: false,
    margin: { l: 60, r: 60, t: 20, b: 20 },
    height: 350,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)"
  };

  Plotly.newPlot(containerId, data, layout, { displayModeBar: false });
}

/** Plotly chart: Gauge */
function createPdsGauge(containerId, pds) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let color;
  if (pds >= Config.PDS_BUY_THRESHOLD) color = "#48bb78";
  else if (pds < Config.PDS_CONSIDER_THRESHOLD) color = "#f56565";
  else color = "#ed8936";

  const data = [{
    type: "indicator",
    mode: "gauge+number",
    value: pds,
    gauge: {
      axis: { range: [-10, 10] },
      bar: { color },
      steps: [
        { range: [-10, 0], color: "#fed7d7" },
        { range: [0, 5], color: "#feebc8" },
        { range: [5, 10], color: "#c6f6d5" }
      ]
    },
    domain: { x: [0, 1], y: [0, 1] }
  }];

  const layout = {
    height: 250,
    margin: { l: 20, r: 20, t: 50, b: 20 },
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#2d3748" }
  };

  Plotly.newPlot(containerId, data, layout, { displayModeBar: false });
}

// Attach to window
window.AppHelpers = {
  Config,
  callGeminiAPI,
  computePDS,
  getRecommendation,
  createRadarChart,
  createPdsGauge
};
