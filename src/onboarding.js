/***************************************************************
 * onboarding.js
 *
 * Provides interactive onboarding experience with tooltips and
 * step-by-step guidance for new users
 ***************************************************************/

const MungerOnboarding = (function() {
  // Track if user has seen the tour
  const TOUR_SEEN_KEY = "munger_tour_seen";
  
  // Tour steps configuration
  const tourSteps = [
    {
      element: ".landing",
      title: "Welcome to Munger AI",
      content: "Let's take a quick tour to help you make better purchase decisions with AI assistance.",
      position: "bottom"
    },
    {
      element: "#basic-form",
      title: "Basic Decision Tool",
      content: "Enter what you're buying and its cost, then our AI will tell you if it's a good purchase.",
      position: "bottom"
    },
    {
      element: "#basic-item-image",
      title: "AI Image Analysis",
      content: "Optionally upload a photo of the item, and our AI will identify it and suggest a price.",
      position: "top"
    },
    {
      element: ".submit-btn",
      title: "Get Your Decision",
      content: "Click this button and we'll analyze your purchase using financial wisdom from Charlie Munger.",
      position: "top"
    },
    {
      element: "#nav-profile",
      title: "Complete Your Profile",
      content: "Add your financial details for more personalized recommendations based on your situation.",
      position: "right"
    }
  ];
  
  // Track current step
  let currentStep = 0;
  let tourActive = false;
  let overlay;
  let tooltip;
  
  // Initialize the onboarding experience
  function init() {
    // Add the Take a Tour button to the landing section
    const landingSection = document.querySelector('.landing');
    if (landingSection) {
      const tourButton = document.createElement('button');
      tourButton.className = 'tour-button';
      tourButton.innerHTML = '<i class="fas fa-map-signs"></i> Take a Tour';
      tourButton.addEventListener('click', startTour);
      landingSection.appendChild(tourButton);
    }
    
    // Check if this is the first visit
    const tourSeen = localStorage.getItem(TOUR_SEEN_KEY);
    if (!tourSeen) {
      // Delay the tour to allow the page to load completely
      setTimeout(() => {
        startTour();
      }, 1500);
    }
    
    // Add tooltips to important elements
    addTooltips();
  }
  
  // Start the interactive tour
  function startTour() {
    // Create overlay and tooltip elements if they don't exist
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'tour-overlay';
      document.body.appendChild(overlay);
      
      tooltip = document.createElement('div');
      tooltip.className = 'tour-tooltip';
      document.body.appendChild(tooltip);
    }
    
    // Mark that user has seen the tour
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    
    // Reset and start tour
    currentStep = 0;
    tourActive = true;
    showStep(currentStep);
    
    // Add event listener to close tour when clicking outside
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        endTour();
      }
    });
    
    // Add keyboard navigation
    document.addEventListener('keydown', handleKeyNavigation);
  }
  
  // Show a specific tour step
  function showStep(stepIndex) {
    if (stepIndex >= tourSteps.length) {
      endTour();
      return;
    }
    
    const step = tourSteps[stepIndex];
    const element = document.querySelector(step.element);
    
    if (!element) {
      // Skip this step if element not found
      showStep(stepIndex + 1);
      return;
    }
    
    // Highlight the target element
    highlightElement(element);
    
    // Position and show the tooltip
    positionTooltip(element, step);
    
    // Update tooltip content
    tooltip.innerHTML = `
      <div class="tooltip-header">
        <h3>${step.title}</h3>
        <button class="tooltip-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="tooltip-content">
        <p>${step.content}</p>
      </div>
      <div class="tooltip-footer">
        <div class="tooltip-progress">
          Step ${stepIndex + 1} of ${tourSteps.length}
        </div>
        <div class="tooltip-actions">
          ${stepIndex > 0 ? '<button class="btn-prev">Previous</button>' : ''}
          ${stepIndex < tourSteps.length - 1 ? 
            '<button class="btn-next">Next</button>' : 
            '<button class="btn-finish">Finish Tour</button>'}
        </div>
      </div>
    `;
    
    // Add event listeners to buttons
    const closeBtn = tooltip.querySelector('.tooltip-close');
    const prevBtn = tooltip.querySelector('.btn-prev');
    const nextBtn = tooltip.querySelector('.btn-next');
    const finishBtn = tooltip.querySelector('.btn-finish');
    
    if (closeBtn) closeBtn.addEventListener('click', endTour);
    if (prevBtn) prevBtn.addEventListener('click', () => showStep(stepIndex - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => showStep(stepIndex + 1));
    if (finishBtn) finishBtn.addEventListener('click', endTour);
    
    // Smooth scroll to ensure the element is visible
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  
  // Highlight an element by adjusting the overlay
  function highlightElement(element) {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    const top = rect.top + scrollTop;
    const left = rect.left + scrollLeft;
    
    // Add a small padding around the element
    const padding = 10;
    
    overlay.style.display = 'block';
    overlay.innerHTML = `
      <div class="overlay-mask" style="
        clip-path: polygon(
          0% 0%, 
          0% 100%, 
          100% 100%, 
          100% 0%,
          0% 0%,
          0% 0%,
          ${left - padding}px ${top - padding}px,
          ${left - padding}px ${top + rect.height + padding}px,
          ${left + rect.width + padding}px ${top + rect.height + padding}px,
          ${left + rect.width + padding}px ${top - padding}px,
          ${left - padding}px ${top - padding}px,
          0% 0%
        )
      "></div>
      <div class="element-highlight" style="
        top: ${top - padding}px;
        left: ${left - padding}px;
        width: ${rect.width + padding * 2}px;
        height: ${rect.height + padding * 2}px;
      "></div>
    `;
  }
  
  // Position the tooltip relative to the target element
  function positionTooltip(element, step) {
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    const tooltipWidth = 300; // Fixed width for tooltip
    const tooltipHeight = 200; // Approximate height
    const margin = 20; // Margin between element and tooltip
    
    let top, left;
    
    switch (step.position) {
      case 'top':
        top = rect.top + scrollTop - tooltipHeight - margin;
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = rect.bottom + scrollTop + margin;
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = rect.top + scrollTop + (rect.height / 2) - (tooltipHeight / 2);
        left = rect.left + scrollLeft - tooltipWidth - margin;
        break;
      case 'right':
        top = rect.top + scrollTop + (rect.height / 2) - (tooltipHeight / 2);
        left = rect.right + scrollLeft + margin;
        break;
      default:
        top = rect.bottom + scrollTop + margin;
        left = rect.left + scrollLeft + (rect.width / 2) - (tooltipWidth / 2);
    }
    
    // Make sure tooltip doesn't go off-screen
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    
    if (left < 10) left = 10;
    if (left + tooltipWidth > viewportWidth - 10) left = viewportWidth - tooltipWidth - 10;
    
    if (top < 10) top = 10;
    if (top + tooltipHeight > viewportHeight + scrollTop - 10) {
      // If tooltip would go below viewport, put it above element instead
      top = rect.top + scrollTop - tooltipHeight - margin;
    }
    
    // Set tooltip position
    tooltip.style.display = 'block';
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    // Add arrow pointing to element
    let arrowClass = `arrow-${step.position}`;
    tooltip.className = `tour-tooltip ${arrowClass}`;
  }
  
  // Handle keyboard navigation
  function handleKeyNavigation(e) {
    if (!tourActive) return;
    
    if (e.key === 'Escape') {
      endTour();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      showStep(currentStep + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (currentStep > 0) {
        showStep(currentStep - 1);
      }
    }
  }
  
  // End the tour
  function endTour() {
    tourActive = false;
    
    if (overlay) {
      overlay.style.display = 'none';
    }
    
    if (tooltip) {
      tooltip.style.display = 'none';
    }
    
    // Remove keyboard event listener
    document.removeEventListener('keydown', handleKeyNavigation);
  }
  
  // Add tooltips to important elements
  function addTooltips() {
    const tooltips = [
      {
        selector: '#nav-basic',
        text: 'Make quick purchase decisions',
        position: 'right'
      },
      {
        selector: '#nav-profile',
        text: 'Set up your financial profile',
        position: 'right'
      },
      {
        selector: '.submit-btn',
        text: 'Analyze this purchase',
        position: 'top'
      }
    ];
    
    tooltips.forEach(tooltipConfig => {
      const element = document.querySelector(tooltipConfig.selector);
      if (element) {
        // Add data attributes for tooltip
        element.setAttribute('data-tooltip', tooltipConfig.text);
        element.setAttribute('data-tooltip-position', tooltipConfig.position);
        
        // Add tooltip trigger class
        element.classList.add('has-tooltip');
      }
    });
  }
  
  // Return public methods
  return {
    init,
    startTour,
    endTour
  };
})();

// Initialize onboarding when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Small delay to ensure everything is loaded
  setTimeout(() => {
    MungerOnboarding.init();
  }, 500);
});
