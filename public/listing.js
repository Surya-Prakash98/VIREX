// ===== LISTING DETAILS LOGIC =====

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
let currentListing = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initAuthNav();
    const params = new URLSearchParams(window.location.search);
    const listingId = params.get('id');

    if (!listingId) {
        renderNotFound("No listing ID specified in URL.");
        return;
    }

    fetchListingDetails(listingId);
});

async function initAuthNav() {
    const authNav = document.getElementById('authNav');

    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            renderUserNav(currentUser.name);
        } else {
            currentUser = null;
            authNav.innerHTML = `<a href="login.html">Log In</a><a href="signup.html" class="btn btn-primary btn-sm">Sign Up</a>`;
        }
    } catch (err) {
        currentUser = null;
    }
}

function renderUserNav(userName) {
    const authNav = document.getElementById('authNav');
    authNav.innerHTML = `
        <span class="user-badge">Hi, ${escapeHtml(userName)}</span>
        <button id="logoutBtn" class="btn btn-secondary btn-sm" style="margin-left:8px;">Logout</button>
    `;
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
        window.location.reload();
    });
}

function renderNotFound(msg) {
    const statusDiv = document.getElementById('listingStatus');
    statusDiv.innerHTML = `
        <div class="alert alert-error" style="margin-top: 2rem; text-align: center;">
            <h2>Listing Not Found</h2>
            <p style="margin-top:0.5rem;">${escapeHtml(msg || 'The requested listing does not exist or has been removed.')}</p>
            <a href="index.html" class="btn btn-primary" style="margin-top: 1rem;">Back to Home</a>
        </div>
    `;
}

async function fetchListingDetails(id) {
    const statusDiv = document.getElementById('listingStatus');
    const contentDiv = document.getElementById('listingContent');

    statusDiv.innerHTML = `<div class="alert">Loading item details...</div>`;

    try {
        const res = await fetch(`/api/listings/${id}`, { credentials: 'same-origin' });
        if (!res.ok) {
            statusDiv.innerHTML = '';
            renderNotFound("Listing not found or invalid ID.");
            return;
        }

        currentListing = await res.json();
        statusDiv.innerHTML = '';
        contentDiv.style.display = 'block';
        renderListingUI(currentListing);

    } catch (err) {
        statusDiv.innerHTML = '';
        renderNotFound("Failed to load listing due to a network error.");
    }
}

