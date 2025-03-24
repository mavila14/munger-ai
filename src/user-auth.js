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
      showLoginForm();
    });

    tabSignup.addEventListener('click', () => {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      showSignupForm();
    });

    // Form rendering functions
    function showLoginForm() {
      authContent.innerHTML = `
        <form id="login-form" class="auth-form">
          <div class="form-group">
            <label for="login-username">Username</label>
            <input type="text" id="login-username" required />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <div class="password-input-wrapper">
              <input type="password" id="login-password" required />
              <button type="button" class="password-toggle-btn">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="auth-submit-btn">Login</button>
          <div id="login-error" class="auth-error"></div>
        </form>
      `;

      setupPasswordToggle();
      setupLoginForm();
    }

    function showSignupForm() {
      authContent.innerHTML = `
        <form id="signup-form" class="auth-form">
          <div class="form-group">
            <label for="signup-username">Username</label>
            <input type="text" id="signup-username" required />
          </div>
          <div class="form-group">
            <label for="signup-password">Password</label>
            <div class="password-input-wrapper">
              <input type="password" id="signup-password" required />
              <button type="button" class="password-toggle-btn">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="signup-confirm">Confirm Password</label>
            <div class="password-input-wrapper">
              <input type="password" id="signup-confirm" required />
              <button type="button" class="password-toggle-btn">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="auth-submit-btn">Sign Up</button>
          <div id="signup-error" class="auth-error"></div>
        </form>
      `;

      setupPasswordToggle();
      setupSignupForm();
    }
  }

  /****************************************************
   * FORM HANDLING
   ****************************************************/

  function setupPasswordToggle() {
    const toggleBtns = document.querySelectorAll('.password-toggle-btn');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const passwordInput = this.previousElementSibling;
        const icon = this.querySelector('i');
        
        if (passwordInput.type === 'password') {
          passwordInput.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          passwordInput.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      });
    });
  }

  function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';

      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        loginError.textContent = 'Please enter both username and password';
        return;
      }

      try {
        // Show loading state
        loginForm.classList.add('loading');
        const submitBtn = loginForm.querySelector('.auth-submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';

        // Make API call to login endpoint - Note: proper API path with correct case
        console.log('Calling login endpoint:', `${API_BASE_URL}/login`);
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        // Check if the response is OK before parsing JSON
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Login error response:', errorText);
          throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }

        // Check if the response has content before parsing as JSON
        const responseText = await response.text();
        let data;
        
        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse JSON response:', responseText);
            throw new Error('Login failed: Invalid response format');
          }
        } else {
          // Empty response is unexpected for login since we need a token
          throw new Error('Login failed: No response from server');
        }

        // Store the JWT and username in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', username);

        // Show the user's profile
        showUserProfile();
      } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = error.message || 'Login failed. Please try again.';
      } finally {
        // Reset loading state
        loginForm.classList.remove('loading');
        const submitBtn = loginForm.querySelector('.auth-submit-btn');
        submitBtn.textContent = 'Login';
      }
    });
  }

  function setupSignupForm() {
    const signupForm = document.getElementById('signup-form');
    const signupError = document.getElementById('signup-error');

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      signupError.textContent = '';

      const username = document.getElementById('signup-username').value;
      const password = document.getElementById('signup-password').value;
      const confirm = document.getElementById('signup-confirm').value;

      if (!username || !password || !confirm) {
        signupError.textContent = 'Please fill out all fields';
        return;
      }

      if (password !== confirm) {
        signupError.textContent = 'Passwords do not match';
        return;
      }

      try {
        // Show loading state
        signupForm.classList.add('loading');
        const submitBtn = signupForm.querySelector('.auth-submit-btn');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Signing up...';

        // Make API call to register endpoint - Note: proper API path with correct case
        console.log('Calling registration endpoint:', `${API_BASE_URL}/register`);
        const response = await fetch(`${API_BASE_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        // Check if the response is OK before parsing JSON
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Registration error response:', errorText);
          throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
        }

        // Check if the response has content before parsing as JSON
        const responseText = await response.text();
        let data;
        
        if (responseText) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse JSON response:', responseText);
            throw new Error('Registration succeeded but returned invalid response format');
          }
        } else {
          // Handle empty response - assume success if response was OK
          data = { message: 'User created successfully' };
        }

        // Show success message
        signupForm.innerHTML = `
          <div class="auth-success">
            <i class="fas fa-check-circle"></i>
            <h3>Registration Successful!</h3>
            <p>You can now log in with your credentials.</p>
            <button id="go-to-login" class="auth-submit-btn">Go to Login</button>
          </div>
        `;

        // Add event listener to the "Go to Login" button
        document.getElementById('go-to-login').addEventListener('click', () => {
          document.getElementById('tab-login').click();
        });
      } catch (error) {
        console.error('Signup error:', error);
        signupError.textContent = error.message || 'Registration failed. Please try again.';
      } finally {
        // Reset loading state if we're still showing the form
        if (signupForm.classList.contains('loading')) {
          signupForm.classList.remove('loading');
          const submitBtn = signupForm.querySelector('.auth-submit-btn');
          submitBtn.textContent = 'Sign Up';
        }
      }
    });
  }

  /****************************************************
   * CSS STYLES FOR AUTH COMPONENTS
   ****************************************************/
   
  // Add styles for the authentication components
  const style = document.createElement('style');
  style.textContent = `
    .auth-tabs {
      display: flex;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--neutral-300);
    }
    
    .auth-tab {
      padding: 0.5rem 1rem;
      background: none;
      border: none;
      cursor: pointer;
      font-weight: 500;
      color: var(--neutral-600);
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }
    
    .auth-tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    
    .auth-form {
      padding: 0.5rem 0;
    }
    
    .auth-submit-btn {
      width: 100%;
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.75rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 1rem;
      transition: all 0.2s ease;
    }
    
    .auth-submit-btn:hover {
      background: var(--primary-dark);
    }
    
    .auth-error {
      color: var(--danger);
      font-size: 0.85rem;
      margin-top: 0.75rem;
      min-height: 1.25rem;
    }
    
    .auth-success {
      text-align: center;
      padding: 1rem 0;
    }
    
    .auth-success i {
      font-size: 2rem;
      color: var(--success);
      margin-bottom: 0.5rem;
    }
    
    .auth-success h3 {
      margin: 0.5rem 0;
      color: var(--neutral-800);
    }
    
    .auth-success p {
      margin-bottom: 1rem;
      color: var(--neutral-600);
    }
    
    .user-info {
      display: flex;
      align-items: center;
      margin-bottom: 1rem;
    }
    
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--primary-light);
      color: var(--primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      margin-right: 0.75rem;
    }
    
    .user-name {
      font-weight: 600;
      color: var(--neutral-800);
    }
    
    .user-provider {
      font-size: 0.75rem;
      color: var(--neutral-500);
    }
    
    .logout-btn {
      width: 100%;
      background: var(--neutral-200);
      color: var(--neutral-700);
      border: none;
      padding: 0.5rem;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .logout-btn:hover {
      background: var(--neutral-300);
    }
    
    .auth-form.loading {
      opacity: 0.7;
      pointer-events: none;
    }
  `;
  
  document.head.appendChild(style);
});
