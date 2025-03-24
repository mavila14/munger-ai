/***************************************************************
 * helper.js
 *
 * Simplified: 
 * 1) We call /api/analyze-image if an image is provided (Gemini).
 * 2) We produce a final decision: "Buy" or "Don't Buy."
 *    - Highly simplified example logic below.
 ***************************************************************/

const Config = {
  BUY_RATIO_THRESHOLD: 0.3 // If cost-to-income ratio < 0.3 => "Buy"
};

/**
 * Calls the Gemini-based Azure Function if `imageBase64` is provided.
 * Falls back to user-provided name/cost if no image or error occurs.
 */
async function callGeminiAPI(inputs) {
  try {
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

      // If user typed no name/cost, fill with recognized results
      if ((!inputs.itemName || inputs.itemName === "Unnamed") && data.name) {
        inputs.itemName = data.name;
      }
      if ((!inputs.itemCost || inputs.itemCost <= 0) && data.cost) {
        inputs.itemCost = data.cost;
      }
    }

    // Return final decision
    return decide(inputs);
  } catch (error) {
    console.error("Error calling Gemini AI, falling back to user data:", error);
    return decide(inputs);
  }
}

/**
 * Very simple logic:
 * - If user has high-interest debt => "Don't Buy"
 * - Else if (cost / leftoverIncome < 0.3) => "Buy"
 * - Otherwise => "Don't Buy"
 */
function decide(inputs) {
  const { itemCost = 0, leftoverIncome = 1, hasHighInterestDebt = "No" } = inputs;

  if (hasHighInterestDebt === "Yes") {
    return {
      finalDecision: "Don't Buy",
      ...inputs
    };
  }

  const ratio = itemCost / leftoverIncome;
  if (ratio < Config.BUY_RATIO_THRESHOLD) {
    return {
      finalDecision: "Buy",
      ...inputs
    };
  }

  return {
    finalDecision: "Don't Buy",
    ...inputs
  };
}

// Attach to window
window.AppHelpers = {
  callGeminiAPI
};
