/***************************************************************
 * main.js
 *
 * Main logic for basic tool:
 *  1) Optionally call Gemini to parse item image.
 *  2) Show final decision: "Buy" or "Don't Buy" with advanced reasoning.
 *  3) Handle camera input on mobile devices.
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const { callGeminiAPI } = window.AppHelpers || {};

  const basicForm = document.getElementById("basic-form");
  const basicResultDiv = document.getElementById("basic-result");
  const fileInput = document.getElementById("basic-item-image");
  const cameraButton = document.getElementById("camera-button");
  const uploadButton = document.getElementById("upload-button");
  const imagePreview = document.getElementById("image-preview");
  const previewImg = document.getElementById("preview-img");
  const removeImageBtn = document.getElementById("remove-image");

  // Check if the device has camera capabilities
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  
  // Setup camera and file upload buttons
  if (hasGetUserMedia) {
    cameraButton.addEventListener("click", () => {
      fileInput.setAttribute("capture", "environment");
      fileInput.click();
    });
  } else {
    cameraButton.style.display = "none";
  }

  uploadButton.addEventListener("click", () => {
    fileInput.removeAttribute("capture");
    fileInput.click();
  });

  // Handle file selection for preview
  if (fileInput) {
    fileInput.addEventListener("change", async function() {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        previewImg.src = URL.createObjectURL(file);
        imagePreview.classList.remove("hidden");
      }
    });
  }

  // Handle image removal
  if (removeImageBtn) {
    removeImageBtn.addEventListener("click", () => {
      fileInput.value = "";
      imagePreview.classList.add("hidden");
      previewImg.src = "#";
    });
  }

  if (basicForm) {
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Get values with proper validation
      const itemNameInput = document.getElementById("basic-item-name");
      const itemCostInput = document.getElementById("basic-item-cost");
      
      // Trim input values and provide proper defaults
      const itemName = itemNameInput.value.trim() || "Unknown Item";
      const itemCost = parseFloat(itemCostInput.value) || 0;

      // Check for an image
      let imageBase64 = "";
      if (fileInput && fileInput.files && fileInput.files[0]) {
        imageBase64 = await toBase64(fileInput.files[0]);
      }

      // Get user financial profile data if available
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
      
      try {
        if (window.UserProfile && typeof window.UserProfile.getUserFinancialProfile === 'function') {
          const userProfile = window.UserProfile.getUserFinancialProfile();
          if (userProfile) {
            // Override defaults with actual user data
            profileData = {
              ...profileData,
              ...userProfile
            };
            
            // Make sure we have disposable income
            if (userProfile.monthlyIncome && userProfile.monthlyExpenses) {
              profileData.leftoverIncome = parseFloat(userProfile.monthlyIncome) - parseFloat(userProfile.monthlyExpenses);
            }
            
            // Set high interest debt flag
            if (userProfile.highInterestDebt && parseFloat(userProfile.highInterestDebt) > 0) {
              profileData.hasHighInterestDebt = "Yes";
            }
          }
        }
      } catch (error) {
        console.error("Error retrieving user profile:", error);
      }

      // Show loading
      basicResultDiv.innerHTML = renderLoadingState();

      try {
        // Decide using the advanced algorithm
        const finalData = await callGeminiAPI({
          itemName,
          itemCost,
          imageBase64,
          ...profileData
        });

        // Show final decision with explanation
        basicResultDiv.innerHTML = 
          <div class="analysis-result">
            <div class="item-details">
              <h3>${finalData.itemName || "Unknown Item"}</h3>
              <p class="item-cost">Estimated Cost: ${(parseFloat(finalData.itemCost) || 0).toFixed(2)}</p>
              ${finalData.itemFacts ? <p class="item-facts">${finalData.itemFacts}</p> : ''}
            </div>
            <div class="decision-box">
              <h2 class="recommendation ${
                finalData.finalDecision === "Buy" ? "positive" : "negative"
              }">${finalData.finalDecision}</h2>
              <p class="ai-explanation">${finalData.explanation || ""}</p>
            </div>
            ${renderDecisionFactors(finalData)}
          </div>
        ;
      } catch (err) {
        console.error("Error in final decision:", err);
        basicResultDiv.innerHTML = 
          <div class="error-message">
            <h3>Analysis Error</h3>
            <p>We couldn't complete your analysis. Please try again later.</p>
            <button class="retry-btn" onclick="location.reload()">Retry</button>
          </div>
        ;
      }
    });
  }
});

/**
 * Renders decision factors if available
 */
function renderDecisionFactors(data) {
  if (!data.finalScore) return '';
  
  return 
    <div class="decision-factors">
      <h4>Financial Confidence Score: ${(data.finalScore * 100).toFixed(0)}%</h4>
      <div class="confidence-bar">
        <div class="confidence-progress" style="width: ${data.finalScore * 100}%; 
          background-color: ${data.finalScore >= 0.65 ? '#48bb78' : '#f56565'};">
        </div>
      </div>
    </div>
  ;
}

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
  return 
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <h3>Analyzing...</h3>
      <p>One moment while we generate your recommendation.</p>
    </div>
  ;
}
