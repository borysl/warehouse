# UDS Inventory

Application to manage inventory for NGO

## Installation on Raspberry Pi

Assuming you have SSH access to your Raspberry Pi

1. Install: nginx, node.js, pm2

    ```sh
    sudo apt update && sudo apt upgrade -y
    
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

    sudo npm install pm2 -g
    ```

    Ensure pm2 log also captures date and time:

    ```sh
    pm2 set pm2:log_date_format "YYYY-MM-DD HH:mm:ss"
    ```

2. Have bare repository ~/inventory.git
3. Have remote pi:

    ```sh
    git remote add pi <your-user>@pi:/home/<your user>/inventory.git
    ```

4. Add hook to your repo:

    ```sh
    #!/bin/bash
    git --work-tree=/var/www/inventory --git-dir=/home/<your user>/inventory.git checkout -f main

    cd /var/www/inventory/backend

    npm install --production

    pm2 reload inventory-server
    ```

5. Start server with pm2:

```sh
cd /var/www/warehouse/backend
npm install --production
pm2 start npm --name "warehouse-server" -- start
```

## Google Sheets Integration

To enable the backend to read/write to Google Sheets, you must configure a Service Account.

### Prerequisites

1.  **Create a Service Account**:
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/).
    *   Create a new project or select an existing one.
    *   Enable the **Google Sheets API** and **Google Drive API**.
    *   Go to **IAM & Admin** > **Service Accounts**.
    *   Create a service account.
    *   (Optional) You can skip the role assignment step. The actual **Write/Upload** permissions will be granted later by **Sharing** the specific Google Sheet and Drive Folder with this service account's email (just like sharing with a human).
    *   Create a JSON key for this account and download it (click on Tab Keys --> Create Key --> JSON)

2.  **Configure Credentials**:
    *   Rename the downloaded JSON key file to `credentials.json`.
    *   Place `credentials.json` in the root of the project (same level as `package.json`). This file is neither committed nor deployed, so you will need to do this operation for every environment.

3.  **Share Resources**:
    *   Open the newly created `credentials.json` file and copy the `client_email` address.
    *   Go to your Google Sheet (`https://docs.google.com/spreadsheets/d/1yqVU0OF08OIdoaYxdiZUla0pWb0JwOpzzZuvpip_pVI`) and click **Share**.
    *   Paste the service account email and give it **Editor** access.
    *   Go to the Google Drive folder (`https://drive.google.com/drive/folders/1yNHvBcpHG37vO0LpJk2vPmPkL4Jp-bS-`) and share it with the service account email as well (`Contributor` access).

## Google Authentication (Login)

To enable users to login with their individual Google Accounts, you must configure a Google OAuth 2.0 Client ID.

### Setup Instructions for GCP Administrators

1.  **Configure OAuth Consent Screen**:
    *   In the [Google Cloud Console](https://console.cloud.google.com/), go to **APIs & Services** > **OAuth consent screen**.
    *   Create new credentials or **Get started**
    *   Type `uds-inventory` in the app name field
    *   Type your email in the user support email field
    *   Select **Internal**.
    *   Fill in the notification email.
    *   Agree to Google API Services: User Data Policy.
    *   Press **Create**.
    *   Add the scope `.../auth/userinfo.profile` and `.../auth/userinfo.email`.

2.  **Create OAuth 2.0 Client ID**:
    *   Go to **APIs & Services** > **Credentials**.
    *   Click **Create Credentials** > **OAuth client ID**.
    *   Select **Web application** as the Application type.
    *   Put `uds-inventory-web` as name
    *   Under **Authorized JavaScript origins**, add your application URLs:
        *   `http://localhost:3000`
        *   `http://localhost:8080`
        *   `https://inventory.ukrainedefensesupport.org`
    *   Click **Create**.

3.  **Update Configuration**:
    *   Copy the **Client ID** (it looks like `xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com`).
    *   Paste it into the `GOOGLE_CLIENT_ID` field in your `config.js` file.

## Recommended settings for nginx

```conf
server {
        listen 80 default_server;
        listen [::]:80 default_server;

        root /var/www/inventory/html;
        index index.html;

        server_name pi 192.168.88.15;

        location /inv-api/ {
                proxy_pass http://127.0.0.1:3000/;
                proxy_set_header Host $host;
        }

        location /api/ {
                proxy_pass http://127.0.0.1:8080/api/;
        }

        # return 301 https://$host$request_uri;
}

server {
        listen 443 ssl default_server;
        listen [::]:443 ssl default_server;

        root /var/www/inventory/html;
        index index.html;

        server_name pi 192.168.88.15;

        ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
        ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        location /inv-api/ {
                proxy_pass http://localhost:3000/;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;

                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location / {
                # First attempt to serve request as file, then
                # as directory, then fall back to displaying a 404.
                try_files $uri $uri/ /index.html;
        }

        # deny access to .htaccess files, if Apache's document root
        # concurs with nginx's one
        #
        #location ~ /\.ht {
        #       deny all;
        #}

## Further development

Now we need to have endpoint /i/:id where user can check-in or check-out.
This page can be only for users who logged in.
The top of the page should remain, bu search behavior should be changed - now only when user hits search the app navigates to /search?q= ... otherwise nothing got changed. Until user 