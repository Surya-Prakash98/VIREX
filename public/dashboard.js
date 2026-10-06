// ===== DASHBOARD LOGIC =====

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const isLoggedIn = await checkAuthAndSetupNav();
    if (!isLoggedIn) return; // redirected to login

    setupTabNavigation();
    setupAddListingForm();
    loadDashboardData();
});

// Guard & Navbar Setup
async function checkAuthAndSetupNav() {
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (!res.ok) {

            window.location.href = 'login.html';
            return false;
        }

        const data = await res.json();
        currentUser = data.user;

        const welcomeHeading = document.getElementById('welcomeHeading');
        if (welcomeHeading) welcomeHeading.textContent = `Welcome, ${currentUser.name}!`;

        const authNav = document.getElementById('authNav');
        authNav.innerHTML = `
            <span class="user-badge">Hi, ${escapeHtml(currentUser.name)}</span>
            <button id="logoutBtn" class="btn btn-secondary btn-sm" style="margin-left:8px;">Logout</button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}

            window.location.href = 'login.html';
        });

        return true;
    } catch (err) {
        window.location.href = 'login.html';
        return false;
    }
}

// Tab navigation & localStorage tab persistence
function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

        });
    });
}

// Add listing form & localStorage draft persistence
function setupAddListingForm() {
    const toggleBtn = document.getElementById('toggleAddListingBtn');
    const formCard = document.getElementById('addListingFormCard');
    const cancelBtn = document.getElementById('cancelAddListingBtn');
    const form = document.getElementById('addListingForm');
    const imageFileInput = document.getElementById('imageFile');
    const imageUrlHidden = document.getElementById('imageUrl');

    // Handle image file selection and convert to Base64
    imageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                imageUrlHidden.value = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    toggleBtn.addEventListener('click', () => {
        const isHidden = formCard.style.display === 'none';
        formCard.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? 'Close Form' : '+ Add New Listing';
    });

    cancelBtn.addEventListener('click', () => {
        formCard.style.display = 'none';
        toggleBtn.textContent = '+ Add New Listing';
    });



    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const alertDiv = document.getElementById('addListingAlert');
        alertDiv.innerHTML = '';
        clearFormErrors();

        let isValid = true;
        const title = document.getElementById('title').value.trim();
        const category = document.getElementById('category').value;
        const condition = document.getElementById('condition').value;
        const description = document.getElementById('description').value.trim();
        const city = document.getElementById('city').value;
        const rentPricePerDay = parseFloat(document.getElementById('rentPricePerDay').value);
        const deposit = parseFloat(document.getElementById('deposit').value) || 0;
        const imageUrl = document.getElementById('imageUrl').value.trim();

        if (!title || title.length < 3) {
            showError('titleErr', 'Title must be at least 3 characters.');
            isValid = false;
        }

        if (!description || description.length < 10) {
            showError('descriptionErr', 'Description must be at least 10 characters.');
            isValid = false;
        }

        if (!rentPricePerDay || rentPricePerDay <= 0) {
            showError('rentPriceErr', 'Valid rent price per day required.');
            isValid = false;
        }

        if (!imageUrl) {
            showError('imageFileErr', 'Please select an image file for the listing.');
            isValid = false;
        }

        if (!isValid) return;

        const submitBtn = document.getElementById('addListingSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting Listing...';

        try {
            const body = {
                title, category, condition, description, city, deposit, imageUrl, rentPricePerDay
            };

            const res = await fetch('/api/listings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                alertDiv.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Failed to add listing')}</div>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Listing';
                return;
            }

            alertDiv.innerHTML = `<div class="alert alert-success">Listing posted successfully!</div>`;
            form.reset();

            setTimeout(() => {
                formCard.style.display = 'none';
                toggleBtn.textContent = '+ Add New Listing';
                alertDiv.innerHTML = '';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Listing';
                loadDashboardData();
            }, 1000);

        } catch (err) {
            alertDiv.innerHTML = `<div class="alert alert-error">Network error. Failed to save listing.</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Listing';
        }
    });
}


