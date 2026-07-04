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
    payment_method_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Income
        fields = "__all__"

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def create(self, validated_data):
        name = validated_data.pop("payment_method_name", "")
        if name and not validated_data.get("payment_method"):
            method, _ = PaymentMethod.objects.get_or_create(user=validated_data["user"], name=name)
            validated_data["payment_method"] = method
        return super().create(validated_data)

    def update(self, instance, validated_data):
        name = validated_data.pop("payment_method_name", "")
        if name:
            method, _ = PaymentMethod.objects.get_or_create(user=instance.user, name=name)
            validated_data["payment_method"] = method
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["payment_method_name"] = instance.payment_method.name if instance.payment_method else ""
        return data


class ExpenseSerializer(UserOwnedSerializer):
    category_name = serializers.CharField(write_only=True, required=False)
    sub_category_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    payment_method_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Expense
        fields = "__all__"

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def _resolve_names(self, validated_data, instance=None):
        category_name = validated_data.pop("category_name", "")
        sub_category_name = validated_data.pop("sub_category_name", "")
        payment_name = validated_data.pop("payment_method_name", "")
        user = validated_data.get("user") or instance.user
        if category_name and not validated_data.get("category"):
            category, _ = Category.objects.get_or_create(name=category_name)
            validated_data["category"] = category
        if sub_category_name and validated_data.get("category") and not validated_data.get("sub_category"):
            sub_category, _ = SubCategory.objects.get_or_create(category=validated_data["category"], name=sub_category_name)
            validated_data["sub_category"] = sub_category
        if payment_name and not validated_data.get("payment_method"):
            method, _ = PaymentMethod.objects.get_or_create(user=user, name=payment_name)
            validated_data["payment_method"] = method
        return validated_data

    def create(self, validated_data):
        return super().create(self._resolve_names(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._resolve_names(validated_data, instance))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["category_name"] = instance.category.name if instance.category else ""
        data["sub_category_name"] = instance.sub_category.name if instance.sub_category else ""
        data["payment_method_name"] = instance.payment_method.name if instance.payment_method else ""
        return data


class BudgetSerializer(UserOwnedSerializer):
    category_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    used_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = "__all__"

    def create(self, validated_data):
        category_name = validated_data.pop("category_name", "")
        if category_name and category_name != "All" and not validated_data.get("category"):
            category, _ = Category.objects.get_or_create(name=category_name)
            validated_data["category"] = category
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["category_name"] = instance.category.name if instance.category else "All"
        return data

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
