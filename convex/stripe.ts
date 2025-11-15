import Stripe from "stripe";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "@cvx/_generated/server";
import { v } from "convex/values";
import { ERRORS } from "~/errors";
import { auth } from "@cvx/auth";
import { currencyValidator, intervalValidator, PLANS, CURRENCIES } from "@cvx/schema";
import { api, internal } from "~/convex/_generated/api";
import { SITE_URL, STRIPE_SECRET_KEY } from "@cvx/env";
import { asyncMap } from "convex-helpers";
import { planKeyValidator } from "@cvx/schema";

/**
 * TODO: Uncomment to require Stripe keys.
 * Also remove the `|| ''` from the Stripe constructor.
 */
/*
if (!STRIPE_SECRET_KEY) {
  throw new Error(`Stripe - ${ERRORS.ENVS_NOT_INITIALIZED})`)
}
*/

export const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
  typescript: true,
});

/**
 * The following functions are prefixed 'PREAUTH' or 'UNAUTH' because they are
 * used as scheduled functions and do not have a currently authenticated user to
 * reference. PREAUTH means a user id is passed in, and must be authorized prior
 * to scheduling the function. UNAUTH means authorization is not required.
 *
 * All PREAUTH and UNAUTH functions should be internal.
 *
 * Note: this is an arbitrary naming convention, feel free to change or remove.
 */

/**
 * Creates a Stripe customer for a user.
 */
export const PREAUTH_updateCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { customerId: args.customerId });
  },
});

export const PREAUTH_getUserById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const PREAUTH_getUserSubscription = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const PREAUTH_createStripeCustomer = internalAction({
  args: {
    currency: currencyValidator,
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.runQuery(internal.stripe.PREAUTH_getUserById, {
        userId: args.userId,
      });
      if (!user) {
        throw new Error("User not found");
      }
      if (user.customerId) {
        // Customer đã tồn tại, không cần tạo lại
        return;
      }

      if (!user.email) {
        throw new Error("User email is required to create Stripe customer");
      }

      const customer = await stripe.customers
        .create({ 
          email: user.email, 
          name: user.username || undefined 
        })
        .catch((err) => {
          console.error("Stripe customer creation error:", err);
          throw new Error(`Failed to create Stripe customer: ${err instanceof Error ? err.message : "Unknown error"}`);
        });
      
      if (!customer) {
        throw new Error(ERRORS.STRIPE_CUSTOMER_NOT_CREATED);
      }

      await ctx.runAction(internal.stripe.PREAUTH_createFreeStripeSubscription, {
        userId: args.userId,
        customerId: customer.id,
        currency: args.currency,
      });
    } catch (error) {
      console.error("PREAUTH_createStripeCustomer error:", error);
      // Re-throw với message rõ ràng hơn
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERRORS.STRIPE_CUSTOMER_NOT_CREATED);
    }
  },
});

export const UNAUTH_getDefaultPlan = internalQuery({
  handler: async (ctx) => {
    return ctx.db
      .query("plans")
      .withIndex("key", (q) => q.eq("key", PLANS.FREE))
      .unique();
  },
});

export const PREAUTH_getUserByCustomerId = internalQuery({
  args: {
    customerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("customerId", (q) => q.eq("customerId", args.customerId))
      .unique();
    if (!user) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!subscription) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    const plan = await ctx.db.get(subscription.planId);
    if (!plan) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    return {
      ...user,
      subscription: {
        ...subscription,
        planKey: plan.key,
      },
    };
  },
});

export const PREAUTH_createSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    planId: v.id("plans"),
    priceStripeId: v.string(),
    currency: currencyValidator,
    stripeSubscriptionId: v.string(),
    status: v.string(),
    interval: intervalValidator,
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (subscription) {
      throw new Error("Subscription already exists");
    }
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      planId: args.planId,
      priceStripeId: args.priceStripeId,
      stripeId: args.stripeSubscriptionId,
      currency: args.currency,
      interval: args.interval,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    });
  },
});

