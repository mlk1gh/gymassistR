import { useState, useMemo } from "react";
import { useGetDashboardSummary, useGetRecentActivity, useGetMetricsTrend } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Dumbbell, CheckCircle, Weight, TrendingUp, Clock, TrendingDown, Minus } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, TooltipProps,
} from "recharts";
import { format, subDays } from "date-fns";

const WEIGHT_COLOR = "hsl(142 71% 45%)";
const WEIGHT_COLOR_DIM = "hsl(142 71% 45% / 0.15)";

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
        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(item.timestamp), "MMM d, h:mm a")}</p>
      </div>
    </div>
  );
}

type RangeKey = "7D" | "30D" | "3M" | "All";
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "7D", label: "7D", days: 7 },
  { key: "30D", label: "30D", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "All", label: "All", days: null },
];

type ChartPoint = { date: string; fullDate: string; value: number };

function WeightTooltip({ active, payload, label, unit }: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold" style={{ color: WEIGHT_COLOR }}>
        {point?.value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

function WeightTrendCard({ trendLoading, allPoints, unit }: {
  trendLoading: boolean;
  allPoints: ChartPoint[];
  unit: string;
}) {
  const [range, setRange] = useState<RangeKey>("30D");

  const chartData = useMemo(() => {
    const selected = RANGES.find((r) => r.key === range)!;
    if (selected.days == null) return allPoints;
    const cutoff = subDays(new Date(), selected.days);
    return allPoints.filter((p) => new Date(p.fullDate) >= cutoff);
  }, [allPoints, range]);

  const firstVal = chartData[0]?.value ?? null;
  const lastVal = chartData[chartData.length - 1]?.value ?? null;
  const change = firstVal != null && lastVal != null ? +(lastVal - firstVal).toFixed(1) : null;
  const avg = chartData.length > 0 ? +(chartData.reduce((s, p) => s + p.value, 0) / chartData.length).toFixed(1) : null;

  const isGain = change != null && change > 0;
  const isLoss = change != null && change < 0;
  const ChangeIcon = isGain ? TrendingUp : isLoss ? TrendingDown : Minus;
  const changeColor = isGain ? "text-rose-400" : isLoss ? "text-emerald-400" : "text-muted-foreground";

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Weight Trend</CardTitle>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  range === r.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {trendLoading ? (
          <div className="h-56 animate-pulse bg-secondary rounded" />
        ) : allPoints.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
            <Weight className="w-8 h-8 opacity-30" />
            <span>No weight data yet. Log your weight to see your trend.</span>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Start</p>
                <p className="text-sm font-semibold text-foreground">{firstVal ?? "—"} <span className="text-xs text-muted-foreground font-normal">{unit}</span></p>
              </div>
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Current</p>
                <p className="text-sm font-semibold text-foreground">{lastVal ?? "—"} <span className="text-xs text-muted-foreground font-normal">{unit}</span></p>
              </div>
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Change</p>
                <p className={`text-sm font-semibold flex items-center justify-center gap-0.5 ${changeColor}`}>
                  <ChangeIcon className="w-3.5 h-3.5" />
                  {change != null ? `${change > 0 ? "+" : ""}${change} ${unit}` : "—"}
                </p>
              </div>
            </div>

            {chartData.length < 2 ? (
              <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">
                Not enough data for this range. Try a wider range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={WEIGHT_COLOR} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={WEIGHT_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 10% 12%)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "hsl(240 5% 55%)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(240 5% 55%)" }}
                    axisLine={false}
                    tickLine={false}
                    domain={["dataMin - 1", "dataMax + 1"]}
                    width={48}
                    tickFormatter={(v: number) => `${v}`}
                  />
                  {avg != null && (
                    <ReferenceLine
                      y={avg}
                      stroke="hsl(240 5% 45%)"
                      strokeDasharray="4 4"
                      label={{ value: `avg ${avg}`, position: "insideTopRight", fontSize: 9, fill: "hsl(240 5% 50%)" }}
                    />
                  )}
                  <Tooltip
                    content={<WeightTooltip unit={unit} />}
                    cursor={{ stroke: "hsl(240 5% 40%)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={WEIGHT_COLOR}
                    fill="url(#weightGrad)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: WEIGHT_COLOR,
                      stroke: "hsl(240 10% 6%)",
                      strokeWidth: 2,
                      style: { filter: `drop-shadow(0 0 6px ${WEIGHT_COLOR_DIM})` },
                    }}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const summary = useGetDashboardSummary();
  const activity = useGetRecentActivity();
  const trend = useGetMetricsTrend();

  const summaryData = summary.data ?? null;
  const activityData = activity.data ?? [];
  const trendData = trend.data ?? [];

  const weightTrend = trendData.find((t) => t.type === "weight");
  const weightUnit = weightTrend?.unit ?? "kg";
  const allWeightPoints: ChartPoint[] = (weightTrend?.data ?? []).map((d) => ({
    date: format(new Date(d.loggedAt), "MMM d"),
    fullDate: d.loggedAt,
    value: d.value,
  }));

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your fitness overview at a glance.</p>
        </div>

        {summary.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Card key={i} className="animate-pulse bg-card border-border h-24" />)}
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
          <WeightTrendCard
            trendLoading={trend.isLoading}
            allPoints={allWeightPoints}
            unit={weightUnit}
          />

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-secondary rounded" />)}
                </div>
              ) : activityData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No activity yet. Start a workout!</div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {activityData.map((item) => <ActivityItem key={item.id} item={item} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
