# Hướng dẫn về Subscription và Thanh toán

## Tại sao bảng `subscriptions` trống?

Bảng `subscriptions` sẽ trống nếu:
1. **Chưa có user nào hoàn thành onboarding** - Subscription chỉ được tạo khi user hoàn thành bước onboarding (nhập username)
2. **Chưa có user nào đăng ký** - Cần có user đăng nhập và hoàn thành onboarding
3. **Stripe chưa được cấu hình** - Cần có Stripe keys để tạo subscription

## Cách tạo Subscription đầu tiên:

### Bước 1: Đảm bảo Stripe đã được cấu hình

Kiểm tra environment variables:
```bash
npx convex env list
```

Cần có:
- `STRIPE_SECRET_KEY` (ví dụ: `sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` (cho webhook)

### Bước 2: Chạy Init function để tạo Plans

Init function sẽ tự động chạy khi dev server start, nhưng bạn có thể chạy thủ công:

```bash
# Init function sẽ tự động chạy khi npm start
# Hoặc chạy thủ công trong Convex Dashboard > Functions > init
```

### Bước 3: Tạo User và hoàn thành Onboarding

1. **Đăng nhập** vào ứng dụng (bằng Email hoặc GitHub)
2. **Hoàn thành Onboarding**:
   - Vào trang `/onboarding/username`
   - Nhập username
   - Chọn currency (USD/EUR)
   - Submit

3. **Sau khi hoàn thành onboarding**:
   - Hệ thống sẽ tự động:
     - Tạo Stripe Customer
     - Tạo Free Subscription trong Stripe
     - Tạo record trong bảng `subscriptions` của Convex

### Bước 4: Kiểm tra

Sau khi user hoàn thành onboarding, kiểm tra:
- **Convex Dashboard > Data > subscriptions** - Sẽ có 1 record
- **Stripe Dashboard > Customers** - Sẽ có customer mới
- **Stripe Dashboard > Subscriptions** - Sẽ có free subscription

## Flow hoàn chỉnh:

```
User đăng nhập 
  ↓
Hoàn thành Onboarding (nhập username)
  ↓
completeOnboarding() được gọi
  ↓
Tạo Stripe Customer
  ↓
Tạo Free Subscription trong Stripe
  ↓
Tạo record trong Convex subscriptions table
  ↓
User có thể upgrade/downgrade plan
```

## Test Subscription:

### 1. Test với User mới:
- Đăng nhập bằng email/GitHub
- Hoàn thành onboarding
- Kiểm tra subscription được tạo

### 2. Test Upgrade:
- Vào Settings > Billing
- Chọn Pro plan
- Click "Upgrade to PRO"
- Thanh toán bằng Stripe test card: `4242 4242 4242 4242`

### 3. Test Change Plan:
- Nếu đã có Pro subscription
- Chọn plan khác
- Click "Change Plan"
- Subscription sẽ được update ngay

## Troubleshooting:

### ❌ Subscription không được tạo sau onboarding

**Nguyên nhân có thể:**
1. Stripe keys chưa được set
2. Init function chưa chạy (plans chưa có)
3. Lỗi khi tạo Stripe customer

**Giải pháp:**
1. Kiểm tra Stripe keys: `npx convex env list`
2. Kiểm tra plans table có data chưa
3. Xem logs trong Convex Dashboard > Logs

### ❌ Lỗi "Plan not found"

**Nguyên nhân:** Init function chưa chạy hoặc plans chưa được tạo

**Giải pháp:**
1. Chạy init function trong Convex Dashboard
2. Hoặc restart dev server (init sẽ tự chạy)

### ❌ Không thể upgrade

**Nguyên nhân:** 
- User chưa có customerId
- Plans chưa được tạo trong Stripe

**Giải pháp:**
1. Đảm bảo user đã hoàn thành onboarding
2. Kiểm tra plans trong Convex và Stripe

## Lưu ý quan trọng:

1. **Mỗi user chỉ có 1 subscription** - Khi upgrade, subscription cũ sẽ được thay thế
2. **Free subscription được tạo tự động** - Khi user hoàn thành onboarding
3. **Stripe Test Mode** - Dùng test keys để test, không tính phí thật
4. **Webhook cần được setup** - Để xử lý subscription updates từ Stripe

## Test Cards (Stripe Test Mode):

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0025 0000 3155`

Xem thêm: https://stripe.com/docs/testing#cards


