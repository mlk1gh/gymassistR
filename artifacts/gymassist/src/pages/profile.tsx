import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { User, Save, Ruler, Weight, Target, Calendar } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface UserProfile {
  id: number;
  email: string;
  name: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  fitnessGoal: string | null;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("gymassist_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/user/profile`, { headers: authHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UserProfile | null) => {
        if (data) {
          setProfile(data);
          setName(data.name ?? "");
          setAge(data.age != null ? String(data.age) : "");
          setHeightCm(data.heightCm != null ? String(data.heightCm) : "");
          setWeightKg(data.weightKg != null ? String(data.weightKg) : "");
          setFitnessGoal(data.fitnessGoal ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/user/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          name: name.trim() || undefined,
          age: age !== "" ? Number(age) : null,
          heightCm: heightCm !== "" ? Number(heightCm) : null,
          weightKg: weightKg !== "" ? Number(weightKg) : null,
          fitnessGoal: fitnessGoal.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
      const updated: UserProfile = await res.json();
      setProfile(updated);
      toast({ title: "Profile saved", description: "Your personal details have been updated." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
          Loading profile…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Keep your personal data up to date so GymAssist can give you better recommendations.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" />
              Personal Information
            </CardTitle>
            <CardDescription>Your account details and physical stats</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile?.email ?? user?.email ?? ""}
                    disabled
                    className="opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="age" className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Age
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    min={1}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 28"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="height" className="flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5" /> Height (cm)
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    min={50}
                    max={300}
                    step={0.1}
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="e.g. 175"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="weight" className="flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5" /> Weight (kg)
                  </Label>
                  <Input
                    id="weight"
                    type="number"
                    min={20}
                    max={500}
                    step={0.1}
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 75"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal" className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Fitness Goal
                </Label>
                <Textarea
                  id="goal"
                  value={fitnessGoal}
                  onChange={(e) => setFitnessGoal(e.target.value)}
                  placeholder="e.g. Lose 10 kg by summer, build upper body strength, run a 5K…"
                  rows={3}
                  maxLength={512}
                />
                <p className="text-xs text-muted-foreground">
                  {fitnessGoal.length}/512 characters
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
