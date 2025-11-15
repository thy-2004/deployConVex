# Sửa lỗi GitHub OAuth - redirect_uri

## Các bước cần làm:

### 1. Tắt dev server hiện tại
- Nhấn `Ctrl + C` trong terminal đang chạy `npm start`

### 2. Clear cache (Tùy chọn nhưng khuyên dùng)
```bash
# Xóa cache của Vite
rm -rf node_modules/.vite

# Hoặc trên Windows PowerShell:
Remove-Item -Recurse -Force node_modules\.vite
```

### 3. Restart dev server
```bash
npm start
```

### 4. Thử lại đăng nhập bằng GitHub

---

## Nếu vẫn lỗi, thử thêm cả localhost callback URL:

GitHub cho phép nhiều callback URLs. Cập nhật trong GitHub OAuth App:

1. Vào: https://github.com/settings/developers
2. Click vào OAuth App "convex-saas"
3. Tìm field **"Authorization callback URL"**
4. Thêm cả 2 URLs (mỗi URL một dòng):
   ```
   http://localhost:5173/auth/github/callback
   https://hushed-crow-887.convex.site/auth/github/callback
   ```
5. Click **"Update application"**
6. Restart dev server lại

---

## Kiểm tra Environment Variables:

Đảm bảo các biến đã được set:
```bash
npx convex env list
```

Bạn sẽ thấy:
- `AUTH_GITHUB_ID=Ov23liKO03gsbBPXGLGI`
- `AUTH_GITHUB_SECRET=f8639b95e0aa6dadd6837da1aa4e570288ce4310`

---

## Debug:

Nếu vẫn lỗi, kiểm tra:
1. Console trong trình duyệt (F12) - xem lỗi chi tiết
2. Terminal logs - xem có lỗi gì không
3. Đảm bảo GitHub OAuth App đã được update và save


