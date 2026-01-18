fetch('/api/version')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        document.getElementById('version-text').textContent = `Version: ${data.version}`;
    })
    .catch(error => {
        console.error('Error fetching version:', error);
        document.getElementById('version-text').textContent = 'Version: Unknown';
    });
