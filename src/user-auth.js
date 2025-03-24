/***************************************************************
 * user-auth.js
 *
 * Provides login & signup forms for your Azure Static Web App,
 * calling the Functions at /api/Register and /api/Login.
 ***************************************************************/
document.addEventListener('DOMContentLoaded', () => {
    const userProfile = document.getElementById('user-profile');
    // For Azure Static Web Apps, the Functions are accessible at /api
    const API_BASE_URL = '/api';
  
    // Check if there's a JWT in localStorage
    const token = localStorage.getItem('token');
    if (token) {
      // If we have a token, show the user's profile
      showUserProfile();
    } else {
      // Otherwise, show login/signup tabs
      renderAuthTabs();
    }
  
    /****************************************************
     * RENDER FUNCTIONS
     ****************************************************/
  
    function showUserProfile() {
      // We stored the username in localStorage upon login.
      const username = localStorage.getItem('username') || 'User';
  
      userProfile.innerHTML = `
        <div class="user-info">
          <div class="user-avatar default">${username.charAt(0).toUpperCase()}</div>
          <div>
            <div class="user-name">${username}</div>
            <div class="user-provider">Local</div>
          </div>
        </div>
        <button class="logout-btn">Logout</button>
      `;
  
      document.querySelector('.logout-btn').addEventListener('click', () => {
        // Clear the JWT and username from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        // Show the login/signup tabs again
        renderAuthTabs();
      });
    }
  
    function renderAuthTabs() {
      userProfile.innerHTML = `
        <div class="auth-tabs">
          <button id="tab-login" class="auth-tab active">Login</button>
          <button id="tab-signup" class="auth-tab">Sign Up</button>
        </div>
        <div id="auth-content"></div>
      `;
  
      const tabLogin = document.getElementById('tab-login');
      const tabSignup = document.getElementById('tab-signup');
      const authContent = document.getElementById('auth-content');
  
      // Show login form by default
      showLoginForm();
  
      // Tab click handlers
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');