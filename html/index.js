// document.addEventListener('DOMContentLoaded', load);

function load() {
    const searchInput = document.getElementById('inventory-search');
    const searchForm = document.getElementById('search-form');
    const helpTextDiv = document.getElementById('help-text');
    const resultsContainer = document.getElementById('results-container');
    const resultsGrid = document.getElementById('results-grid');
    const itemContainer = document.getElementById('item-container');
    const authContainer = document.getElementById('auth-container');

    let googleClientId = null;
    let user = null;
    let lastPerformedQuery = null;
    let debounceTimeout = null;

    // --- Initialization ---

    initAuth();
    checkSession();
    fetchVersion();

    // Handle Browser Navigation (Back/Forward)
    window.addEventListener('popstate', () => {
        handleRouting();
    });

    // Initial Routing
    handleRouting();

    // --- Routing & Navigation ---

    async function handleRouting() {
        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');

        // Reset visibility
        helpTextDiv.style.display = 'none';
        resultsContainer.style.display = 'none';
        itemContainer.style.display = 'none';

        if (path.startsWith('/i/')) {
            const itemId = path.split('/')[2];
            showView('item', itemId);
        } else if (path === '/search' || query) {
            if (query) {
                searchInput.value = compressAliases(query);
                showView('search', query);
            } else {
                showView('home');
            }
        } else {
            showView('home');
        }
    }

    function navigateTo(path, query = null) {
        let url = path;
        if (query) url += `?q=${encodeURIComponent(query)}`;
        window.history.pushState({}, '', url);
        handleRouting();
    }

    function showView(view, data) {
        if (view === 'home') {
            helpTextDiv.style.display = 'block';
            searchInput.value = '';
            lastPerformedQuery = null;
        } else if (view === 'search') {
            resultsContainer.style.display = 'block';
            performSearch(data);
        } else if (view === 'item') {
            itemContainer.style.display = 'block';
            loadItemDetail(data);
        }
    }

    // --- Search Logic ---
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query.length >= 3) {
            // Expand :me for the URL
            let urlQuery = query;
            if (user && user.email) {
                urlQuery = query.replace(/\b(owner|holder|donor):me\b/gi, `$1:${user.email}`);
            }
            navigateTo('/search', urlQuery);
        }
    });

    function updateSearchButtonState() {
        const searchBtn = document.getElementById('search-btn');
        if (!searchBtn) return;
        const query = searchInput.value.trim();
        const cleanLength = query.replace(/\s/g, '').length;
        searchBtn.disabled = cleanLength < 3;
    }

    searchInput.addEventListener('input', () => {
        updateSearchButtonState();

        const query = searchInput.value.trim();
        if (query.length >= 3) {
            // Live search logic (triggers after debounce but doesn't change URL)
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                // Only trigger if we are already in search mode or on home
                const path = window.location.pathname;
                if (path === '/' || path === '/search') {
                    resultsContainer.style.display = 'block';
                    helpTextDiv.style.display = 'none';
                    performSearch(query);
                }
            }, 300);
        } else if (window.location.pathname === '/') {
            helpTextDiv.style.display = 'block';
            resultsContainer.style.display = 'none';
        }
    });

    async function performSearch(query) {
        if (!query || query === lastPerformedQuery) return;
        lastPerformedQuery = query;

        resultsGrid.innerHTML = '<p>Searching...</p>';

        try {
            let effectiveQuery = query;
            if (user && user.email) {
                effectiveQuery = query.replace(/\b(owner|holder|donor):me\b/gi, `$1:${user.email}`);
            }

            const res = await fetch(`/inv-api/search?q=${encodeURIComponent(effectiveQuery)}`);
            if (!res.ok) throw new Error('Search failed');

            const data = await res.json();
            renderGrid(data);
        } catch (err) {
            console.error(err);
            resultsGrid.innerHTML = '<p>Error loading results.</p>';
        }
    }

    // --- Rendering Logic (Templates) ---

    function renderGrid(items) {
        if (!items || items.length === 0) {
            resultsGrid.innerHTML = '<p>No items found.</p>';
            return;
        }

        const template = document.getElementById('search-results-template');
        const rowTemplate = document.getElementById('inventory-row-template');
        const fragment = template.content.cloneNode(true);
        const tbody = fragment.querySelector('tbody');

        items.forEach(item => {
            const row = rowTemplate.content.cloneNode(true);

            // Populate Name Link
            const nameLink = row.querySelector('.item-link');
            nameLink.textContent = item.Name;
            nameLink.href = `/i/${item.Id}`;
            nameLink.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(`/i/${item.Id}`);
            });

            // Populate text cells
            row.querySelector('.col-type').textContent = item.Type;
            row.querySelector('.col-category').textContent = item.Category;
            row.querySelector('.col-qty').textContent = item.Quantity;
            row.querySelector('.col-location').textContent = item.MainLocation;

            // Description & Photo
            const descCell = row.querySelector('.desc-cell');
            descCell.title = item.Description || '';
            row.querySelector('.desc-text').textContent = item.Description || '';

            const photoIcon = row.querySelector('.photo-icon');
            if (item.Photo) {
                photoIcon.onclick = () => window.open(item.Photo, '_blank');
            } else {
                photoIcon.style.display = 'none';
            }

            // Action Button
            const btn = row.querySelector('.action-btn');
            updateActionButton(btn, item);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (btn.classList.contains('login-btn-action')) {
                    google.accounts.id.prompt();
                } else {
                    navigateTo(`/i/${item.Id}`);
                }
            });

            tbody.appendChild(row);
        });

        resultsGrid.innerHTML = '';
        resultsGrid.appendChild(fragment);
    }

    function updateActionButton(btn, item) {
        let text = 'Checkout';
        let cls = 'checkout-btn';

        if (!user) {
            text = 'Login to proceed';
            cls = 'login-btn-action';
        } else if (item.Holder) {
            const match = item.Holder.match(/<([^>]+)>/);
            const holderEmail = match ? match[1] : item.Holder;
            if (holderEmail === user.email) {
                text = 'Checkin';
                cls = 'checkin-btn';
            }
        }

        btn.textContent = text;
        btn.className = `action-btn ${cls}`;
        btn.dataset.id = item.Id;
    }

    async function loadItemDetail(id) {
        itemContainer.innerHTML = '<p>Loading item details...</p>';
        try {
            const res = await fetch(`/inv-api/item/${id}`);
            if (!res.ok) throw new Error('Failed to fetch item');
            const item = await res.json();
            renderItemDetail(item);
        } catch (err) {
            console.error(err);
            itemContainer.innerHTML = '<p>Error loading item details.</p>';
        }
    }

    function renderItemDetail(item) {
        const template = document.getElementById('item-detail-template');
        const fragment = template.content.cloneNode(true);

        fragment.querySelector('.back-btn').onclick = () => window.history.back();
        fragment.querySelector('.item-name').textContent = item.Name;
        fragment.querySelector('.detail-id').textContent = item.Id;
        fragment.querySelector('.detail-type').textContent = item.Type;
        fragment.querySelector('.detail-category').textContent = item.Category;
        fragment.querySelector('.detail-qty').textContent = item.Quantity;
        fragment.querySelector('.detail-location').textContent = item.MainLocation;
        fragment.querySelector('.detail-holder').textContent = item.Holder || 'None';
        fragment.querySelector('.detail-owner').textContent = item.Owner || 'None';
        fragment.querySelector('.detail-donor').textContent = item.Donor || 'None';
        fragment.querySelector('.detail-storage').textContent = item.StorageGuidelines || 'None';
        fragment.querySelector('.detail-description').textContent = item.Description || 'None';
        fragment.querySelector('.detail-damages').textContent = item.Damages || 'None';
        fragment.querySelector('.detail-registered').textContent = item.Registered ? new Date(item.Registered).toLocaleString() : 'N/A';
        fragment.querySelector('.detail-updated').textContent = item.LastUpdate ? new Date(item.LastUpdate).toLocaleString() : 'N/A';

        if (item.Photo) {
            const img = document.createElement('img');
            img.src = item.Photo;
            img.className = 'detail-photo';
            img.style.maxWidth = '100%';
            img.onclick = () => window.open(item.Photo, '_blank');
            fragment.querySelector('.detail-photos').appendChild(img);
        }

        const actionBtn = fragment.querySelector('.main-action-btn');
        updateActionButton(actionBtn, item);
        actionBtn.onclick = () => {
            if (actionBtn.classList.contains('login-btn-action')) {
                google.accounts.id.prompt();
            } else {
                // Future: Handle actual checkin/checkout logic
                alert('Action coming soon!');
            }
        };

        itemContainer.innerHTML = '';
        itemContainer.appendChild(fragment);
    }

    // --- Helper Functions ---

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function compressAliases(query) {
        if (!user || !user.email || !query) return query;
        const emailRegex = new RegExp(`\\b(owner|holder|donor):${user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        return query.replace(emailRegex, '$1:me');
    }

    async function fetchVersion() {
        try {
            const res = await fetch('/inv-api/version');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('version-text').textContent = `Version: ${data.version}`;
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
                if (window.location.pathname === '/' || window.location.pathname === '/search') {
                    refreshSearch();
                }
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
                updateAuthUI();
            }
        } catch (e) {
            console.error('Failed to initialize Google Auth:', e);
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
                refreshSearch();
            } else {
                alert('Auth failed');
            }
        } catch (e) {
            console.error('Auth error:', e);
        }
    }

    function updateAuthUI() {
        if (!authContainer) return;
        if (user) {
            authContainer.innerHTML = `
                <button class="login-btn logged-in">
                    <div class="user-info">
                        <img src="${user.picture}" alt="${user.name}" class="user-pic">
                        <span>${user.name}</span>
                    </div>
                </button>
            `;
            authContainer.querySelector('.login-btn').onclick = logout;
        } else {
            authContainer.innerHTML = `<button class="login-btn">Login</button>`;
            authContainer.querySelector('.login-btn').onclick = () => google.accounts.id.prompt();
        }
    }

    async function logout() {
        if (!confirm('Are you sure you want to log out?')) return;
        try {
            const res = await fetch('/inv-api/auth/logout', { method: 'POST' });
            if (res.ok) {
                user = null;
                location.reload();
            }
        } catch (e) {
            console.error('Logout error:', e);
        }
    }

    function refreshSearch() {
        const query = searchInput.value.trim();
        if (query) {
            lastPerformedQuery = null;
            performSearch(query);
        }
    }
}