export const PREAUTH_replaceSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionStripeId: v.string(),
    input: v.object({
      currency: currencyValidator,
      planStripeId: v.string(),
      priceStripeId: v.string(),
      interval: intervalValidator,
      status: v.string(),
      currentPeriodStart: v.number(),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!subscription) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    await ctx.db.delete(subscription._id);
    const plan = await ctx.db
      .query("plans")
      .withIndex("stripeId", (q) => q.eq("stripeId", args.input.planStripeId))
      .unique();
    if (!plan) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      planId: plan._id,
      stripeId: args.subscriptionStripeId,
      priceStripeId: args.input.priceStripeId,
      interval: args.input.interval,
      status: args.input.status,
      currency: args.input.currency,
      currentPeriodStart: args.input.currentPeriodStart,
      currentPeriodEnd: args.input.currentPeriodEnd,
      cancelAtPeriodEnd: args.input.cancelAtPeriodEnd,
    });
  },
});

export const PREAUTH_deleteSubscription = internalMutation({
  args: {
    subscriptionStripeId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("stripeId", (q) => q.eq("stripeId", args.subscriptionStripeId))
      .unique();
    if (!subscription) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    await ctx.db.delete(subscription._id);
  },
});

/**
 * Creates a Stripe free tier subscription for a user.
 */
