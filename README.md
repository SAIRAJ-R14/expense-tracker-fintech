# SmartExpense Tracker

Full-stack SmartExpense tracker with:

- React.js, HTML5, CSS3, Bootstrap 5, JavaScript, Chart.js, Axios-ready frontend
- Django REST Framework backend
- JWT authentication
- MySQL database setup script
- User registration, login, forgot password, OTP, profile setup, dashboard, income, expenses, budgets, goals, bills, receipts, reports, analytics, AI-style insights, notifications, settings, and admin APIs

## Project Structure

```text
.
├── index.html
├── styles.css
├── app.js
└── backend
    ├── manage.py
    ├── requirements.txt
    ├── database_setup.sql
    ├── smartexpense
    ├── accounts
    └── finance
```

## Frontend

Open directly:

```text
index.html
```

Or serve locally:

```powershell
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Create the MySQL database:

```powershell
mysql -u root -p < database_setup.sql
```

Run Django:

```powershell
python manage.py makemigrations
python manage.py migrate
python manage.py seed_categories
python manage.py createsuperuser
python manage.py runserver
```

API base URL:

```text
http://127.0.0.1:8000/api/
```

## Important

Do not commit `.env`. Use `.env.example` as the template.
