# Hướng dẫn Đăng nhập bằng GitHub - Từng bước chi tiết

## Tổng quan

Hướng dẫn này sẽ giúp bạn cấu hình đăng nhập bằng GitHub OAuth từ đầu đến cuối.

---

## Bước 1: Tạo GitHub OAuth App

### 1.1. Truy cập GitHub Developer Settings

1. Đăng nhập vào tài khoản GitHub của bạn
2. Click vào **ảnh đại diện** ở góc trên bên phải
3. Chọn **Settings**
4. Trong menu bên trái, scroll xuống và click **Developer settings**
5. Click **OAuth Apps** (trong menu bên trái)
6. Click nút **"New OAuth App"** (màu xanh lá)

### 1.2. Điền thông tin OAuth App

**Application name:**
- Nhập tên ứng dụng của bạn (ví dụ: `Convex SaaS App` hoặc `My App`)

**Homepage URL:**
- **Cho Development (local):** `http://localhost:5173`
- **Cho Production:** URL của ứng dụng bạn deploy (ví dụ: `https://your-app.vercel.app`)

**Application description (tùy chọn):**
- Mô tả ngắn về ứng dụng (ví dụ: `My SaaS application`)

**Authorization callback URL:**
- **Cho Development:** `http://localhost:5173/auth/github/callback`
- **Cho Production:** `https://your-app.vercel.app/auth/github/callback`
- **Hoặc:** `https://your-convex-deployment.convex.cloud/auth/github/callback`

> ⚠️ **QUAN TRỌNG**: Callback URL phải khớp chính xác với URL mà ứng dụng của bạn sử dụng!

### 1.3. Đăng ký OAuth App

1. Click nút **"Register application"** (màu xanh lá)
2. Bạn sẽ được chuyển đến trang chi tiết của OAuth App

---

## Bước 2: Lấy Client ID và Client Secret

### 2.1. Copy Client ID

1. Trên trang chi tiết OAuth App, bạn sẽ thấy **Client ID**
2. **Client ID** là một chuỗi dài (ví dụ: `Iv1.8a61f9b3a7aba766`)
3. Click nút **Copy** bên cạnh Client ID hoặc copy thủ công
4. **Lưu lại** Client ID này (bạn sẽ cần dùng sau)

### 2.2. Tạo và Copy Client Secret

1. Scroll xuống phần **Client secrets**
2. Click nút **"Generate a new client secret"**
3. GitHub sẽ hiển thị một **Client Secret** mới
4. **⚠️ CẢNH BÁO**: Client Secret chỉ hiển thị **1 LẦN DUY NHẤT**!
5. **COPY NGAY** Client Secret và lưu vào nơi an toàn
6. Nếu bạn quên hoặc mất Client Secret, bạn sẽ phải tạo lại

> 💡 **Mẹo**: Dán Client Secret vào một file text tạm thời để không bị mất khi copy

---

## Bước 3: Cấu hình Environment Variables trong Convex

### 3.1. Set Client ID

Mở terminal và chạy lệnh sau (thay `YOUR_CLIENT_ID` bằng Client ID thực của bạn):

```bash
npx convex env set AUTH_GITHUB_ID YOUR_CLIENT_ID
```

**Ví dụ:**
```bash
npx convex env set AUTH_GITHUB_ID Iv1.8a61f9b3a7aba766
```

### 3.2. Set Client Secret

Chạy lệnh sau (thay `YOUR_CLIENT_SECRET` bằng Client Secret thực của bạn):

```bash
npx convex env set AUTH_GITHUB_SECRET YOUR_CLIENT_SECRET
```

**Ví dụ:**
```bash
npx convex env set AUTH_GITHUB_SECRET abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

### 3.3. Kiểm tra đã set thành công

Chạy lệnh để xem các environment variables:

```bash
npx convex env list
```

Bạn sẽ thấy `AUTH_GITHUB_ID` và `AUTH_GITHUB_SECRET` trong danh sách.

---

## Bước 4: Cấu hình Site URL (Nếu chưa có)

Đảm bảo `CONVEX_SITE_URL` và `SITE_URL` đã được set đúng:

### Cho Development:
```bash
npx convex env set CONVEX_SITE_URL http://localhost:5173
npx convex env set SITE_URL http://localhost:5173
```

### Cho Production:
```bash
npx convex env set CONVEX_SITE_URL https://your-app.vercel.app --prod
npx convex env set SITE_URL https://your-app.vercel.app --prod
```

---

## Bước 5: Test đăng nhập bằng GitHub

### 5.1. Khởi động ứng dụng

```bash
npm start
```

### 5.2. Test đăng nhập

1. Mở trình duyệt và vào `http://localhost:5173`
2. Vào trang đăng nhập
3. Click nút **"Github"** (nút có icon GitHub)
4. Bạn sẽ được chuyển đến trang GitHub để authorize
5. Click **"Authorize"** trên GitHub
6. GitHub sẽ redirect bạn quay lại ứng dụng
7. Nếu thành công, bạn sẽ được đăng nhập vào ứng dụng!

