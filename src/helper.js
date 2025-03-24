/***************************************************************
 * helper.js
 *
 * Advanced version:
 * 1) We call /api/analyze-image if an image is provided (Gemini).
 * 2) We produce a final decision: "Buy" or "Don't Buy" using a sophisticated
 *    multi-factor financial algorithm.
 ***************************************************************/

const Config = {
  // Financial thresholds for decision algorithm
  DEBT_TO_INCOME_MAX: 0.36, // 36% DTI ratio is standard financial advice
  HIGH_INTEREST_DEBT_THRESHOLD: 0, // Any high-interest debt is a red flag
  EMERGENCY_FUND_MONTHS_MIN: 3, // At least 3 months of expenses in emergency fund
  DISCRETIONARY_SPENDING_MAX: 0.30, // 30% of discretionary income is max for luxury purchases
  NECESSITIES_SPENDING_MAX: 0.15, // 15% of necessities income for essential purchases
  
  // Weights for the scoring model
  WEIGHTS: {
    DEBT_FACTOR: 0.30,
    SAVINGS_FACTOR: 0.25,
    INCOME_FACTOR: 0.25,
    NECESSITY_FACTOR: 0.20
  }
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
    return advancedDecisionAlgorithm(inputs, recognizedImage);
  } catch (error) {
    console.error("Error calling Gemini AI, falling back to user data:", error);
    return advancedDecisionAlgorithm(inputs, false);
  }
}

/**
 * Advanced Decision Algorithm that evaluates multiple financial factors
 * to provide a nuanced recommendation based on:
 * 1. Debt situation (high-interest & total debt burden)
 * 2. Emergency fund adequacy
 * 3. Income stability & disposable income
 * 4. Item necessity vs. luxury
 * 5. Current financial priorities
 */
function advancedDecisionAlgorithm(inputs, recognizedImage) {
  // Extract all inputs with defaults
  const { 
    itemName = "Unnamed Item",
    itemCost = 0,
    leftoverIncome = 1000, // Default disposable income
    hasHighInterestDebt = "No",
    // Optional extended profile data fields
    monthlyIncome = 4000, // Default monthly income assumption
    monthlyExpenses = 3000, // Default monthly expenses assumption
    emergencyFund = 0,
    financialGoal = "", // User's primary financial goal
    highInterestDebt = 0,
    lowInterestDebt = 0,
    monthlySavings = 0
  } = inputs;

  // Calculate derived financial metrics
  const totalDebt = parseFloat(highInterestDebt) + parseFloat(lowInterestDebt);
  const debtToIncomeRatio = totalDebt > 0 ? totalDebt / (parseFloat(monthlyIncome) * 12) : 0;
  const emergencyFundMonths = parseFloat(monthlyExpenses) > 0 ? 
    parseFloat(emergencyFund) / parseFloat(monthlyExpenses) : 0;
  
  // Purchase as percentage of disposable income
  const disposableIncomeRatio = parseFloat(leftoverIncome) > 0 ? 
    parseFloat(itemCost) / parseFloat(leftoverIncome) : 1;
    
  // Detection of item necessity (simplified approximation based on keywords)
  const necessityKeywords = [
    'refrigerator', 'stove', 'oven', 'microwave', 'heating', 'cooling', 'laptop', 'computer', 
    'medicine', 'phone', 'mattress', 'bed', 'chair', 'desk', 'glasses', 'contacts', 'shoes',
    'coat', 'jacket', 'winter', 'washer', 'dryer', 'cookware', 'pan', 'pot'
  ];
  
  // Check if this appears to be a necessity rather than luxury
  const isNecessity = necessityKeywords.some(keyword => 
    itemName.toLowerCase().includes(keyword));
    
  // Initialize scoring factors
  let debtFactor = 1.0;
  let savingsFactor = 1.0;
  let incomeFactor = 1.0;
  let necessityFactor = 1.0;
  
  // 1. Debt evaluation - lower score for concerning debt
  if (hasHighInterestDebt === "Yes" || parseFloat(highInterestDebt) > Config.HIGH_INTEREST_DEBT_THRESHOLD) {
    // Significant negative impact if high-interest debt exists
    debtFactor = 0.2;
  } else if (debtToIncomeRatio > Config.DEBT_TO_INCOME_MAX) {
    // Reduced factor if overall debt burden is high
    debtFactor = 0.4;
  } else if (totalDebt > 0) {
    // Small reduction for any debt
    debtFactor = 0.8;
  }
  
  // 2. Savings evaluation - emergency fund status
  if (emergencyFundMonths < 1) {
    // Critical low emergency fund
    savingsFactor = 0.2;
  } else if (emergencyFundMonths < Config.EMERGENCY_FUND_MONTHS_MIN) {
    // Below recommended minimum emergency fund
    savingsFactor = 0.5;
  } else if (emergencyFundMonths >= Config.EMERGENCY_FUND_MONTHS_MIN * 2) {
    // Extra boost for very strong emergency fund
    savingsFactor = 1.2;
  }
  
  // 3. Income evaluation - based on purchase to disposable income ratio
  const incomeThreshold = isNecessity ? 
    Config.NECESSITIES_SPENDING_MAX : 
    Config.DISCRETIONARY_SPENDING_MAX;
    
  if (disposableIncomeRatio > incomeThreshold * 2) {
    // Way too expensive for income
    incomeFactor = 0.1;
  } else if (disposableIncomeRatio > incomeThreshold) {
    // Too expensive relative to income
    incomeFactor = 0.4;
  } else if (disposableIncomeRatio > incomeThreshold * 0.5) {
    // Moderately affordable
    incomeFactor = 0.8;
  } else {
    // Very affordable
    incomeFactor = 1.2;
  }
  
  // 4. Necessity vs luxury factor
  necessityFactor = isNecessity ? 1.3 : 0.8;
  
  // 5. Apply goal-based adjustments
  if (financialGoal === "pay-off-debt" && totalDebt > 0) {
    // Further reduce all factors if paying off debt is the priority
    debtFactor *= 0.7;
    savingsFactor *= 0.9;
  } else if (financialGoal === "emergency-fund" && emergencyFundMonths < Config.EMERGENCY_FUND_MONTHS_MIN) {
    // Reduce factors if building emergency fund is the priority
    savingsFactor *= 0.7;
  }
  
  // Calculate weighted final score
  const finalScore = (
    debtFactor * Config.WEIGHTS.DEBT_FACTOR +
    savingsFactor * Config.WEIGHTS.SAVINGS_FACTOR +
    incomeFactor * Config.WEIGHTS.INCOME_FACTOR +
    necessityFactor * Config.WEIGHTS.NECESSITY_FACTOR
  );
  
  // Decision threshold
  const DECISION_THRESHOLD = 0.65;
  const finalDecision = finalScore >= DECISION_THRESHOLD ? "Buy" : "Don't Buy";

  // Prepare detailed explanation
  let explanation = generateExplanation({
    finalDecision,
    debtFactor,
    savingsFactor, 
    incomeFactor,
    necessityFactor,
    isNecessity,
    hasHighInterestDebt,
    emergencyFundMonths,
    itemName,
    disposableIncomeRatio,
    recognizedImage,
    financialGoal
  });

  // Debugging information
  console.log("Decision factors:", {
    debtFactor,
    savingsFactor,
    incomeFactor,
    necessityFactor,
    finalScore,
    isNecessity
  });

  return {
    finalDecision,
    explanation,
    finalScore: Math.round(finalScore * 100) / 100,
    ...inputs
  };
}

