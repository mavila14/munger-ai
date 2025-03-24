/***************************************************************
 * navigation-updates.js
 *
 * Handle navigation between different sections and pages
 * including the user profile page
 ***************************************************************/

document.addEventListener('DOMContentLoaded', () => {
    // Nav buttons
    const navBasicBtn = document.getElementById("nav-basic");
    const navProfileBtn = document.getElementById("nav-profile");
    
    // Pages/sections
    const basicSection = document.getElementById("basic-section");
    const profileSection = document.getElementById("profile-section");
    
    // Check if we're on the index or profile page
    const isIndexPage = basicSection;
    const isProfilePage = profileSection;
    
    // Nav button click handlers - only set if we're on the index page
    if (isIndexPage) {
      // Profile page navigation
      if (navProfileBtn) {
        navProfileBtn.addEventListener("click", () => {
          // Navigate to profile page
          window.location.href = 'profile.html';
        });
      }
    }
    
    // Profile page nav buttons - only set if we're on the profile page
    if (isProfilePage) {
      // Navigation back to main page from profile
      if (navBasicBtn) {
        navBasicBtn.addEventListener("click", () => {
          window.location.href = 'index.html';
          // We'll set the active tab via localStorage
          localStorage.setItem('activeTab', 'basic');
        });
      }
    }
    
    // Add profile completion indicator to the main index page
    // This gives users a nudge to complete their profile
    function addProfileCompletionIndicator() {
      // Only run on index page and if user is logged in
      if (!isIndexPage || !localStorage.getItem('token')) return;
      
      // Get the landing section
      const landingSection = document.querySelector('.landing');
      if (!landingSection) return;
      
      // Check profile completion
      const username = localStorage.getItem('username');
      const profileData = localStorage.getItem(`profile_${username}`);
      
      if (!profileData) {
        // No profile data yet, show a prompt
        const profilePrompt = document.createElement('div');
        profilePrompt.className = 'profile-prompt';
        profilePrompt.innerHTML = `
          <div class="profile-prompt-content">
            <i class="fas fa-user-circle"></i>
            <p>Complete your financial profile to get personalized recommendations</p>
            <button id="go-to-profile" class="action-btn">Complete Profile</button>
          </div>
        `;
        
        landingSection.appendChild(profilePrompt);
        
        // Add click handler
        document.getElementById('go-to-profile').addEventListener('click', () => {
          window.location.href = 'profile.html';
        });
      } else {
        // Has some profile data, show completion
        try {
          const data = JSON.parse(profileData);
          // Count filled fields (excluding customNotes which is optional)
          const fieldCount = Object.entries(data).filter(([key, value]) => 
            key !== 'customNotes' && value && value.toString().trim() !== ''
          ).length;
          
          // We have 10 main fields in our profile form
          const totalFields = 10;
          const completionPercentage = Math.round((fieldCount / totalFields) * 100);
          
          if (completionPercentage < 100) {
            // Show completion indicator
            const completionIndicator = document.createElement('div');
            completionIndicator.className = 'profile-completion-indicator';
            completionIndicator.innerHTML = `
              <div class="completion-indicator-content">
                <div class="completion-text">Profile ${completionPercentage}% complete</div>
                <div class="mini-completion-bar">
                  <div class="mini-completion-progress" style="width: ${completionPercentage}%"></div>
                </div>
                <button id="complete-profile" class="small-action-btn">Complete</button>
              </div>
            `;
            
            landingSection.appendChild(completionIndicator);
            
            // Add click handler
            document.getElementById('complete-profile').addEventListener('click', () => {
              window.location.href = 'profile.html';
            });
          }
        } catch (error) {
          console.error('Error parsing profile data:', error);
        }
      }
    }
    
    // Run the profile completion indicator
    addProfileCompletionIndicator();
});
