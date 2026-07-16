# Deploy GitHub Pages frontend + VPS Docker backend

Tài liệu này ghi lại trạng thái deploy hiện tại cho MindMap English.

## Mục tiêu

- Frontend chạy trên GitHub Pages:
  - `https://hoatv2211.github.io/MindMap_English/`
- Backend/API chạy Docker trên VPS:
  - `https://103-180-138-84.sslip.io`
- Frontend chỉ biết public API URL qua `VITE_API_BASE_URL`.
- Provider secrets chỉ nằm trên VPS Docker environment, không đưa vào frontend/GitHub Pages.

## Trạng thái đã xong

- Repo đã có commit mới trên `main`:
  - `c943a62 Support GitHub Pages hosting and cross-site auth`
  - `10bdbf1 fix: include tsx in Docker runtime image`
- GHCR package đang public:
  - `ghcr.io/hoatv2211/mindmap_english:latest`
  - tag có `sha-10bdbf1`
- HTTPS đã cấp bằng Let's Encrypt cho:
  - `https://103-180-138-84.sslip.io`
- VPS dùng Nginx reverse proxy, không dùng Caddy vì Nginx đang chiếm port `80`.
- Docker Compose chạy từ `/root/mindmap-english` vì Docker Compose trên VPS không đọc được file dưới `/opt/mindmap-english` trong lần setup.

## GitHub Pages config

Trong GitHub repo, vào:

```text
Settings -> Secrets and variables -> Actions -> Variables
```

Đặt biến:

```text
VITE_API_BASE_URL=https://103-180-138-84.sslip.io
```

Không đặt các biến này ở GitHub Pages/Actions variables:

```text
PROVIDER_API_KEY
PROVIDER_API_URL
PROVIDER_API_CHAT_MODEL
PROVIDER_API_STT_MODEL
PROVIDER_API_TTS_MODEL
NINEROUTER_KEY
```

Các biến provider chỉ đặt trong Docker Compose trên VPS.

## VPS files

### Docker Compose path

Dùng path này:

```bash
/root/mindmap-english/docker-compose.yml
```

Nội dung chuẩn:

```yaml
services:
  mindmap-english:
    image: ghcr.io/hoatv2211/mindmap_english:latest
    container_name: mindmap-english
    restart: unless-stopped
    ports:
      - "127.0.0.1:8787:8787"
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 8787
      DATA_DIR: /data
      ALLOW_REMOTE_BINDING: "true"

      APP_ORIGIN: "https://hoatv2211.github.io"
      AUTH_SECURE_COOKIES: "true"
      AUTH_COOKIE_SAME_SITE: "none"

      PROVIDER_API_URL: "http://host.docker.internal:20128"
      PROVIDER_API_KEY: ""
      PROVIDER_API_CHAT_MODEL: ""
      PROVIDER_API_STT_MODEL: ""
      PROVIDER_API_TTS_MODEL: ""
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - mindmap_english_data:/data

volumes:
  mindmap_english_data:
```

Nếu provider API có key/model, sửa các dòng `PROVIDER_API_*` trên VPS.

### Nginx config path

Dùng path:

```bash
/etc/nginx/sites-available/mindmap-english-api
/etc/nginx/sites-enabled/mindmap-english-api
```

Config trước Certbot:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name 103-180-138-84.sslip.io;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }
}
```

Certbot đã sửa config để bật HTTPS. Không ghi đè file nếu không cần.

## Lệnh update backend trên VPS

Mỗi lần GitHub Actions build xong Docker image mới:

```bash
cd /root/mindmap-english

docker compose -f ./docker-compose.yml pull
docker compose -f ./docker-compose.yml up -d --force-recreate
docker compose -f ./docker-compose.yml ps
docker compose -f ./docker-compose.yml logs --tail=100
```

Test health:

```bash
curl -i http://127.0.0.1:8787/api/health
curl -i https://103-180-138-84.sslip.io/api/health
```

Kết quả đúng:

```text
HTTP/1.1 200 OK
```

Body có JSON kiểu:

```json
{"ok":true}
```

## Lỗi đã gặp và cách xử lý

### `no configuration file provided: not found`

Nguyên nhân trong lần setup: Docker Compose không đọc được file dưới `/opt/mindmap-english` dù `ls` thấy file.

Cách xử lý đã dùng:

```bash
mkdir -p /root/mindmap-english
cp /opt/mindmap-english/docker-compose.yml /root/mindmap-english/docker-compose.yml
cd /root/mindmap-english
docker compose -f ./docker-compose.yml config
```

### `unauthorized` khi `docker compose pull`

Nguyên nhân: GHCR package private hoặc Docker cache auth cũ.

Đã xử lý:

- Package `mindmap_english` đã chuyển public.
- Nếu VPS vẫn lỗi, chạy:

```bash
docker logout ghcr.io || true
rm -f ~/.docker/config.json
systemctl restart docker
docker pull ghcr.io/hoatv2211/mindmap_english:latest
```

### `Cannot find package 'tsx' imported from /app/`

Nguyên nhân: Docker runtime image thiếu `tsx` nhưng command chạy:

```text
node --import tsx src/server/index.ts
```

Đã fix trong commit:

```text
10bdbf1 fix: include tsx in Docker runtime image
```

Sau khi GitHub Actions build xong image mới, pull lại trên VPS:

```bash
cd /root/mindmap-english
docker compose -f ./docker-compose.yml pull
docker compose -f ./docker-compose.yml up -d --force-recreate
```

### `502 Bad Gateway` từ Nginx

Nguyên nhân: container backend chưa chạy hoặc đang crash.

Check:

```bash
docker compose -f /root/mindmap-english/docker-compose.yml ps
docker compose -f /root/mindmap-english/docker-compose.yml logs --tail=100
curl -i http://127.0.0.1:8787/api/health
```

Khi local health `127.0.0.1:8787` OK, Nginx HTTPS thường OK theo.

## Lệnh kiểm tra nhanh VPS

```bash
ss -ltnp | grep -E ':80|:443|:8787'
systemctl status nginx --no-pager
nginx -t
certbot certificates

docker --version
docker compose version
docker compose -f /root/mindmap-english/docker-compose.yml ps
```

## Luồng deploy chuẩn từ giờ

1. Sửa code local.
2. Chạy verify local:

```bash
npm run test
npm run typecheck
npm run build
```

3. Commit + push `main`.
4. Chờ GitHub Actions:
   - `Docker publish` pass.
   - `GitHub Pages` pass.
5. VPS pull image mới:

```bash
cd /root/mindmap-english
docker compose -f ./docker-compose.yml pull
docker compose -f ./docker-compose.yml up -d --force-recreate
```

6. Test:

```bash
curl -i https://103-180-138-84.sslip.io/api/health
```

7. Mở frontend:

```text
https://hoatv2211.github.io/MindMap_English/
```
