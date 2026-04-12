import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListHealthMetrics,
  useCreateHealthMetric,
  useDeleteHealthMetric,
  getListHealthMetricsQueryKey,
  useGetMetricsTrend,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const METRIC_TYPES = [
  { value: "weight", label: "Weight", unit: "lbs" },
  { value: "steps", label: "Steps", unit: "steps" },
  { value: "sleep", label: "Sleep", unit: "hours" },
  { value: "calories", label: "Calories", unit: "kcal" },
  { value: "heart_rate", label: "Heart Rate", unit: "bpm" },
  { value: "blood_pressure", label: "Blood Pressure", unit: "mmHg" },
];

const CHART_COLORS: Record<string, string> = {
  weight: "hsl(142 71% 45%)",
  steps: "hsl(199 89% 48%)",
  sleep: "hsl(280 80% 60%)",
  calories: "hsl(39 100% 50%)",
  heart_rate: "hsl(326 100% 50%)",
  blood_pressure: "hsl(0 84% 60%)",
};

const metricSchema = z.object({
  type: z.string().min(1),
  value: z.number({ coerce: true }).min(0, "Value must be positive"),
  unit: z.string().min(1),
  notes: z.string().optional(),
  loggedAt: z.string().optional(),
});
type MetricForm = z.infer<typeof metricSchema>;

export default function HealthPage() {
  const qc = useQueryClient();
  const metrics = useListHealthMetrics();
  const trend = useGetMetricsTrend();
  const createMutation = useCreateHealthMetric();
  const deleteMutation = useDeleteHealthMetric();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [activeType, setActiveType] = useState("weight");

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<MetricForm>({
    resolver: zodResolver(metricSchema),
    defaultValues: { type: "weight", unit: "lbs" },
  });

  const watchedType = watch("type");

  const onSubmit = (data: MetricForm) => {
    createMutation.mutate(
      {
        data: {
          ...data,
          loggedAt: data.loggedAt ? new Date(data.loggedAt).toISOString() : new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHealthMetricsQueryKey() });
          toast({ title: "Metric logged" });
          setModalOpen(false);
          reset({ type: "weight", unit: "lbs" });
        },
        onError: () => toast({ title: "Failed to log metric", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    if (deleteId == null) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListHealthMetricsQueryKey() });
          toast({ title: "Metric deleted" });
          setDeleteId(null);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  const trendData = trend.data ?? [];
  const activeTrend = trendData.find((t) => t.type === activeType);
  const chartData = activeTrend?.data?.map((d) => ({
    date: format(new Date(d.loggedAt), "MMM d"),
    value: d.value,
  })) ?? [];
  const chartColor = CHART_COLORS[activeType] ?? "hsl(142 71% 45%)";

  const allMetrics = metrics.data ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Health Tracking</h1>
            <p className="text-muted-foreground text-sm mt-1">Monitor your health metrics over time.</p>
          </div>
          <Button onClick={() => setModalOpen(true)} data-testid="log-metric-btn" className="gap-2">
            <Plus className="w-4 h-4" /> Log Metric
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Trend Chart</CardTitle>
              <div className="flex flex-wrap gap-2">
                {METRIC_TYPES.filter((m) => trendData.find((t) => t.type === m.value)).map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setActiveType(m.value)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all border ${
                      activeType === m.value
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`trend-tab-${m.value}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {trend.isLoading ? (
              <div className="h-48 animate-pulse bg-secondary rounded" />
            ) : chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No {activeType.replace("_", " ")} data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
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
                    itemStyle={{ color: chartColor, fontSize: 12 }}
                    formatter={(v: number) => [`${v} ${activeTrend?.unit ?? ""}`, activeType.replace("_", " ")]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    strokeWidth={2}
                    dot={{ fill: chartColor, r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-secondary rounded" />)}
              </div>
            ) : allMetrics.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No metrics logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Value</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Notes</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Date</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {allMetrics.map((m) => (
                      <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors" data-testid={`metric-row-${m.id}`}>
                        <td className="py-2.5 pr-4">
                          <span className="capitalize font-medium text-foreground">{m.type.replace("_", " ")}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-foreground">{m.value} <span className="text-muted-foreground text-xs">{m.unit}</span></td>
                        <td className="py-2.5 pr-4 text-muted-foreground max-w-xs truncate">{m.notes ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs">{format(new Date(m.loggedAt), "MMM d, yyyy")}</td>
                        <td className="py-2.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-7 h-7 p-0 hover:text-destructive"
                            onClick={() => setDeleteId(m.id)}
                            data-testid={`delete-metric-${m.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Log Health Metric</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      const found = METRIC_TYPES.find((m) => m.value === v);
                      if (found) setValue("unit", found.unit);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_TYPES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="metric-value">Value</Label>
                <Input id="metric-value" type="number" step="any" {...register("value", { valueAsNumber: true })} className="mt-1" />
                {errors.value && <p className="text-destructive text-xs mt-1">{errors.value.message}</p>}
              </div>
              <div>
                <Label htmlFor="metric-unit">Unit</Label>
                <Input id="metric-unit" {...register("unit")} className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="metric-notes">Notes</Label>
              <Input id="metric-notes" {...register("notes")} placeholder="Optional notes" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="metric-date">Date</Label>
              <Input id="metric-date" type="date" {...register("loggedAt")} className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Log Metric</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Metric</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this metric log.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
