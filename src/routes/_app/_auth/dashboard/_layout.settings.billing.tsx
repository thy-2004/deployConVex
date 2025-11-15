import { useState } from "react";
import { Switch } from "@/ui/switch";
import { Button } from "@/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "~/convex/_generated/api";
import { convexQuery, useConvexAction } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getLocaleCurrency } from "@/utils/misc";
import { CURRENCIES, PLANS } from "@cvx/schema";

export const Route = createFileRoute(
  "/_app/_auth/dashboard/_layout/settings/billing",
)({
  component: BillingSettings,
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.app.getActivePlans, {}),
    );
    return {
      title: "Billing",
      headerTitle: "Billing",
      headerDescription: "Manage billing and your subscription plan.",
    };
  },
});

export default function BillingSettings() {
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  const { data: plans } = useQuery(convexQuery(api.app.getActivePlans, {}));

  const [selectedPlanId, setSelectedPlanId] = useState(
    user?.subscription?.planId,
  );

  const [selectedPlanInterval, setSelectedPlanInterval] = useState<
    "month" | "year"
  >(
    user?.subscription?.planKey !== PLANS.FREE
      ? user?.subscription?.interval || "month"
      : "month",
  );

  const { mutateAsync: createSubscriptionCheckout } = useMutation({
    mutationFn: useConvexAction(api.stripe.createSubscriptionCheckout),
  });
  const { mutateAsync: createCustomerPortal } = useMutation({
    mutationFn: useConvexAction(api.stripe.createCustomerPortal),
  });
  const { mutateAsync: syncPlans, isPending: isSyncing } = useMutation({
    mutationFn: useConvexAction(api.stripe.syncPlans),
  });

  const currency = getLocaleCurrency();

  const handleCreateSubscriptionCheckout = async () => {
    if (!user || !selectedPlanId) {
      return;
    }
    try {
      const checkoutUrl = await createSubscriptionCheckout({
        userId: user._id,
        planId: selectedPlanId,
        planInterval: selectedPlanInterval,
        currency,
      });
      if (!checkoutUrl) {
        return;
      }
      // Nếu là URL billing (subscription updated), reload page
      if (checkoutUrl.includes('/dashboard/settings/billing')) {
        window.location.href = checkoutUrl;
      } else {
        // Nếu là Stripe checkout URL, redirect đến đó
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
      // Hiển thị thông báo lỗi cho user
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      if (errorMessage.includes("onboarding")) {
        // Nếu lỗi liên quan đến onboarding, có thể redirect đến onboarding page
        alert(errorMessage + "\n\nYou will be redirected to complete onboarding.");
        // Có thể redirect đến onboarding nếu cần
        // window.location.href = '/onboarding/username';
      } else if (errorMessage.includes("sync") || errorMessage.includes("No prices configured")) {
        // Nếu lỗi liên quan đến sync, hỏi user có muốn sync không
        const shouldSync = confirm(
          errorMessage + 
          "\n\nWould you like to sync Stripe products now? This will update plan prices from Stripe."
        );
        if (shouldSync) {
          try {
            await syncPlans({});
            alert("Plans synced successfully! Please try again.");
            // Reload page để refresh plans
            window.location.reload();
          } catch (syncError) {
            console.error("Error syncing plans:", syncError);
            alert(`Failed to sync plans: ${syncError instanceof Error ? syncError.message : "Unknown error"}`);
          }
        }
      } else {
        alert(`Failed to create subscription: ${errorMessage}`);
      }
    }
  };
  const handleCreateCustomerPortal = async () => {
    if (!user?.customerId) {
      return;
    }
    const customerPortalUrl = await createCustomerPortal({
      userId: user._id,
    });
    if (!customerPortalUrl) {
      return;
    }
    window.location.href = customerPortalUrl;
  };

  if (!user || !plans) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2 p-6 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-primary">
              This is a demo app.
            </h2>
            <p className="text-sm font-normal text-primary/60">
              Convex SaaS is a demo app that uses Stripe test environment. You can
              find a list of test card numbers on the{" "}
              <a
                href="https://stripe.com/docs/testing#cards"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary/80 underline"
              >
                Stripe docs
              </a>
              .
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await syncPlans({});
                alert("Plans synced successfully!");
                window.location.reload();
              } catch (error) {
                console.error("Error syncing plans:", error);
                alert(`Failed to sync plans: ${error instanceof Error ? error.message : "Unknown error"}`);
              }
            }}
            disabled={isSyncing}
          >
            {isSyncing ? "Syncing..." : "Sync Plans"}
          </Button>
        </div>
      </div>

      {/* Plans */}
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 p-6">
          <h2 className="text-xl font-medium text-primary">Plan</h2>
          <p className="flex items-start gap-1 text-sm font-normal text-primary/60">
            You are currently on the{" "}
            <span className="flex h-[18px] items-center rounded-md bg-primary/10 px-1.5 text-sm font-medium text-primary/80">
              {user.subscription
                ? user.subscription.planKey.charAt(0).toUpperCase() +
                  user.subscription.planKey.slice(1)
                : "Free"}
            </span>
            plan.
          </p>
        </div>

        {/* Hiển thị tất cả plans cho mọi user */}
        <div className="flex w-full flex-col items-center justify-evenly gap-2 border-border p-6 pt-0">
          {Object.values(plans).map((plan) => (
            <div
              key={plan._id}
              tabIndex={0}
              role="button"
              className={`flex w-full select-none items-center rounded-md border border-border hover:border-primary/60 ${
                selectedPlanId === plan._id && "border-primary/60"
              } ${
                user.subscription?.planId === plan._id && "border-primary bg-primary/5"
              }`}
              onClick={() => setSelectedPlanId(plan._id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSelectedPlanId(plan._id);
              }}
            >
                <div className="flex w-full flex-col items-start p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium text-primary">
                      {plan.name}
                    </span>
                    {plan._id !== plans.free._id && (() => {
                      const price = selectedPlanInterval === "month"
                        ? plan.prices.month[currency]
                        : plan.prices.year[currency];
                      if (!price) return null;
                      return (
                        <span className="flex items-center rounded-md bg-primary/10 px-1.5 text-sm font-medium text-primary/80">
                          {currency === CURRENCIES.USD ? "$" : currency === CURRENCIES.EUR ? "€" : "₫"}{" "}
                          {price.amount / 100}{" "}
                          / {selectedPlanInterval === "month" ? "month" : "year"}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-start text-sm font-normal text-primary/60">
                    {plan.description}
                  </p>
                </div>

                {/* Billing Switch */}
                {plan._id !== plans.free._id && (
                  <div className="flex items-center gap-2 px-4">
                    <label
                      htmlFor="interval-switch"
                      className="text-start text-sm text-primary/60"
                    >
                      {selectedPlanInterval === "month" ? "Monthly" : "Yearly"}
                    </label>
                    <Switch
                      id="interval-switch"
                      checked={selectedPlanInterval === "year"}
                      onCheckedChange={() =>
                        setSelectedPlanInterval((prev) =>
                          prev === "month" ? "year" : "month",
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

        {/* Hiển thị thông tin subscription hiện tại */}
        {user.subscription && user.subscription.planId !== plans.free._id && (
          <div className="flex w-full flex-col gap-2 border-t border-border p-6">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary/60">Current Plan:</span>
              <span className="flex h-[18px] items-center rounded-md bg-primary/10 px-1.5 text-sm font-medium text-primary/80">
                {user.subscription.planKey.charAt(0).toUpperCase() +
                  user.subscription.planKey.slice(1)}
              </span>
              <span className="text-sm font-normal text-primary/60">
                {user.subscription.cancelAtPeriodEnd === true ? (
                  <span className="text-red-500">(Expires on {new Date(
                    user.subscription.currentPeriodEnd * 1000,
                  ).toLocaleDateString("en-US")})</span>
                ) : (
                  <span className="text-green-500">(Renews on {new Date(
                    user.subscription.currentPeriodEnd * 1000,
                  ).toLocaleDateString("en-US")})</span>
                )}
              </span>
            </div>
          </div>
        )}

        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
          <p className="text-sm font-normal text-primary/60">
            {user.subscription?.planId === plans.free._id 
              ? "You will not be charged for testing the subscription upgrade."
              : "Changing your plan will update your subscription immediately."}
          </p>
          <Button
            type="submit"
            size="sm"
            onClick={handleCreateSubscriptionCheckout}
            disabled={selectedPlanId === user.subscription?.planId}
          >
            {user.subscription?.planId === plans.free._id 
              ? "Upgrade to PRO"
              : selectedPlanId === plans.free._id
              ? "Downgrade to Free"
              : "Change Plan"}
          </Button>
        </div>
      </div>

      {/* Manage Subscription */}
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 p-6">
          <h2 className="text-xl font-medium text-primary">
            Manage Subscription
          </h2>
          <p className="flex items-start gap-1 text-sm font-normal text-primary/60">
            Update your payment method, billing address, and more.
          </p>
        </div>

        <div className="flex min-h-14 w-full items-center justify-between rounded-lg rounded-t-none border-t border-border bg-secondary px-6 py-3 dark:bg-card">
          <p className="text-sm font-normal text-primary/60">
            You will be redirected to the Stripe Customer Portal.
          </p>
          <Button type="submit" size="sm" onClick={handleCreateCustomerPortal}>
            Manage
          </Button>
        </div>
      </div>
    </div>
  );
}
