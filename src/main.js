/***************************************************************
 * main.js
 *
 * Main application logic with enhanced functionality
 * - Basic screen has image upload that calls Gemini
 * - If user leaves item name/cost blank, we fill them from Gemini
 * - Then we do the "Should I Buy It?" factor analysis
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const {
    callGeminiAPI,
    computePDS,
    getRecommendation,
    createRadarChart,
    createPdsGauge,
    Config
  } = window.AppHelpers || {};

  // DOM references
  const navBasicBtn = document.getElementById("nav-basic");
  const basicSection = document.getElementById("basic-section");
  const basicForm = document.getElementById("basic-form");
  const basicResultDiv = document.getElementById("basic-result");

  initializeTooltips();

  // Basic Form
  if (basicForm) {
    initializeFormValidation(basicForm);
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!basicForm.checkValidity()) {
        showValidationMessages(basicForm);
        return;
      }
      basicResultDiv.innerHTML = renderLoadingState();

      try {
        // Gather user inputs
        let itemName = document.getElementById("basic-item-name").value.trim() || "Unnamed";
        let itemCost = parseFloat(document.getElementById("basic-item-cost").value) || 0;

        // Check for image
        const fileInput = document.getElementById("basic-item-image");
        let imageBase64 = "";
        if (fileInput && fileInput.files && fileInput.files[0]) {
          imageBase64 = await toBase64(fileInput.files[0]);
        }

        // Provide default values
        const leftoverIncome = Math.max(1000, itemCost * 2);
        const hasHighInterestDebt = "No";
        const mainFinancialGoal = "Save for emergencies";
        const purchaseUrgency = "Mixed";

        // Get profile data if available
        let profileData = null;
        try {
          if (window.UserProfile && typeof window.UserProfile.getUserFinancialProfile === 'function') {
            profileData = window.UserProfile.getUserFinancialProfile();
          }
        } catch (e) {
          console.error("Error loading user profile:", e);
        }

        // Use profile data if available
        const userLeftoverIncome = profileData?.disposableIncome || 
                                  (profileData?.monthlyIncome && profileData?.monthlyExpenses ? 
                                    parseFloat(profileData.monthlyIncome) - parseFloat(profileData.monthlyExpenses) : 
                                    leftoverIncome);
        
        const userHasDebt = profileData?.highInterestDebt && parseFloat(profileData.highInterestDebt) > 0 ? 
                            "Yes" : "No";
        
        const userGoal = profileData?.financialGoal || mainFinancialGoal;

        // Call the Gemini-based analysis
        const factors = await callGeminiAPI({
          leftoverIncome: userLeftoverIncome,
          hasHighInterestDebt: userHasDebt,
          mainFinancialGoal: userGoal,
          purchaseUrgency,
          itemName,
          itemCost,
          imageBase64
        });

        // Compute PDS
        const pds = computePDS(factors);
        const { text: recText, cssClass: recClass } = getRecommendation(pds);

        // Render
        basicResultDiv.innerHTML = `
          <div class="analysis-result">
            ${renderItemCard(factors.itemName || itemName, factors.itemCost || itemCost)}
            <div class="result-grid">
              <div class="result-column decision-column">
                ${renderDecisionBox(pds, recText, recClass)}
                <div class="gauge-container" id="basic-gauge"></div>
              </div>
              <div class="result-column factors-column">
                <h3>Factor Analysis</h3>
                <div class="radar-container" id="basic-radar"></div>
                <div id="basic-factors"></div>
              </div>
            </div>
          </div>
        `;

        // Factor details
        const factorsDiv = document.getElementById("basic-factors");
        factorsDiv.innerHTML = `<h3>Decision Factors</h3>`;
        for (const factor of ["D","O","G","L","B"]) {
          const val = factors[factor] || 0;
          factorsDiv.innerHTML += renderFactorCard(factor, val, Config.FACTOR_LABELS[factor]);
          const explanationKey = factor + "_explanation";
          if (factors[explanationKey]) {
            factorsDiv.innerHTML += `<div class="factor-explanation">${factors[explanationKey]}</div>`;
          }
        }

        // Plotly
        setTimeout(() => {
          createRadarChart("basic-radar", factors);
          createPdsGauge("basic-gauge", pds);
          document.querySelector(".analysis-result")?.classList.add("result-animated");
        }, 100);
      } catch (err) {
        console.error("Error in basic analysis:", err);
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

  // URL share
  loadFromUrlParams();
});

/***************************************************************
 * Additional Helpers
 ***************************************************************/

