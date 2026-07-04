from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import (
    AIInsight,
    ActivityLog,
    Bill,
    Budget,
    Category,
    Expense,
    Income,
    Notification,
    PaymentMethod,
    Receipt,
    RecurringTransaction,
    Report,
    SavingsGoal,
    SubCategory,
    UserSettings,
)
from .serializers import (
    AIInsightSerializer,
    ActivityLogSerializer,
    BillSerializer,
    BudgetSerializer,
    CategorySerializer,
    ExpenseSerializer,
    IncomeSerializer,
    NotificationSerializer,
    PaymentMethodSerializer,
    ReceiptSerializer,
    RecurringTransactionSerializer,
    ReportSerializer,
    SavingsGoalSerializer,
    SubCategorySerializer,
    UserSettingsSerializer,
)

User = get_user_model()


class OwnerScopedViewSet(viewsets.ModelViewSet):
    search_fields = ["id"]
    ordering_fields = ["created_at", "updated_at"]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        ActivityLog.objects.create(user=self.request.user, action=f"created_{instance.__class__.__name__.lower()}", metadata={"id": instance.id})

    def perform_update(self, serializer):
        instance = serializer.save()
        ActivityLog.objects.create(user=self.request.user, action=f"updated_{instance.__class__.__name__.lower()}", metadata={"id": instance.id})

    def perform_destroy(self, instance):
        ActivityLog.objects.create(user=self.request.user, action=f"deleted_{instance.__class__.__name__.lower()}", metadata={"id": instance.id})
        instance.delete()


class PaymentMethodViewSet(OwnerScopedViewSet):
    queryset = PaymentMethod.objects.all()
    serializer_class = PaymentMethodSerializer
    search_fields = ["name"]


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAdminUser()]
        return super().get_permissions()


class SubCategoryViewSet(viewsets.ModelViewSet):
    queryset = SubCategory.objects.select_related("category").all()
    serializer_class = SubCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    search_fields = ["name", "category__name"]

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAdminUser()]
        return super().get_permissions()


class IncomeViewSet(OwnerScopedViewSet):
    queryset = Income.objects.all()
    serializer_class = IncomeSerializer
    search_fields = ["income_source", "description", "amount", "date"]
    ordering_fields = ["date", "amount", "created_at"]


class ExpenseViewSet(OwnerScopedViewSet):
    queryset = Expense.objects.select_related("category", "sub_category", "payment_method").all()
    serializer_class = ExpenseSerializer
    search_fields = ["merchant_name", "notes", "amount", "date", "category__name", "sub_category__name"]
    ordering_fields = ["date", "amount", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        month = self.request.query_params.get("month")
        amount = self.request.query_params.get("amount")
        if category:
            qs = qs.filter(category__name=category)
        if month:
            qs = qs.filter(date__startswith=month)
        if amount:
            qs = qs.filter(amount__lte=amount)
        return qs


class BudgetViewSet(OwnerScopedViewSet):
    queryset = Budget.objects.select_related("category").all()
    serializer_class = BudgetSerializer


class SavingsGoalViewSet(OwnerScopedViewSet):
    queryset = SavingsGoal.objects.all()
    serializer_class = SavingsGoalSerializer
    search_fields = ["goal_name", "priority"]


class RecurringTransactionViewSet(OwnerScopedViewSet):
    queryset = RecurringTransaction.objects.all()
    serializer_class = RecurringTransactionSerializer
    search_fields = ["name", "frequency", "transaction_type"]


class BillViewSet(OwnerScopedViewSet):
    queryset = Bill.objects.all()
    serializer_class = BillSerializer
    search_fields = ["bill_name", "amount", "due_date"]


class NotificationViewSet(OwnerScopedViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer


class ReceiptViewSet(OwnerScopedViewSet):
    queryset = Receipt.objects.select_related("expense").all()
    serializer_class = ReceiptSerializer


class ReportViewSet(OwnerScopedViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer


class UserSettingsViewSet(OwnerScopedViewSet):
    queryset = UserSettings.objects.all()
    serializer_class = UserSettingsSerializer


class ActivityLogViewSet(OwnerScopedViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer


class AIInsightViewSet(OwnerScopedViewSet):
    queryset = AIInsight.objects.all()
    serializer_class = AIInsightSerializer


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def dashboard_summary(request):
    user = request.user
    total_income = Income.objects.filter(user=user).aggregate(total=Sum("amount"))["total"] or 0
    total_expenses = Expense.objects.filter(user=user).aggregate(total=Sum("amount"))["total"] or 0
    savings = SavingsGoal.objects.filter(user=user).aggregate(total=Sum("current_saved_amount"))["total"] or 0
    profile = user.profile
    current_balance = (profile.monthly_salary or 0) + total_income - total_expenses
    upcoming_bills = BillSerializer(Bill.objects.filter(user=user, due_date__gte=timezone.localdate()).order_by("due_date")[:5], many=True).data
    recent_expenses = ExpenseSerializer(Expense.objects.filter(user=user).order_by("-date", "-time")[:5], many=True).data
    recent_income = IncomeSerializer(Income.objects.filter(user=user).order_by("-date")[:5], many=True).data
    budget_progress = round((total_expenses / profile.monthly_budget) * 100, 2) if profile.monthly_budget else 0
    health_score = max(0, min(100, 90 - int(budget_progress / 2) + (10 if savings else 0)))
    return Response({
        "welcome_user": user.get_full_name() or user.username,
        "today": timezone.localdate(),
        "current_balance": current_balance,
        "monthly_salary": profile.monthly_salary,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "remaining_balance": current_balance,
        "savings": savings,
        "budget_progress": budget_progress,
        "financial_health_score": health_score,
        "recent_transactions": {"income": recent_income, "expenses": recent_expenses},
        "upcoming_bills": upcoming_bills,
    })


@api_view(["GET"])
@permission_classes([permissions.IsAdminUser])
def admin_summary(request):
    return Response({
        "total_users": User.objects.count(),
        "total_income_records": Income.objects.count(),
        "total_expense_records": Expense.objects.count(),
        "total_transactions": Income.objects.count() + Expense.objects.count(),
        "total_budgets": Budget.objects.count(),
        "total_savings_goals": SavingsGoal.objects.count(),
        "active_users": User.objects.filter(is_active=True, is_blocked=False).count(),
        "daily_activity": ActivityLog.objects.filter(created_at__date=timezone.localdate()).count(),
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def global_search(request):
    query = request.query_params.get("q", "")
    if not query:
        return Response({"income": [], "expenses": []})
    income = Income.objects.filter(user=request.user, income_source__icontains=query)[:10]
    expenses = Expense.objects.filter(user=request.user, merchant_name__icontains=query)[:10]
    return Response({
        "income": IncomeSerializer(income, many=True).data,
        "expenses": ExpenseSerializer(expenses, many=True).data,
    })
