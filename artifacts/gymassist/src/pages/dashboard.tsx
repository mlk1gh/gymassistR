import { useGetDashboardSummary, useGetRecentActivity, useGetMetricsTrend } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Dumbbell, CheckCircle, Weight, TrendingUp, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ item }: { item: { id: number; type: string; description: string; timestamp: string } }) {
  const typeColors: Record<string, string> = {
    workout_completed: "bg-primary",
    workout_created: "bg-chart-2",
    health_metric_logged: "bg-chart-3",
    chat_message: "bg-chart-5",
  };
  const dot = typeColors[item.type] ?? "bg-muted-foreground";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">{item.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(item.timestamp), "MMM d, h:mm a")}
        </p>
      </div>
    </div>
  );
}

const CHART_COLORS: Record<string, string> = {
  weight: "hsl(142 71% 45%)",
  steps: "hsl(199 89% 48%)",
  sleep: "hsl(280 80% 60%)",
  calories: "hsl(39 100% 50%)",
  heart_rate: "hsl(326 100% 50%)",
};

export default function DashboardPage() {
  const summary = useGetDashboardSummary();
  const activity = useGetRecentActivity();
  const trend = useGetMetricsTrend();

  const summaryData = summary.data ?? null;
  const activityData = activity.data ?? [];
  const trendData = trend.data ?? [];

  const weightTrend = trendData.find((t) => t.type === "weight");
  const chartData = weightTrend?.data?.map((d) => ({
    date: format(new Date(d.loggedAt), "MMM d"),
    value: d.value,
  })) ?? [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your fitness overview at a glance.</p>
        </div>

        {summary.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse bg-card border-border h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Total Workouts" value={summaryData?.totalWorkouts ?? 0} icon={Activity} />
            <StatCard label="Completed" value={summaryData?.completedWorkouts ?? 0} icon={CheckCircle} />
            <StatCard label="Exercises" value={summaryData?.totalExercises ?? 0} icon={Dumbbell} />
            <StatCard
              label="Latest Weight"
              value={summaryData?.latestWeight != null ? `${summaryData.latestWeight} ${summaryData.latestWeightUnit}` : "—"}
              icon={Weight}
            />
            <StatCard label="This Week" value={`${summaryData?.weeklyWorkoutsCount ?? 0} workouts`} icon={TrendingUp} />
            <StatCard
              label="Avg Duration"
              value={summaryData?.averageDurationMinutes != null ? `${Math.round(summaryData.averageDurationMinutes)} min` : "—"}
              icon={Clock}
            />
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Weight Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {trend.isLoading ? (
                <div className="h-48 animate-pulse bg-secondary rounded" />
              ) : chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No weight data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.weight} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.weight} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 12%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(240 5% 65%)" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(240 5% 65%)" }}
                      axisLine={false}
                      tickLine={false}
                      domain={["dataMin - 1", "dataMax + 1"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(240 10% 6%)", border: "1px solid hsl(240 10% 12%)", borderRadius: 6 }}
                      labelStyle={{ color: "hsl(0 0% 98%)", fontSize: 12 }}
                      itemStyle={{ color: CHART_COLORS.weight, fontSize: 12 }}
                      formatter={(v: number) => [`${v} lbs`, "Weight"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={CHART_COLORS.weight}
                      fill="url(#weightGrad)"
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS.weight, r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 animate-pulse bg-secondary rounded" />
                  ))}
                </div>
              ) : activityData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No activity yet. Start a workout!</div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  {activityData.map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
