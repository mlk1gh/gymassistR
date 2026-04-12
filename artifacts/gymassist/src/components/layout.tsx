import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Dumbbell, HeartPulse, MessageSquareText, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClerk, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Activity },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/chat", label: "AI Coach", icon: MessageSquareText },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const { data: adminStatus } = useQuery({
    queryKey: ["admin-status"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/admin/status`, { credentials: "include" });
      if (!res.ok) return { isAdmin: false };
      return res.json() as Promise<{ isAdmin: boolean }>;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const isAdmin = adminStatus?.isAdmin === true;

  const handleSignOut = () => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    signOut({ redirectUrl: window.location.origin + base + "/sign-in" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground selection:bg-primary selection:text-primary-foreground">
      <aside className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border shrink-0 flex flex-col z-20 sticky top-0 md:h-screen">
        <div className="p-6 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">GYMASSIST</span>
        </div>

        <nav className="flex-1 px-4 pb-4 overflow-y-auto md:overflow-visible flex gap-1 md:flex-col md:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md font-medium transition-all group relative overflow-hidden",
                  isActive
                    ? "text-primary-foreground bg-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
              >
                <item.icon className="w-5 h-5 relative z-10" />
                <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <div className="shrink-0 px-4 pb-2 hidden md:block">
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-all text-xs border",
                location === "/admin" || location.startsWith("/admin")
                  ? "text-primary-foreground bg-primary border-primary"
                  : "text-muted-foreground hover:text-foreground border-border hover:bg-secondary"
              )}
              data-testid="nav-admin"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">Admin Panel</span>
            </Link>
          </div>
        )}

        {user && (
          <div className="shrink-0 px-4 pb-4 pt-2 border-t border-border mt-auto">
            <div className="flex items-center gap-3 px-3 py-2.5">
              {user.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName ?? "User"} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {(user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.fullName ?? user.emailAddresses[0]?.emailAddress}</p>
                {user.fullName && (
                  <p className="text-xs text-muted-foreground truncate">{user.emailAddresses[0]?.emailAddress}</p>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title="Sign out"
                data-testid="sign-out-btn"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-h-[calc(100vh-80px)] md:min-h-screen overflow-x-hidden">
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