/**
 * Generates a human-friendly explanation for the decision
 */
function generateExplanation(factors) {
  const {
    finalDecision,
    debtFactor,
    savingsFactor,
    incomeFactor,
    necessityFactor,
    isNecessity,
    hasHighInterestDebt,
    emergencyFundMonths,
    itemName,
    disposableIncomeRatio,
    recognizedImage,
    financialGoal
  } = factors;
  
  // Format percentage for disposable income
  const percentOfIncome = Math.round(disposableIncomeRatio * 100);
  
  let explanation = recognizedImage 
    ? `AI recognized this as a ${itemName}. `
    : "";
    
  // Primary factor determination (lowest factor has biggest impact on decision)
  const lowestFactor = Math.min(debtFactor, savingsFactor, incomeFactor);
  
  if (lowestFactor === debtFactor && debtFactor < 0.5) {
    // Debt is the main concern
    if (hasHighInterestDebt === "Yes") {
      explanation += `It's best to pay off your high-interest debt before purchasing this ${itemName}.`;
    } else {
      explanation += `Your overall debt level suggests focusing on debt reduction before this purchase.`;
    }
  } else if (lowestFactor === savingsFactor && savingsFactor < 0.5) {
    // Emergency fund is the main concern
    if (emergencyFundMonths < 1) {
      explanation += `Building at least a 1-month emergency fund should take priority over buying this ${itemName}.`;
    } else {
      explanation += `Consider building your emergency fund to ${Config.EMERGENCY_FUND_MONTHS_MIN} months before this purchase.`;
    }
  } else if (lowestFactor === incomeFactor && incomeFactor < 0.5) {
    // Affordability is the main concern
    explanation += `This ${itemName} costs ${percentOfIncome}% of your monthly disposable income, which is more than recommended.`;
  } else if (finalDecision === "Buy") {
    // Explain the positive decision
    if (isNecessity) {
      explanation += `This ${itemName} appears to be a necessity and is financially reasonable at ${percentOfIncome}% of your disposable income.`;
    } else {
      explanation += `This ${itemName} fits comfortably within your budget at ${percentOfIncome}% of your disposable income.`;
    }
  } else {
    // General negative explanation if no specific factor dominates
    explanation += `Based on your overall financial situation, this ${itemName} purchase may not be the best use of funds right now.`;
  }
  
  // Add financial goal context if relevant
  if (financialGoal === "pay-off-debt" && finalDecision === "Don't Buy") {
    explanation += " Your goal of paying off debt should take priority.";
  } else if (financialGoal === "emergency-fund" && finalDecision === "Don't Buy") {
    explanation += " Building your emergency fund remains your stated priority.";
  }
  
  return explanation;
}

// Attach to window
window.AppHelpers = {
  callGeminiAPI
};
