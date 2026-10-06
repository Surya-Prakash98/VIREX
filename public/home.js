// ===== HOME PAGE LOGIC =====

// Escape HTML utility to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Current Filter State
let filters = {
    search: '',
    category: 'All',
    city: ''
};

document.addEventListener('DOMContentLoaded', () => {
    initAuthNav();
    setupFilterListeners();
    fetchListings();
});

// Check auth state & update navbar
async function initAuthNav() {
    const authNav = document.getElementById('authNav');
    


    // Verify with backend
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (res.ok) {
            const data = await res.json();
            // Cache user in localStorage
            renderUserNav(data.user.name);
        } else {
            // Logged out
            authNav.innerHTML = `<a href="login.html">Log In</a><a href="signup.html" class="btn btn-primary btn-sm">Sign Up</a>`;
        }
    } catch (err) {
        console.error("Auth check failed:", err);
    }
}

function renderUserNav(userName) {
    const authNav = document.getElementById('authNav');
    authNav.innerHTML = `
        <span class="user-badge">Hi, ${escapeHtml(userName)}</span>
        <button id="logoutBtn" class="btn btn-secondary btn-sm" style="margin-left:8px;">Logout</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

async function handleLogout() {
    try {
        await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {}
    window.location.reload();
}



function setupFilterListeners() {
    const searchInput = document.getElementById('searchInput');
    const cityInput = document.getElementById('cityInput');
    const chips = document.querySelectorAll('.chip');

    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filters.search = e.target.value.trim();
            fetchListings();
        }, 300);
    });

    cityInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filters.city = e.target.value;
            fetchListings();
        }, 300);
    });

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filters.category = chip.getAttribute('data-category');
            fetchListings();
        });
    });
}

// Fetch listings from MONGODB via express API
async function fetchListings() {
    const statusDiv = document.getElementById('listingsStatus');
    const gridDiv = document.getElementById('listingsGrid');

    statusDiv.innerHTML = `<div class="alert">Loading available listings...</div>`;
    gridDiv.innerHTML = '';

    try {
        const query = new URLSearchParams({
            search: filters.search,
            category: filters.category,
            city: filters.city
        });

        const res = await fetch(`/api/listings?${query.toString()}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (!res.ok) {
            statusDiv.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Failed to load listings')}</div>`;
            return;
        }

        if (!data || data.length === 0) {
            statusDiv.innerHTML = `<div class="alert">No listings found matching your search. Try adjusting your filters.</div>`;
            return;
        }

        statusDiv.innerHTML = '';
        gridDiv.innerHTML = data.map(item => renderListingCard(item)).join('');

        // Attach click handlers to navigate to listing.html?id=ID
        document.querySelectorAll('.card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                window.location.href = `listing.html?id=${id}`;
            });
        });

    } catch (err) {
        statusDiv.innerHTML = `<div class="alert alert-error">Network error. Please try again later.</div>`;
    }
}

function renderListingCard(item) {
    const fallbackImage = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80';
    let priceText = `₹${item.rentPricePerDay}/day`;

    const statusBadge = `<span class="badge badge-${item.status}">${item.status}</span>`;

    return `
        <div class="card" data-id="${item._id}">
            <img src="${escapeHtml(item.imageUrl)}" 
                 alt="${escapeHtml(item.title)}" 
                 class="card-img" 
                 onerror="this.onerror=null;this.src='${fallbackImage}';">
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(item.title)}</h3>
                <div class="card-city">📍 ${escapeHtml(item.city)} • ${escapeHtml(item.category)}</div>
                <div class="card-price">${priceText}</div>
                <div class="card-badges">
                    ${statusBadge}
                </div>
            </div>
        </div>
    `;
}