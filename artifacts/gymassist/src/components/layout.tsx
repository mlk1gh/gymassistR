import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Dumbbell, HeartPulse, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workouts", label: "Workouts", icon: Activity },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/chat", label: "AI Coach", icon: MessageSquareText },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border shrink-0 flex flex-col z-20 sticky top-0 md:h-screen">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">GYMASSIST</span>
        </div>
        
        <nav className="flex-1 px-4 pb-4 overflow-y-auto md:overflow-visible flex gap-1 md:flex-col md:gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-[calc(100vh-80px)] md:min-h-screen overflow-x-hidden">
        <div className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
