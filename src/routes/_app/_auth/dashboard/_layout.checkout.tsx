import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, BadgeCheck, AlertTriangle, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/ui/button-util";
import { useEffect, useState } from "react";
import { Route as DashboardRoute } from "@/routes/_app/_auth/dashboard/_layout.index";
import siteConfig from "~/site.config";
import { PLANS } from "@cvx/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/checkout")({
  component: DashboardCheckout,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Checkout`,
  }),
});

export default function DashboardCheckout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useQuery(convexQuery(api.app.getCurrentUser, {}));
  const isFreePlan = user?.subscription?.planKey === PLANS.FREE;
  const [isPending, setIsPending] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const maxPolls = 20; // Poll tối đa 20 lần (khoảng 1 phút)

  // Polling để đợi webhook xử lý subscription update
  useEffect(() => {
    if (!user) return;

    // Nếu đã là PRO plan, không cần polling
    if (!isFreePlan) {
      setIsPending(false);
      // Redirect sau 2 giây để user thấy success message
      const redirectTimer = setTimeout(() => {
        navigate({ to: DashboardRoute.fullPath });
      }, 2000);
      return () => clearTimeout(redirectTimer);
    }

    // Nếu vẫn là FREE plan, polling để đợi webhook
    setIsPending(true);
    let currentPollCount = 0;
    
    const pollInterval = setInterval(async () => {
      currentPollCount++;
      
      // Nếu đã poll quá nhiều lần, dừng lại
      if (currentPollCount >= maxPolls) {
        clearInterval(pollInterval);
        setIsPending(false);
        return;
      }

      // Refresh user data
      await queryClient.invalidateQueries({
        queryKey: convexQuery(api.app.getCurrentUser, {}).queryKey,
      });
      
      setPollCount(currentPollCount);
    }, 3000); // Poll mỗi 3 giây

    return () => clearInterval(pollInterval);
  }, [user, isFreePlan, queryClient, navigate]);

  // Kiểm tra lại khi user data thay đổi
  useEffect(() => {
    if (user && !isFreePlan && isPending) {
      // Subscription đã được update thành PRO
      setIsPending(false);
      // Redirect sau 2 giây
      setTimeout(() => {
        navigate({ to: DashboardRoute.fullPath });
      }, 2000);
    }
  }, [user, isFreePlan, isPending, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
          <div className="flex w-full flex-col rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                Completing your Checkout
              </h2>
              <p className="text-sm font-normal text-primary/60">
                We are completing your checkout, please wait ...
              </p>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>
          <div className="relative mx-auto flex w-full  flex-col items-center p-6">
            <div className="relative flex w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-lg border border-border bg-secondary px-6 py-24 dark:bg-card">
              <div className="z-10 flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card hover:border-primary/40">
                  {isFreePlan && isPending && (
                    <Loader2 className="h-8 w-8 animate-spin stroke-[1.5px] text-primary/60" />
                  )}
                  {!isFreePlan && (
                    <BadgeCheck className="h-8 w-8 stroke-[1.5px] text-primary/60" />
                  )}
                  {isFreePlan && !isPending && (
                    <AlertTriangle className="h-8 w-8 stroke-[1.5px] text-primary/60" />
                  )}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-center text-base font-medium text-primary">
                    {isFreePlan && isPending && "Completing your checkout ..."}
                    {!isFreePlan && "Checkout completed!"}
                    {isFreePlan && !isPending && "Something went wrong."}
                  </p>
                </div>
              </div>
              <div className="z-10 flex items-center justify-center">
                <Link
                  to={DashboardRoute.fullPath}
                  className={`${buttonVariants({ variant: "ghost", size: "sm" })} gap-2`}
                >
                  <span className="text-sm font-medium text-primary/60 group-hover:text-primary">
                    Return to Dashboard
                  </span>
                  <ExternalLink className="h-4 w-4 stroke-[1.5px] text-primary/60 group-hover:text-primary" />
                </Link>
              </div>
              <div className="base-grid absolute h-full w-full opacity-40" />
              <div className="absolute bottom-0 h-full w-full bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
