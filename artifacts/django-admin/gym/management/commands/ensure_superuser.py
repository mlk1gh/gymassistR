import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Create a Django admin superuser if one does not exist"

    def handle(self, *args, **options):
        User = get_user_model()
        username = os.environ.get("DJANGO_ADMIN_USER", "admin")
        password = os.environ.get("DJANGO_ADMIN_PASSWORD", "gymassist_admin")
        email = os.environ.get("DJANGO_ADMIN_EMAIL", "admin@gymassist.local")

        if not User.objects.filter(username=username).exists():
            User.objects.create_superuser(username=username, email=email, password=password)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Superuser '{username}' created. "
                    f"Login at /django-admin/admin/ with username '{username}'."
                )
            )
        else:
            self.stdout.write(f"Superuser '{username}' already exists.")
