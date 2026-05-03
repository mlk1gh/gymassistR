from django.db import models


class User(models.Model):
    email = models.CharField(max_length=256, unique=True)
    password_hash = models.TextField()
    name = models.CharField(max_length=256, default="")
    is_admin = models.BooleanField(default=False)
    banned = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "users"
        verbose_name = "App User"
        verbose_name_plural = "App Users"

    def __str__(self):
        return f"{self.name} <{self.email}>"


class Exercise(models.Model):
    name = models.TextField()
    description = models.TextField(null=True, blank=True)
    muscle_group = models.TextField()
    difficulty = models.TextField()
    equipment = models.TextField(null=True, blank=True)
    instructions = models.TextField(null=True, blank=True)
    sets = models.IntegerField(null=True, blank=True)
    reps = models.IntegerField(null=True, blank=True)
    duration_seconds = models.IntegerField(null=True, blank=True)
    video_url = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = "exercises"

    def __str__(self):
        return self.name


class Workout(models.Model):
    clerk_user_id = models.CharField(max_length=256, default="")
    name = models.TextField()
    description = models.TextField(null=True, blank=True)
    goal = models.TextField()
    duration_minutes = models.IntegerField()
    difficulty = models.TextField()
    completed = models.BooleanField(default=False)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "workouts"

    def __str__(self):
        return self.name


class WorkoutExercise(models.Model):
    workout = models.ForeignKey(
        Workout, on_delete=models.CASCADE, db_column="workout_id", related_name="workout_exercises"
    )
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, db_column="exercise_id", related_name="workout_exercises"
    )
    order = models.IntegerField(default=0)

    class Meta:
        managed = False
        db_table = "workout_exercises"
        verbose_name = "Workout Exercise"
        verbose_name_plural = "Workout Exercises"
        ordering = ["order"]

    def __str__(self):
        return f"{self.workout} → {self.exercise} (order {self.order})"


class HealthMetric(models.Model):
    clerk_user_id = models.CharField(max_length=256, default="")
    type = models.TextField()
    value = models.FloatField()
    unit = models.TextField()
    notes = models.TextField(null=True, blank=True)
    logged_at = models.DateTimeField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "health_metrics"
        verbose_name = "Health Metric"
        verbose_name_plural = "Health Metrics"

    def __str__(self):
        return f"{self.type}: {self.value} {self.unit} (user {self.clerk_user_id})"


class ChatMessage(models.Model):
    clerk_user_id = models.CharField(max_length=256, default="")
    role = models.TextField()
    content = models.TextField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "chat_messages"
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"

    def __str__(self):
        return f"[{self.role}] {self.content[:60]}"
