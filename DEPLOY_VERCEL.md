# Hướng dẫn Deploy lên Vercel

## Tổng quan

Project này là một ứng dụng Convex SaaS với:
- **Frontend**: React + Vite (SPA - Single Page Application)
- **Backend**: Convex (được deploy riêng biệt)
- **Build output**: Thư mục `dist/`

## Các bước Deploy

### 1. Chuẩn bị Convex Backend

Convex backend được deploy riêng biệt, không phải trên Vercel. Trước khi deploy frontend:

```bash
# Deploy Convex backend lên production
npx convex deploy --prod
```

Lưu lại URL của Convex deployment (sẽ có dạng: `https://your-project.convex.cloud`)

### 2. Tạo Project trên Vercel

Có 2 cách:

#### Cách 1: Deploy qua Vercel Dashboard (Khuyên dùng)

1. Truy cập [vercel.com](https://vercel.com) và đăng nhập
2. Click "Add New Project"
3. Import repository từ GitHub/GitLab/Bitbucket
4. **Vercel sẽ tự động detect Vite framework** - không cần config thêm!

#### Cách 2: Deploy qua Vercel CLI

```bash
# Cài đặt Vercel CLI (nếu chưa có)
npm i -g vercel

# Login vào Vercel
vercel login

# Deploy project
vercel

# Deploy lên production
vercel --prod
```

### 3. Cấu hình Build Settings

**Lưu ý**: Vercel tự động detect Vite, nhưng bạn cần cấu hình **SPA routing**:

#### Option A: Dùng file `vercel.json` (đã có sẵn) ✅

File `vercel.json` đã được tạo với cấu hình đầy đủ:
- Build command: `npm run build`
- Output directory: `dist`
- Rewrites cho SPA routing

File này **không ảnh hưởng tiêu cực**, chỉ giúp cấu hình sẵn để tiện hơn.

#### Option B: Cấu hình trong Vercel Dashboard

Nếu không dùng `vercel.json`, vào **Settings > Build & Development Settings**:
- **Framework Preset**: Vite (auto-detect)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

Sau đó vào **Settings > Rewrites** và thêm:
- **Source**: `/(.*)`
- **Destination**: `/index.html`

### 4. Cấu hình Environment Variables

Trong Vercel Dashboard, vào **Settings > Environment Variables**, thêm:

#### Biến môi trường Frontend (Required):

```
VITE_CONVEX_URL=https://your-project.convex.cloud
```

**Lưu ý**: 
- `VITE_CONVEX_URL` là biến bắt buộc để frontend kết nối với Convex backend
- Lấy URL này từ output của `npx convex deploy --prod`
- Hoặc lấy từ [Convex Dashboard](https://dashboard.convex.dev)

#### Các biến môi trường khác (nếu cần):

Nếu bạn có các biến môi trường khác cho frontend, thêm chúng với prefix `VITE_`:

```
VITE_API_URL=...
VITE_APP_NAME=...
```

### 5. Cấu hình Routing (SPA) - QUAN TRỌNG!

**Vercel có thể auto-detect Vite, nhưng cần config rewrites cho SPA routing.**

Project này dùng React Router (TanStack Router), là SPA nên cần redirect tất cả routes về `/index.html`.

**Đã có sẵn trong `vercel.json`**:
```json
"rewrites": [
  {
    "source": "/(.*)",
    "destination": "/index.html"
  }
]
```

Nếu không dùng `vercel.json`, cấu hình trong Vercel Dashboard (Settings > Rewrites).

### 6. Deploy và Kiểm tra

Sau khi cấu hình xong:

1. **Deploy tự động**: Mỗi lần push code lên GitHub, Vercel sẽ tự động deploy
2. **Deploy thủ công**: 
   ```bash
   vercel --prod
   ```
3. **Kiểm tra**: 
   - Vào Vercel Dashboard để xem deployment logs
   - Kiểm tra URL production được cung cấp bởi Vercel
   - Test các routes và chức năng của ứng dụng

### 7. Cấu hình Custom Domain (Tùy chọn)

1. Vào **Settings > Domains** trong Vercel Dashboard
2. Thêm domain của bạn
3. Cấu hình DNS records theo hướng dẫn của Vercel

## Cấu hình Convex Backend cho Production

Đảm bảo các biến môi trường trong Convex backend đã được set:

```bash
# Set các biến môi trường cho Convex production deployment
npx convex env set AUTH_RESEND_KEY re_... --prod
npx convex env set STRIPE_SECRET_KEY sk_live_... --prod
npx convex env set STRIPE_WEBHOOK_SECRET whsec_... --prod
npx convex env set CONVEX_SITE_URL https://your-vercel-app.vercel.app --prod
npx convex env set SITE_URL https://your-vercel-app.vercel.app --prod
```

## So sánh với Netlify

| Tính năng | Netlify | Vercel |
|-----------|---------|--------|
| Config file | `netlify.toml` (bắt buộc) | `vercel.json` (tùy chọn - auto-detect) |
| Build command | Trong `netlify.toml` | Auto-detect từ `package.json` |
| Routing | `[[redirects]]` trong `netlify.toml` | `rewrites` trong `vercel.json` hoặc Dashboard |
| Convex deploy | Trong build command | Tách riêng (manual) |

**Khác biệt chính**: Vercel auto-detect tốt hơn, nhưng vẫn cần config rewrites cho SPA.

## Troubleshooting

### Lỗi: "Cannot find module" hoặc build fail
- Kiểm tra `package.json` có đầy đủ dependencies
- Đảm bảo `node_modules` được install đúng

### Lỗi: "VITE_CONVEX_URL is not defined"
- Kiểm tra environment variables trong Vercel Dashboard
- Đảm bảo biến có prefix `VITE_`
- Redeploy sau khi thêm biến môi trường

### Lỗi: Routing không hoạt động (404)
- Kiểm tra `vercel.json` có cấu hình `rewrites` đúng
- Đảm bảo `rewrites` redirect tất cả routes về `/index.html`
- Hoặc config rewrites trong Vercel Dashboard

### Lỗi: Kết nối Convex fail
- Kiểm tra `VITE_CONVEX_URL` có đúng không
- Kiểm tra Convex backend đã được deploy chưa
- Kiểm tra CORS settings trong Convex (nếu có)

## Lưu ý quan trọng

1. **File `vercel.json`**: File này **không ảnh hưởng tiêu cực** đến deploy. Nó chỉ giúp cấu hình sẵn để tiện hơn. Nếu không có, Vercel vẫn auto-detect nhưng bạn phải config rewrites trong Dashboard.

2. **Auto-detect**: Vercel tự động detect Vite framework, nhưng **vẫn cần config rewrites cho SPA routing** (đã có trong `vercel.json`)

3. **Convex Backend**: Convex backend được deploy riêng, không phải trên Vercel. Vercel chỉ deploy frontend.

4. **Environment Variables**: 
   - Frontend variables: Phải có prefix `VITE_` để Vite expose chúng
   - Backend variables: Set trong Convex dashboard, không phải Vercel

5. **Build Output**: Vite build output vào `dist/` (Vercel auto-detect)

6. **Stripe Webhook**: Nếu dùng Stripe, cần config webhook URL trong Stripe Dashboard:
   ```
   https://your-vercel-app.vercel.app/stripe/webhook
   ```
   (Đường dẫn này phụ thuộc vào cấu hình routing trong Convex)

## Tài liệu tham khảo

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Convex Deployment](https://docs.convex.dev/deployment)

