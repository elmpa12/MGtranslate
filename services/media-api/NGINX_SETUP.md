# Nginx Configuration Changes Required

To enable the browser client to work, add these location blocks to `/etc/nginx/sites-available/mg.falconsoft.dev`:

```nginx
# Media API service - Client page
location /client {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Media API service - Static assets (SDK bundle)
location /meet-client.bundle.js {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

After adding, run:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Test URLs

- Client page: `https://mg.falconsoft.dev/client?meetingCode=xxx-xxxx-xxx`
- Health check: `https://mg.falconsoft.dev/media-api/health`
- OAuth start: `https://mg.falconsoft.dev/auth`