---

## Troubleshooting (Xử lý lỗi)

### ❌ Lỗi: "Invalid client_id"

**Nguyên nhân**: Client ID không đúng hoặc chưa được set

**Giải pháp**:
1. Kiểm tra lại Client ID trong GitHub OAuth App
2. Đảm bảo đã set đúng: `npx convex env set AUTH_GITHUB_ID ...`
3. Restart ứng dụng sau khi set environment variable

### ❌ Lỗi: "redirect_uri_mismatch"

**Nguyên nhân**: Callback URL trong GitHub OAuth App không khớp với URL thực tế

**Giải pháp**:
1. Vào GitHub OAuth App settings
2. Kiểm tra **Authorization callback URL**
3. Đảm bảo nó khớp với:
   - Development: `http://localhost:5173/auth/github/callback`
   - Production: `https://your-app.vercel.app/auth/github/callback`
4. Update nếu cần và save

### ❌ Lỗi: "Invalid client_secret"

**Nguyên nhân**: Client Secret không đúng hoặc chưa được set

**Giải pháp**:
1. Kiểm tra lại Client Secret trong GitHub OAuth App
2. Nếu quên, tạo lại Client Secret mới
3. Set lại: `npx convex env set AUTH_GITHUB_SECRET ...`
4. Restart ứng dụng

### ❌ Lỗi: GitHub OAuth không redirect về ứng dụng

**Nguyên nhân**: Site URL chưa được cấu hình đúng

**Giải pháp**:
1. Kiểm tra `CONVEX_SITE_URL` và `SITE_URL` đã được set chưa
2. Set lại nếu cần (xem Bước 4)
3. Restart ứng dụng

### ❌ Lỗi: "Cannot find module" hoặc build fail

**Giải pháp**:
1. Đảm bảo đã chạy `npm install`
2. Kiểm tra tất cả dependencies đã được cài đặt
3. Xóa `node_modules` và `package-lock.json`, sau đó chạy lại `npm install`

---

## Cấu hình cho Production

Khi deploy lên production, bạn cần:

### 1. Tạo OAuth App riêng cho Production (Khuyên dùng)

Tạo một OAuth App mới với:
- **Homepage URL**: URL production của bạn
- **Authorization callback URL**: URL production callback

### 2. Set Environment Variables cho Production

```bash
npx convex env set AUTH_GITHUB_ID YOUR_PRODUCTION_CLIENT_ID --prod
npx convex env set AUTH_GITHUB_SECRET YOUR_PRODUCTION_CLIENT_SECRET --prod
npx convex env set CONVEX_SITE_URL https://your-app.vercel.app --prod
npx convex env set SITE_URL https://your-app.vercel.app --prod
```

### 3. Update Callback URL trong GitHub OAuth App

Đảm bảo Callback URL trong GitHub OAuth App trỏ đến URL production.

---

## Checklist hoàn chỉnh

- [ ] Đã tạo GitHub OAuth App
- [ ] Đã copy và lưu Client ID
- [ ] Đã tạo và copy Client Secret
- [ ] Đã set `AUTH_GITHUB_ID` trong Convex
- [ ] Đã set `AUTH_GITHUB_SECRET` trong Convex
- [ ] Đã set `CONVEX_SITE_URL` và `SITE_URL`
- [ ] Đã test đăng nhập thành công
- [ ] (Nếu có) Đã cấu hình cho production

---

## Tài liệu tham khảo

- [GitHub OAuth Apps Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [Convex Auth Documentation](https://docs.convex.dev/auth)
- [@auth/core GitHub Provider](https://authjs.dev/reference/core/providers/github)

---

## Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Console logs trong trình duyệt (F12)
2. Terminal logs khi chạy ứng dụng
3. GitHub OAuth App settings
4. Convex environment variables

Chúc bạn thành công! 🎉


