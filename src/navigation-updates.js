/***************************************************************
 * navigation-updates.js
 *
 * Handle navigation between different sections/pages
 * including the user profile page and mobile menu
 ***************************************************************/

document.addEventListener('DOMContentLoaded', () => {
    const navBasicBtn = document.getElementById("nav-basic");
    const navProfileBtn = document.getElementById("nav-profile");
    
    const basicSection = document.getElementById("basic-section");
    const profileSection = document.getElementById("profile-section");
    
    const menuToggle = document.getElementById("menu-toggle");
    const sidebar = document.querySelector("aside");
    const closeSidebarBtn = document.querySelector(".close-sidebar-btn");
    
    const isIndexPage = basicSection;
    const isProfilePage = profileSection;
    
    if (menuToggle) {
        menuToggle.addEventListener("click", () => {
            sidebar.classList.add("sidebar-open");
            document.body.classList.add("sidebar-is-open");
        });
    }
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener("click", () => {
            sidebar.classList.remove("sidebar-open");
            document.body.classList.remove("sidebar-is-open");
        });
    }
    
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove("sidebar-open");
                document.body.classList.remove("sidebar-is-open");
            }
        });
    });
    
    if (isIndexPage && navProfileBtn) {
      navProfileBtn.addEventListener("click", () => {
        window.location.href = 'profile.html';
      });
    }
    
    if (isProfilePage && navBasicBtn) {
      navBasicBtn.addEventListener("click", () => {
        window.location.href = 'index.html';
        localStorage.setItem('activeTab', 'basic');
      });
    }
    
    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains("sidebar-open") && 
            !sidebar.contains(e.target) && 
            e.target !== menuToggle && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove("sidebar-open");
            document.body.classList.remove("sidebar-is-open");
        }
    });

    function addProfileCompletionIndicator() {
      if (!isIndexPage || !localStorage.getItem('token')) return;
      
      const landingSection = document.querySelector('.landing');
      if (!landingSection) return;

      const username = localStorage.getItem('username');
      const profileData = localStorage.getItem(`profile_${username}`);

      if (!profileData) {
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
        
        document.getElementById('go-to-profile').addEventListener('click', () => {
          window.location.href = 'profile.html';
        });
      } else {
        try {
          const data = JSON.parse(profileData);
          const fieldCount = Object.entries(data).filter(([key, value]) =>
            key !== 'customNotes' && value && value.toString().trim() !== ''
          ).length;
          
          const totalFields = 10;
          const completionPercentage = Math.round((fieldCount / totalFields) * 100);

          if (completionPercentage < 100) {
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
            
            document.getElementById('complete-profile').addEventListener('click', () => {
              window.location.href = 'profile.html';
            });
          }
        } catch (error) {
          console.error('Error parsing profile data:', error);
        }
      }
    }
    
    addProfileCompletionIndicator();
});
