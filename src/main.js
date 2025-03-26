/***************************************************************
 * main.js
 *
 * Main logic for the basic “Should I Buy It?” tool.
 * - Optionally call Gemini to parse item image => name/cost/facts.
 * - Show the final decision with explanation.
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const { callGeminiAPI } = window.AppHelpers || {};

  const basicForm = document.getElementById("basic-form");
  const basicResultDiv = document.getElementById("basic-result");
  const fileInput = document.getElementById("basic-item-image");
  // ...

  // ... Setup camera & file upload buttons ... (unchanged)

  if (basicForm) {
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // 1) Collect user inputs
      const itemNameInput = document.getElementById("basic-item-name");
      const itemCostInput = document.getElementById("basic-item-cost");
      const itemName = itemNameInput.value.trim() || "Unknown Item";
      const itemCost = parseFloat(itemCostInput.value) || 0;

      // 2) Convert the chosen file to Base64 for the Gemini API
      let imageBase64 = "";
      if (fileInput && fileInput.files && fileInput.files[0]) {
        imageBase64 = await toBase64(fileInput.files[0]);
      }

      // 3) Load or default user financial profile
      let profileData = {
        leftoverIncome: 2000,
        hasHighInterestDebt: "No",
        monthlyIncome: 4000,
        monthlyExpenses: 3000,
        emergencyFund: 6000,
        highInterestDebt: 0,
        lowInterestDebt: 0,
        monthlySavings: 500,
        financialGoal: ""
      };
      // (If you have userProfile logic, merge it in here.)

      // Show a loading spinner while we analyze
      basicResultDiv.innerHTML = renderLoadingState();

      try {
        // 4) Call the advanced logic which internally calls Gemini
        const finalData = await callGeminiAPI({
          itemName,
          itemCost,
          imageBase64,
          ...profileData
        });

        // 5) Display the results on screen (AI name, cost, facts, final decision).
        basicResultDiv.innerHTML = `
          <div class="analysis-result">
            <div class="item-details">
              <h3>${finalData.itemName || "Unknown Item"}</h3>
              <p class="item-cost">
                Estimated Cost: ${(parseFloat(finalData.itemCost) || 0).toFixed(2)}
              </p>
              ${
                finalData.itemFacts
                  ? `<p class="item-facts">${finalData.itemFacts}</p>`
                  : ""
              }
            </div>

            <div class="decision-box">
              <h2 class="recommendation ${
                finalData.finalDecision === "Buy" ? "positive" : "negative"
              }">
                ${finalData.finalDecision}
              </h2>
              <p class="ai-explanation">
                ${finalData.explanation || ""}
              </p>
            </div>

            ${renderDecisionFactors(finalData)}
          </div>
        `;
      } catch (err) {
        console.error("Error in final decision:", err);
        basicResultDiv.innerHTML = `
          <div class="error-message">
            <h3>Analysis Error</h3>
            <p>We couldn't complete your analysis. Please try again later.</p>
            <button class="retry-btn" onclick="location.reload()">Retry</button>
          </div>
        `;
      }
    });
  }
  
  /* Helper functions remain the same: toBase64, renderLoadingState, renderDecisionFactors, etc. */
});
