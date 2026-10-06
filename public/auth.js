// ===== AUTHENTICATION LOGIC =====

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    checkIfAlreadyLoggedIn();
    setupPasswordToggle();

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        prefillLastEmail();
        setupLoginValidation(loginForm);
    }

    if (signupForm) {
        setupSignupValidation(signupForm);
    }
});

// Redirect to dashboard if session already active
async function checkIfAlreadyLoggedIn() {
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (res.ok) {
            window.location.href = 'dashboard.html';
        }
    } catch (e) {}
}

// Toggle password visibility
function setupPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            toggleBtn.textContent = isPassword ? 'Hide' : 'Show';
        });
    }
}

// Restore last used email from localStorage
function prefillLastEmail() {
    try {
        const lastEmail = localStorage.getItem('virexLastEmail');
        if (lastEmail) {
            const emailInput = document.getElementById('email');
            if (emailInput) emailInput.value = lastEmail;
        }
    } catch (e) { console.error("LocalStorage error:", e); }
}

// LOGIN VALIDATION & SUBMISSION
function setupLoginValidation(form) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailErr = document.getElementById('emailErr');
    const passwordErr = document.getElementById('passwordErr');
    const formAlert = document.getElementById('formAlert');
    const submitBtn = document.getElementById('submitBtn');

    // Clear errors on typing
    emailInput.addEventListener('input', () => emailErr.textContent = '');
    passwordInput.addEventListener('input', () => passwordErr.textContent = '');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formAlert.innerHTML = '';
        let isValid = true;

        const email = emailInput.value.trim();
        const password = passwordInput.value;



        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            emailErr.textContent = 'Please enter a valid email address.';
            isValid = false;
        }

        if (!password) {
            passwordErr.textContent = 'Password is required.';
            isValid = false;
        }

        if (!isValid) return;

        // Disable button while processing
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                formAlert.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Login failed')}</div>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
                return;
            }

            // Save last email to localStorage on successful login
            try {
                localStorage.setItem('virexLastEmail', email);
            } catch (e) {}

            // Redirect back or to dashboard
            const params = new URLSearchParams(window.location.search);
            const redirectUrl = params.get('redirect') || 'dashboard.html';
            window.location.href = redirectUrl;

        } catch (err) {
            formAlert.innerHTML = `<div class="alert alert-error">Network error. Please try again.</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log In';
        }
    });
}

// SIGNUP VALIDATION & SUBMISSION
function setupSignupValidation(form) {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const cityInput = document.getElementById('city');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');

    const nameErr = document.getElementById('nameErr');
    const emailErr = document.getElementById('emailErr');
    const phoneErr = document.getElementById('phoneErr');
    const cityErr = document.getElementById('cityErr');
    const passwordErr = document.getElementById('passwordErr');
    const confirmPasswordErr = document.getElementById('confirmPasswordErr');
    const formAlert = document.getElementById('formAlert');
    const submitBtn = document.getElementById('submitBtn');

    // Clear errors on typing
    nameInput.addEventListener('input', () => nameErr.textContent = '');
    emailInput.addEventListener('input', () => emailErr.textContent = '');
    phoneInput.addEventListener('input', () => phoneErr.textContent = '');
    cityInput.addEventListener('change', () => cityErr.textContent = '');
    passwordInput.addEventListener('input', () => passwordErr.textContent = '');
    confirmInput.addEventListener('input', () => confirmPasswordErr.textContent = '');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formAlert.innerHTML = '';
        let isValid = true;

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const city = cityInput.value;
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;

        if (!name || name.length < 2) {
            nameErr.textContent = 'Name must be at least 2 characters.';
            isValid = false;
        }

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            emailErr.textContent = 'Please enter a valid email address.';
            isValid = false;
        }

        if (!phone || !/^\d{10}$/.test(phone)) {
            phoneErr.textContent = 'Phone number must be exactly 10 digits.';
            isValid = false;
        }

        if (!city) {
            cityErr.textContent = 'Please select your city.';
            isValid = false;
        }

        if (!password || password.length < 6) {
            passwordErr.textContent = 'Password must be at least 6 characters.';
            isValid = false;
        }

        if (confirmPassword !== password) {
            confirmPasswordErr.textContent = 'Passwords do not match.';
            isValid = false;
        }

        if (!isValid) return;

        // Disable button while processing
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ name, email, phone, city, password })
            });

            const data = await res.json();

            if (!res.ok) {
                formAlert.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Signup failed')}</div>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
                return;
            }



            // Nodemailer confirmation banner
            formAlert.innerHTML = `<div class="alert alert-success">Welcome email sent to <strong>${escapeHtml(email)}</strong>! Redirecting to dashboard...</div>`;

            setTimeout(() => {
                const params = new URLSearchParams(window.location.search);
                const redirectUrl = params.get('redirect') || 'dashboard.html';
                window.location.href = redirectUrl;
            }, 1500);

        } catch (err) {
            formAlert.innerHTML = `<div class="alert alert-error">Network error. Please try again.</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign Up';
        }
    });
}