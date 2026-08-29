document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  if (localStorage.getItem('zynero_token')) {
    window.location.href = 'index.html';
    return;
  }

  const loginContainer = document.getElementById('login-form-container');
  const signupContainer = document.getElementById('signup-form-container');
  const showSignupBtn = document.getElementById('show-signup-btn');
  const showLoginBtn = document.getElementById('show-login-btn');

  // Toggle Forms
  if (showSignupBtn && loginContainer && signupContainer) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginContainer.style.display = 'none';
      signupContainer.style.display = 'block';
    });
  }

  if (showLoginBtn && signupContainer && loginContainer) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signupContainer.style.display = 'none';
      loginContainer.style.display = 'block';
    });
  }

  // Handle Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Please enter both email and password', 'warning');
        return;
      }

      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const data = await apiFetch('/users/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        // Save user & token
        localStorage.setItem('zynero_token', data.token);
        localStorage.setItem('zynero_user', JSON.stringify({
          _id: data._id,
          name: data.name,
          email: data.email,
          isAdmin: Boolean(data.isAdmin),
          addresses: data.addresses || []
        }));

        showToast(`Welcome back, ${data.name}!`, 'success');

        // Sync cart
        await syncCartWithServer();

        // Redirect
        setTimeout(() => {
          const redirect = new URLSearchParams(window.location.search).get('redirect');
          if (redirect) {
            window.location.href = redirect;
          } else {
            window.location.href = 'index.html';
          }
        }, 1000);

      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  }

  // Handle Signup Form
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const confirmPassword = document.getElementById('signup-confirm-password').value;

      if (!name || !email || !password) {
        showToast('Please fill out all required fields', 'warning');
        return;
      }

      if (password.length < 6) {
        showToast('Password must be at least 6 characters long', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }

      const btn = signupForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Creating account...';

      try {
        const data = await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({ name, email, password })
        });

        // Save user & token
        localStorage.setItem('zynero_token', data.token);
        localStorage.setItem('zynero_user', JSON.stringify({
          _id: data._id,
          name: data.name,
          email: data.email,
          isAdmin: Boolean(data.isAdmin),
          addresses: data.addresses || []
        }));

        showToast(`Welcome, ${data.name}! Account registered.`, 'success');

        // Sync cart
        await syncCartWithServer();

        setTimeout(() => {
          const redirect = new URLSearchParams(window.location.search).get('redirect');
          if (redirect) {
            window.location.href = redirect;
          } else {
            window.location.href = 'index.html';
          }
        }, 1000);

      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Sign Up';
      }
    });
  }
});