function renderListingUI(item) {
    const contentDiv = document.getElementById('listingContent');
    const fallbackImg = 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80';

    const isOwner = currentUser && (currentUser._id === item.owner._id || currentUser.id === item.owner._id);
    const isAvailable = item.status === 'available';

    // Pricing details
    let priceDetailsHtml = '';
    priceDetailsHtml += `<p style="font-size: 1.1rem; margin-bottom: 0.4rem;"><strong>Rent:</strong> ₹${item.rentPricePerDay}/day</p>`;
    if (item.deposit) {
        priceDetailsHtml += `<p style="color: var(--text-muted); font-size: 0.9rem;">Security Deposit: ₹${item.deposit.toLocaleString()}</p>`;
    }

    contentDiv.innerHTML = `
        <div class="detail-layout">
            <!-- LEFT COLUMN: IMAGE & DESCRIPTION -->
            <div>
                <img src="${escapeHtml(item.imageUrl)}" 
                     alt="${escapeHtml(item.title)}" 
                     class="detail-img"
                     onerror="this.onerror=null;this.src='${fallbackImg}';">
                
                <div style="background: white; padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border-color); margin-top: 1.5rem;">
                    <h2>${escapeHtml(item.title)}</h2>
                    <div style="display:flex; gap: 0.5rem; margin: 0.75rem 0 1rem 0;">
                        <span class="badge badge-rent">rent</span>
                        <span class="badge badge-${item.status}">${item.status}</span>
                        <span class="chip" style="cursor:default;">${escapeHtml(item.category)}</span>
                    </div>

                    <p style="color: var(--text-muted); line-height: 1.6; margin-bottom: 1rem;">${escapeHtml(item.description)}</p>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">
                        <p><strong>Condition:</strong> ${escapeHtml(item.condition)}</p>
                        <p><strong>Listed by:</strong> ${escapeHtml(item.owner.name)} (${escapeHtml(item.owner.city)})</p>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: ACTION BOX & CONTACT -->
            <div>
                <div style="background: white; padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border-color); box-shadow: var(--shadow);">
                    <div style="margin-bottom: 1rem;">
                        ${priceDetailsHtml}
                    </div>

                    <div id="bookingAlert"></div>

                    ${renderActionBox(item, isOwner, isAvailable)}
                </div>

                <!-- CONTACT OWNER BOX -->
                <div style="background: white; padding: 1.5rem; border-radius: var(--radius); border: 1px solid var(--border-color); margin-top: 1.5rem;">
                    <h3>Contact Owner</h3>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Send a direct message to ${escapeHtml(item.owner.name)}.</p>
                    
                    <div id="contactAlert"></div>
                    <form id="contactForm">
                        <div class="form-group">
                            <textarea id="contactMessage" class="form-control" rows="3" placeholder="Hi, is this item available for delivery this weekend?"></textarea>
                            <span class="error-text" id="contactMsgErr"></span>
                        </div>
                        <button type="submit" id="contactBtn" class="btn btn-secondary" style="width: 100%;">Send Message</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    setupBookingInteractions(item, isAvailable);
    setupContactInteraction(item);
}

function renderActionBox(item, isOwner, isAvailable) {
    if (!currentUser) {
        const redirectUrl = encodeURIComponent(`listing.html?id=${item._id}`);
        return `
            <div style="text-align: center; padding: 1rem 0;">
                <p style="color: var(--text-muted); margin-bottom: 1rem;">Log in to submit a rental request.</p>
                <a href="/login?redirect=${redirectUrl}" class="btn btn-primary" style="width: 100%;">Login to Rent</a>
            </div>
        `;
    }

    if (isOwner) {
        return `
            <div class="alert alert-success" style="text-align: center; margin: 0;">
                <strong>This is your listing.</strong><br>
                Manage requests in your <a href="dashboard.html" style="color: var(--primary-color); font-weight: 700;">Dashboard</a>.
            </div>
        `;
    }

    if (!isAvailable) {
        return `
            <button class="btn btn-secondary" disabled style="width: 100%;">Item Currently Unavailable</button>
        `;
    }

    let formHtml = '';

    const today = new Date().toISOString().split('T')[0];
    formHtml += `
        <div style="padding-bottom: 1rem; margin-bottom: 1rem;">
            <h4 style="margin-bottom: 0.75rem;">Rent this Item</h4>
            <div class="form-group">
                <label for="startDate">Start Date</label>
                <input type="date" id="startDate" class="form-control" min="${today}">
                <span class="error-text" id="startDateErr"></span>
            </div>
            <div class="form-group">
                <label for="endDate">End Date</label>
                <input type="date" id="endDate" class="form-control" min="${today}">
                <span class="error-text" id="endDateErr"></span>
            </div>
            <div style="margin: 0.75rem 0; font-weight: 700; color: var(--primary-color);" id="totalPriceCalc">
                Total: ₹0 (0 days)
            </div>
            <button type="button" id="rentSubmitBtn" class="btn btn-primary" style="width: 100%;">Request to Rent</button>
        </div>
    `;

    return formHtml;
}

function setupBookingInteractions(item, isAvailable) {
    if (!currentUser || !isAvailable) return;

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const startDateErr = document.getElementById('startDateErr');
    const endDateErr = document.getElementById('endDateErr');
    const totalPriceCalc = document.getElementById('totalPriceCalc');
    const rentSubmitBtn = document.getElementById('rentSubmitBtn');
    const buySubmitBtn = document.getElementById('buySubmitBtn');
    const bookingAlert = document.getElementById('bookingAlert');

    let calculatedTotal = 0;

    function updateCalculations() {
        if (!startDateInput || !endDateInput) return;
        startDateErr.textContent = '';
        endDateErr.textContent = '';
        
        const startVal = startDateInput.value;
        const endVal = endDateInput.value;

        if (!startVal || !endVal) {
            totalPriceCalc.textContent = `Total: ₹0 (0 days)`;
            calculatedTotal = 0;
            return;
        }

        const start = new Date(startVal);
        const end = new Date(endVal);
        const today = new Date();
        today.setHours(0,0,0,0);

        if (start < today) {
            startDateErr.textContent = 'Start date cannot be in the past.';
            totalPriceCalc.textContent = `Total: ₹0 (0 days)`;
            calculatedTotal = 0;
            return;
        }

        if (end <= start) {
            endDateErr.textContent = 'End date must be after start date.';
            totalPriceCalc.textContent = `Total: ₹0 (0 days)`;
            calculatedTotal = 0;
            return;
        }

        const diffTime = Math.abs(end - start);
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        calculatedTotal = days * item.rentPricePerDay;
        totalPriceCalc.textContent = `Total: ₹${calculatedTotal.toLocaleString()} (${days} ${days === 1 ? 'day' : 'days'})`;
    }

    if (startDateInput && endDateInput) {
        startDateInput.addEventListener('change', updateCalculations);
        endDateInput.addEventListener('change', updateCalculations);
    }

    if (rentSubmitBtn) {
        rentSubmitBtn.addEventListener('click', async () => {
            bookingAlert.innerHTML = '';
            if (calculatedTotal <= 0) {
                startDateErr.textContent = 'Please select valid rental dates.';
                return;
            }

            rentSubmitBtn.disabled = true;
            rentSubmitBtn.textContent = 'Submitting...';

            try {
                const res = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        listingId: item._id,
                        startDate: startDateInput.value,
                        endDate: endDateInput.value,
                        totalPrice: calculatedTotal
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    bookingAlert.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Request failed')}</div>`;
                    rentSubmitBtn.disabled = false;
                    rentSubmitBtn.textContent = 'Request to Rent';
                    return;
                }

                bookingAlert.innerHTML = `<div class="alert alert-success">Rental request sent! Owner has been emailed.</div>`;
                rentSubmitBtn.disabled = true;
                rentSubmitBtn.textContent = 'Request Sent';

            } catch (err) {
                bookingAlert.innerHTML = `<div class="alert alert-error">Network error. Please try again.</div>`;
                rentSubmitBtn.disabled = false;
                rentSubmitBtn.textContent = 'Request to Rent';
            }
        });
    }
}

