from datetime import timedelta
import random

from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import LoginHistory, PasswordResetOTP, UserProfile

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "profile_picture", "monthly_salary", "salary_credit_date", "monthly_budget",
            "daily_budget", "savings_goal", "preferred_currency", "default_payment_method",
            "financial_goal", "profile_complete",
        ]
        read_only_fields = ["profile_complete"]

    def validate(self, attrs):
        required = [
            "monthly_salary", "salary_credit_date", "monthly_budget", "daily_budget",
            "savings_goal", "preferred_currency", "default_payment_method", "financial_goal",
        ]
        if self.context.get("setup") and any(attrs.get(field) in [None, ""] for field in required):
            raise serializers.ValidationError("All first-time setup fields are required.")
        return attrs

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        required_values = [
            instance.monthly_salary, instance.salary_credit_date, instance.monthly_budget,
            instance.daily_budget, instance.savings_goal, instance.preferred_currency,
            instance.default_payment_method, instance.financial_goal,
        ]
        instance.profile_complete = all(value not in [None, ""] for value in required_values)
        instance.save(update_fields=["profile_complete"])
        return instance


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "username", "email", "phone_number", "country", "currency", "is_blocked", "is_staff", "profile"]
        read_only_fields = ["id", "is_blocked", "is_staff"]


class RegisterSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["full_name", "username", "email", "phone_number", "country", "currency", "password", "confirm_password"]

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        names = full_name.strip().split(" ", 1)
        user = User(**validated_data, first_name=names[0], last_name=names[1] if len(names) > 1 else "")
        user.set_password(password)
        user.save()
        UserProfile.objects.create(user=user, preferred_currency=user.currency)
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(default=False)

    def validate(self, attrs):
        identifier = attrs["identifier"]
        user = User.objects.filter(email=identifier).first() or User.objects.filter(username=identifier).first()
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        if user.is_blocked:
            raise serializers.ValidationError("This account is blocked.")
        authenticated = authenticate(username=user.username, password=attrs["password"])
        if not authenticated:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = authenticated
        return attrs

    def create_tokens(self):
        user = self.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        if self.validated_data.get("remember_me"):
            refresh.set_exp(lifetime=timedelta(days=30))
        return {"refresh": str(refresh), "access": str(refresh.access_token)}


class ForgotPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField()

    def save(self):
        identifier = self.validated_data["identifier"]
        user = User.objects.filter(email=identifier).first() or User.objects.filter(username=identifier).first()
        if not user:
            raise serializers.ValidationError("No user found.")
        otp = f"{random.randint(100000, 999999)}"
        PasswordResetOTP.objects.create(user=user, otp=otp, expires_at=timezone.now() + timedelta(minutes=10))
        return {"message": "OTP generated.", "demo_otp": otp}


class VerifyOTPSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    otp = serializers.CharField(max_length=6)

    def save(self):
        identifier = self.validated_data["identifier"]
        user = User.objects.filter(email=identifier).first() or User.objects.filter(username=identifier).first()
        record = PasswordResetOTP.objects.filter(user=user, otp=self.validated_data["otp"], expires_at__gte=timezone.now()).last()
        if not record:
            raise serializers.ValidationError("Invalid or expired OTP.")
        record.is_verified = True
        record.save(update_fields=["is_verified"])
        return {"message": "OTP verified."}


class ResetPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    otp = serializers.CharField(max_length=6)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs

    def save(self):
        identifier = self.validated_data["identifier"]
        user = User.objects.filter(email=identifier).first() or User.objects.filter(username=identifier).first()
        record = PasswordResetOTP.objects.filter(user=user, otp=self.validated_data["otp"], is_verified=True, expires_at__gte=timezone.now()).last()
        if not record:
            raise serializers.ValidationError("OTP verification required.")
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        record.delete()
        return {"message": "Password reset successful."}


class LoginHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LoginHistory
        fields = ["id", "ip_address", "user_agent", "logged_in_at"]