function clearFormErrors() {
    document.querySelectorAll('#addListingForm .error-text').forEach(span => span.textContent = '');
}

function showError(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// MAIN DASHBOARD LOADER
async function loadDashboardData() {
    loadMyListings();
    loadMyRentals();
    loadMyRequests();
}

// 1. My Listings
async function loadMyListings() {
    const statusDiv = document.getElementById('myListingsStatus');
    const gridDiv = document.getElementById('myListingsGrid');
    const statMyListings = document.getElementById('statMyListings');

    statusDiv.innerHTML = `<div class="alert">Loading your listings...</div>`;
    gridDiv.innerHTML = '';

    try {
        const res = await fetch('/api/my/listings', { credentials: 'same-origin' });
        const data = await res.json();

        if (!res.ok) {
            statusDiv.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Failed to load listings')}</div>`;
            return;
        }

        statMyListings.textContent = data.length;

        if (data.length === 0) {
            statusDiv.innerHTML = `<div class="alert">You haven't listed any electronics yet. Click "+ Add New Listing" above to get started!</div>`;
            return;
        }

        statusDiv.innerHTML = '';
        gridDiv.innerHTML = data.map(item => `
            <div class="card" style="cursor: default;">
                <img src="${escapeHtml(item.imageUrl)}" class="card-img" alt="${escapeHtml(item.title)}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80';">
                <div class="card-body">
                    <h3 class="card-title">${escapeHtml(item.title)}</h3>
                    <div class="card-city">📍 ${escapeHtml(item.city)} • ${escapeHtml(item.category)}</div>
                    <div class="card-badges" style="margin-bottom:0.75rem;">
                        <span class="badge badge-rent">rent</span>
                        <span class="badge badge-${item.status}">${item.status}</span>
                    </div>
                    <div style="display:flex; gap:0.5rem; margin-top:auto;">
                        <a href="listing.html?id=${item._id}" class="btn btn-secondary btn-sm" style="flex:1;">View</a>
                        <button onclick="deleteListing('${item._id}')" class="btn btn-danger btn-sm">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        statusDiv.innerHTML = `<div class="alert alert-error">Network error. Could not load listings.</div>`;
    }
}

async function deleteListing(id) {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
        const res = await fetch(`/api/listings/${id}`, { method: 'DELETE', credentials: 'same-origin' });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Failed to delete listing.");
            return;
        }

        loadDashboardData();
    } catch (err) {
        alert("Network error.");
    }
}

// 2. My Rentals & Purchases
async function loadMyRentals() {
    const statusDiv = document.getElementById('myRentalsStatus');
    const listDiv = document.getElementById('myRentalsList');
    const statMyRentals = document.getElementById('statMyRentals');

    statusDiv.innerHTML = `<div class="alert">Loading your rentals...</div>`;
    listDiv.innerHTML = '';

    try {
        const res = await fetch('/api/my/bookings', { credentials: 'same-origin' });
        const data = await res.json();

        if (!res.ok) {
            statusDiv.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Failed to load bookings')}</div>`;
            return;
        }

        statMyRentals.textContent = data.length;

        if (data.length === 0) {
            statusDiv.innerHTML = `<div class="alert">You have no active rental requests or purchases. Browse <a href="index.html">Home</a> to find tech!</div>`;
            return;
        }

        statusDiv.innerHTML = '';
        listDiv.innerHTML = data.map(b => {
            const listing = b.listing || { title: 'Listing Removed', imageUrl: '' };
            const startDateStr = new Date(b.startDate).toLocaleDateString();
            const endDateStr = new Date(b.endDate).toLocaleDateString();

            let returnBtnHtml = '';
            if (b.status === 'approved') {
                returnBtnHtml = `<button onclick="updateBookingStatus('${b._id}', 'returned')" class="btn btn-primary btn-sm" style="margin-top:0.5rem;">Mark Returned</button>`;
            }

            return `
                <div style="background: white; padding: 1.25rem; border-radius: var(--radius); border: 1px solid var(--border-color); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <h4 style="font-size: 1.1rem; margin-bottom: 0.3rem;">${escapeHtml(listing.title)}</h4>
                        <div style="color: var(--text-muted); font-size: 0.875rem;">
                            Dates: ${startDateStr} - ${endDateStr}
                        </div>
                        <div style="color: var(--primary-color); font-weight: 700; margin-top: 0.3rem;">
                            Total: ₹${b.totalPrice.toLocaleString()}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge badge-${b.status}" style="font-size:0.85rem;">${b.status}</span>
                        <div>${returnBtnHtml}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        statusDiv.innerHTML = `<div class="alert alert-error">Network error.</div>`;
    }
}

// 3. Requests On My Items
async function loadMyRequests() {
    const statusDiv = document.getElementById('myRequestsStatus');
    const listDiv = document.getElementById('myRequestsList');
    const statPendingRequests = document.getElementById('statPendingRequests');

    statusDiv.innerHTML = `<div class="alert">Loading incoming requests...</div>`;
    listDiv.innerHTML = '';

    try {
        const res = await fetch('/api/my/requests', { credentials: 'same-origin' });
        const data = await res.json();

        if (!res.ok) {
            statusDiv.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Failed to load requests')}</div>`;
            return;
        }

        const pendingCount = data.filter(r => r.status === 'pending').length;
        statPendingRequests.textContent = pendingCount;

        if (data.length === 0) {
            statusDiv.innerHTML = `<div class="alert">No requests received for your items yet.</div>`;
            return;
        }

        statusDiv.innerHTML = '';
        listDiv.innerHTML = data.map(req => {
            const listing = req.listing || { title: 'Listing Removed' };
            const renter = req.renter || { name: 'Unknown User', email: '' };
            const startDateStr = new Date(req.startDate).toLocaleDateString();
            const endDateStr = new Date(req.endDate).toLocaleDateString();

            let actionBtnsHtml = '';
            if (req.status === 'pending') {
                actionBtnsHtml = `
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                        <button onclick="updateBookingStatus('${req._id}', 'approved')" class="btn btn-primary btn-sm">Approve</button>
                        <button onclick="updateBookingStatus('${req._id}', 'rejected')" class="btn btn-danger btn-sm">Reject</button>
                    </div>
                `;
            }

            return `
                <div style="background: white; padding: 1.25rem; border-radius: var(--radius); border: 1px solid var(--border-color); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <h4 style="font-size: 1.1rem; margin-bottom: 0.3rem;">Item: ${escapeHtml(listing.title)}</h4>
                        <div style="color: var(--text-muted); font-size: 0.875rem;">
                            Requested by: <strong>${escapeHtml(renter.name)}</strong> (${escapeHtml(renter.email)})
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.875rem; margin-top:0.2rem;">
                            Dates: ${startDateStr} - ${endDateStr}
                        </div>
                        <div style="color: var(--primary-color); font-weight: 700; margin-top: 0.3rem;">
                            Total: ₹${req.totalPrice.toLocaleString()}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge badge-${req.status}" style="font-size:0.85rem;">${req.status}</span>
                        ${actionBtnsHtml}
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        statusDiv.innerHTML = `<div class="alert alert-error">Network error.</div>`;
    }
}

// Update booking status (Approve / Reject / Return)
async function updateBookingStatus(id, newStatus) {
    try {
        const res = await fetch(`/api/bookings/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ status: newStatus })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Failed to update request status.");
            return;
        }

        // Show Nodemailer notice depending on status
        let notice = '';
        if (newStatus === 'approved' || newStatus === 'rejected') {
            notice = `Request ${newStatus}. Renter has been emailed!`;
        } else if (newStatus === 'returned') {
            notice = `Item marked as returned. Owner has been emailed!`;
        }
        if (notice) alert(notice);

        loadDashboardData();
    } catch (err) {
        alert("Network error.");
    }
}