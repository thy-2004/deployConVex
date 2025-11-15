import { createFileRoute } from "@tanstack/react-router";
import { Plus, ExternalLink, Trash2, Edit2, Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/misc.js";
import { buttonVariants } from "@/ui/button-util";
import siteConfig from "~/site.config";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/ui/dialog";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";

export const Route = createFileRoute("/_app/_auth/dashboard/_layout/")({
  component: Dashboard,
  beforeLoad: () => ({
    title: `${siteConfig.siteTitle} - Dashboard`,
    headerTitle: "Dashboard",
    headerDescription: "Manage your Apps and view your usage.",
  }),
});

export default function Dashboard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [appName, setAppName] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery(convexQuery(api.app.getUserApps, {}));
  const createApp = useMutation({
    mutationFn: useConvexMutation(api.app.createApp),
  });
  const deleteApp = useMutation({
    mutationFn: useConvexMutation(api.app.deleteApp),
  });

  const handleCreateApp = async () => {
    if (!appName.trim()) return;
    
    try {
      await createApp.mutateAsync({
        name: appName.trim(),
        description: appDescription.trim() || undefined,
      });
      setIsCreateDialogOpen(false);
      setAppName("");
      setAppDescription("");
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.app.getUserApps, {}).queryKey,
      });
    } catch (error) {
      console.error("Error creating app:", error);
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (!confirm("Are you sure you want to delete this app?")) return;
    
    try {
      await deleteApp.mutateAsync({ appId: appId as any });
      queryClient.invalidateQueries({
        queryKey: convexQuery(api.app.getUserApps, {}).queryKey,
      });
    } catch (error) {
      console.error("Error deleting app:", error);
    }
  };

  const handleCopyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(apiKey);
    setTimeout(() => setCopiedApiKey(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-primary/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col gap-6">
          {/* Apps List */}
          {apps.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <div
                  key={app._id}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-primary">{app.name}</h3>
                      {app.description && (
                        <p className="mt-1 text-sm text-primary/60">{app.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteApp(app._id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary/60">API Key:</span>
                      <code className="flex-1 truncate rounded bg-secondary px-2 py-1 text-xs text-primary/80">
                        {app.apiKey}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyApiKey(app.apiKey)}
                        className="h-6 w-6 p-0"
                      >
                        {copiedApiKey === app.apiKey ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          app.status === "active"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "bg-gray-500/10 text-gray-700 dark:text-gray-400",
                        )}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Create App Button/Card */}
          <div
            className={cn(
              "relative flex w-full flex-col items-center justify-center gap-6 overflow-hidden rounded-lg border border-border bg-secondary px-6 py-24 dark:bg-card",
              apps.length === 0 && "border-dashed",
            )}
          >
            <div className="z-10 flex max-w-[460px] flex-col items-center gap-4">
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-card hover:border-primary/40 transition-colors"
              >
                <Plus className="h-8 w-8 stroke-[1.5px] text-primary/60" />
              </button>
              <div className="flex flex-col items-center gap-2">
                <p className="text-base font-medium text-primary">
                  {apps.length === 0 ? t("title") : "Create New App"}
                </p>
                <p className="text-center text-base font-normal text-primary/60">
                  {apps.length === 0
                    ? t("description")
                    : "Add a new app to your dashboard"}
                </p>
                {apps.length === 0 && (
                  <span className="hidden select-none items-center rounded-full bg-green-500/5 px-3 py-1 text-xs font-medium tracking-tight text-green-700 ring-1 ring-inset ring-green-600/20 backdrop-blur-md dark:bg-green-900/40 dark:text-green-100 md:flex">
                    TIP: Try changing the language!
                  </span>
                )}
              </div>
            </div>
            <div className="z-10 flex items-center justify-center">
              <a
                target="_blank"
                rel="noreferrer"
                href="https://github.com/get-convex/convex-saas/tree/main/docs"
                className={cn(
                  `${buttonVariants({ variant: "ghost", size: "sm" })} gap-2`,
                )}
              >
                <span className="text-sm font-medium text-primary/60 group-hover:text-primary">
                  Explore Documentation
                </span>
                <ExternalLink className="h-4 w-4 stroke-[1.5px] text-primary/60 group-hover:text-primary" />
              </a>
            </div>
            <div className="base-grid absolute h-full w-full opacity-40" />
            <div className="absolute bottom-0 h-full w-full bg-gradient-to-t from-[hsl(var(--card))] to-transparent" />
          </div>
        </div>
      </div>

      {/* Create App Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogClose onClose={() => setIsCreateDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Create New App</DialogTitle>
            <DialogDescription>
              Create a new app to get started. You'll receive an API key to use with your application.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="app-name" className="text-sm font-medium text-primary">
                App Name *
              </label>
              <Input
                id="app-name"
                placeholder="My Awesome App"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && appName.trim()) {
                    handleCreateApp();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="app-description" className="text-sm font-medium text-primary">
                Description (Optional)
              </label>
              <Input
                id="app-description"
                placeholder="A brief description of your app"
                value={appDescription}
                onChange={(e) => setAppDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && appName.trim()) {
                    handleCreateApp();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateApp}
              disabled={!appName.trim() || createApp.isPending}
            >
              {createApp.isPending ? "Creating..." : "Create App"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
