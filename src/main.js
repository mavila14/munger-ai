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
  const navAdvancedBtn = document.getElementById("nav-advanced");
  const basicSection = document.getElementById("basic-section");
  const advancedSection = document.getElementById("advanced-section");
  const basicForm = document.getElementById("basic-form");
  const advancedForm = document.getElementById("advanced-form");
  const basicResultDiv = document.getElementById("basic-result");
  const advancedResultDiv = document.getElementById("advanced-result");

  hideAdvancedToolIfProfileComplete();
  initializeTooltips();

  if (navBasicBtn) {
    navBasicBtn.addEventListener("click", () => {
      navBasicBtn.classList.add("active");
      if (navAdvancedBtn) navAdvancedBtn.classList.remove("active");
      basicSection.classList.remove("hidden");
      advancedSection.classList.add("hidden");
    });
  }

  if (navAdvancedBtn) {
    navAdvancedBtn.addEventListener("click", () => {
      navBasicBtn.classList.remove("active");
      navAdvancedBtn.classList.add("active");
      basicSection.classList.add("hidden");
      advancedSection.classList.remove("hidden");
    });
  }

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
        let base64Image = "";
        if (fileInput.files && fileInput.files[0]) {
          base64Image = await toBase64(fileInput.files[0]);
        }

        // Provide default leftover income
        const leftoverIncome = Math.max(1000, itemCost * 2);
        const hasHighInterestDebt = "No";
        const mainFinancialGoal = "Save for emergencies";
        const purchaseUrgency = "Mixed";

        // Call the Gemini-based analysis
        const factors = await callGeminiAPI({
          leftoverIncome,
          hasHighInterestDebt,
          mainFinancialGoal,
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

  // Advanced Form (unchanged except it also can pass an image).
  if (advancedForm) {
    initializeFormValidation(advancedForm);
    advancedForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!advancedForm.checkValidity()) {
        showValidationMessages(advancedForm);
        return;
      }
      advancedResultDiv.innerHTML = renderLoadingState();

      try {
        const itemName = document.getElementById("adv-item-name").value.trim() || "Unnamed";
        const itemCost = parseFloat(document.getElementById("adv-item-cost").value) || 0;
        const leftoverIncome = parseFloat(document.getElementById("adv-leftover-income").value) || 0;
        const hasDebt = document.getElementById("adv-debt").value;
        const mainGoal = document.getElementById("adv-goal").value;
        const urgency = document.getElementById("adv-urgency").value;
        const extraNotes = document.getElementById("adv-extra-notes").value;

        const fileInput = document.getElementById("adv-item-image");
        let base64Image = "";
        if (fileInput.files && fileInput.files[0]) {
          base64Image = await toBase64(fileInput.files[0]);
        }

        const factors = await callGeminiAPI({
          leftoverIncome,
          hasHighInterestDebt: hasDebt,
          mainFinancialGoal: mainGoal,
          purchaseUrgency: urgency,
          itemName,
          itemCost,
          extraContext: extraNotes,
          imageBase64
        });

        const pds = computePDS(factors);
        const { text: recText, cssClass: recClass } = getRecommendation(pds);

        advancedResultDiv.innerHTML = `
          <div class="analysis-result">
            ${renderItemCard(factors.itemName || itemName, factors.itemCost || itemCost)}
            <div class="result-grid">
              <div class="result-column decision-column">
                ${renderDecisionBox(pds, recText, recClass)}
                <div class="gauge-container" id="advanced-gauge"></div>
              </div>
              <div class="result-column factors-column">
                <h3>Factor Analysis</h3>
                <div class="radar-container" id="advanced-radar"></div>
                <div id="advanced-factors"></div>
              </div>
              ${
                extraNotes
                  ? `<div class="extra-context">
                      <h4>Your Additional Context</h4>
                      <p>${extraNotes}</p>
                    </div>`
                  : ""
              }
            </div>
          </div>
        `;

        const factorsDiv = document.getElementById("advanced-factors");
        factorsDiv.innerHTML = `<h3>Decision Factors</h3>`;
        for (const factor of ["D","O","G","L","B"]) {
          const val = factors[factor] || 0;
          factorsDiv.innerHTML += renderFactorCard(factor, val, Config.FACTOR_LABELS[factor]);
          const explanationKey = factor + "_explanation";
          if (factors[explanationKey]) {
            factorsDiv.innerHTML += `<div class="factor-explanation">${factors[explanationKey]}</div>`;
          }
        }

        setTimeout(() => {
          createRadarChart("advanced-radar", factors);
          createPdsGauge("advanced-gauge", pds);
          document.querySelector(".analysis-result")?.classList.add("result-animated");
        }, 100);
      } catch (err) {
        console.error("Error in advanced analysis:", err);
        advancedResultDiv.innerHTML = `
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

function hideAdvancedToolIfProfileComplete() {
  const token = localStorage.getItem("token");
  if (!token) return;
  const username = localStorage.getItem("username");
  if (!username) return;
  const profileDataStr = localStorage.getItem(`profile_${username}`);
  if (!profileDataStr) return;
  try {
    const data = JSON.parse(profileDataStr);
    if (isProfileComplete(data)) {
      const navAdv = document.getElementById("nav-advanced");
      const advSec = document.getElementById("advanced-section");
      if (navAdv) navAdv.style.display = "none";
      if (advSec) advSec.classList.add("hidden");
    }
  } catch (err) {
    console.error("Error checking profile completeness:", err);
  }
}

// Pick whichever fields must be set
function isProfileComplete(data) {
  const requiredFields = [
    "monthlyIncome","monthlyExpenses","emergencyFund","monthlySavings",
    "retirementSavings","investmentAccounts","highInterestDebt","lowInterestDebt",
    "financialGoal","riskProfile"
  ];
  for (const field of requiredFields) {
    if (!data[field] || data[field].toString().trim() === "") {
      return false;
    }
  }
  return true;
}

function initializeTooltips() {
  // If you have tooltips, define them or remove this
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
