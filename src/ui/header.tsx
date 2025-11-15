import { useMatches } from "@tanstack/react-router";

export function Header() {
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  
  // Get route context from the last match's context
  const routeContext = lastMatch?.context as { 
    headerTitle?: string; 
    headerDescription?: string 
  } | undefined;

  return (
    <header className="z-10 flex w-full flex-col border-b border-border bg-card px-6">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between py-12">
        <div className="flex flex-col items-start gap-2">
          <h1 className="text-3xl font-medium text-primary/80">
            {routeContext?.headerTitle || "Dashboard"}
          </h1>
          <p className="text-base font-normal text-primary/60">
            {routeContext?.headerDescription || "Manage your Apps and view your usage."}
          </p>
        </div>
      </div>
    </header>
  );
}
