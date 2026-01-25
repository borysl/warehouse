// document.addEventListener('DOMContentLoaded', load);

function load() {
    const searchInput = document.getElementById('inventory-search');
    const helpTextDiv = document.getElementById('help-text');
    const resultsContainer = document.getElementById('results-container');
    const resultsGrid = document.getElementById('results-grid');
    const loginBtn = document.querySelector('.login-btn');

    let googleClientId = null;
    let user = null;

    // Initialize Google Auth
    initAuth();

    // Check for existing session
    checkSession();

    // Fetch Version on Load
    fetchVersion();

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        const cleanLength = query.replace(/\s/g, '').length;

        if (cleanLength >= 3) {
            helpTextDiv.style.display = 'none';
            resultsContainer.style.display = 'block';

            clearTimeout(debounceTimeout);
            var debounceTimeout = setTimeout(() => {
                console.log('searching');
                performSearch(query);
            }, 300);
        } else {
            helpTextDiv.style.display = 'block';
            resultsContainer.style.display = 'none';
            resultsGrid.innerHTML = '';
        }
    });

    async function performSearch(query) {
        try {
            resultsGrid.innerHTML = '<p>Searching...</p>';
            const res = await fetch(`/inv-api/search?q=${encodeURIComponent(query)}`);
            
            if (!res.ok) {
                const text = await res.text();
                if (text.includes('Fatal Error')) {
                    resultsGrid.innerHTML = text; // Inject the red error HTML
                } else {
                    resultsGrid.innerHTML = '<p>Error loading results.</p>';
                }
                return;
            }

            const data = await res.json();
            renderGrid(data);
        } catch (err) {
            console.error(err);
            resultsGrid.innerHTML = '<p>Error loading results.</p>';
        }
    }

    function renderGrid(items) {
        if (!items || items.length === 0) {
            resultsGrid.innerHTML = '<p>No items found.</p>';
            return;
        }

        // Table Header
        let html = `
        <table class="inventory-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>T</th>
                    <th>C</th>
                    <th>Qty</th>
                    <th>L</th>
                    <th>Description</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
        `;

        items.forEach(item => {
            html += `
            <tr>
                <td><a href="/item/${item.Id}" class="item-link">${escapeHtml(item.Name)}</a></td>
                <td>${escapeHtml(item.Type)}</td>
                <td>${escapeHtml(item.Category)}</td>
                <td>${item.Quantity}</td>
                <td>${escapeHtml(item.MainLocation)}</td>
                <td>
                    <div class="desc-cell" title="${escapeHtml(item.Description)}">
                        ${item.Photo ? `<span class="photo-icon" onclick="window.open('${item.Photo}', '_blank')">📷</span>` : ''}
                        ${escapeHtml(item.Description)}
                    </div>
                </td>
                <td>
                    <button class="action-btn checkout-btn" data-id="${item.Id}">Checkout</button>
                </td>
            </tr>
            `;
        });

        html += '</tbody></table>';
        resultsGrid.innerHTML = html;

        // Attach listeners
        // Attach listeners

        document.querySelectorAll('.checkout-btn').forEach(b => {
             b.addEventListener('click', () => window.location.href = `/checkout/${b.dataset.id}`);
        });
    }



    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function fetchVersion() {
        try {
            const res = await fetch('/inv-api/version');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('version-text').textContent = `Version: ${data.version}`;
            } else {
                const text = await res.text();
                if (text.includes('Fatal Error')) {
                    helpTextDiv.innerHTML = text;
                }
            }
        } catch (e) {
            document.getElementById('version-text').textContent = 'Version: Unknown';
        }
    }

    async function checkSession() {
        try {
            const res = await fetch('/inv-api/auth/me');
            if (res.ok) {
                const data = await res.json();
                user = data.user;
                updateAuthUI();
            }
        } catch (e) {
            console.error('Failed to check session:', e);
        }
    }

    async function initAuth() {
        try {
            const res = await fetch('/inv-api/config');
            if (res.ok) {
                const config = await res.json();
                googleClientId = config.googleClientId;
                
                google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleCredentialResponse,
                    use_fedcm_for_prompt: false
                });

                loginBtn.addEventListener('click', () => {
                    if (user) {
                        logout();
                    } else {
                        google.accounts.id.prompt();
                    }
                });
            }
        } catch (e) {
            console.error('Failed to initialize Google Auth:', e);
        }
    }

    async function logout() {
        if (!confirm('Are you sure you want to log out?')) return;
        
        try {
            const res = await fetch('/inv-api/auth/logout', { method: 'POST' });
            if (res.ok) {
                user = null;
                location.reload(); // Refresh to clear state and update UI
            }
        } catch (e) {
            console.error('Logout error:', e);
        }
    }

    async function handleCredentialResponse(response) {
        try {
            const res = await fetch('/inv-api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });

            if (res.ok) {
                const data = await res.json();
                user = data.user;
                updateAuthUI();
            } else {
                alert('Auth failed');
            }
        } catch (e) {
            console.error('Auth error:', e);
        }
    }

    function updateAuthUI() {
        if (user) {
            loginBtn.innerHTML = `
                <div class="user-info">
                    <img src="${user.picture}" alt="${user.name}" class="user-pic">
                    <span>${user.name}</span>
                </div>
            `;
            loginBtn.classList.add('logged-in');
        }
    }
};
