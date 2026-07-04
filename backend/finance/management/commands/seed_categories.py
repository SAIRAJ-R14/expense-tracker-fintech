from django.core.management.base import BaseCommand

from finance.models import Category


class Command(BaseCommand):
    help = "Create default SmartExpense categories."

    def handle(self, *args, **options):
        names = [
            "Food", "Grocery", "Rent", "Shopping", "Fuel", "Transport",
            "Entertainment", "Healthcare", "Education", "Investment", "EMI",
            "Insurance", "Travel", "Others",
        ]
        for name in names:
            Category.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS("Default categories are ready."))
