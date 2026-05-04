import { Router, type IRouter } from "express";
import { db, chatMessagesTable, workoutsTable, exercisesTable, workoutExercisesTable, healthMetricsTable, usersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { serializeRows, serializeRow } from "../lib/serialize";
import { SendChatMessageBody, SendChatMessageResponse, GetChatHistoryResponse } from "@workspace/api-zod";
import { eq, and, desc, asc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/chat/history", async (req, res): Promise<void> => {
  const userId = req.userId;
  const messages = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId)).orderBy(chatMessagesTable.createdAt);
  res.json(GetChatHistoryResponse.parse(serializeRows(messages)));
});

router.delete("/chat/history", async (req, res): Promise<void> => {
  const userId = req.userId;
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));
  res.sendStatus(204);
});

const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "list_workouts",
      description: "List all of the user's workout plans with their details.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_workout_exercises",
      description: "List exercises inside a specific workout plan.",
      parameters: {
        type: "object",
        properties: {
          workoutId: { type: "number", description: "The ID of the workout plan." },
        },
        required: ["workoutId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_health_metrics",
      description: "Get the user's recent health metric logs (weight, steps, sleep, calories, heart rate, etc.).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Filter by metric type, e.g. weight, steps, sleep_hours, calories, heart_rate, body_fat, water_intake." },
          limit: { type: "number", description: "How many records to return. Default 10." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_exercise_library",
      description: "Browse all available exercises in the global exercise library.",
      parameters: {
        type: "object",
        properties: {
          muscleGroup: { type: "string", description: "Filter by muscle group, e.g. Chest, Back, Legs, Arms, Core, Shoulders, Full Body, Cardio." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_workout",
      description: "Create a new workout plan for the user.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the workout plan, e.g. Push Day, Upper Body Strength." },
          goal: { type: "string", enum: ["strength", "hypertrophy", "endurance", "weight_loss", "flexibility", "general"], description: "Primary goal of this workout." },
          durationMinutes: { type: "number", description: "Estimated duration in minutes." },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Difficulty level." },
          description: { type: "string", description: "Optional description." },
        },
        required: ["name", "goal", "durationMinutes", "difficulty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_health_metric",
      description: "Log a health metric entry for the user.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["weight", "steps", "sleep_hours", "calories", "heart_rate", "body_fat", "water_intake"], description: "Type of metric." },
          value: { type: "number", description: "The measured value." },
          unit: { type: "string", description: "Unit, e.g. kg, lbs, steps, hours, kcal, bpm, %, L." },
          notes: { type: "string", description: "Optional notes." },
        },
        required: ["type", "value", "unit"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_exercise_to_workout",
      description: "Add an exercise from the library to one of the user's workout plans.",
      parameters: {
        type: "object",
        properties: {
          workoutId: { type: "number", description: "The ID of the workout plan." },
          exerciseId: { type: "number", description: "The ID of the exercise from the library." },
        },
        required: ["workoutId", "exerciseId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_exercise_to_library",
      description: "Create a brand-new exercise and save it to the exercise library only — do NOT add it to any workout. Use this when the user says things like 'add X to the library', 'save X to my exercises', or 'create an exercise' without mentioning a workout.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name of the exercise, e.g. Romanian Deadlift, Cable Fly, Face Pull." },
          muscleGroup: { type: "string", enum: ["Chest", "Back", "Legs", "Arms", "Core", "Shoulders", "Full Body", "Cardio"], description: "Primary muscle group targeted." },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Difficulty level." },
          description: { type: "string", description: "Brief description of the exercise and what it targets." },
          equipment: { type: "string", description: "Equipment needed, e.g. Barbell, Dumbbell, Cable, Bodyweight, Resistance Band." },
          instructions: { type: "string", description: "Step-by-step instructions for performing the exercise correctly." },
          sets: { type: "number", description: "Recommended number of sets." },
          reps: { type: "number", description: "Recommended number of reps per set." },
          durationSeconds: { type: "number", description: "Duration in seconds (for timed exercises like planks). Omit if sets/reps apply." },
          videoUrl: { type: "string", description: "YouTube video URL demonstrating the exercise — include this whenever you know a good tutorial video." },
        },
        required: ["name", "muscleGroup", "difficulty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_and_add_exercise",
      description: "Create a brand-new exercise that doesn't exist in the library AND immediately add it to a specific workout plan. Use this ONLY when the user explicitly asks to add an exercise to a workout AND the exercise doesn't exist in the library yet. Do NOT use this just to add something to the library.",
      parameters: {
        type: "object",
        properties: {
          workoutId: { type: "number", description: "The ID of the workout plan to add the exercise to." },
          name: { type: "string", description: "Full name of the exercise, e.g. Romanian Deadlift, Cable Fly, Face Pull." },
          muscleGroup: { type: "string", enum: ["Chest", "Back", "Legs", "Arms", "Core", "Shoulders", "Full Body", "Cardio"], description: "Primary muscle group targeted." },
          difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Difficulty level." },
          description: { type: "string", description: "Brief description of the exercise and what it targets." },
          equipment: { type: "string", description: "Equipment needed, e.g. Barbell, Dumbbell, Cable, Bodyweight, Resistance Band." },
          instructions: { type: "string", description: "Step-by-step instructions for performing the exercise correctly." },
          sets: { type: "number", description: "Recommended number of sets." },
          reps: { type: "number", description: "Recommended number of reps per set." },
          durationSeconds: { type: "number", description: "Duration in seconds (for timed exercises like planks). Omit if sets/reps apply." },
          videoUrl: { type: "string", description: "YouTube video URL demonstrating the exercise, e.g. https://www.youtube.com/watch?v=... — include this whenever you know a good tutorial video for the exercise." },
        },
        required: ["workoutId", "name", "muscleGroup", "difficulty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mark_workout_complete",
      description: "Mark one of the user's workout plans as completed.",
      parameters: {
        type: "object",
        properties: {
          workoutId: { type: "number", description: "The ID of the workout to complete." },
        },
        required: ["workoutId"],
      },
    },
  },
];

async function executeToolCall(name: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
  switch (name) {
    case "list_workouts": {
      const rows = await db.select().from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId)).orderBy(asc(workoutsTable.createdAt));
      return rows.map((w) => ({ id: w.id, name: w.name, goal: w.goal, difficulty: w.difficulty, durationMinutes: w.durationMinutes, completed: w.completed }));
    }

    case "get_workout_exercises": {
      const workoutId = args.workoutId as number;
      const [workout] = await db.select({ id: workoutsTable.id }).from(workoutsTable).where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId)));
      if (!workout) return { error: "Workout not found or does not belong to this user." };
      const rows = await db.select({
        id: exercisesTable.id, name: exercisesTable.name, muscleGroup: exercisesTable.muscleGroup,
        difficulty: exercisesTable.difficulty, equipment: exercisesTable.equipment,
        sets: exercisesTable.sets, reps: exercisesTable.reps, durationSeconds: exercisesTable.durationSeconds,
      })
        .from(workoutExercisesTable)
        .innerJoin(exercisesTable, eq(workoutExercisesTable.exerciseId, exercisesTable.id))
        .where(eq(workoutExercisesTable.workoutId, workoutId))
        .orderBy(asc(workoutExercisesTable.order));
      return rows;
    }

    case "list_health_metrics": {
      const type = args.type as string | undefined;
      const limit = (args.limit as number | undefined) ?? 10;
      const conditions = [eq(healthMetricsTable.clerkUserId, userId), ...(type ? [eq(healthMetricsTable.type, type)] : [])];
      const rows = await db.select({
        id: healthMetricsTable.id, type: healthMetricsTable.type, value: healthMetricsTable.value,
        unit: healthMetricsTable.unit, notes: healthMetricsTable.notes, loggedAt: healthMetricsTable.loggedAt,
      }).from(healthMetricsTable).where(and(...conditions)).orderBy(desc(healthMetricsTable.loggedAt)).limit(limit);
      return rows;
    }

    case "get_exercise_library": {
      const muscleGroup = args.muscleGroup as string | undefined;
      const rows = await db.select({
        id: exercisesTable.id, name: exercisesTable.name, muscleGroup: exercisesTable.muscleGroup,
        difficulty: exercisesTable.difficulty, equipment: exercisesTable.equipment,
        sets: exercisesTable.sets, reps: exercisesTable.reps, durationSeconds: exercisesTable.durationSeconds,
        description: exercisesTable.description,
      }).from(exercisesTable).where(muscleGroup ? eq(exercisesTable.muscleGroup, muscleGroup) : undefined);
      return rows;
    }

    case "create_workout": {
      const [workout] = await db.insert(workoutsTable).values({
        clerkUserId: userId,
        name: args.name as string,
        goal: args.goal as string,
        durationMinutes: args.durationMinutes as number,
        difficulty: args.difficulty as string,
        description: (args.description as string | undefined) ?? null,
      }).returning();
      return { id: workout.id, name: workout.name, goal: workout.goal, difficulty: workout.difficulty, durationMinutes: workout.durationMinutes, message: "Workout plan created successfully." };
    }

    case "log_health_metric": {
      const [metric] = await db.insert(healthMetricsTable).values({
        clerkUserId: userId,
        type: args.type as string,
        value: args.value as number,
        unit: args.unit as string,
        notes: (args.notes as string | undefined) ?? null,
        loggedAt: new Date(),
      }).returning();
      return { id: metric.id, type: metric.type, value: metric.value, unit: metric.unit, message: "Health metric logged successfully." };
    }

    case "add_exercise_to_workout": {
      const workoutId = args.workoutId as number;
      const exerciseId = args.exerciseId as number;
      const [workout] = await db.select({ id: workoutsTable.id }).from(workoutsTable).where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId)));
      if (!workout) return { error: "Workout not found or does not belong to this user." };
      const existing = await db.select({ id: workoutExercisesTable.id }).from(workoutExercisesTable).where(and(eq(workoutExercisesTable.workoutId, workoutId), eq(workoutExercisesTable.exerciseId, exerciseId)));
      if (existing.length > 0) return { message: "Exercise is already in this workout plan." };
      await db.insert(workoutExercisesTable).values({ workoutId, exerciseId, order: 0 });
      return { message: "Exercise added to workout plan successfully." };
    }

    case "add_exercise_to_library": {
      const [exercise] = await db.insert(exercisesTable).values({
        name: args.name as string,
        muscleGroup: args.muscleGroup as string,
        difficulty: args.difficulty as string,
        description: (args.description as string | undefined) ?? null,
        equipment: (args.equipment as string | undefined) ?? null,
        instructions: (args.instructions as string | undefined) ?? null,
        sets: (args.sets as number | undefined) ?? null,
        reps: (args.reps as number | undefined) ?? null,
        durationSeconds: (args.durationSeconds as number | undefined) ?? null,
        videoUrl: (args.videoUrl as string | undefined) ?? null,
      }).returning();
      return {
        message: `Exercise "${exercise.name}" has been added to the Exercise Library. It is NOT added to any workout.`,
        exerciseId: exercise.id,
      };
    }

    case "create_and_add_exercise": {
      const workoutId = args.workoutId as number;
      const [workout] = await db.select({ id: workoutsTable.id }).from(workoutsTable).where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId)));
      if (!workout) return { error: "Workout not found or does not belong to this user." };

      const [exercise] = await db.insert(exercisesTable).values({
        name: args.name as string,
        muscleGroup: args.muscleGroup as string,
        difficulty: args.difficulty as string,
        description: (args.description as string | undefined) ?? null,
        equipment: (args.equipment as string | undefined) ?? null,
        instructions: (args.instructions as string | undefined) ?? null,
        sets: (args.sets as number | undefined) ?? null,
        reps: (args.reps as number | undefined) ?? null,
        durationSeconds: (args.durationSeconds as number | undefined) ?? null,
        videoUrl: (args.videoUrl as string | undefined) ?? null,
      }).returning();

      await db.insert(workoutExercisesTable).values({ workoutId, exerciseId: exercise.id, order: 0 });
      return {
        message: `Created exercise "${exercise.name}" and added it to the workout successfully. It is now visible in the Exercise Library too.`,
        exerciseId: exercise.id,
      };
    }

    case "mark_workout_complete": {
      const workoutId = args.workoutId as number;
      const result = await db.update(workoutsTable).set({ completed: true }).where(and(eq(workoutsTable.id, workoutId), eq(workoutsTable.clerkUserId, userId))).returning({ id: workoutsTable.id, name: workoutsTable.name });
      if (!result[0]) return { error: "Workout not found or does not belong to this user." };
      return { message: `Workout "${result[0].name}" marked as completed.` };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

router.post("/chat", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userMessage = parsed.data.message;
  await db.insert(chatMessagesTable).values({ clerkUserId: userId, role: "user", content: userMessage });

  const [workouts, recentMetrics, history, profileRows] = await Promise.all([
    db.select().from(workoutsTable).where(eq(workoutsTable.clerkUserId, userId)).orderBy(asc(workoutsTable.createdAt)),
    db.select({ type: healthMetricsTable.type, value: healthMetricsTable.value, unit: healthMetricsTable.unit, loggedAt: healthMetricsTable.loggedAt })
      .from(healthMetricsTable).where(eq(healthMetricsTable.clerkUserId, userId)).orderBy(desc(healthMetricsTable.loggedAt)).limit(15),
    db.select().from(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId)).orderBy(asc(chatMessagesTable.createdAt)),
    db.select({ age: usersTable.age, heightCm: usersTable.heightCm, weightKg: usersTable.weightKg, fitnessGoal: usersTable.fitnessGoal })
      .from(usersTable).where(eq(usersTable.id, Number(userId))).limit(1),
  ]);

  const profile = profileRows[0] ?? null;

  const workoutSummary = workouts.length > 0
    ? workouts.map((w) => `  • ${w.name} (ID:${w.id}) — goal: ${w.goal}, ${w.difficulty}, ${w.durationMinutes} min${w.completed ? ", completed" : ""}`).join("\n")
    : "  None yet.";

  const metricSummary = recentMetrics.length > 0
    ? recentMetrics.map((m) => `  • ${m.type}: ${m.value} ${m.unit} (${new Date(m.loggedAt).toLocaleDateString()})`).join("\n")
    : "  None logged yet.";

  const profileLines: string[] = [];
  if (profile) {
    if (profile.age != null) profileLines.push(`  • Age: ${profile.age} years`);
    if (profile.heightCm != null) profileLines.push(`  • Height: ${profile.heightCm} cm`);
    if (profile.weightKg != null) profileLines.push(`  • Weight: ${profile.weightKg} kg`);
    if (profile.fitnessGoal) profileLines.push(`  • Fitness goal: ${profile.fitnessGoal}`);
  }
  const profileSummary = profileLines.length > 0 ? profileLines.join("\n") : "  Not set yet.";

  const systemPrompt = `You are GymAssist, an expert AI fitness coach and personal health assistant. You have direct access to this user's fitness data and can take real actions on their behalf.

## Current User Data

**User Profile:**
${profileSummary}

**Workout Plans (${workouts.length} total):**
${workoutSummary}

**Recent Health Metrics:**
${metricSummary}

## What You Can Do
You have tools that let you:
- List the user's workout plans and exercises inside each one
- Browse the global exercise library (filter by muscle group)
- CREATE new workout plans for the user
- LOG health metrics (weight, steps, sleep, calories, heart rate, etc.)
- ADD exercises from the library into a workout plan
- ADD a brand-new exercise to the library only (without adding to any workout)
- CREATE a brand-new exercise AND add it to a workout in one step
- MARK a workout as complete

## How to Respond
- When the user asks you to create a workout, log data, or add exercises — USE YOUR TOOLS to actually do it, don't just describe how.
- After using a tool, naturally confirm what was done (e.g. "Done! I've created your Push Day plan — you can find it in the Workouts section.").
- **Choosing the right exercise tool — read carefully:**
  - User says "add X to the library" / "save X to my exercises" / "create exercise X" (no workout mentioned): use add_exercise_to_library. Do NOT add to any workout.
  - User says "add X to my [workout name]" / "put X in my push day": first check the library with get_exercise_library. If found, use add_exercise_to_workout. If NOT found, use create_and_add_exercise to create it and add it to the workout in one step.
  - Never use create_and_add_exercise when the user only wants to add something to the library.
- Reference the user's actual data above when giving advice. When the user's profile is set, personalise recommendations using their age, height, weight, and fitness goal (e.g. "Given your goal to lose 10 kg..." or "At 175 cm and 80 kg, a calorie target of X would suit you well.").
- Be concise, motivating, and practical. Prioritize safety.
- If you create a workout or log a metric, tell the user where they can see it in the app.`;

  type OpenAIMessage = Parameters<typeof openai.chat.completions.create>[0]["messages"][0];

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })),
  ];

  let reply = "";

  try {
    let iterations = 0;
    while (iterations < 6) {
      iterations++;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages,
        tools: toolDefinitions,
        tool_choice: "auto",
      });

      const aiMessage = response.choices[0]?.message;
      if (!aiMessage) break;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages.push(aiMessage as any);

      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        for (const toolCall of aiMessage.tool_calls) {
          let toolResult: unknown;
          try {
            const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
            toolResult = await executeToolCall(toolCall.function.name, args, userId);
          } catch (err) {
            toolResult = { error: String(err) };
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
      } else {
        reply = aiMessage.content ?? "";
        break;
      }
    }

    if (!reply) reply = "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (err) {
    logger.error({ err }, "OpenAI chat error");
    try {
      const fallback = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [
          { role: "system", content: "You are GymAssist, an expert AI fitness coach. Be concise and helpful." },
          ...history.slice(-10).map((msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })),
          { role: "user", content: userMessage },
        ],
      });
      reply = fallback.choices[0]?.message?.content ?? "I'm having trouble connecting right now. Please try again in a moment.";
    } catch {
      reply = "I'm having trouble connecting right now. Please try again in a moment.";
    }
  }

  const [assistantMessage] = await db.insert(chatMessagesTable).values({ clerkUserId: userId, role: "assistant", content: reply }).returning();
  res.json(SendChatMessageResponse.parse(serializeRow({ reply, messageId: assistantMessage.id })));
});

export default router;
