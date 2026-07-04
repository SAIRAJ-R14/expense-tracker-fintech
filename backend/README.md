# SmartExpense Django Backend

Django REST Framework backend for the SmartExpense tracker.

## Setup

```powershell
cd outputs/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Create the MySQL database:

```powershell
mysql -u root -p < database_setup.sql
```

Then run:

```powershell
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API root: `http://127.0.0.1:8000/api/`

JWT endpoints:

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/token/refresh/`
- `POST /api/auth/forgot-password/`
- `POST /api/auth/verify-otp/`
- `POST /api/auth/reset-password/`
- `GET/PATCH /api/auth/me/`

Main resources are exposed under `/api/finance/`.
