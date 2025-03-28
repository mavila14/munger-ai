document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const imageUpload = document.getElementById("imageUpload");
  const takePhotoBtn = document.getElementById("takePhotoBtn");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultContainer = document.getElementById("resultContainer");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const resultContent = document.getElementById("resultContent");
  const imagePreview = document.getElementById("imagePreview");
  const cameraContainer = document.getElementById("cameraContainer");
  const cameraStream = document.getElementById("cameraStream");
  const captureBtn = document.getElementById("captureBtn");
  const cancelCameraBtn = document.getElementById("cancelCameraBtn");
  const itemNameInput = document.getElementById("itemName");
  const itemCostInput = document.getElementById("itemCost");
  const itemNameLabel = document.querySelector('label[for="itemName"]');
  
  // Advanced analysis elements
  const advancedToggle = document.getElementById("advancedToggle");
  const advancedSection = document.getElementById("advancedSection");
  const itemPurpose = document.getElementById("itemPurpose");
  const itemFrequency = document.getElementById("itemFrequency");
  const itemLifespan = document.getElementById("itemLifespan");
  const alternativeCost = document.getElementById("alternativeCost");
  const userNotes = document.getElementById("userNotes");

  // Camera stream variable
  let stream = null;
  let capturedImage = null;
  let hasImage = false;
  
  // Function to create a Google search URL
  function createGoogleSearchUrl(productName) {
    // Encode the product name for a URL
    const encodedName = encodeURIComponent(productName);
    return `https://www.google.com/search?q=${encodedName}`;
  }
  
  // Function to update the item name field requirements based on image presence
  function updateItemNameRequirement() {
    if (hasImage) {
      // Make name field optional when image is present
      itemNameLabel.innerHTML = "What are you buying? <span class='optional-text'>(Optional when image is uploaded)</span>";
      itemNameInput.required = false;
    } else {
      // Make name field required when no image
      itemNameLabel.innerHTML = "What are you buying?";
      itemNameInput.required = true;
    }
    
    // Update validation state
    validateInputs();
  }
  
  // Toggle advanced analysis section
  advancedToggle.addEventListener("click", () => {
    advancedToggle.classList.toggle("open");
    advancedSection.classList.toggle("open");
    
    // Smooth animation for opening/closing
    if (advancedSection.classList.contains("open")) {
      advancedSection.style.maxHeight = advancedSection.scrollHeight + "px";
    } else {
      advancedSection.style.maxHeight = "0";
    }
  });
  
  // Add focus animation to input fields
  const animateLabel = (input, labelSelector) => {
    input.addEventListener("focus", () => {
      const label = document.querySelector(labelSelector);
      if (label) {
        label.style.color = "#4f46e5";
        label.style.transform = "translateY(-3px)";
      }
    });
    
    input.addEventListener("blur", () => {
      const label = document.querySelector(labelSelector);
      if (label) {
        label.style.color = "";
        label.style.transform = "";
      }
    });
  };
  
  // Apply animations to form fields
  animateLabel(itemNameInput, 'label[for="itemName"]');
  animateLabel(itemCostInput, 'label[for="itemCost"]');
  animateLabel(itemLifespan, 'label[for="itemLifespan"]');
  animateLabel(alternativeCost, 'label[for="alternativeCost"]');
  animateLabel(userNotes, 'label[for="userNotes"]');
  
  // Add button press effect
  analyzeBtn.addEventListener("mousedown", () => {
    analyzeBtn.style.transform = "scale(0.98)";
  });
  
  analyzeBtn.addEventListener("mouseup", () => {
    analyzeBtn.style.transform = "";
  });
  
  // Add input validation visual feedback
  itemNameInput.addEventListener("input", () => {
    validateInputs();
  });
  
  itemCostInput.addEventListener("input", () => {
    validateInputs();
  });
  
  function validateInputs() {
    const nameValue = itemNameInput.value.trim();
    const costValue = itemCostInput.value.trim();
    
    if ((hasImage || nameValue) && costValue && parseFloat(costValue) > 0) {
      analyzeBtn.classList.add("ready");
    } else {
      analyzeBtn.classList.remove("ready");
    }
  }

  // Camera functionality
  takePhotoBtn.addEventListener("click", async () => {
    try {
      // Add button animation
      takePhotoBtn.classList.add("active");
      
      // Request camera access
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      // Display the camera preview with animation
      cameraStream.srcObject = stream;
      cameraContainer.classList.remove("hidden");
      cameraContainer.style.opacity = "0";
      setTimeout(() => {
        cameraContainer.style.opacity = "1";
      }, 10);
      
      takePhotoBtn.classList.remove("active");
      takePhotoBtn.classList.add("hidden");

    } catch (err) {
      console.error("Error accessing camera:", err);
      takePhotoBtn.classList.remove("active");
      alert("Could not access camera. Please check your permissions or upload an image.");
    }
  });

  // Capture photo from camera
  captureBtn.addEventListener("click", () => {
    // Add button animation
    captureBtn.classList.add("active");
    
    const canvas = document.createElement("canvas");
    canvas.width = cameraStream.videoWidth;
    canvas.height = cameraStream.videoHeight;
    const ctx = canvas.getContext("2d");

    // Draw current frame from video
    ctx.drawImage(cameraStream, 0, 0, canvas.width, canvas.height);

    // Get image data as base64
    capturedImage = canvas.toDataURL("image/jpeg");

    // Show preview of captured image with fade-in effect
    imagePreview.innerHTML = `<img src="${capturedImage}" alt="Captured image" style="opacity: 0">`;
    setTimeout(() => {
      imagePreview.querySelector("img").style.opacity = "1";
    }, 10);

    // Update image flag and field requirements
    hasImage = true;
    updateItemNameRequirement();

    // Stop camera and hide camera container
    stopCamera();
    captureBtn.classList.remove("active");
  });

  // Cancel camera
  cancelCameraBtn.addEventListener("click", stopCamera);

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    
    // Add animation when closing camera
    cameraContainer.style.opacity = "0";
    setTimeout(() => {
      cameraContainer.classList.add("hidden");
      takePhotoBtn.classList.remove("hidden");
    }, 300);
  }

  // Convert uploaded file to base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  // Handle image upload preview with animation
  imageUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        capturedImage = null; // Reset if previously captured
        
        // Create image with fade-in effect
        imagePreview.innerHTML = `<img src="${e.target.result}" alt="Item preview" style="opacity: 0">`;
        setTimeout(() => {
          imagePreview.querySelector("img").style.opacity = "1";
        }, 10);
        
        // Update image flag and field requirements
        hasImage = true;
        updateItemNameRequirement();
      };
      reader.readAsDataURL(file);
    } else {
      hasImage = false;
      updateItemNameRequirement();
    }
  });

  // Loading messages for a more engaging experience
  const loadingMessages = [
    "Consulting Charlie Munger's wisdom...",
    "Analyzing purchase value...",
    "Calculating opportunity cost...",
    "Searching for cheaper alternatives...",
    "Applying mental models...",
    "Making investment decision..."
  ];
  
  let loadingMessageIndex = 0;
  let loadingInterval;
  
  function startLoadingAnimation() {
    const loadingText = loadingIndicator.querySelector("p");
    loadingText.textContent = loadingMessages[0];
    
    loadingInterval = setInterval(() => {
      loadingMessageIndex = (loadingMessageIndex + 1) % loadingMessages.length;
      loadingText.style.opacity = "0";
      
      setTimeout(() => {
        loadingText.textContent = loadingMessages[loadingMessageIndex];
        loadingText.style.opacity = "1";
      }, 300);
    }, 2000);
  }
  
  function stopLoadingAnimation() {
    clearInterval(loadingInterval);
  }
  
  // Collect advanced analysis data
  function getAdvancedAnalysisData() {
    // Only collect data if the advanced section is open
    if (!advancedSection.classList.contains("open")) {
      return null;
    }
    
    const advancedData = {
      purpose: itemPurpose.value || null,
      frequency: itemFrequency.value || null,
      lifespan: itemLifespan.value ? parseFloat(itemLifespan.value) : null,
      alternativeCost: alternativeCost.value ? parseFloat(alternativeCost.value) : null,
      notes: userNotes.value.trim() || null
    };
    
    // Only return if at least one field has data
    const hasData = Object.values(advancedData).some(value => value !== null && value !== "");
    return hasData ? advancedData : null;
  }

  // Analyze button click event handler
  analyzeBtn.addEventListener("click", async () => {
    const itemName = itemNameInput.value.trim();
    const itemCost = itemCostInput.value.trim();

    // Modified validation to account for images
    if ((!itemName && !hasImage) || !itemCost) {
      // Shake animation for invalid input
      analyzeBtn.classList.add("shake");
      setTimeout(() => {
        analyzeBtn.classList.remove("shake");
        if (!itemCost) {
          alert("Please provide the item cost.");
        } else {
          alert("Please either provide an item name or upload an image.");
        }
      }, 500);
      return;
    }

    // Show loading state with animation
    resultContainer.classList.remove("hidden");
    loadingIndicator.classList.remove("hidden");
    resultContent.innerHTML = "";
    
    // Start the loading message rotation
    startLoadingAnimation();

    let base64Image = null;

    // Use camera-captured image or uploaded file
    try {
      if (capturedImage) {
        base64Image = capturedImage.split(",")[1];
      } else if (imageUpload.files[0]) {
        const file = imageUpload.files[0];
        base64Image = await fileToBase64(file);
      }
    } catch (error) {
      console.error("Error processing image:", error);
    }
    
    // Get advanced analysis data if available
    const advancedData = getAdvancedAnalysisData();

    try {
      // Prepare request data
      const requestData = {
        itemName,
        itemCost: parseFloat(itemCost),
        imageBase64: base64Image,
        findAlternatives: true // Request alternative search
      };
      
      // Add advanced data if available
      if (advancedData) {
        requestData.advancedData = advancedData;
      }
      
      // Make request to backend API
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      
      // Add debugging logs for API response
      console.log("API response received:", data);
      if (data.alternative) {
        console.log("Alternative data:", data.alternative);
        
        // Validate alternative data
        if (!data.alternative.name) console.warn("Alternative missing name");
        if (!data.alternative.price) console.warn("Alternative missing price");
        if (!data.alternative.url) console.warn("Alternative missing URL");
      } else {
        console.log("No alternative data in response");
      }

      // Stop the loading animation
      stopLoadingAnimation();

      // "Buy" or "Don't Buy" logic for styling
      const recommendationClass = data.recommendation.toLowerCase().includes("don't") ? 
        "dont-buy" : "buy";

      // Random Munger quotes for additional wisdom
      const mungerQuotes = [
        "Take a simple idea and take it seriously.",
        "The big money is not in the buying and selling, but in the waiting.",
        "All intelligent investing is value investing.",
        "Knowing what you don't know is more useful than being brilliant.",
        "Spend each day trying to be a little wiser than you were when you woke up."
      ];
      
      const randomQuoteIndex = Math.floor(Math.random() * mungerQuotes.length);

      let resultsHTML = `
        <h2>Purchase Analysis</h2>
        <p><strong>Item:</strong> ${data.name}</p>
        <p><strong>Cost:</strong> $${parseFloat(data.cost).toFixed(2)}</p>
      `;

      // Add interesting facts if available
      if (data.facts) {
        resultsHTML += `<p><strong>Interesting Facts:</strong> ${data.facts}</p>`;
      }

      // Build recommendation section
      resultsHTML += `
        <div class="recommendation-container">
          <h3>Charlie Munger's Recommendation:</h3>
          <div class="recommendation ${recommendationClass}">
            ${data.recommendation}
          </div>
          <p>${data.explanation}</p>
        </div>
      `;

      // Check if alternative exists and has a name property
      console.log("Checking alternative data...");
      if (data.alternative && 
          typeof data.alternative === 'object' && 
          data.alternative.name) {
        
        console.log("Building alternative HTML section");
        
        // Get price safely with fallback
        const altPrice = data.alternative.price ? parseFloat(data.alternative.price) : 0;
        const itemPrice = parseFloat(data.cost);
        
        // Only calculate savings if we have valid prices
        let savingsText = "";
        if (data.alternative.price && altPrice < itemPrice) {
          const savings = itemPrice - altPrice;
          const savingsPercent = (savings / itemPrice * 100).toFixed(1);
          savingsText = `<p class="savings-text">Potential Savings: $${savings.toFixed(2)} (${savingsPercent}%)</p>`;
        }
        
        let retailerName = data.alternative.retailer || "Online Retailers";
        
        // The price display is now conditional
        const priceDisplay = data.alternative.price ? 
          `- $${parseFloat(data.alternative.price).toFixed(2)}` : 
          "";
        
        // Create a Google search URL for the alternative product
        const googleSearchUrl = createGoogleSearchUrl(data.alternative.name);
        
        resultsHTML += `
          <div class="alternative-suggestion">
            <h3>Cheaper Alternative Found:</h3>
            <p><strong>${data.alternative.name}</strong> ${priceDisplay}</p>
            <p class="retailer-info">Available from <strong>${retailerName}</strong></p>
            <p>
              <a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer" class="alternative-link">
                <i class="fas fa-search"></i> Search Google
              </a>
            </p>
            ${savingsText}
          </div>
        `;
      } else {
        console.log("Alternative data not available or incomplete:", data.alternative);
      }
      
      // Add Munger quote at the end
      resultsHTML += `
        <div class="munger-quote">
          "${mungerQuotes[randomQuoteIndex]}"
          <div style="text-align: right; margin-top: 8px; font-weight: 500;">— Charlie Munger</div>
        </div>
      `;

      // Hide loading indicator and show results
      loadingIndicator.classList.add("hidden");
      resultContent.innerHTML = resultsHTML;

      // Setup alternative link handlers
      console.log("Setting up alternative link handlers");
      setTimeout(() => {
        const alternativeLinks = document.querySelectorAll('.alternative-link');
        console.log(`Found ${alternativeLinks.length} alternative links`);
        
        if (alternativeLinks.length > 0) {
          alternativeLinks.forEach(link => {
            console.log(`Adding handler to link: ${link.getAttribute('href')}`);
            link.addEventListener('click', function(e) {
              e.preventDefault();
              const url = this.getAttribute('href');
              console.log(`Opening URL: ${url}`);
              window.open(url, '_blank', 'noopener,noreferrer');
            });
          });
        }
        
        // Also add a global delegated handler as a fallback
        document.body.addEventListener('click', function(e) {
          const link = e.target.closest('.alternative-link');
          if (link) {
            e.preventDefault();
            const url = link.getAttribute('href');
            console.log(`Global handler opening URL: ${url}`);
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      }, 200); // Slightly longer timeout to ensure DOM is fully ready

      // Smooth scroll to results
      resultContainer.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });

    } catch (error) {
      console.error("Error:", error);
      
      // Stop the loading animation
      stopLoadingAnimation();
      
      // Show error with animation
      loadingIndicator.classList.add("hidden");
      resultContent.innerHTML = `
        <h2>Oops! Something went wrong</h2>
        <p>We couldn't analyze your item at this time. Please try again later.</p>
        <p><small>Error details: ${error.message}</small></p>
      `;
    }
  });
  
  // Initialize the UI state
  updateItemNameRequirement();
});
