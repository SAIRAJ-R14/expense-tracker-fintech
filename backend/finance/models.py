from django.conf import settings
from django.db import models


class OwnedModel(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PaymentMethod(OwnedModel):
    name = models.CharField(max_length=80)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=80, unique=True)
    icon = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class SubCategory(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="sub_categories")
    name = models.CharField(max_length=80)

    class Meta:
        unique_together = ("category", "name")

    def __str__(self):
        return f"{self.category.name} - {self.name}"


class Income(OwnedModel):
    income_source = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    attachment = models.FileField(upload_to="income/", blank=True, null=True)

    class Meta:
        ordering = ["-date", "-created_at"]


class Expense(OwnedModel):
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    sub_category = models.ForeignKey(SubCategory, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    time = models.TimeField()
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True)
    merchant_name = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    receipt = models.FileField(upload_to="receipts/", blank=True, null=True)
    location = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-date", "-time", "-created_at"]


class Budget(OwnedModel):
    PERIODS = [("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("category", "Category")]
    period = models.CharField(max_length=20, choices=PERIODS)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)


class SavingsGoal(OwnedModel):
    PRIORITIES = [("low", "Low"), ("medium", "Medium"), ("high", "High")]
    goal_name = models.CharField(max_length=120)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_saved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deadline = models.DateField()
    priority = models.CharField(max_length=20, choices=PRIORITIES, default="medium")


class RecurringTransaction(OwnedModel):
    FREQUENCIES = [("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("yearly", "Yearly")]
    TYPES = [("income", "Income"), ("expense", "Expense")]
    name = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TYPES)
    frequency = models.CharField(max_length=20, choices=FREQUENCIES)
    next_run_date = models.DateField()
    is_active = models.BooleanField(default=True)


class Bill(OwnedModel):
    bill_name = models.CharField(max_length=120)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    reminder_days_before_due_date = models.PositiveIntegerField(default=3)
    is_paid = models.BooleanField(default=False)


class Notification(OwnedModel):
    TYPES = [
        ("salary_added", "Salary Added"), ("budget_crossed", "Budget Crossed"),
        ("bill_reminder", "Bill Reminder"), ("goal_completed", "Goal Completed"),
        ("large_expense", "Large Expense Alert"), ("monthly_summary", "Monthly Summary"),
        ("weekly_summary", "Weekly Summary"),
    ]
    notification_type = models.CharField(max_length=40, choices=TYPES)
    title = models.CharField(max_length=160)
    message = models.TextField()
    is_read = models.BooleanField(default=False)


class Receipt(OwnedModel):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="receipts")
    file = models.FileField(upload_to="receipts/")
    file_type = models.CharField(max_length=20, blank=True)


class Report(OwnedModel):
    REPORT_TYPES = [
        ("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("yearly", "Yearly"),
        ("income", "Income"), ("expense", "Expense"), ("budget", "Budget"),
        ("savings", "Savings"), ("cash_flow", "Cash Flow"),
    ]
    report_type = models.CharField(max_length=40, choices=REPORT_TYPES)
    start_date = models.DateField()
    end_date = models.DateField()
    payload = models.JSONField(default=dict)


class UserSettings(OwnedModel):
    theme = models.CharField(max_length=20, default="light")
    language = models.CharField(max_length=40, default="English")
    currency = models.CharField(max_length=8, default="INR")
    time_zone = models.CharField(max_length=80, default="Asia/Kolkata")
    notification_settings = models.JSONField(default=dict)


class ActivityLog(OwnedModel):
    action = models.CharField(max_length=120)
    metadata = models.JSONField(default=dict)

    class Meta:
        ordering = ["-created_at"]


class AIInsight(OwnedModel):
    insight_type = models.CharField(max_length=80)
    title = models.CharField(max_length=160)
    insight = models.TextField()
    source_snapshot = models.JSONField(default=dict)
