# UDS Inventory

Application to manage inventory for NGO

## Installation on Raspberry Pi

Assuming you have SSH access to your Raspberry Pi

1. Install: nginx, node.js, pm2
2. Have bare repository ~/inventory.git
3. Have remote pi:

```sh
git remote add pi <your-user>@pi:/home/<your user>/inventory.git
```

4. Add hook to your repo:

```sh
#!/bin/bash
git --work-tree=/var/www/inventory --git-dir=/home/myuser/inventory.git checkout -f

cd /var/www/inventory/backend

npm install --production

pm2 reload inventory-server
```

5. Start server with pm3:

```sh
cd /var/www/inventory/backend
npm install --production
pm2 start npm --name "inventory-server" -- start
```

## Recommended settings for nginx

```conf
server {
        listen 80 default_server;
        listen [::]:80 default_server;

        root /var/www/inventory/html;
        index index.html;

        server_name pi 192.168.88.15;
        return 301 https://$host$request_uri;
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

        location /admin {
                proxy_pass http://127.0.0.1:8080/admin;

                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;

                proxy_read_timeout 90;
                proxy_connect_timeout 90;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection "upgrade";

                proxy_hide_header 'Content-Security-Policy';
        }

        location / {
                # First attempt to serve request as file, then
                # as directory, then fall back to displaying a 404.
                try_files $uri $uri/ =404;
        }

        # deny access to .htaccess files, if Apache's document root
        # concurs with nginx's one
        #
        #location ~ /\.ht {
        #       deny all;
        #}
}
```
