from datetime import date

from rest_framework import serializers

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


class UserOwnedSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())


class PaymentMethodSerializer(UserOwnedSerializer):
    class Meta:
        model = PaymentMethod
        fields = "__all__"


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"


class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategory
        fields = "__all__"


class IncomeSerializer(UserOwnedSerializer):
    class Meta:
        model = Income
        fields = "__all__"

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class ExpenseSerializer(UserOwnedSerializer):
    class Meta:
        model = Expense
        fields = "__all__"

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class BudgetSerializer(UserOwnedSerializer):
    used_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = "__all__"

    def _used(self, obj):
        qs = Expense.objects.filter(user=obj.user)
        if obj.category:
            qs = qs.filter(category=obj.category)
        return sum(item.amount for item in qs)

    def get_used_amount(self, obj):
        return self._used(obj)

    def get_remaining_amount(self, obj):
        return obj.amount - self._used(obj)

    def get_progress_percentage(self, obj):
        return round((self._used(obj) / obj.amount) * 100, 2) if obj.amount else 0


class SavingsGoalSerializer(UserOwnedSerializer):
    progress_percentage = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = SavingsGoal
        fields = "__all__"

    def get_progress_percentage(self, obj):
        return round((obj.current_saved_amount / obj.target_amount) * 100, 2) if obj.target_amount else 0

    def get_remaining_amount(self, obj):
        return obj.target_amount - obj.current_saved_amount

    def get_days_left(self, obj):
        return (obj.deadline - date.today()).days


class RecurringTransactionSerializer(UserOwnedSerializer):
    class Meta:
        model = RecurringTransaction
        fields = "__all__"


class BillSerializer(UserOwnedSerializer):
    days_left = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = "__all__"

    def get_days_left(self, obj):
        return (obj.due_date - date.today()).days


class NotificationSerializer(UserOwnedSerializer):
    class Meta:
        model = Notification
        fields = "__all__"


class ReceiptSerializer(UserOwnedSerializer):
    class Meta:
        model = Receipt
        fields = "__all__"


class ReportSerializer(UserOwnedSerializer):
    class Meta:
        model = Report
        fields = "__all__"


class UserSettingsSerializer(UserOwnedSerializer):
    class Meta:
        model = UserSettings
        fields = "__all__"


class ActivityLogSerializer(UserOwnedSerializer):
    class Meta:
        model = ActivityLog
        fields = "__all__"


class AIInsightSerializer(UserOwnedSerializer):
    class Meta:
        model = AIInsight
        fields = "__all__"
