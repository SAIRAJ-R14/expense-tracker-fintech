from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20)
    country = models.CharField(max_length=80)
    currency = models.CharField(max_length=8, default="INR")
    is_blocked = models.BooleanField(default=False)

    REQUIRED_FIELDS = ["email", "phone_number", "country", "currency"]

    def __str__(self):
        return self.username


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    profile_picture = models.ImageField(upload_to="profiles/", blank=True, null=True)
    monthly_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    salary_credit_date = models.DateField(null=True, blank=True)
    monthly_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    daily_budget = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    savings_goal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    preferred_currency = models.CharField(max_length=8, default="INR")
    default_payment_method = models.CharField(max_length=60, blank=True)
    financial_goal = models.CharField(max_length=255, blank=True)
    profile_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} profile"


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_otps")
    otp = models.CharField(max_length=6)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"OTP for {self.user.username}"


class LoginHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_history")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    logged_in_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-logged_in_at"]


class AdminProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_profile")
    role = models.CharField(max_length=80, default="Admin")
    can_export_reports = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
