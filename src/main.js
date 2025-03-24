/***************************************************************
 * main.js
 *
 * Main logic for basic tool:
 *  1) Optionally call Gemini to parse item image.
 *  2) Show final decision: "Strong Buy" or "Don't Buy."
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const { callGeminiAPI } = window.AppHelpers || {};

  const basicForm = document.getElementById("basic-form");
  const basicResultDiv = document.getElementById("basic-result");

  if (basicForm) {
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Quick validation
      const itemName = document.getElementById("basic-item-name").value.trim() || "Unnamed";
      const itemCost = parseFloat(document.getElementById("basic-item-cost").value) || 0;

      // Check for an image
      const fileInput = document.getElementById("basic-item-image");
      let imageBase64 = "";
      if (fileInput && fileInput.files && fileInput.files[0]) {
        imageBase64 = await toBase64(fileInput.files[0]);
      }

      // Optionally load user profile
      let leftoverIncome = 2000;
      let hasHighInterestDebt = "No";
      try {
        if (window.UserProfile && typeof window.UserProfile.getUserFinancialProfile === 'function') {
          const profileData = window.UserProfile.getUserFinancialProfile();
          if (profileData?.disposableIncome) {
            leftoverIncome = parseFloat(profileData.disposableIncome);
          }
          if (profileData?.highInterestDebt && parseFloat(profileData.highInterestDebt) > 0) {
            hasHighInterestDebt = "Yes";
          }
        }
      } catch (error) {
        console.error("Error retrieving user profile:", error);
      }

      // Show loading
      basicResultDiv.innerHTML = renderLoadingState();

      try {
        // Decide
        const finalData = await callGeminiAPI({
          itemName,
          itemCost,
          imageBase64,
          leftoverIncome,
          hasHighInterestDebt
        });

        // Show final decision
        basicResultDiv.innerHTML = `
          <div class="analysis-result">
            <h3>Item: ${finalData.itemName || "Unnamed"}</h3>
            <p>Estimated Cost: $${finalData.itemCost?.toFixed(2) || 0}</p>
            <div class="decision-box">
              <h2 class="recommendation ${
                finalData.finalDecision === "Strong Buy" ? "positive" : "negative"
              }">${finalData.finalDecision}</h2>
            </div>
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
});

/** Convert file => Base64 */
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

/** Loading state HTML */
function renderLoadingState() {
  return `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <h3>Analyzing...</h3>
      <p>One moment while we generate your recommendation.</p>
    </div>
  `;
}
