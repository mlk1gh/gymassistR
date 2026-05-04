import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListExercises,
  useCreateExercise,
  useUpdateExercise,
  useDeleteExercise,
  useListWorkouts,
  getListExercisesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Search, Play, X, ChevronDown, ChevronRight, Dumbbell, Home, Heart, Zap, Target, RotateCcw, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders, ...(options?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

type WorkoutExercise = {
  id: number; name: string; description: string | null; muscleGroup: string;
  difficulty: string; equipment: string | null; instructions: string | null;
  sets: number | null; reps: number | null; durationSeconds: number | null;
  videoUrl: string | null; linkId: number; order: number;
};

type GlobalExercise = {
  id: number; name: string; description?: string | null; muscleGroup: string;
  difficulty: string; equipment?: string | null; instructions?: string | null;
  sets?: number | null; reps?: number | null; durationSeconds?: number | null;
  videoUrl?: string | null;
};

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
  videoUrl: z.string().optional(),
});
type ExerciseForm = z.infer<typeof exerciseSchema>;

const difficultyColors: Record<string, string> = {
  beginner: "bg-chart-2/20 text-chart-2",
  intermediate: "bg-chart-3/20 text-chart-3",
  advanced: "bg-destructive/20 text-destructive",
};

const goalColors: Record<string, string> = {
  strength: "bg-primary/15 text-primary",
  hypertrophy: "bg-chart-3/15 text-chart-3",
  endurance: "bg-chart-2/15 text-chart-2",
  weight_loss: "bg-destructive/15 text-destructive",
  flexibility: "bg-chart-4/15 text-chart-4",
  general: "bg-secondary text-muted-foreground",
};

const MUSCLE_GROUPS = ["Legs", "Back", "Chest", "Shoulders", "Arms", "Core", "Full Body", "Cardio"];

type CategoryDef = {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  filter: (ex: { muscleGroup: string; equipment?: string | null }) => boolean;
};

const CATEGORIES: CategoryDef[] = [
  {
    key: "all",
    label: "All",
    icon: Dumbbell,
    color: "text-primary",
    bgColor: "bg-primary/10",
    filter: () => true,
  },
  {
    key: "chest",
    label: "Chest",
    icon: Target,
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    filter: (ex) => ex.muscleGroup === "Chest",
  },
  {
    key: "back",
    label: "Back",
    icon: User,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    filter: (ex) => ex.muscleGroup === "Back",
  },
  {
    key: "legs",
    label: "Legs",
    icon: Zap,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    filter: (ex) => ex.muscleGroup === "Legs",
  },
  {
    key: "shoulders",
    label: "Shoulders",
    icon: RotateCcw,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    filter: (ex) => ex.muscleGroup === "Shoulders",
  },
  {
    key: "arms",
    label: "Arms",
    icon: Dumbbell,
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    filter: (ex) => ex.muscleGroup === "Arms",
  },
  {
    key: "core",
    label: "Core",
    icon: Target,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    filter: (ex) => ex.muscleGroup === "Core",
  },
  {
    key: "cardio",
    label: "Cardio",
    icon: Heart,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
    filter: (ex) => ex.muscleGroup === "Cardio",
  },
  {
    key: "home",
    label: "Home",
    icon: Home,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    filter: (ex) =>
      !ex.equipment ||
      ex.equipment.toLowerCase().includes("bodyweight") ||
      ex.equipment.toLowerCase() === "none" ||
      ex.equipment.toLowerCase() === "no equipment",
  },
  {
    key: "fullbody",
    label: "Full Body",
    icon: Zap,
    color: "text-indigo-400",
    bgColor: "bg-indigo-400/10",
    filter: (ex) => ex.muscleGroup === "Full Body",
  },
];

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v");
    else if (u.hostname === "youtu.be") videoId = u.pathname.slice(1).split("?")[0];
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : null;
  } catch { return null; }
}

function getYouTubeThumbnail(url: string): string | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname.includes("youtube.com")) videoId = u.searchParams.get("v");
    else if (u.hostname === "youtu.be") videoId = u.pathname.slice(1).split("?")[0];
    return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  } catch { return null; }
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const embedUrl = getYouTubeEmbedUrl(url);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black border-border">
        <div className="flex items-center justify-between px-4 py-2 bg-card">
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {embedUrl ? (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe src={embedUrl} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Invalid video URL</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExercisePickerDialog({
  workoutId,
  workoutName,
  currentExerciseIds,
  onClose,
  onAdded,
}: {
  workoutId: number;
  workoutName: string;
  currentExerciseIds: Set<number>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const exercises = useListExercises();
  const qc = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (exerciseId: number) =>
      apiFetch(`/api/workouts/${workoutId}/exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workout-exercises", workoutId] });
      onAdded();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const all = exercises.data ?? [];
  const filtered = all.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase()) || ex.muscleGroup.toLowerCase().includes(search.toLowerCase());
    const matchGroup = filterGroup === "all" || ex.muscleGroup === filterGroup;
    return matchSearch && matchGroup;
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Exercise to "{workoutName}"</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All muscles</SelectItem>
              {MUSCLE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto mt-3 space-y-1.5">
          {exercises.isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No exercises found.</p>
          ) : filtered.map((ex) => {
            const already = currentExerciseIds.has(ex.id);
            return (
              <div key={ex.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ex.name}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{ex.muscleGroup}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${difficultyColors[ex.difficulty] ?? ""}`}>{ex.difficulty}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={already ? "ghost" : "default"}
                  disabled={already || addMutation.isPending}
                  onClick={() => !already && addMutation.mutate(ex.id)}
                  className="shrink-0 ml-2 h-7 text-xs"
                >
                  {already ? "Added" : <><Plus className="w-3 h-3 mr-1" />Add</>}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose} className="w-full">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkoutPlanSection({
  workout,
  videoExercise,
  setVideoExercise,
}: {
  workout: { id: number; name: string; goal: string; difficulty: string; durationMinutes: number; completed: boolean };
  videoExercise: { url: string; title: string } | null;
  setVideoExercise: (v: { url: string; title: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const qc = useQueryClient();

  const { data: exercises = [], isLoading } = useQuery<WorkoutExercise[]>({
    queryKey: ["workout-exercises", workout.id],
    queryFn: () => apiFetch(`/api/workouts/${workout.id}/exercises`),
    enabled: open,
  });

  const removeMutation = useMutation({
    mutationFn: (exerciseId: number) =>
      apiFetch(`/api/workouts/${workout.id}/exercises/${exerciseId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workout-exercises", workout.id] }),
    onError: () => toast({ title: "Failed to remove exercise", variant: "destructive" }),
  });

  const currentIds = new Set(exercises.map((e) => e.id));

  return (
    <Card className={`bg-card border-border overflow-hidden transition-all ${workout.completed ? "opacity-60" : ""}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${open ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
          <Dumbbell className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{workout.name}</span>
            {workout.completed && <span className="text-[10px] bg-chart-2/20 text-chart-2 px-1.5 py-0.5 rounded font-medium">Completed</span>}
          </div>
          <div className="flex gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${goalColors[workout.goal] ?? "bg-secondary text-muted-foreground"}`}>{workout.goal.replace("_", " ")}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${difficultyColors[workout.difficulty] ?? ""}`}>{workout.difficulty}</span>
            <span className="text-[10px] text-muted-foreground">{workout.durationMinutes} min</span>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="px-4 py-6 text-center">
              <div className="h-4 w-32 animate-pulse bg-secondary rounded mx-auto" />
            </div>
          ) : exercises.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">No exercises added yet.</p>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Exercise
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {exercises.map((ex) => {
                const thumbnail = ex.videoUrl ? getYouTubeThumbnail(ex.videoUrl) : null;
                return (
                  <div key={ex.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-secondary/20 transition-colors">
                    {thumbnail ? (
                      <div
                        className="relative w-14 h-10 rounded overflow-hidden cursor-pointer shrink-0 flex-none"
                        onClick={() => ex.videoUrl && setVideoExercise({ url: ex.videoUrl, title: ex.name })}
                      >
                        <img src={thumbnail} alt={ex.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3 h-3 text-white" fill="white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-10 rounded bg-secondary flex items-center justify-center shrink-0 flex-none">
                        <Dumbbell className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ex.name}</p>
                      <div className="flex gap-1.5 mt-0.5 flex-wrap items-center">
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{ex.muscleGroup}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${difficultyColors[ex.difficulty] ?? ""}`}>{ex.difficulty}</span>
                        {ex.sets != null && ex.reps != null && (
                          <span className="text-[10px] text-muted-foreground">{ex.sets}×{ex.reps}</span>
                        )}
                        {ex.durationSeconds != null && (
                          <span className="text-[10px] text-muted-foreground">{ex.durationSeconds}s</span>
                        )}
                        {ex.equipment && <span className="text-[10px] text-muted-foreground italic">{ex.equipment}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {ex.videoUrl && (
                        <Button size="sm" variant="ghost" className="w-7 h-7 p-0 text-primary" onClick={() => ex.videoUrl && setVideoExercise({ url: ex.videoUrl, title: ex.name })}>
                          <Play className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="w-7 h-7 p-0 hover:text-destructive" onClick={() => removeMutation.mutate(ex.id)} disabled={removeMutation.isPending}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-2.5">
                <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)} className="gap-1.5 text-primary hover:text-primary hover:bg-primary/10 h-8">
                  <Plus className="w-3.5 h-3.5" /> Add Exercise
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {pickerOpen && (
        <ExercisePickerDialog
          workoutId={workout.id}
          workoutName={workout.name}
          currentExerciseIds={currentIds}
          onClose={() => setPickerOpen(false)}
          onAdded={() => {}}
        />
      )}
    </Card>
  );
}

export default function ExercisesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [videoExercise, setVideoExercise] = useState<{ url: string; title: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [planSearch, setPlanSearch] = useState("");

  const workouts = useListWorkouts();
  const exercises = useListExercises();
  const createMutation = useCreateExercise();
  const updateMutation = useUpdateExercise();
  const deleteMutation = useDeleteExercise();

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ExerciseForm>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { difficulty: "intermediate" },
  });

  const openCreate = () => {
    reset({ difficulty: "intermediate", name: "", muscleGroup: "", description: "", equipment: "", instructions: "", videoUrl: "" });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (e: GlobalExercise) => {
    reset({
      name: e.name, description: e.description ?? "", muscleGroup: e.muscleGroup,
      difficulty: e.difficulty as "beginner" | "intermediate" | "advanced",
      equipment: e.equipment ?? "", instructions: e.instructions ?? "",
      sets: e.sets ?? undefined, reps: e.reps ?? undefined,
      durationSeconds: e.durationSeconds ?? undefined, videoUrl: e.videoUrl ?? "",
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
      videoUrl: data.videoUrl || undefined,
    };
    if (editingId != null) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListExercisesQueryKey() }); toast({ title: "Exercise updated" }); setModalOpen(false); },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListExercisesQueryKey() }); toast({ title: "Exercise added" }); setModalOpen(false); },
        onError: () => toast({ title: "Failed to add exercise", variant: "destructive" }),
      });
    }
  };

  const handleDelete = () => {
    if (deleteId == null) return;
    deleteMutation.mutate({ id: deleteId }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListExercisesQueryKey() }); toast({ title: "Exercise deleted" }); setDeleteId(null); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  const allWorkouts = workouts.data ?? [];
  const filteredWorkouts = allWorkouts.filter((w) =>
    w.name.toLowerCase().includes(planSearch.toLowerCase()) ||
    w.goal.toLowerCase().includes(planSearch.toLowerCase())
  );

  const allExercises = exercises.data ?? [];
  const activeCategory = CATEGORIES.find((c) => c.key === filterGroup) ?? CATEGORIES[0]!;
  const filteredExercises = allExercises.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase()) || ex.muscleGroup.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory.filter(ex);
    return matchSearch && matchCategory;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>
          <p className="text-muted-foreground text-sm mt-1">Browse exercises organized by your workout plans</p>
        </div>

        <Tabs defaultValue="plans">
          <TabsList className="bg-secondary">
            <TabsTrigger value="plans">My Plans</TabsTrigger>
            <TabsTrigger value="library">Exercise Library</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search workout plans..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {workouts.isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse bg-card rounded-lg border border-border" />
                ))}
              </div>
            ) : filteredWorkouts.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-16 text-center">
                  <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {allWorkouts.length === 0
                      ? "No workout plans yet. Create a plan on the Workouts page first."
                      : "No plans match your search."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredWorkouts.map((w) => (
                  <WorkoutPlanSection
                    key={w.id}
                    workout={w}
                    videoExercise={videoExercise}
                    setVideoExercise={setVideoExercise}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library" className="mt-4 space-y-4">
            {/* Category cards */}
            <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = filterGroup === cat.key;
                const count = cat.key === "all" ? allExercises.length : allExercises.filter(cat.filter).length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => { setFilterGroup(cat.key); setSearch(""); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:bg-secondary/50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground" : `${cat.bgColor} ${cat.color}`}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[11px] font-medium leading-none ${isActive ? "text-primary" : "text-foreground"}`}>{cat.label}</span>
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Search + add button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={`Search ${activeCategory.label === "All" ? "exercises" : activeCategory.label}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="exercise-search" />
              </div>
              <Button onClick={openCreate} data-testid="create-exercise-btn" className="gap-2 shrink-0" size="sm">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>

            {/* Results */}
            {exercises.isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse bg-card rounded-lg border border-border" />)}
              </div>
            ) : filteredExercises.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-16 text-center">
                  <div className={`w-12 h-12 rounded-xl ${activeCategory.bgColor} flex items-center justify-center mx-auto mb-3`}>
                    <activeCategory.icon className={`w-6 h-6 ${activeCategory.color}`} />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {allExercises.length === 0
                      ? "No exercises yet. Add your first one."
                      : `No ${activeCategory.label === "All" ? "" : activeCategory.label + " "}exercises found.`}
                  </p>
                  <Button onClick={openCreate} className="mt-4 gap-2" size="sm">
                    <Plus className="w-4 h-4" /> Add Exercise
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExercises.map((ex) => {
                  const thumbnail = ex.videoUrl ? getYouTubeThumbnail(ex.videoUrl) : null;
                  return (
                    <Card key={ex.id} className="bg-card border-border group overflow-hidden" data-testid={`exercise-card-${ex.id}`}>
                      {thumbnail && (
                        <div className="relative w-full cursor-pointer overflow-hidden" style={{ paddingBottom: "56.25%" }} onClick={() => ex.videoUrl && setVideoExercise({ url: ex.videoUrl, title: ex.name })}>
                          <img src={thumbnail} alt={ex.name} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                              <Play className="w-5 h-5 text-black ml-0.5" fill="black" />
                            </div>
                          </div>
                        </div>
                      )}
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
                            {ex.videoUrl && (
                              <Button size="sm" variant="ghost" className="w-7 h-7 p-0 text-primary" onClick={() => ex.videoUrl && setVideoExercise({ url: ex.videoUrl, title: ex.name })}>
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="w-7 h-7 p-0" onClick={() => openEdit(ex)} data-testid={`edit-exercise-${ex.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="w-7 h-7 p-0 hover:text-destructive" onClick={() => setDeleteId(ex.id)} data-testid={`delete-exercise-${ex.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        {ex.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ex.description}</p>}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                          {ex.sets != null && <span>{ex.sets} sets</span>}
                          {ex.reps != null && <span>{ex.reps} reps</span>}
                          {ex.durationSeconds != null && <span>{ex.durationSeconds}s</span>}
                          {ex.equipment && <span className="italic">{ex.equipment}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {videoExercise && (
        <VideoModal url={videoExercise.url} title={videoExercise.title} onClose={() => setVideoExercise(null)} />
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Controller name="muscleGroup" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {MUSCLE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
                {errors.muscleGroup && <p className="text-destructive text-xs mt-1">{errors.muscleGroup.message}</p>}
              </div>
              <div>
                <Label>Difficulty</Label>
                <Controller name="difficulty" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
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
              <div className="col-span-2">
                <Label htmlFor="videoUrl">YouTube Video URL</Label>
                <Input id="videoUrl" {...register("videoUrl")} placeholder="https://www.youtube.com/watch?v=..." className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Paste a YouTube link to show a video preview.</p>
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
          <DialogHeader><DialogTitle>Delete Exercise</DialogTitle></DialogHeader>
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