function setupContactInteraction(item) {
    const contactForm = document.getElementById('contactForm');
    const messageInput = document.getElementById('contactMessage');
    const msgErr = document.getElementById('contactMsgErr');
    const contactAlert = document.getElementById('contactAlert');
    const contactBtn = document.getElementById('contactBtn');

    if (!contactForm) return;

    messageInput.addEventListener('input', () => msgErr.textContent = '');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        contactAlert.innerHTML = '';

        if (!currentUser) {
            const redirectUrl = encodeURIComponent(`listing.html?id=${item._id}`);
            contactAlert.innerHTML = `<div class="alert alert-error">Please <a href="login.html?redirect=${redirectUrl}">log in</a> to contact the owner.</div>`;
            return;
        }

        const msg = messageInput.value.trim();
        if (!msg || msg.length < 10) {
            msgErr.textContent = 'Message must be at least 10 characters long.';
            return;
        }

        contactBtn.disabled = true;
        contactBtn.textContent = 'Sending...';

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ listingId: item._id, message: msg })
            });

            const data = await res.json();

            if (!res.ok) {
                contactAlert.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Failed to send email')}</div>`;
                contactBtn.disabled = false;
                contactBtn.textContent = 'Send Message';
                return;
            }

            contactAlert.innerHTML = `<div class="alert alert-success">Owner has been emailed!</div>`;
            messageInput.value = '';
            contactBtn.disabled = false;
            contactBtn.textContent = 'Send Message';

        } catch (err) {
            contactAlert.innerHTML = `<div class="alert alert-error">Network error. Message could not be sent.</div>`;
            contactBtn.disabled = false;
            contactBtn.textContent = 'Send Message';
        }
    });
}