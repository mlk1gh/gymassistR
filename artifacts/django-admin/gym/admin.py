from django.contrib import admin
from django.utils.html import format_html
from .models import User, Exercise, Workout, WorkoutExercise, HealthMetric, ChatMessage


class WorkoutExerciseInline(admin.TabularInline):
    model = WorkoutExercise
    extra = 0
    fields = ("exercise", "order")
    ordering = ("order",)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "is_admin", "banned", "created_at", "last_login_at")
    list_filter = ("is_admin", "banned")
    search_fields = ("email", "name")
    readonly_fields = ("created_at", "last_login_at", "password_hash")
    fieldsets = (
        ("Identity", {"fields": ("email", "name")}),
        ("Permissions", {"fields": ("is_admin", "banned")}),
        ("Security", {"fields": ("password_hash",), "classes": ("collapse",)}),
        ("Timestamps", {"fields": ("created_at", "last_login_at"), "classes": ("collapse",)}),
    )
    ordering = ("-created_at",)


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("name", "muscle_group", "difficulty", "equipment", "has_video", "created_at")
    list_filter = ("muscle_group", "difficulty")
    search_fields = ("name", "muscle_group", "equipment")
    readonly_fields = ("created_at", "updated_at", "video_preview")
    fieldsets = (
        ("Basic Info", {"fields": ("name", "description", "muscle_group", "difficulty", "equipment")}),
        ("Instructions", {"fields": ("instructions",)}),
        ("Volume", {"fields": ("sets", "reps", "duration_seconds")}),
        ("Video", {"fields": ("video_url", "video_preview")}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )
    ordering = ("name",)

    def has_video(self, obj):
        return bool(obj.video_url)
    has_video.boolean = True
    has_video.short_description = "Video"

    def video_preview(self, obj):
        if obj.video_url:
            return format_html(
                '<a href="{}" target="_blank" rel="noopener">▶ Watch on YouTube</a>',
                obj.video_url,
            )
        return "—"
    video_preview.short_description = "Preview"


@admin.register(Workout)
class WorkoutAdmin(admin.ModelAdmin):
    list_display = ("name", "clerk_user_id", "goal", "difficulty", "duration_minutes", "completed", "scheduled_at")
    list_filter = ("difficulty", "completed", "goal")
    search_fields = ("name", "clerk_user_id", "goal")
    readonly_fields = ("created_at", "updated_at")
    inlines = [WorkoutExerciseInline]
    fieldsets = (
        ("Workout", {"fields": ("name", "description", "goal", "difficulty", "duration_minutes")}),
        ("Status", {"fields": ("completed", "scheduled_at")}),
        ("User", {"fields": ("clerk_user_id",)}),
        ("Timestamps", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )
    ordering = ("-created_at",)


@admin.register(WorkoutExercise)
class WorkoutExerciseAdmin(admin.ModelAdmin):
    list_display = ("workout", "exercise", "order")
    list_filter = ("workout",)
    search_fields = ("workout__name", "exercise__name")
    ordering = ("workout", "order")


@admin.register(HealthMetric)
class HealthMetricAdmin(admin.ModelAdmin):
    list_display = ("type", "value", "unit", "clerk_user_id", "logged_at")
    list_filter = ("type", "unit")
    search_fields = ("clerk_user_id", "type", "notes")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-logged_at",)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("role", "short_content", "clerk_user_id", "created_at")
    list_filter = ("role",)
    search_fields = ("clerk_user_id", "content")
    readonly_fields = ("created_at",)
    ordering = ("-created_at",)

    def short_content(self, obj):
        return obj.content[:80] + ("…" if len(obj.content) > 80 else "")
    short_content.short_description = "Content"
