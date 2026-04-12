import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Dumbbell, HeartPulse, MessageSquareText, ShieldAlert } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

type AdminStatus = { isAdmin: boolean };
type AdminSummary = {
  totalUsers: number;
  totalWorkouts: number;
  totalHealthEntries: number;
  totalChatMessages: number;
};
type AdminUser = {
  clerkUserId: string;
  email: string;
  name: string;
  imageUrl: string;
  workoutCount: number;
  healthCount: number;
  chatCount: number;
  lastActivity: string | null;
};
type AdminUsers = { users: AdminUser[] };

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

function UserAvatar({ user }: { user: AdminUser }) {
  const initial = (user.name?.[0] ?? user.email?.[0] ?? "U").toUpperCase();
  return user.imageUrl ? (
    <img src={user.imageUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
      {initial}
    </div>
  );
}

export default function AdminPage() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => apiFetch<AdminStatus>("/api/admin/status"),
  });

  const isAdmin = status?.isAdmin === true;

  const { data: summary } = useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => apiFetch<AdminSummary>("/api/admin/summary"),
    enabled: isAdmin,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<AdminUsers>("/api/admin/users"),
    enabled: isAdmin,
  });

  if (statusLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Checking access…</div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Access Denied</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your account does not have admin privileges.<br />
              Ask the site owner to add your email to <code className="text-xs bg-muted px-1 py-0.5 rounded">ADMIN_EMAILS</code>.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const users = usersData?.users ?? [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform-wide activity overview</p>
        </div>

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={summary.totalUsers} icon={Users} />
            <StatCard label="Total Workouts" value={summary.totalWorkouts} icon={Dumbbell} />
            <StatCard label="Health Entries" value={summary.totalHealthEntries} icon={HeartPulse} />
            <StatCard label="Chat Messages" value={summary.totalChatMessages} icon={MessageSquareText} />
          </div>
        )}

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No users yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">User</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Workouts</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Health</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Chats</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.clerkUserId} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[180px]">{user.name}</p>
                              {user.email && user.email !== user.name && (
                                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            {user.workoutCount}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-chart-3/15 text-chart-3 text-xs font-semibold">
                            {user.healthCount}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-chart-5/15 text-chart-5 text-xs font-semibold">
                            {user.chatCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {user.lastActivity
                            ? formatDistanceToNow(new Date(user.lastActivity), { addSuffix: true })
                            : "—"}
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
    </AppLayout>
  );
}
