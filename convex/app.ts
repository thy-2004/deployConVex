import { internal } from "@cvx/_generated/api";
import { mutation, query } from "@cvx/_generated/server";
import { auth } from "@cvx/auth";
import { currencyValidator, PLANS } from "@cvx/schema";
import { asyncMap } from "convex-helpers";
import { v } from "convex/values";
import { User } from "~/types";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<User | undefined> => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    const [user, subscription] = await Promise.all([
      ctx.db.get(userId),
      ctx.db
        .query("subscriptions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .unique(),
    ]);
    if (!user) {
      return;
    }
    const plan = subscription?.planId
      ? await ctx.db.get(subscription.planId)
      : undefined;
    const avatarUrl = user.imageId
      ? await ctx.storage.getUrl(user.imageId)
      : user.image;
    return {
      ...user,
      avatarUrl: avatarUrl || undefined,
      subscription:
        subscription && plan
          ? {
              ...subscription,
              planKey: plan.key,
            }
          : undefined,
    };
  },
});

export const updateUsername = mutation({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    await ctx.db.patch(userId, { username: args.username });
  },
});

export const completeOnboarding = mutation({
  args: {
    username: v.string(),
    currency: currencyValidator,
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return;
    }
    await ctx.db.patch(userId, { username: args.username });
    if (user.customerId) {
      return;
    }
    await ctx.scheduler.runAfter(
      0,
      internal.stripe.PREAUTH_createStripeCustomer,
      {
        currency: args.currency,
        userId,
      },
    );
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateUserImage = mutation({
  args: {
    imageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    ctx.db.patch(userId, { imageId: args.imageId });
  },
});

export const removeUserImage = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    ctx.db.patch(userId, { imageId: undefined, image: undefined });
  },
});

export const getActivePlans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return;

    const [free, pro] = await asyncMap(
      [PLANS.FREE, PLANS.PRO] as const,
      (key) =>
        ctx.db
          .query("plans")
          .withIndex("key", (q) => q.eq("key", key))
          .first(), 
    );

    if (!free || !pro) {
      throw new Error("Plan not found");
    }

    return { free, pro };
  },
});



export const deleteCurrentUserAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .unique();
    if (!subscription) {
      console.error("No subscription found");
    } else {
      await ctx.db.delete(subscription._id);
      await ctx.scheduler.runAfter(
        0,
        internal.stripe.cancelCurrentUserSubscriptions,
      );
    }
    await ctx.db.delete(userId);
    await asyncMap(["resend-otp", "github"], async (provider) => {
      const authAccount = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", userId).eq("provider", provider),
        )
        .unique();
      if (!authAccount) {
        return;
      }
      await ctx.db.delete(authAccount._id);
    });
  },
});

// Apps Management
export const getUserApps = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      return [];
    }
    return await ctx.db
      .query("apps")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const createApp = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    // Generate API key
    const apiKey = `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    const now = Date.now();
    const appId = await ctx.db.insert("apps", {
      userId,
      name: args.name,
      description: args.description,
      apiKey,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    return appId;
  },
});

export const updateApp = mutation({
  args: {
    appId: v.id("apps"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const app = await ctx.db.get(args.appId);
    if (!app || app.userId !== userId) {
      throw new Error("App not found or unauthorized");
    }

    await ctx.db.patch(args.appId, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.status !== undefined && { status: args.status }),
      updatedAt: Date.now(),
    });
  },
});

export const deleteApp = mutation({
  args: {
    appId: v.id("apps"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const app = await ctx.db.get(args.appId);
    if (!app || app.userId !== userId) {
      throw new Error("App not found or unauthorized");
    }

    await ctx.db.delete(args.appId);
  },
});

export const regenerateApiKey = mutation({
  args: {
    appId: v.id("apps"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("User not found");
    }

    const app = await ctx.db.get(args.appId);
    if (!app || app.userId !== userId) {
      throw new Error("App not found or unauthorized");
    }

    const newApiKey = `sk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

    await ctx.db.patch(args.appId, {
      apiKey: newApiKey,
      updatedAt: Date.now(),
    });

    return newApiKey;
  },
});