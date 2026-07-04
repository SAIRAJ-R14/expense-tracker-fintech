from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AIInsightViewSet,
    ActivityLogViewSet,
    BillViewSet,
    BudgetViewSet,
    CategoryViewSet,
    ExpenseViewSet,
    IncomeViewSet,
    NotificationViewSet,
    PaymentMethodViewSet,
    ReceiptViewSet,
    RecurringTransactionViewSet,
    ReportViewSet,
    SavingsGoalViewSet,
    SubCategoryViewSet,
    UserSettingsViewSet,
    admin_summary,
    dashboard_summary,
    global_search,
)

router = DefaultRouter()
router.register("payment-methods", PaymentMethodViewSet, basename="payment-methods")
router.register("categories", CategoryViewSet, basename="categories")
router.register("sub-categories", SubCategoryViewSet, basename="sub-categories")
router.register("income", IncomeViewSet, basename="income")
router.register("expenses", ExpenseViewSet, basename="expenses")
router.register("budgets", BudgetViewSet, basename="budgets")
router.register("savings-goals", SavingsGoalViewSet, basename="savings-goals")
router.register("recurring-transactions", RecurringTransactionViewSet, basename="recurring-transactions")
router.register("bills", BillViewSet, basename="bills")
router.register("notifications", NotificationViewSet, basename="notifications")
router.register("receipts", ReceiptViewSet, basename="receipts")
router.register("reports", ReportViewSet, basename="reports")
router.register("settings", UserSettingsViewSet, basename="settings")
router.register("activity-logs", ActivityLogViewSet, basename="activity-logs")
router.register("ai-insights", AIInsightViewSet, basename="ai-insights")

urlpatterns = [
    path("dashboard/", dashboard_summary, name="dashboard-summary"),
    path("admin-summary/", admin_summary, name="admin-summary"),
    path("search/", global_search, name="global-search"),
    *router.urls,
]
