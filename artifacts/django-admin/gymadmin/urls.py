from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView

admin.site.site_header = "GymAssist Admin"
admin.site.site_title = "GymAssist Admin"
admin.site.index_title = "Database Management"

urlpatterns = [
    path("", RedirectView.as_view(url="/django-admin/admin/", permanent=False)),
    path("django-admin/", admin.site.urls),
]
