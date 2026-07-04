from django.contrib import admin

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

admin.site.register(PaymentMethod)
admin.site.register(Category)
admin.site.register(SubCategory)
admin.site.register(Income)
admin.site.register(Expense)
admin.site.register(Budget)
admin.site.register(SavingsGoal)
admin.site.register(RecurringTransaction)
admin.site.register(Bill)
admin.site.register(Notification)
admin.site.register(Receipt)
admin.site.register(Report)
admin.site.register(UserSettings)
admin.site.register(ActivityLog)
admin.site.register(AIInsight)