export const PREAUTH_createFreeStripeSubscription = internalAction({
  args: {
    userId: v.id("users"),
    customerId: v.string(),
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    try {
      const plan = await ctx.runQuery(internal.stripe.UNAUTH_getDefaultPlan);
      if (!plan) {
        console.error("FREE plan not found in database. Please sync Stripe products first.");
        throw new Error("FREE plan not found. Please contact support or try again later.");
      }

      // Kiểm tra xem đã có subscription chưa
      const existingSubscription = await ctx.runQuery(internal.stripe.PREAUTH_getUserSubscription, {
        userId: args.userId,
      });
      
      if (existingSubscription) {
        // Đã có subscription rồi, không cần tạo lại
        console.log("Subscription already exists for user");
        return;
      }

      // FREE plan không cần tạo subscription trong Stripe (vì nó là $0)
      // Chỉ cần tạo subscription record trong database
      const now = Math.floor(Date.now() / 1000);
      const oneYearFromNow = now + 365 * 24 * 60 * 60; // 1 năm sau

      // Tìm price cho FREE plan (có thể không có stripeId vì là $0)
      const yearlyPrice = plan?.prices?.year?.[args.currency as keyof typeof plan.prices.year];
      const priceStripeId = yearlyPrice?.stripeId || `free_${args.currency}_year`; // Fake ID nếu không có

      // Tạo subscription record trong database mà không cần gọi Stripe API
      await ctx.runMutation(internal.stripe.PREAUTH_createSubscription, {
        userId: args.userId,
        planId: plan._id,
        currency: args.currency,
        priceStripeId: priceStripeId,
        stripeSubscriptionId: `free_sub_${args.userId}`, // Fake Stripe subscription ID
        status: "active",
        interval: "year",
        currentPeriodStart: now,
        currentPeriodEnd: oneYearFromNow,
        cancelAtPeriodEnd: false,
      });

      await ctx.runMutation(internal.stripe.PREAUTH_updateCustomerId, {
        userId: args.userId,
        customerId: args.customerId,
      });
    } catch (error) {
      console.error("PREAUTH_createFreeStripeSubscription error:", error);
      // Re-throw với message rõ ràng hơn
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
  },
});

export const getCurrentUserSubscription = internalQuery({
  args: {
    planId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    const [currentSubscription, newPlan] = await Promise.all([
      ctx.db
        .query("subscriptions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db.get(args.planId),
    ]);
    if (!currentSubscription) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    const currentPlan = await ctx.db.get(currentSubscription.planId);
    return {
      currentSubscription: {
        ...currentSubscription,
        plan: currentPlan,
      },
      newPlan,
    };
  },
});

/**
 * Creates a Stripe checkout session for a user.
 */
export const createSubscriptionCheckout = action({
  args: {
    userId: v.id("users"),
    planId: v.id("plans"),
    planInterval: intervalValidator,
    currency: currencyValidator,
  },
  handler: async (ctx, args): Promise<string | undefined> => {
    try {
      // Kiểm tra Stripe key
      if (!STRIPE_SECRET_KEY) {
        console.error("Stripe secret key not configured");
        throw new Error("Stripe secret key not configured. Please set STRIPE_SECRET_KEY in Convex environment variables.");
      }

      const user = await ctx.runQuery(api.app.getCurrentUser);
      if (!user) {
        console.error("User not found");
        throw new Error("User not found. Please log in again.");
      }
      
      // Kiểm tra username - nếu chưa có username thì cần hoàn thành onboarding
      if (!user.username) {
        console.error("User does not have username. User needs to complete onboarding.");
        throw new Error("Please complete onboarding first. You need a username to create a subscription.");
      }
      
      // Nếu chưa có customerId nhưng đã có username, tự động tạo customerId
      if (!user.customerId) {
        console.log("User has username but no customerId. Creating Stripe customer...");
        const currency = args.currency;
        try {
          // Tạo Stripe customer và subscription
          // PREAUTH_createStripeCustomer sẽ tạo customer và gọi PREAUTH_updateCustomerId
          await ctx.runAction(internal.stripe.PREAUTH_createStripeCustomer, {
            currency,
            userId: user._id,
          });
          
          // Lấy lại user để có customerId mới (mutation đã chạy xong trong action)
          const updatedUser = await ctx.runQuery(api.app.getCurrentUser);
          if (!updatedUser?.customerId) {
            // Nếu vẫn chưa có, có thể do độ trễ của database, thử lại một lần nữa
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryUser = await ctx.runQuery(api.app.getCurrentUser);
            if (!retryUser?.customerId) {
              throw new Error("Failed to create Stripe customer. Please refresh the page and try again.");
            }
            user.customerId = retryUser.customerId;
          } else {
            user.customerId = updatedUser.customerId;
          }
        } catch (error) {
          console.error("Error creating Stripe customer:", error);
          // Nếu lỗi là do customer đã tồn tại hoặc các lỗi khác, thử lấy lại user để xem có customerId không
          const retryUser = await ctx.runQuery(api.app.getCurrentUser);
          if (retryUser?.customerId) {
            // Nếu đã có customerId (có thể đã được tạo bởi process khác), sử dụng nó
            user.customerId = retryUser.customerId;
            console.log("Customer ID found after error, continuing...");
          } else {
            // Nếu vẫn chưa có customerId, throw error với message rõ ràng
            if (error instanceof Error) {
              // Kiểm tra các lỗi cụ thể và cung cấp message phù hợp
              if (error.message.includes("Price not available")) {
                throw new Error(`Price not available for FREE plan in ${args.currency.toUpperCase()}. Please use USD or EUR, or contact support.`);
              }
              if (error.message.includes("User email is required")) {
                throw new Error("User email is required. Please update your profile with an email address.");
              }
              throw error;
            }
            throw new Error(`Failed to create Stripe customer: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }
      }

      const { currentSubscription, newPlan } = await ctx.runQuery(
        internal.stripe.getCurrentUserSubscription,
        { planId: args.planId },
      );
      if (!currentSubscription?.plan) {
        console.error("Current subscription not found");
        throw new Error("Current subscription not found. Please complete onboarding first.");
      }
      if (!newPlan) {
        console.error("New plan not found");
        throw new Error("Selected plan not found. Please refresh the page.");
      }

      // Nếu đang chọn cùng plan, không làm gì
      if (currentSubscription.plan.key === newPlan.key) {
        return;
      }

      // Debug: Log cấu trúc plan để kiểm tra
      console.log("Plan structure:", {
        planKey: newPlan.key,
        planName: newPlan.name,
        interval: args.planInterval,
        currency: args.currency,
        prices: newPlan.prices,
        availablePrices: newPlan.prices?.[args.planInterval],
      });

      // Truy cập price một cách an toàn hơn
      let intervalPrices = newPlan?.prices?.[args.planInterval];
      let actualInterval = args.planInterval;
      
      // Nếu interval yêu cầu không có prices, thử fallback sang interval khác
      if (!intervalPrices || Object.keys(intervalPrices).length === 0) {
        console.warn(`No prices found for interval ${args.planInterval}, trying fallback interval...`);
        // Thử interval khác (month -> year hoặc year -> month)
        const fallbackInterval = args.planInterval === "month" ? "year" : "month";
        const fallbackPrices = newPlan?.prices?.[fallbackInterval];
        
        if (fallbackPrices && Object.keys(fallbackPrices).length > 0) {
          console.log(`Using fallback interval: ${fallbackInterval} instead of ${args.planInterval}`);
          intervalPrices = fallbackPrices;
          actualInterval = fallbackInterval;
        } else {
          console.error(`No prices found for interval ${args.planInterval} in plan ${newPlan.key}`);
          throw new Error(`Price interval not available for ${newPlan.name} plan. Please select a different interval or sync Stripe products.`);
        }
      }

      // Kiểm tra xem intervalPrices có phải là object rỗng không
      const availableCurrencies = Object.keys(intervalPrices).filter(
        key => {
          const price = intervalPrices[key as keyof typeof intervalPrices];
          return price !== undefined && 
                 price !== null &&
                 typeof price === 'object' &&
                 'stripeId' in price &&
                 price.stripeId;
        }
      );
      
      if (availableCurrencies.length === 0) {
        console.error(`No prices configured for plan ${newPlan.key}, interval ${actualInterval}`);
        console.error("Full plan structure:", JSON.stringify(newPlan, null, 2));
        throw new Error(`No prices configured for ${newPlan.name} plan (${actualInterval} interval). Please sync Stripe products. You can call the 'stripe:syncPlans' action from Convex Dashboard or use the sync button in the billing settings.`);
      }

      // Tìm price cho currency yêu cầu
      let price = intervalPrices[args.currency as keyof typeof intervalPrices];
      
      // Nếu không có price cho currency yêu cầu, thử fallback sang các currency khác theo thứ tự ưu tiên
      if (!price) {
        console.warn(`Price not found for currency ${args.currency}, trying fallback currencies...`);
        console.log("Available currencies:", availableCurrencies);
        
        // Thứ tự ưu tiên: USD -> EUR -> VND -> bất kỳ currency nào có sẵn
        const fallbackOrder = [CURRENCIES.USD, CURRENCIES.EUR, CURRENCIES.VND];
        
        for (const fallbackCurrency of fallbackOrder) {
          if (availableCurrencies.includes(fallbackCurrency)) {
            price = intervalPrices[fallbackCurrency as keyof typeof intervalPrices];
            if (price && price.stripeId) {
              console.log(`Using fallback currency: ${fallbackCurrency} instead of ${args.currency}`);
              break;
            }
          }
        }
        
        // Nếu vẫn không có, thử currency đầu tiên có sẵn
        if (!price && availableCurrencies.length > 0) {
          const firstAvailable = availableCurrencies[0] as keyof typeof intervalPrices;
          price = intervalPrices[firstAvailable];
          if (price && price.stripeId) {
            console.log(`Using first available currency: ${firstAvailable}`);
          }
        }
      }

      if (!price) {
        console.error(`No price found for plan ${newPlan.key}, interval ${args.planInterval}`);
        console.error("Available currencies:", availableCurrencies);
        console.error("Full intervalPrices:", JSON.stringify(intervalPrices, null, 2));
        throw new Error(`No price available for ${newPlan.name} plan. Available currencies: ${availableCurrencies.join(", ").toUpperCase()}. Please sync Stripe products or contact support.`);
      }

      if (!price.stripeId) {
        console.error(`Stripe ID not found for price in plan ${newPlan.key}, interval ${args.planInterval}`);
        throw new Error(`Stripe price ID not configured for ${newPlan.name} plan. Please sync Stripe products.`);
      }

      // Nếu user đã có subscription (không phải FREE), dùng subscription update thay vì checkout mới
      if (currentSubscription.plan.key !== PLANS.FREE) {
        try {
          // Update existing subscription
          const subscription = await stripe.subscriptions.retrieve(currentSubscription.stripeId);
          await stripe.subscriptions.update(subscription.id, {
            items: [{
              id: subscription.items.data[0].id,
              price: price.stripeId,
            }],
            proration_behavior: 'always_invoice', // Charge immediately for the difference
          });
          // Return billing page URL để frontend redirect
          return `${SITE_URL}/dashboard/settings/billing?updated=true`;
        } catch (error) {
          console.error("Error updating subscription:", error);
          throw new Error(`Failed to update subscription: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      // Nếu là FREE plan, tạo checkout session mới
      try {
        const checkout = await stripe.checkout.sessions.create({
          customer: user.customerId,
          line_items: [{ price: price.stripeId, quantity: 1 }],
          mode: "subscription",
          payment_method_types: ["card"],
          success_url: `${SITE_URL}/dashboard/checkout`,
          cancel_url: `${SITE_URL}/dashboard/settings/billing`,
        });
        if (!checkout || !checkout.url) {
          throw new Error("Failed to create checkout session");
        }
        return checkout.url;
      } catch (error) {
        console.error("Error creating checkout session:", error);
        throw new Error(`Failed to create checkout session: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } catch (error) {
      console.error("createSubscriptionCheckout error:", error);
      // Re-throw với message rõ ràng hơn
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
  },
});

/**
 * Creates a Stripe customer portal for a user.
 */
export const createCustomerPortal = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user || !user.customerId) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }

    const customerPortal = await stripe.billingPortal.sessions.create({
      customer: user.customerId,
      return_url: `${SITE_URL}/dashboard/settings/billing`,
    });
    if (!customerPortal) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    return customerPortal.url;
  },
});

export const cancelCurrentUserSubscriptions = internalAction({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.app.getCurrentUser);
    if (!user) {
      throw new Error(ERRORS.STRIPE_SOMETHING_WENT_WRONG);
    }
    const subscriptions = (
      await stripe.subscriptions.list({ customer: user.customerId })
    ).data.map((sub) => sub.items);

    await asyncMap(subscriptions, async (subscription) => {
      await stripe.subscriptions.cancel(subscription.data[0].subscription);
    });
  },
});
export const findPlanByStripeId = internalQuery({
  args: { stripeId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("plans")
      .withIndex("stripeId", (q) => q.eq("stripeId", args.stripeId))
      .unique();
  },
});

export const insertPlan = internalMutation({
  args: {
    key: planKeyValidator,
    stripeId: v.string(),
    name: v.string(),
    description: v.string(),
    prices: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("plans", {
      key: args.key as "free" | "pro" | "business",
      stripeId: args.stripeId,
      name: args.name,
      description: args.description,
      prices: args.prices,
    });
  },
});

export const updatePlanByStripeId = internalMutation({
  args: {
    stripeId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("stripeId", (q) => q.eq("stripeId", args.stripeId))
      .unique();
    if (!plan) return;
    await ctx.db.patch(plan._id, args.data);
  },
});

/**
 * Public action to sync Stripe Products & Prices to Convex 'plans' table
 * This can be called from the frontend to manually sync plans
 */
export const syncPlans = action({
  args: {},
  handler: async (ctx) => {
    // Check if user is authenticated
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("You must be logged in to sync plans");
    }
    
    // Call the internal sync action
    await ctx.runAction(internal.stripe.syncStripeProductsToConvex, {});
    return { success: true, message: "Plans synced successfully" };
  },
});

/**
 * Sync Stripe Products & Prices to Convex 'plans' table
 * This is an internal action, but we also expose a public action for manual syncing
 */
export const syncStripeProductsToConvex = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("🔄 Syncing Stripe Products → Convex...");
    const products = await stripe.products.list({ active: true });
    const prices = await stripe.prices.list({ active: true });

    for (const product of products.data) {
      // Tìm các price tương ứng theo product.id
      const productPrices = prices.data.filter(
        (p) => p.product === product.id && p.recurring
      );

      // Nếu không có price hợp lệ thì bỏ qua
      if (productPrices.length === 0) continue;

      // Gom giá theo interval (month/year) và currency (usd/eur)
      const priceMap: any = {
        month: {},
        year: {},
      };

      for (const price of productPrices) {
        const interval = price.recurring?.interval as "month" | "year";
        const currency = price.currency.toLowerCase() as "usd" | "eur" | "vnd";

        // Chỉ lưu các currency được hỗ trợ
        if (currency === "usd" || currency === "eur" || currency === "vnd") {
          priceMap[interval][currency] = {
            stripeId: price.id,
            amount: price.unit_amount ?? 0,
          };
        } else {
          console.warn(`Unsupported currency: ${currency} for product ${product.name}`);
        }
      }

      // Xác định key: free/pro/business
      const key = product.name.toLowerCase().includes("pro")
        ? PLANS.PRO
        : product.name.toLowerCase().includes("free")
        ? PLANS.FREE
        : "business"; // fallback nếu bạn có Business Plan

      // Kiểm tra đã có trong Convex chưa
      const existing = await ctx.runQuery(
        internal.stripe.findPlanByStripeId,
        { stripeId: product.id }
      );

      if (existing) {
        console.log(`↻ Updating existing plan: ${product.name}`);
        await ctx.runMutation(internal.stripe.updatePlanByStripeId, {
          stripeId: product.id,
          data: {
            key,
            name: product.name,
            description: product.description || "",
            prices: priceMap,
          },
        });
      } else {
        console.log(`➕ Inserting new plan: ${product.name}`);
        await ctx.runMutation(internal.stripe.insertPlan, {
          key,
          stripeId: product.id,
          name: product.name,
          description: product.description || "",
          prices: priceMap,
        });
      }
    }

    console.log("✅ Stripe → Convex sync completed!");
  },
});
