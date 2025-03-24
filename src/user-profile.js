/***************************************************************
 * user-profile.js
 *
 * Manages the user financial profile data for personalized
 * purchase recommendations from Munger AI.
 ***************************************************************/

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the profile page
  const profileSection = document.getElementById('profile-section');
  if (!profileSection) return;

  // If user is not authenticated, block profile
  if (!localStorage.getItem('token')) {
    profileSection.innerHTML = `
      <div class="error-message">
        <h3>Please log in or register to access your profile.</h3>
        <p><a href="index.html">Return to Home</a></p>
      </div>
    `;
    return;
  }

  const profileForm = document.getElementById('profile-form');
  const profileResult = document.getElementById('profile-result');
  const completionProgress = document.getElementById('completion-progress');
  const completionPercentage = document.getElementById('completion-percentage');
  const decisionToolBtn = document.getElementById('go-to-decision-tool');

  // Load previously saved data
  loadUserProfile();

  // Form submission
  if (profileForm) {
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in to save your profile');
        return;
      }

      // Gather form data
      const formData = new FormData(profileForm);
      const profileData = {};
      for (const [key, value] of formData.entries()) {
        profileData[key] = value;
      }

      // Calculate derived fields for convenience
      if (profileData.monthlyIncome && profileData.monthlyExpenses) {
        profileData.disposableIncome =
          parseFloat(profileData.monthlyIncome) - parseFloat(profileData.monthlyExpenses);
      }
      if (profileData.highInterestDebt && profileData.lowInterestDebt) {
        profileData.totalDebt =
          parseFloat(profileData.highInterestDebt) + parseFloat(profileData.lowInterestDebt);
      }
      if (profileData.emergencyFund && profileData.monthlyExpenses) {
        profileData.emergencyFundMonths =
          parseFloat(profileData.emergencyFund) / parseFloat(profileData.monthlyExpenses);
      }

      try {
        // Save to localStorage
        const username = localStorage.getItem('username');
        localStorage.setItem(`profile_${username}`, JSON.stringify(profileData));

        // If API is available and token exists, also save to server
        if (token) {
          saveProfileToServer(profileData, token)
            .then(() => {
              console.log("Profile saved to server successfully");
            })
            .catch(err => {
              console.error("Error saving profile to server:", err);
              // Still proceed with showing success since we saved locally
            });
        }

        // Show success
        profileForm.classList.add('hidden');
        profileResult.classList.remove('hidden');
        profileResult.style.animation = 'fadeIn 0.6s ease-out';
        profileResult.style.opacity = '1';

      } catch (error) {
        console.error('Error saving profile:', error);
        alert('There was an error saving your profile. Please try again.');
      }
    });
  }

  // Update completion as user types
  const formInputs = profileForm.querySelectorAll('input, select, textarea');
  formInputs.forEach(input => {
    input.addEventListener('input', updateCompletionPercentage);
    input.addEventListener('change', updateCompletionPercentage);
  });

  // When user clicks "Decision Tool" after saving
  if (decisionToolBtn) {
    decisionToolBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
      // Optionally set the active tab
      localStorage.setItem('activeTab', 'basic');
    });
  }

  /****************************************************
   * Internal Functions
   ****************************************************/

  function loadUserProfile() {
    const username = localStorage.getItem('username');
    if (!username) return;

    const dataStr = localStorage.getItem(`profile_${username}`);
    if (!dataStr) {
      // Try to load from server if we have a token
      const token = localStorage.getItem('token');
      if (token) {
        fetchProfileFromServer(token)
          .then(data => {
            if (data) {
              fillProfileForm(data);
              localStorage.setItem(`profile_${username}`, JSON.stringify(data));
            }
          })
          .catch(err => {
            console.error("Error loading profile from server:", err);
          });
      }
      return;
    }

    try {
      const data = JSON.parse(dataStr);
      fillProfileForm(data);
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }

  function fillProfileForm(data) {
    // Fill in form
    for (const [key, value] of Object.entries(data)) {
      if (profileForm.elements[key]) {
        profileForm.elements[key].value = value;
      }
    }
    updateCompletionPercentage();
  }

  async function fetchProfileFromServer(token) {
    try {
      const response = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching profile: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
  }

  async function saveProfileToServer(profileData, token) {
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error(`Error saving profile: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error;
    }
  }

  function updateCompletionPercentage() {
    // Get all required fields (excluding anything marked data-optional)
    const requiredInputs = Array.from(
      profileForm.querySelectorAll('input:not([data-optional]), select:not([data-optional])')
    );

    // Count how many are filled
    const completed = requiredInputs.filter(i => i.value && i.value.trim() !== '').length;
    const pct = Math.round((completed / requiredInputs.length) * 100);

    completionPercentage.textContent = pct + '%';
    completionProgress.style.width = pct + '%';

    if (pct < 30) {
      completionProgress.style.backgroundColor = '#f56565'; // red
    } else if (pct < 70) {
      completionProgress.style.backgroundColor = '#ed8936'; // orange
    } else {
      completionProgress.style.backgroundColor = '#48bb78'; // green
    }
  }

  // Expose a getter for your profile data globally:
  window.UserProfile = {
    getUserFinancialProfile() {
      const username = localStorage.getItem('username');
      if (!username) return null;
      const dataStr = localStorage.getItem(`profile_${username}`);
      if (!dataStr) return null;
      try {
        return JSON.parse(dataStr);
      } catch (err) {
        console.error('Error parsing stored profile data:', err);
        return null;
      }
    }
  };
});
