from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AdminProfile, LoginHistory, PasswordResetOTP, User, UserProfile


@admin.register(User)
class SmartExpenseUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("SmartExpense", {"fields": ("phone_number", "country", "currency", "is_blocked")}),)
    list_display = ("username", "email", "phone_number", "country", "currency", "is_blocked", "is_staff")
    search_fields = ("username", "email", "phone_number")


admin.site.register(UserProfile)
admin.site.register(PasswordResetOTP)
admin.site.register(LoginHistory)
admin.site.register(AdminProfile)
