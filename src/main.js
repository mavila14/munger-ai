/***************************************************************
 * main.js
 *
 * Main application logic with enhanced functionality
 * - Basic screen has image upload that calls Gemini
 * - If user leaves item name/cost blank, we fill them from Gemini
 * - Then we do the "Should I Buy It?" factor analysis
 * - Added microinteractions and animations for better UX
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
  const navProfileBtn = document.getElementById("nav-profile");
  const basicSection = document.getElementById("basic-section");
  const basicForm = document.getElementById("basic-form");
  const basicResultDiv = document.getElementById("basic-result");

  initializeTooltips();
  initializeAnimations();

  // Basic Form
  if (basicForm) {
    initializeFormValidation(basicForm);
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!basicForm.checkValidity()) {
        showValidationMessages(basicForm);
        return;
      }
      
      // Show submit animation
      showSubmitAnimation();
      
      // Show loading state with delay for smooth transition
      setTimeout(() => {
        basicResultDiv.innerHTML = renderLoadingState();
      }, 500);

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

        // Plotly - with delay for smoother animation
        setTimeout(() => {
          createRadarChart("basic-radar", factors);
          createPdsGauge("basic-gauge", pds);
          document.querySelector(".analysis-result")?.classList.add("result-animated");
        }, 300);
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

// Initialize microinteractions and animations
function initializeAnimations() {
  // Add ripple effect to buttons
  document.querySelectorAll('.submit-btn, .action-btn').forEach(button => {
    button.addEventListener('click', createRippleEffect);
  });
  
  // Add hover animation to cards
  document.querySelectorAll('.item-card, .factor-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-5px)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
    });
  });
  
  // Add input focus effects
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('focus', () => {
      input.closest('.form-group')?.classList.add('input-focus');
    });
    input.addEventListener('blur', () => {
      input.closest('.form-group')?.classList.remove('input-focus');
    });
  });
}

// Create ripple effect on button click
function createRippleEffect(event) {
  const button = event.currentTarget;
  const circle = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.getBoundingClientRect().left - diameter / 2}px`;
  circle.style.top = `${event.clientY - button.getBoundingClientRect().top - diameter / 2}px`;
  circle.classList.add('ripple');
  
  const ripple = button.getElementsByClassName('ripple')[0];
  if (ripple) {
    ripple.remove();
  }
  
  button.appendChild(circle);
}

// Show submit animation
function showSubmitAnimation() {
  const successOverlay = document.createElement('div');
  successOverlay.className = 'form-submit-success';
  successOverlay.innerHTML = `
    <div class="success-checkmark">
      <i class="fas fa-check"></i>
    </div>
  `;
  
  document.body.appendChild(successOverlay);
  
  // Remove after animation
  setTimeout(() => {
    successOverlay.remove();
  }, 2000);
}

// Convert file => Base64
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}
