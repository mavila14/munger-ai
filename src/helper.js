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
    let recognizedImage = false;
    
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

      // If user typed no name, fill with recognized results
      if ((!inputs.itemName || inputs.itemName === "Unnamed") && data.name && data.name !== "Unknown") {
        inputs.itemName = data.name;
        recognizedImage = true;
      }
      
      // If user provided no cost or zero cost, use the AI-detected cost
      if ((!inputs.itemCost || inputs.itemCost <= 0) && data.cost) {
        inputs.itemCost = data.cost;
        recognizedImage = true;
      }
    }

    // Generate an explanation and final decision
    return decideWithExplanation(inputs, recognizedImage);
  } catch (error) {
    console.error("Error calling Gemini AI, falling back to user data:", error);
    return decideWithExplanation(inputs, false);
  }
}

/**
 * Makes the decision and generates an explanation
 * - If user has high-interest debt => "Don't Buy"
 * - Else if (cost / leftoverIncome < 0.3) => "Buy"
 * - Otherwise => "Don't Buy"
 */
function decideWithExplanation(inputs, recognizedImage) {
  const { itemName = "Unnamed Item", itemCost = 0, leftoverIncome = 1, hasHighInterestDebt = "No" } = inputs;
  let finalDecision = "Don't Buy";
  let explanation = "";
  
  // Generate explanations based on decision factors
  if (hasHighInterestDebt === "Yes") {
    finalDecision = "Don't Buy";
    explanation = `Pay off your high-interest debt before purchasing this ${itemName}.`;
  } else {
    const ratio = itemCost / leftoverIncome;
    const percentOfIncome = Math.round(ratio * 100);
    
    if (ratio < Config.BUY_RATIO_THRESHOLD) {
      finalDecision = "Buy";
      explanation = `This ${itemName} costs only ${percentOfIncome}% of your monthly disposable income.`;
    } else {
      finalDecision = "Don't Buy";
      explanation = `This ${itemName} costs ${percentOfIncome}% of your monthly disposable income, which exceeds our recommended threshold.`;
    }
  }
  
  // Include info about AI recognition if applicable
  if (recognizedImage) {
    explanation = `AI recognized a ${itemName}. ${explanation}`;
  }

  return {
    finalDecision,
    explanation,
    ...inputs
  };
}

// Attach to window
window.AppHelpers = {
  callGeminiAPI
};
