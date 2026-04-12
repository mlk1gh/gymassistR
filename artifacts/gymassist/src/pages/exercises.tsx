import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListExercises,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
  getListExercisesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const exerciseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  muscleGroup: z.string().min(1, "Muscle group is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  equipment: z.string().optional(),
  instructions: z.string().optional(),
  sets: z.number({ coerce: true }).optional(),
  reps: z.number({ coerce: true }).optional(),
  durationSeconds: z.number({ coerce: true }).optional(),
});
type ExerciseForm = z.infer<typeof exerciseSchema>;

const difficultyColors: Record<string, string> = {
  beginner: "bg-chart-2/20 text-chart-2",
  intermediate: "bg-chart-3/20 text-chart-3",
  advanced: "bg-destructive/20 text-destructive",
};

const MUSCLE_GROUPS = ["Legs", "Back", "Chest", "Shoulders", "Arms", "Core", "Full Body", "Cardio"];

export default function ExercisesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");

  const exercises = useListExercises();
  const createMutation = useCreateExercise();
  const updateMutation = useUpdateExercise();
  const deleteMutation = useDeleteExercise();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ExerciseForm>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { difficulty: "intermediate" },
  });

  const openCreate = () => {
    reset({ difficulty: "intermediate", name: "", muscleGroup: "", description: "", equipment: "", instructions: "" });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (e: { id: number; name: string; description?: string | null; muscleGroup: string; difficulty: string; equipment?: string | null; instructions?: string | null; sets?: number | null; reps?: number | null; durationSeconds?: number | null }) => {
    reset({
      name: e.name,
      description: e.description ?? "",
      muscleGroup: e.muscleGroup,
      difficulty: e.difficulty as "beginner" | "intermediate" | "advanced",
      equipment: e.equipment ?? "",
      instructions: e.instructions ?? "",
      sets: e.sets ?? undefined,
      reps: e.reps ?? undefined,
      durationSeconds: e.durationSeconds ?? undefined,
    });
    setEditingId(e.id);
    setModalOpen(true);
  };

  const onSubmit = (data: ExerciseForm) => {
    const payload = {
      ...data,
      sets: data.sets || undefined,
      reps: data.reps || undefined,
      durationSeconds: data.durationSeconds || undefined,
    };
    if (editingId != null) {
      updateMutation.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
            toast({ title: "Exercise updated" });
            setModalOpen(false);
          },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
            toast({ title: "Exercise added" });
            setModalOpen(false);
          },
          onError: () => toast({ title: "Failed to add exercise", variant: "destructive" }),
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
          qc.invalidateQueries({ queryKey: getListExercisesQueryKey() });
          toast({ title: "Exercise deleted" });
          setDeleteId(null);
        },
        onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
      }
    );
  };

  const allData = exercises.data ?? [];
  const filtered = allData.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
      (ex.muscleGroup?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchGroup = filterGroup === "all" || ex.muscleGroup === filterGroup;
    return matchSearch && matchGroup;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Exercise Library</h1>
            <p className="text-muted-foreground text-sm mt-1">{allData.length} exercises</p>
          </div>
          <Button onClick={openCreate} data-testid="create-exercise-btn" className="gap-2">
            <Plus className="w-4 h-4" /> Add Exercise
          </Button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="exercise-search"
            />
          </div>
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-40" data-testid="muscle-group-filter">
              <SelectValue placeholder="All muscles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All muscles</SelectItem>
              {MUSCLE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {exercises.isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse bg-card rounded-lg border border-border" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">
                {allData.length === 0 ? "No exercises yet. Add your first one." : "No exercises match your search."}
              </p>
              {allData.length === 0 && (
                <Button onClick={openCreate} className="mt-4 gap-2">
                  <Plus className="w-4 h-4" /> Add Exercise
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((ex) => (
              <Card key={ex.id} className="bg-card border-border group" data-testid={`exercise-card-${ex.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{ex.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{ex.muscleGroup}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${difficultyColors[ex.difficulty] ?? ""}`}>{ex.difficulty}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <Button size="sm" variant="ghost" className="w-7 h-7 p-0" onClick={() => openEdit(ex)} data-testid={`edit-exercise-${ex.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="w-7 h-7 p-0 hover:text-destructive" onClick={() => setDeleteId(ex.id)} data-testid={`delete-exercise-${ex.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {ex.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ex.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                    {ex.sets != null && <span>{ex.sets} sets</span>}
                    {ex.reps != null && <span>{ex.reps} reps</span>}
                    {ex.durationSeconds != null && <span>{ex.durationSeconds}s</span>}
                    {ex.equipment && <span className="italic">{ex.equipment}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId != null ? "Edit Exercise" : "Add Exercise"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="ex-name">Name</Label>
                <Input id="ex-name" {...register("name")} placeholder="Exercise name" className="mt-1" />
                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label>Muscle Group</Label>
                <Controller
                  name="muscleGroup"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MUSCLE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.muscleGroup && <p className="text-destructive text-xs mt-1">{errors.muscleGroup.message}</p>}
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
              <div className="col-span-2">
                <Label htmlFor="equipment">Equipment</Label>
                <Input id="equipment" {...register("equipment")} placeholder="e.g. Barbell, None" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="sets">Sets</Label>
                <Input id="sets" type="number" {...register("sets", { valueAsNumber: true })} placeholder="e.g. 3" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reps">Reps</Label>
                <Input id="reps" type="number" {...register("reps", { valueAsNumber: true })} placeholder="e.g. 10" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="durationSeconds">Duration (seconds)</Label>
                <Input id="durationSeconds" type="number" {...register("durationSeconds", { valueAsNumber: true })} placeholder="e.g. 60" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="ex-description">Description</Label>
                <Input id="ex-description" {...register("description")} placeholder="Brief description" className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Input id="instructions" {...register("instructions")} placeholder="How to perform this exercise" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId != null ? "Save Changes" : "Add Exercise"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId != null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Exercise</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently remove this exercise from the library.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
