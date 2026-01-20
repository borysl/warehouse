document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('inventory-search');
    const helpTextDiv = document.getElementById('help-text');
    const resultsContainer = document.getElementById('results-container');
    const resultsGrid = document.getElementById('results-grid');

    let debounceTimeout;

    // Fetch Version on Load
    fetchVersion();

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Hide help text logic
        // "collapse when user types over 3 symbols besides spaces"
        const cleanLength = query.replace(/\s/g, '').length;

        if (cleanLength > 3) {
            helpTextDiv.style.display = 'none';
            resultsContainer.style.display = 'block';

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
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
            if (!res.ok) throw new Error('Search failed');
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
            }
        } catch (e) {
            document.getElementById('version-text').textContent = 'Version: Unknown';
        }
    }
});
