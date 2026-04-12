import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWorkouts,
  useCreateWorkout,
  useUpdateWorkout,
  useDeleteWorkout,
  useCompleteWorkout,
  getListWorkoutsQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle, Clock, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const workoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  goal: z.string().min(1, "Goal is required"),
  durationMinutes: z.number({ coerce: true }).min(1, "Duration must be at least 1 min"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  scheduledAt: z.string().optional(),
});
type WorkoutForm = z.infer<typeof workoutSchema>;

const difficultyColors: Record<string, string> = {
  beginner: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  intermediate: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  advanced: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function WorkoutsPage() {
  const qc = useQueryClient();
  const workouts = useListWorkouts();
  const createMutation = useCreateWorkout();
  const updateMutation = useUpdateWorkout();
  const deleteMutation = useDeleteWorkout();
  const completeMutation = useCompleteWorkout();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<WorkoutForm>({
    resolver: zodResolver(workoutSchema),
    defaultValues: { difficulty: "intermediate", durationMinutes: 45 },
  });

  const openCreate = () => {
    reset({ difficulty: "intermediate", durationMinutes: 45, name: "", description: "", goal: "", scheduledAt: "" });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (w: { id: number; name: string; description?: string | null; goal: string; durationMinutes: number; difficulty: string; scheduledAt?: string | null }) => {
    reset({
      name: w.name,
      description: w.description ?? "",
      goal: w.goal,
      durationMinutes: w.durationMinutes,
      difficulty: w.difficulty as "beginner" | "intermediate" | "advanced",
      scheduledAt: w.scheduledAt ? w.scheduledAt.substring(0, 10) : "",
    });
    setEditingId(w.id);
    setModalOpen(true);
  };

  const onSubmit = (data: WorkoutForm) => {
    const payload = {
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
    };
    if (editingId != null) {
      updateMutation.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
            toast({ title: "Workout updated" });
            setModalOpen(false);
          },
          onError: () => toast({ title: "Failed to update workout", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
            toast({ title: "Workout created" });
            setModalOpen(false);
          },
          onError: () => toast({ title: "Failed to create workout", variant: "destructive" }),
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId == null) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
          toast({ title: "Workout deleted" });
          setDeleteId(null);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  const handleComplete = (id: number) => {
    completeMutation.mutate(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
          toast({ title: "Workout completed!" });
        },
        onError: () => toast({ title: "Failed to complete workout", variant: "destructive" }),
      }
    );
  };

  const data = workouts.data ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Workout Plans</h1>
            <p className="text-muted-foreground text-sm mt-1">{data.length} plan{data.length !== 1 ? "s" : ""}</p>
          </div>
          <Button onClick={openCreate} data-testid="create-workout-btn" className="gap-2">
            <Plus className="w-4 h-4" /> New Workout
          </Button>
        </div>

        {workouts.isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse bg-card rounded-lg border border-border" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">No workout plans yet. Create your first one.</p>
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Create Workout
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.map((w) => (
              <Card
                key={w.id}
                className={`bg-card border-border transition-opacity ${w.completed ? "opacity-60" : ""}`}
                data-testid={`workout-card-${w.id}`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`font-semibold text-foreground ${w.completed ? "line-through" : ""}`}>{w.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${difficultyColors[w.difficulty] ?? ""}`}>
                        {w.difficulty}
                      </span>
                      {w.completed && (
                        <span className="text-xs px-2 py-0.5 rounded border bg-primary/20 text-primary border-primary/30 font-medium">Done</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{w.description || w.goal}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{w.durationMinutes} min</span>
                      <span>Goal: {w.goal}</span>
                      {w.scheduledAt && <span>Scheduled: {format(new Date(w.scheduledAt), "MMM d")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!w.completed && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-primary border-primary/40 hover:bg-primary/10"
                        onClick={() => handleComplete(w.id)}
                        data-testid={`complete-workout-${w.id}`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Done
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(w)}
                      data-testid={`edit-workout-${w.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteId(w.id)}
                      data-testid={`delete-workout-${w.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId != null ? "Edit Workout" : "New Workout"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} placeholder="Workout name" className="mt-1" />
              {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register("description")} placeholder="Optional" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="goal">Goal</Label>
              <Input id="goal" {...register("goal")} placeholder="e.g. Build strength" className="mt-1" />
              {errors.goal && <p className="text-destructive text-xs mt-1">{errors.goal.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="duration">Duration (min)</Label>
                <Input id="duration" type="number" {...register("durationMinutes", { valueAsNumber: true })} className="mt-1" />
                {errors.durationMinutes && <p className="text-destructive text-xs mt-1">{errors.durationMinutes.message}</p>}
              </div>
              <div>
                <Label>Difficulty</Label>
                <Controller
                  name="difficulty"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="scheduledAt">Scheduled Date</Label>
              <Input id="scheduledAt" type="date" {...register("scheduledAt")} className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId != null ? "Save Changes" : "Create Workout"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Workout</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the workout. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
