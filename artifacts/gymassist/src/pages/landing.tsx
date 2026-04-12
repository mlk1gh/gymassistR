import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, Dumbbell, HeartPulse, MessageSquareText, TrendingUp, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">GYMASSIST</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-24 px-6 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest mb-6">
            AI-Powered Fitness Coach
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
            Train smarter.<br />
            <span className="text-primary">Track everything.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            GymAssist combines an AI coaching assistant with full workout planning and health tracking — all in one focused, distraction-free app.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 px-8">
                Start for Free
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="gap-2 px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="py-16 px-6 border-t border-border">
          <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Dumbbell,
                title: "Workout Plans",
                description: "Create and manage personalized workout plans with difficulty tracking and scheduling.",
              },
              {
                icon: Activity,
                title: "Exercise Library",
                description: "Browse and add exercises organized by muscle group, difficulty, and equipment.",
              },
              {
                icon: HeartPulse,
                title: "Health Tracking",
                description: "Log weight, steps, sleep, calories, and more. Visualize your progress over time.",
              },
              {
                icon: MessageSquareText,
                title: "AI Coach",
                description: "Ask your AI coach anything — workout advice, nutrition tips, recovery strategies.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-lg p-5">
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-6 border-t border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">Everything you need, nothing you don't.</h2>
            <div className="grid sm:grid-cols-2 gap-3 text-left mt-8">
              {[
                "Personal workout plans with scheduling",
                "AI-powered fitness coaching",
                "Health metrics dashboard",
                "Progress trend charts",
                "Complete exercise library",
                "Your data stays private",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link href="/sign-up">
                <Button size="lg" className="gap-2 px-10">
                  Create Your Account
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 px-6 text-center text-xs text-muted-foreground">
        GymAssist — Your personal AI fitness companion.
      </footer>
    </div>
  );
}
