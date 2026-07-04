from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminUserViewSet,
    ForgotPasswordView,
    LoginHistoryView,
    LoginView,
    MeView,
    ProfileSetupView,
    RegisterView,
    ResetPasswordView,
    VerifyOTPView,
)

router = DefaultRouter()
router.register("admin/users", AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify_otp"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("me/", MeView.as_view(), name="me"),
    path("profile/setup/", ProfileSetupView.as_view(), name="profile_setup"),
    path("login-history/", LoginHistoryView.as_view(), name="login_history"),
    path("", include(router.urls)),
]