// Convert file => Base64
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

function initializeTooltips() {
  // Initialize tooltips if needed
}

function initializeFormValidation(form) {
  form.querySelectorAll("input, select, textarea").forEach(el => {
    if (!el.hasAttribute("data-optional")) {
      el.setAttribute("required", "");
    }
    el.addEventListener("invalid", function() {
      this.classList.add("invalid");
    });
    el.addEventListener("input", function() {
      this.classList.remove("invalid");
      if (this.validity.valid) {
        this.classList.add("valid");
      } else {
        this.classList.remove("valid");
      }
    });
  });
}

function showValidationMessages(form) {
  const firstInvalid = form.querySelector(":invalid");
  if (firstInvalid) {
    firstInvalid.focus();
    firstInvalid.classList.add("invalid-shake");
    setTimeout(() => {
      firstInvalid.classList.remove("invalid-shake");
    }, 600);
  }
}

function loadFromUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const item = urlParams.get("item");
  const score = urlParams.get("score");
  if (item && score) {
    const banner = document.createElement("div");
    banner.className = "shared-result-banner";
    banner.innerHTML = `
      <div class="shared-result-content">
        <h3>Shared Result</h3>
        <p>You're viewing a shared decision for <strong>${item}</strong> with a score of <strong>${score}</strong>.</p>
        <button class="create-own-btn" onclick="clearSharedResult()">Create Your Own</button>
      </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    const basicItemField = document.getElementById("basic-item-name");
    if (basicItemField) basicItemField.value = item;
  }
}

window.clearSharedResult = function () {
  const banner = document.querySelector(".shared-result-banner");
  if (banner) banner.remove();
  window.history.replaceState({}, document.title, window.location.pathname);
};

function renderLoadingState() {
  return `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <h3>Analyzing with Munger AI + Gemini...</h3>
      <p>Please wait while we identify your item and calculate your decision score.</p>
    </div>
  `;
}

// Renders a small card showing the item + cost
function renderItemCard(name, cost) {
  let icon = "🛍️";
  if (cost >= 5000) icon = "💰";
  else if (cost >= 1000) icon = "💼";

  const lower = (name || "").toLowerCase();
  if (lower.includes("house") || lower.includes("home")) icon = "🏠";
  else if (lower.includes("car") || lower.includes("vehicle")) icon = "🚗";
  else if (lower.includes("laptop") || lower.includes("computer")) icon = "💻";

  return `
    <div class="item-card">
      <div class="item-icon">${icon}</div>
      <div class="item-details">
        <div class="item-name">${name}</div>
      </div>
      <div class="item-cost">
        $${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  `;
}

function renderDecisionBox(pds, recText, recClass) {
  let desc = "";
  if (pds >= 7) desc = "This looks like a great purchase!";
  else if (pds >= 5) desc = "This purchase aligns with your financial goals.";
  else if (pds >= 0) desc = "This purchase requires more consideration.";
  else if (pds >= -5) desc = "This purchase may not be advisable right now.";
  else desc = "This purchase is strongly discouraged.";

  return `
    <div class="decision-box">
      <h2>Purchase Decision Score</h2>
      <div class="score">${pds}</div>
      <div class="recommendation ${recClass}">${recText}</div>
      <p class="score-description">${desc}</p>
    </div>
  `;
}

function renderFactorCard(factor, value, desc) {
  let valClass = "neutral";
  if (value > 0) valClass = "positive";
  if (value < 0) valClass = "negative";

  return `
    <div class="factor-card">
      <div class="factor-letter">${factor}</div>
      <div class="factor-description">${desc}</div>
      <div class="factor-value ${valClass}">
        ${value > 0 ? "+" + value : value}
      </div>
    </div>
  `;
}
