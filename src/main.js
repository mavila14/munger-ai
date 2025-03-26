<!-- main.js -->
<script>
/***************************************************************
 * main.js
 *
 * Main logic for the basic "Should I Buy It?" tool:
 * 1) Optionally call Gemini to parse item image => name/cost/facts.
 * 2) Show the final decision with explanation.
 * 3) Handle camera input on mobile devices.
 ***************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  // 1) Access our Gemini-calling helper
  const { callGeminiAPI } = window.AppHelpers || {};

  // 2) Grab relevant DOM elements
  const basicForm = document.getElementById("basic-form");
  const basicResultDiv = document.getElementById("basic-result");

  // File, camera, and preview
  const fileInput = document.getElementById("basic-item-image");
  const cameraButton = document.getElementById("camera-button");
  const uploadButton = document.getElementById("upload-button");
  const imagePreview = document.getElementById("image-preview");
  const previewImg = document.getElementById("preview-img");
  const removeImageBtn = document.getElementById("remove-image");

  // 3) Check if device can use camera capture
  const hasGetUserMedia = !!(
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  );

  // Set up camera button if available
  if (cameraButton && hasGetUserMedia) {
    cameraButton.addEventListener("click", () => {
      // Force the file input to use "environment" camera on mobile
      fileInput.setAttribute("capture", "environment");
      fileInput.click();
    });
  } else if (cameraButton) {
    // Hide the "Take Photo" button if camera is not available
    cameraButton.style.display = "none";
  }

  // Set up upload button
  if (uploadButton) {
    uploadButton.addEventListener("click", () => {
      // Remove any "capture" so we get a normal file picker
      fileInput.removeAttribute("capture");
      fileInput.click();
    });
  }

  // 4) Show image preview when user picks (or takes) a photo
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        previewImg.src = URL.createObjectURL(file);
        imagePreview.classList.remove("hidden");
      }
    });
  }

  // 5) Allow user to remove selected image
  if (removeImageBtn) {
    removeImageBtn.addEventListener("click", () => {
      fileInput.value = "";
      imagePreview.classList.add("hidden");
      previewImg.src = "#";
    });
  }

  // 6) Handle the form submission
  if (basicForm) {
    basicForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Retrieve item name & cost from form fields
      const itemNameInput = document.getElementById("basic-item-name");
      const itemCostInput = document.getElementById("basic-item-cost");

      const itemName = itemNameInput?.value.trim() || "Unknown Item";
      const itemCost = parseFloat(itemCostInput?.value) || 0;

      // Convert the chosen image to base64 if present
      let imageBase64 = "";
      if (fileInput && fileInput.files && fileInput.files[0]) {
        imageBase64 = await toBase64(fileInput.files[0]);
      }

      // For demo, default some user financials if not pulling from profile
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

      // Show a loading spinner in the result area
      basicResultDiv.innerHTML = renderLoadingState();

      try {
        // 7) Call our advanced logic which also calls Gemini if there's an image
        const finalData = await callGeminiAPI({
          itemName,
          itemCost,
          imageBase64,
          ...profileData
        });

        // 8) Render results (AI name, cost, facts, final decision)
        basicResultDiv.innerHTML = `
  <div class="analysis-result">
    <div class="decision-box">
      <h2 class="recommendation ${
        finalData.finalDecision === "Buy" ? "positive" : "negative"
      }">
        ${finalData.finalDecision}
      </h2>
      <p class="ai-explanation">${finalData.explanation || ""}</p>
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
});

/**
 * Convert a File object to base64 string
 */
async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Show a simple loading state
 */
function renderLoadingState() {
  return `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <h3>Analyzing...</h3>
      <p>One moment while we generate your recommendation.</p>
    </div>
  `;
}

/**
 * Render numeric decision factors (score bar, etc.)
 */
function renderDecisionFactors(data) {
  if (!data.finalScore) return "";
  
  const itemDetails = `
    <div class="item-details">
      <h3>${data.itemName || "Unknown Item"}</h3>
      <p class="item-cost">
        Estimated Cost: $${(parseFloat(data.itemCost) || 0).toFixed(2)}
      </p>
      ${
        data.itemFacts
          ? `<p class="item-facts">${data.itemFacts}</p>`
          : ""
      }
    </div>
  `;
  
  return `
    <div class="decision-factors">
      <h4>Financial Confidence Score: ${(data.finalScore * 100).toFixed(0)}%</h4>
      <div class="confidence-bar">
        <div class="confidence-progress"
             style="width: ${data.finalScore * 100}%;
             background-color: ${
               data.finalScore >= 0.65 ? "#48bb78" : "#f56565"
             };">
        </div>
      </div>
      ${itemDetails}
    </div>
  `;
}
</script>
