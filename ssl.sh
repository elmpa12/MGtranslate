# Generate self-signed certificate
sudo mkdir -p /etc/ssl/private
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/mg.falconsoft.dev.key \
  -out /etc/ssl/certs/mg.falconsoft.dev.crt \
  -subj "/CN=mg.falconsoft.dev"

# Create nginx config with SSL
sudo tee /etc/nginx/sites-available/mg.falconsoft.dev << 'EOF'
map $http_upgrade $mg_connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    server_name mg.falconsoft.dev;

    ssl_certificate /etc/ssl/certs/mg.falconsoft.dev.crt;
    ssl_certificate_key /etc/ssl/private/mg.falconsoft.dev.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $mg_connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF
