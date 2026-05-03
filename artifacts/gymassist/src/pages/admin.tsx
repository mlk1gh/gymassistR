import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Dumbbell, HeartPulse, MessageSquareText, ShieldAlert,
  Trash2, Ban, ShieldCheck, Eye,
  LayoutDashboard, Pencil, Plus, X, ChevronRight,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

import { useAuth, getToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err?.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

type Summary = { totalUsers: number; totalWorkouts: number; totalHealthEntries: number; totalChatMessages: number };
type UserRow = { userId: string; email: string; name: string; isAdmin: boolean; banned: boolean; createdAt: string | null; lastLoginAt: string | null; workoutCount: number; healthCount: number; chatCount: number; lastActivity: string | null };
type Workout = { id: number; name: string; goal: string; durationMinutes: number; difficulty: string; completed: boolean; scheduledAt: string | null; createdAt: string };
type Metric = { id: number; type: string; value: number; unit: string; notes: string | null; loggedAt: string };
type UserProfile = UserRow & { workouts: Workout[]; healthMetrics: Metric[]; chatMessageCount: number };
type Exercise = { id: number; name: string; muscleGroup: string; difficulty: string; equipment: string | null; description: string | null; instructions: string | null; sets: number | null; reps: number | null; durationSeconds: number | null; videoUrl: string | null };

function Avatar({ name, email, size = "md" }: { name: string; email: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  const initial = (name?.[0] ?? email?.[0] ?? "U").toUpperCase();
  return (
    <div className={`${sz} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0`}>{initial}</div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmDialog({ open, title, description, onConfirm, onCancel, danger }: {
  open: boolean; title: string; description: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "destructive" : "default"} onClick={onConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function UserProfileSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["admin-user", userId],
    queryFn: () => apiFetch(`/api/admin/users/${userId}`),
    enabled: !!userId,
  });

  const deleteWorkout = useMutation({
    mutationFn: (workoutId: number) => apiFetch(`/api/admin/users/${userId}/workouts/${workoutId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user", userId] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Workout deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMetric = useMutation({
    mutationFn: (metricId: number) => apiFetch(`/api/admin/users/${userId}/health-metrics/${metricId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user", userId] }); toast({ title: "Metric deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearChat = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${userId}/chat`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-user", userId] }); toast({ title: "Chat history cleared" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet open={!!userId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading profile…</div>}
        {profile && (
          <div className="space-y-6 pb-8">
            <SheetHeader>
              <SheetTitle>User Profile</SheetTitle>
            </SheetHeader>

            <div className="flex items-center gap-4">
              <Avatar name={profile.name} email={profile.email} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{profile.name}</p>
                <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                {profile.banned && <Badge variant="destructive" className="mt-1 text-xs">Banned</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Joined</p>
                <p className="font-medium">{profile.createdAt ? format(new Date(profile.createdAt), "MMM d, yyyy") : "—"}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Last login</p>
                <p className="font-medium">{profile.lastLoginAt ? formatDistanceToNow(new Date(profile.lastLoginAt), { addSuffix: true }) : "Never"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm text-center">
              {[{ label: "Workouts", v: profile.workouts.length }, { label: "Health entries", v: profile.healthMetrics.length }, { label: "Chat msgs", v: profile.chatMessageCount }].map((s) => (
                <div key={s.label} className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xl font-bold text-foreground">{s.v}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-primary" /> Workouts ({profile.workouts.length})
              </h3>
              {profile.workouts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No workouts yet.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {profile.workouts.map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-secondary/40 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.durationMinutes}min · {w.difficulty} {w.completed && "· ✓ done"}</p>
                      </div>
                      <button onClick={() => deleteWorkout.mutate(w.id)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors" title="Delete workout">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-primary" /> Health Metrics ({profile.healthMetrics.length})
              </h3>
              {profile.healthMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground">No health metrics yet.</p>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {profile.healthMetrics.slice(-10).reverse().map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-secondary/40 text-sm">
                      <div>
                        <p className="font-medium capitalize">{m.type}</p>
                        <p className="text-xs text-muted-foreground">{m.value} {m.unit} · {format(new Date(m.loggedAt), "MMM d, yyyy")}</p>
                      </div>
                      <button onClick={() => deleteMetric.mutate(m.id)} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors" title="Delete metric">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-primary" /> Chat History
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{profile.chatMessageCount} messages in history</p>
                {profile.chatMessageCount > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => clearChat.mutate()} disabled={clearChat.isPending}>
                    Clear history
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function UsersTab() {
  const { user: selfUser } = useAuth();
  const selfId = selfUser?.userId;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: "delete" | "ban" | "unban"; userId: string; name: string } | null>(null);

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({ queryKey: ["admin-users"], queryFn: () => apiFetch("/api/admin/users") });

  const banMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/users/${userId}/ban`, { method: "POST" }),
    onSuccess: (_, userId) => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: `User banned` }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/users/${userId}/unban`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User unbanned" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); qc.invalidateQueries({ queryKey: ["admin-summary"] }); toast({ title: "User deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "ban") banMutation.mutate(confirm.userId);
    else if (confirm.type === "unban") unbanMutation.mutate(confirm.userId);
    else deleteMutation.mutate(confirm.userId);
    setConfirm(null);
  };

  const users = (data?.users ?? []).filter((u) => {
    const q = search.toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">User</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Workouts</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Health</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Chats</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isSelf = user.userId === selfId;
                    return (
                      <tr key={user.userId} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={user.name} email={user.email} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-foreground truncate max-w-[150px]">{user.name}</p>
                                {isSelf && <Badge variant="outline" className="text-[10px] px-1 py-0">you</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</p>
                              {user.lastActivity && (
                                <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(user.lastActivity), { addSuffix: true })}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">{user.workoutCount}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full bg-chart-3/15 text-chart-3 text-xs font-semibold">{user.healthCount}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-full bg-chart-5/15 text-chart-5 text-xs font-semibold">{user.chatCount}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant={user.banned ? "destructive" : "secondary"} className="text-xs">
                            {user.banned ? "Banned" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setProfileUserId(user.userId)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="View profile">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!isSelf && (
                              <>
                                {user.banned ? (
                                  <button onClick={() => setConfirm({ type: "unban", userId: user.userId, name: user.name })} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Unban user">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button onClick={() => setConfirm({ type: "ban", userId: user.userId, name: user.name })} className="p-1.5 rounded text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title="Ban user">
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button onClick={() => setConfirm({ type: "delete", userId: user.userId, name: user.name })} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete user">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {profileUserId && <UserProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />}
      {confirm && (
        <ConfirmDialog
          open
          title={confirm.type === "delete" ? "Delete User" : confirm.type === "ban" ? "Ban User" : "Unban User"}
          description={
            confirm.type === "delete"
              ? `This will permanently delete ${confirm.name} and all their data. This cannot be undone.`
              : confirm.type === "ban"
              ? `Ban ${confirm.name}? They will be unable to sign in.`
              : `Unban ${confirm.name}? They will be able to sign in again.`
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          danger={confirm.type === "delete"}
        />
      )}
    </div>
  );
}

function ExerciseFormDialog({ exercise, onClose }: { exercise?: Exercise | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!exercise;

  const [form, setForm] = useState({
    name: exercise?.name ?? "",
    muscleGroup: exercise?.muscleGroup ?? "",
    difficulty: exercise?.difficulty ?? "",
    equipment: exercise?.equipment ?? "",
    description: exercise?.description ?? "",
    instructions: exercise?.instructions ?? "",
    sets: exercise?.sets?.toString() ?? "",
    reps: exercise?.reps?.toString() ?? "",
    durationSeconds: exercise?.durationSeconds?.toString() ?? "",
    videoUrl: exercise?.videoUrl ?? "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        muscleGroup: form.muscleGroup,
        difficulty: form.difficulty,
        equipment: form.equipment || null,
        description: form.description || null,
        instructions: form.instructions || null,
        sets: form.sets ? parseInt(form.sets) : null,
        reps: form.reps ? parseInt(form.reps) : null,
        durationSeconds: form.durationSeconds ? parseInt(form.durationSeconds) : null,
        videoUrl: form.videoUrl || null,
      };
      return isEdit
        ? apiFetch(`/api/exercises/${exercise!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : apiFetch("/api/exercises", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-exercises"] }); toast({ title: isEdit ? "Exercise updated" : "Exercise created" }); onClose(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const muscleGroups = ["chest", "back", "shoulders", "biceps", "triceps", "legs", "core", "glutes", "cardio", "full body"];
  const difficulties = ["beginner", "intermediate", "advanced"];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Exercise" : "Add Exercise"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Barbell Squat" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Muscle Group *</label>
              <Select value={form.muscleGroup} onValueChange={(v) => set("muscleGroup", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{muscleGroups.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Difficulty *</label>
              <Select value={form.difficulty} onValueChange={(v) => set("difficulty", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{difficulties.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Equipment</label>
              <Input value={form.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="e.g. Barbell" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sets</label>
              <Input type="number" value={form.sets} onChange={(e) => set("sets", e.target.value)} placeholder="e.g. 3" min={1} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Reps</label>
              <Input type="number" value={form.reps} onChange={(e) => set("reps", e.target.value)} placeholder="e.g. 10" min={1} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Duration (seconds)</label>
              <Input type="number" value={form.durationSeconds} onChange={(e) => set("durationSeconds", e.target.value)} placeholder="e.g. 60" min={1} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description…" rows={2} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Instructions</label>
              <Textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Step-by-step instructions…" rows={3} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">YouTube Video URL</label>
              <Input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
              <p className="text-xs text-muted-foreground mt-1">Optional — paste a YouTube link to add a video to this exercise.</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || !form.muscleGroup || !form.difficulty || mutation.isPending}>
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Exercise"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExercisesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editExercise, setEditExercise] = useState<Exercise | null | "new">(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<Exercise[]>({
    queryKey: ["admin-exercises"],
    queryFn: () => apiFetch("/api/exercises"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/exercises/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-exercises"] }); toast({ title: "Exercise deleted" }); setDeleteId(null); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const exercises = (data ?? []).filter((e) => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.muscleGroup.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search exercises…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button onClick={() => setEditExercise("new")} size="sm" className="ml-auto gap-2">
          <Plus className="w-4 h-4" /> Add Exercise
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading exercises…</div>
          ) : exercises.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No exercises found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Muscle</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Difficulty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sets/Reps</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((ex) => (
                    <tr key={ex.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{ex.name}</p>
                        {ex.equipment && <p className="text-xs text-muted-foreground">{ex.equipment}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs">{ex.muscleGroup}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`capitalize text-xs ${ex.difficulty === "beginner" ? "text-primary" : ex.difficulty === "intermediate" ? "text-amber-500" : "text-destructive"}`}>
                          {ex.difficulty}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ex.durationSeconds ? `${ex.durationSeconds}s` : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditExercise(ex)} className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(ex.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editExercise && <ExerciseFormDialog exercise={editExercise === "new" ? null : editExercise} onClose={() => setEditExercise(null)} />}
      {deleteId !== null && (
        <ConfirmDialog
          open
          title="Delete Exercise"
          description="Remove this exercise from the global library? This cannot be undone."
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
          danger
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => apiFetch<{ isAdmin: boolean }>("/api/admin/status"),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["admin-summary"],
    queryFn: () => apiFetch("/api/admin/summary"),
    enabled: status?.isAdmin === true,
  });

  if (statusLoading) {
    return <AppLayout><div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Checking access…</div></AppLayout>;
  }

  if (!status?.isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Access Denied</p>
            <p className="text-sm text-muted-foreground mt-1">Your account does not have admin privileges.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Admin Control Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Full platform management</p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="w-4 h-4" />Overview</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />Users</TabsTrigger>
            <TabsTrigger value="exercises" className="gap-2"><Dumbbell className="w-4 h-4" />Exercises</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={summary.totalUsers} icon={Users} />
                <StatCard label="Total Workouts" value={summary.totalWorkouts} icon={Dumbbell} />
                <StatCard label="Health Entries" value={summary.totalHealthEntries} icon={HeartPulse} />
                <StatCard label="Chat Messages" value={summary.totalChatMessages} icon={MessageSquareText} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          <TabsContent value="exercises">
            <ExercisesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
