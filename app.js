const { useEffect, useMemo, useRef, useState } = React;

const STORE_KEY = "smartExpenseState.v1";
const API_BASE = "http://127.0.0.1:8000/api";
const categories = ["Food", "Grocery", "Rent", "Shopping", "Fuel", "Transport", "Entertainment", "Healthcare", "Education", "Investment", "EMI", "Insurance", "Travel", "Others"];
const paymentMethods = ["Cash", "Debit Card", "Credit Card", "UPI", "Bank Transfer", "Wallet"];
const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];
const emptyState = {
  users: [],
  session: null,
  adminSession: false,
  theme: "light",
  incomes: [],
  expenses: [],
  budgets: [],
  goals: [],
  recurring: [],
  bills: [],
  receipts: [],
  notifications: [],
  settings: { language: "English", timezone: "Asia/Calcutta", notifications: true },
  loginHistory: []
};

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readState() {
  try {
    return { ...emptyState, ...JSON.parse(localStorage.getItem(STORE_KEY)) };
  } catch {
    return emptyState;
  }
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

async function apiRequest(path, options = {}, token) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

function apiUserToLocal(user) {
  const profile = user.profile || {};
  return {
    id: user.id,
    fullName: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username,
    username: user.username,
    email: user.email,
    phone: user.phone_number,
    country: user.country,
    currency: user.currency || profile.preferred_currency || "INR",
    monthlySalary: profile.monthly_salary || "",
    salaryDate: profile.salary_credit_date || todayISO(),
    monthlyBudget: profile.monthly_budget || "",
    dailyBudget: profile.daily_budget || "",
    savingsGoal: profile.savings_goal || "",
    preferredCurrency: profile.preferred_currency || user.currency || "INR",
    defaultPayment: profile.default_payment_method || "UPI",
    financialGoal: profile.financial_goal || "",
    profileComplete: Boolean(profile.profile_complete),
    blocked: user.is_blocked
  };
}

function incomeFromApi(item) {
  return {
    id: item.id,
    userId: item.user,
    source: item.income_source,
    amount: Number(item.amount),
    date: item.date,
    payment: item.payment_method_name || "",
    description: item.description || "",
    attachment: item.attachment || ""
  };
}

function expenseFromApi(item) {
  return {
    id: item.id,
    userId: item.user,
    amount: Number(item.amount),
    category: item.category_name || item.category || "Others",
    subCategory: item.sub_category_name || "",
    date: item.date,
    time: item.time,
    payment: item.payment_method_name || "",
    merchant: item.merchant_name || "",
    notes: item.notes || "",
    receipt: item.receipt || "",
    location: item.location || ""
  };
}

function budgetFromApi(item) {
  return { id: item.id, userId: item.user, type: item.period, category: item.category_name || "All", amount: Number(item.amount) };
}

function goalFromApi(item) {
  return { id: item.id, userId: item.user, name: item.goal_name, target: Number(item.target_amount), current: Number(item.current_saved_amount), deadline: item.deadline, priority: item.priority };
}

function billFromApi(item) {
  return { id: item.id, userId: item.user, name: item.bill_name, amount: Number(item.amount), dueDate: item.due_date, remindBefore: item.reminder_days_before_due_date };
}

function hashPassword(value) {
  return btoa(unescape(encodeURIComponent(value))).split("").reverse().join("");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function pct(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function App() {
  const [state, setState] = useState(readState);
  const [authMode, setAuthMode] = useState("login");
  const [active, setActive] = useState("dashboard");
  const [toast, setToast] = useState([]);
  const currentUser = state.users.find((user) => user.id === state.session?.userId);
  const needsSetup = currentUser && !currentUser.profileComplete;

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme || "light";
  }, [state.theme]);

  const patchState = (patcher) => setState((prev) => typeof patcher === "function" ? patcher(prev) : { ...prev, ...patcher });
  const loadBackendData = async (token, userId) => {
    const [income, expenses, budgets, goals, bills, notifications] = await Promise.all([
      apiRequest("/finance/income/", {}, token),
      apiRequest("/finance/expenses/", {}, token),
      apiRequest("/finance/budgets/", {}, token),
      apiRequest("/finance/savings-goals/", {}, token),
      apiRequest("/finance/bills/", {}, token),
      apiRequest("/finance/notifications/", {}, token)
    ]);
    patchState((prev) => ({
      ...prev,
      incomes: [...prev.incomes.filter((item) => item.userId !== userId), ...income.map(incomeFromApi)],
      expenses: [...prev.expenses.filter((item) => item.userId !== userId), ...expenses.map(expenseFromApi)],
      budgets: [...prev.budgets.filter((item) => item.userId !== userId), ...budgets.map(budgetFromApi)],
      goals: [...prev.goals.filter((item) => item.userId !== userId), ...goals.map(goalFromApi)],
      bills: [...prev.bills.filter((item) => item.userId !== userId), ...bills.map(billFromApi)],
      notifications: [...notifications.map((item) => ({ id: item.id, userId: item.user, title: item.title, message: item.message, date: item.created_at, read: item.is_read })), ...prev.notifications.filter((item) => item.userId !== userId)]
    }));
  };
  const backend = {
    register: (payload) => apiRequest("/auth/register/", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload) => apiRequest("/auth/login/", { method: "POST", body: JSON.stringify(payload) }),
    forgot: (payload) => apiRequest("/auth/forgot-password/", { method: "POST", body: JSON.stringify(payload) }),
    verifyOtp: (payload) => apiRequest("/auth/verify-otp/", { method: "POST", body: JSON.stringify(payload) }),
    resetPassword: (payload) => apiRequest("/auth/reset-password/", { method: "POST", body: JSON.stringify(payload) }),
    setupProfile: (payload) => apiRequest("/auth/profile/setup/", { method: "PATCH", body: JSON.stringify(payload) }, state.session?.token),
    create: (path, payload) => apiRequest(path, { method: "POST", body: JSON.stringify(payload) }, state.session?.token),
    update: (path, id, payload) => apiRequest(`${path}${id}/`, { method: "PATCH", body: JSON.stringify(payload) }, state.session?.token),
    remove: (path, id) => apiRequest(`${path}${id}/`, { method: "DELETE" }, state.session?.token),
    loadBackendData
  };
  const notify = (message, type = "Info") => {
    const item = { id: uid("toast"), message, type };
    setToast((items) => [...items, item]);
    patchState((prev) => ({ ...prev, notifications: [{ id: uid("note"), title: type, message, date: new Date().toLocaleString(), read: false, userId: prev.session?.userId }, ...prev.notifications] }));
    setTimeout(() => setToast((items) => items.filter((entry) => entry.id !== item.id)), 3200);
  };

  const logout = () => {
    patchState({ session: null, adminSession: false });
    setActive("dashboard");
    notify("Logged out securely", "Session");
  };

  return (
    <>
      {!currentUser && !state.adminSession ? (
        <AuthPage state={state} patchState={patchState} authMode={authMode} setAuthMode={setAuthMode} notify={notify} backend={backend} />
      ) : needsSetup ? (
        <SetupPage user={currentUser} patchState={patchState} notify={notify} logout={logout} backend={backend} />
      ) : (
        <Workspace state={state} patchState={patchState} user={currentUser} active={active} setActive={setActive} logout={logout} notify={notify} backend={backend} />
      )}
      <div className="toast-stack">{toast.map((item) => <div className="app-toast" key={item.id}><strong>{item.type}</strong><div>{item.message}</div></div>)}</div>
    </>
  );
}

function AuthPage({ state, patchState, authMode, setAuthMode, notify, backend }) {
  const [login, setLogin] = useState({ identifier: "", password: "", remember: true, otp: "" });
  const [register, setRegister] = useState({ fullName: "", username: "", email: "", phone: "", country: "", currency: "INR", password: "", confirm: "" });
  const [reset, setReset] = useState({ identifier: "", otpSent: false, otp: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});

  const validateRegister = () => {
    const next = {};
    Object.entries(register).forEach(([key, value]) => { if (!value) next[key] = "Required"; });
    if (register.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(register.email)) next.email = "Enter a valid email";
    if (register.phone && register.phone.replace(/\D/g, "").length < 8) next.phone = "Enter a valid phone number";
    if (register.password && register.password.length < 8) next.password = "Use at least 8 characters";
    if (register.password !== register.confirm) next.confirm = "Passwords must match";
    if (state.users.some((user) => user.email === register.email || user.username === register.username)) next.email = "Email or username already exists";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    if (!validateRegister()) return;
    const user = {
      id: uid("user"),
      fullName: register.fullName,
      username: register.username,
      email: register.email,
      phone: register.phone,
      country: register.country,
      currency: register.currency,
      passwordHash: hashPassword(register.password),
      profileComplete: false,
      blocked: false,
      createdAt: new Date().toISOString()
    };
    try {
      await backend.register({
        full_name: register.fullName,
        username: register.username,
        email: register.email,
        phone_number: register.phone,
        country: register.country,
        currency: register.currency,
        password: register.password,
        confirm_password: register.confirm
      });
    } catch (error) {
      notify("Backend offline: account saved locally for frontend testing", "API Fallback");
    }
    patchState((prev) => prev.users.some((entry) => entry.email === user.email) ? prev : { ...prev, users: [...prev.users, user] });
    setAuthMode("login");
    notify("Account created. Please sign in.", "Registration");
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    const user = state.users.find((entry) => (entry.email === login.identifier || entry.username === login.identifier) && entry.passwordHash === hashPassword(login.password));
    if (login.identifier === "admin" && login.password === "Admin@123") {
      patchState({ adminSession: true });
      notify("Admin login successful", "Admin");
      return;
    }
    try {
      const data = await backend.login({ identifier: login.identifier, password: login.password, remember_me: login.remember });
      const apiUser = apiUserToLocal(data.user);
      patchState((prev) => ({
        ...prev,
        users: prev.users.some((entry) => entry.id === apiUser.id) ? prev.users.map((entry) => entry.id === apiUser.id ? apiUser : entry) : [...prev.users, apiUser],
        session: { userId: apiUser.id, token: data.tokens.access, refresh: data.tokens.refresh, remember: login.remember, startedAt: new Date().toISOString() },
        loginHistory: [{ id: uid("login"), userId: apiUser.id, date: new Date().toLocaleString(), device: navigator.userAgent.slice(0, 70) }, ...prev.loginHistory]
      }));
      await backend.loadBackendData(data.tokens.access, apiUser.id);
      notify("JWT session started from Django API", "Login");
      return;
    } catch (error) {
      notify("Backend login unavailable, trying local session", "API Fallback");
      if (!user || user.blocked) {
        setErrors({ login: "Invalid credentials or blocked user" });
        return;
      }
    }
    const token = `jwt.${btoa(user.id)}.${Date.now()}`;
    patchState((prev) => ({
      ...prev,
      session: { userId: user.id, token, remember: login.remember, startedAt: new Date().toISOString() },
      loginHistory: [{ id: uid("login"), userId: user.id, date: new Date().toLocaleString(), device: navigator.userAgent.slice(0, 70) }, ...prev.loginHistory]
    }));
    notify("JWT session started", "Login");
  };

  const submitReset = async (event) => {
    event.preventDefault();
    if (!reset.otpSent) {
      try {
        const result = await backend.forgot({ identifier: reset.identifier });
        setReset({ ...reset, otpSent: true, otp: result.demo_otp || "" });
        notify(`OTP generated${result.demo_otp ? `: ${result.demo_otp}` : ""}`, "OTP Verification");
        return;
      } catch (error) {
        notify("Backend OTP unavailable, using demo OTP", "API Fallback");
      }
      setReset({ ...reset, otpSent: true, otp: "123456" });
      notify("Demo OTP generated: 123456", "OTP Verification");
      return;
    }
    if (reset.otp !== "123456" || reset.password.length < 8 || reset.password !== reset.confirm) {
      try {
        await backend.verifyOtp({ identifier: reset.identifier, otp: reset.otp });
        await backend.resetPassword({ identifier: reset.identifier, otp: reset.otp, password: reset.password, confirm_password: reset.confirm });
        setAuthMode("login");
        notify("Password reset complete", "Security");
        return;
      } catch (error) {
        setErrors({ reset: "Check OTP and password confirmation" });
        return;
      }
    }
    patchState((prev) => ({
      ...prev,
      users: prev.users.map((user) => user.email === reset.identifier || user.username === reset.identifier ? { ...user, passwordHash: hashPassword(reset.password) } : user)
    }));
    setAuthMode("login");
    notify("Password reset complete", "Security");
  };

  return (
    <main className="auth-page fade-in">
      <section className="auth-visual">
        <div className="brand-mark"><i className="fa-solid fa-wallet"></i><span>SmartExpense</span></div>
        <div className="hero-copy">
          <h1>Personal finance starts after sign in.</h1>
          <p>A professional tracker for income, expenses, budgets, goals, recurring bills, reports, notifications, analytics, and AI-style insights based only on your entered data.</p>
        </div>
        <div className="insight-strip">
          <div className="mini-stat"><strong>JWT</strong><span>Authentication ready</span></div>
          <div className="mini-stat"><strong>18+</strong><span>API data tables mapped</span></div>
          <div className="mini-stat"><strong>0</strong><span>Sample income records</span></div>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-tabs">
          {["login", "register", "forgot"].map((mode) => <button className={authMode === mode ? "active" : ""} onClick={() => { setAuthMode(mode); setErrors({}); }} key={mode}>{mode === "register" ? "Create Account" : mode === "forgot" ? "Forgot Password" : "Login"}</button>)}
        </div>
        {authMode === "login" && (
          <form onSubmit={submitLogin}>
            <h2 className="h4 fw-bold mb-3">Secure Login</h2>
            {errors.login && <div className="alert alert-danger py-2">{errors.login}</div>}
            <Field label="Email or Username" value={login.identifier} onChange={(value) => setLogin({ ...login, identifier: value })} required />
            <Field label="Password" type="password" value={login.password} onChange={(value) => setLogin({ ...login, password: value })} required />
            <label className="form-check mb-3"><input className="form-check-input" type="checkbox" checked={login.remember} onChange={(event) => setLogin({ ...login, remember: event.target.checked })} /> <span className="form-check-label">Remember Me</span></label>
            <button className="btn btn-primary w-100" type="submit"><i className="fa-solid fa-right-to-bracket me-2"></i>Login</button>
            <button className="btn btn-link w-100 mt-2" type="button" onClick={() => setAuthMode("forgot")}>Forgot Password</button>
          </form>
        )}
        {authMode === "register" && (
          <form onSubmit={submitRegister}>
            <h2 className="h4 fw-bold mb-3">Create Account</h2>
            <div className="row g-3">
              <div className="col-md-6"><Field label="Full Name" value={register.fullName} error={errors.fullName} onChange={(value) => setRegister({ ...register, fullName: value })} required /></div>
              <div className="col-md-6"><Field label="Username" value={register.username} error={errors.username} onChange={(value) => setRegister({ ...register, username: value })} required /></div>
              <div className="col-md-6"><Field label="Email" type="email" value={register.email} error={errors.email} onChange={(value) => setRegister({ ...register, email: value })} required /></div>
              <div className="col-md-6"><Field label="Phone Number" value={register.phone} error={errors.phone} onChange={(value) => setRegister({ ...register, phone: value })} required /></div>
              <div className="col-md-6"><Field label="Country" value={register.country} error={errors.country} onChange={(value) => setRegister({ ...register, country: value })} required /></div>
              <div className="col-md-6"><Select label="Currency" value={register.currency} options={currencies} onChange={(value) => setRegister({ ...register, currency: value })} /></div>
              <div className="col-md-6"><Field label="Password" type="password" value={register.password} error={errors.password} onChange={(value) => setRegister({ ...register, password: value })} required /></div>
              <div className="col-md-6"><Field label="Confirm Password" type="password" value={register.confirm} error={errors.confirm} onChange={(value) => setRegister({ ...register, confirm: value })} required /></div>
            </div>
            <button className="btn btn-primary w-100 mt-2" type="submit"><i className="fa-solid fa-user-plus me-2"></i>Create Account</button>
          </form>
        )}
        {authMode === "forgot" && (
          <form onSubmit={submitReset}>
            <h2 className="h4 fw-bold mb-3">OTP Verification</h2>
            {errors.reset && <div className="alert alert-danger py-2">{errors.reset}</div>}
            <Field label="Email or Username" value={reset.identifier} onChange={(value) => setReset({ ...reset, identifier: value })} required />
            {reset.otpSent && (
              <>
                <Field label="OTP" value={reset.otp} onChange={(value) => setReset({ ...reset, otp: value })} required />
                <Field label="New Password" type="password" value={reset.password} onChange={(value) => setReset({ ...reset, password: value })} required />
                <Field label="Confirm Password" type="password" value={reset.confirm} onChange={(value) => setReset({ ...reset, confirm: value })} required />
              </>
            )}
            <button className="btn btn-primary w-100" type="submit"><i className="fa-solid fa-shield-halved me-2"></i>{reset.otpSent ? "Reset Password" : "Send OTP"}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function SetupPage({ user, patchState, notify, logout, backend }) {
  const [form, setForm] = useState({ monthlySalary: "", salaryDate: todayISO(), monthlyBudget: "", dailyBudget: "", savingsGoal: "", preferredCurrency: user.currency, defaultPayment: "UPI", financialGoal: "" });
  const complete = async (event) => {
    event.preventDefault();
    if (Object.values(form).some((value) => !value)) {
      notify("Complete every setup field before opening the dashboard", "Profile Setup");
      return;
    }
    try {
      await backend.setupProfile({
        monthly_salary: form.monthlySalary,
        salary_credit_date: form.salaryDate,
        monthly_budget: form.monthlyBudget,
        daily_budget: form.dailyBudget,
        savings_goal: form.savingsGoal,
        preferred_currency: form.preferredCurrency,
        default_payment_method: form.defaultPayment,
        financial_goal: form.financialGoal
      });
      notify("Profile setup saved to Django/MySQL API", "Profile Setup");
    } catch (error) {
      notify("Backend setup unavailable, saved locally", "API Fallback");
    }
    patchState((prev) => ({
      ...prev,
      users: prev.users.map((entry) => entry.id === user.id ? { ...entry, ...form, currency: form.preferredCurrency, profileComplete: true } : entry),
      budgets: [...prev.budgets, { id: uid("budget"), userId: user.id, type: "Monthly", category: "All", amount: Number(form.monthlyBudget), spent: 0 }]
    }));
    notify("Profile setup completed", "Welcome");
  };
  return (
    <main className="auth-page fade-in">
      <section className="auth-visual">
        <div className="brand-mark"><i className="fa-solid fa-chart-line"></i><span>First Time Setup</span></div>
        <div className="hero-copy"><h1>Tell SmartExpense how your money works.</h1><p>The dashboard opens only after salary, budget, savings, currency, payment, and goal preferences are entered.</p></div>
      </section>
      <section className="auth-card">
        <div className="d-flex justify-content-between align-items-center mb-3"><h2 className="h4 fw-bold m-0">Complete Profile</h2><button className="btn btn-sm btn-outline-secondary" onClick={logout}>Logout</button></div>
        <form onSubmit={complete}>
          <div className="row g-3">
            <div className="col-md-6"><Field label="Monthly Salary" type="number" value={form.monthlySalary} onChange={(value) => setForm({ ...form, monthlySalary: value })} required /></div>
            <div className="col-md-6"><Field label="Salary Credit Date" type="date" value={form.salaryDate} onChange={(value) => setForm({ ...form, salaryDate: value })} required /></div>
            <div className="col-md-6"><Field label="Monthly Budget" type="number" value={form.monthlyBudget} onChange={(value) => setForm({ ...form, monthlyBudget: value })} required /></div>
            <div className="col-md-6"><Field label="Daily Budget" type="number" value={form.dailyBudget} onChange={(value) => setForm({ ...form, dailyBudget: value })} required /></div>
            <div className="col-md-6"><Field label="Savings Goal" type="number" value={form.savingsGoal} onChange={(value) => setForm({ ...form, savingsGoal: value })} required /></div>
            <div className="col-md-6"><Select label="Preferred Currency" value={form.preferredCurrency} options={currencies} onChange={(value) => setForm({ ...form, preferredCurrency: value })} /></div>
            <div className="col-md-6"><Select label="Default Payment Method" value={form.defaultPayment} options={paymentMethods} onChange={(value) => setForm({ ...form, defaultPayment: value })} /></div>
            <div className="col-md-6"><Field label="Financial Goal" value={form.financialGoal} onChange={(value) => setForm({ ...form, financialGoal: value })} required /></div>
          </div>
          <button className="btn btn-primary w-100 mt-2" type="submit"><i className="fa-solid fa-circle-check me-2"></i>Open Dashboard</button>
        </form>
      </section>
    </main>
  );
}

function Workspace(props) {
  const { state, patchState, user, active, setActive, logout, notify, backend } = props;
  const nav = [
    ["dashboard", "fa-gauge-high", "Dashboard"], ["income", "fa-arrow-trend-up", "Income"], ["expenses", "fa-receipt", "Expenses"],
    ["budgets", "fa-chart-pie", "Budgets"], ["goals", "fa-bullseye", "Savings Goals"], ["recurring", "fa-repeat", "Recurring"],
    ["bills", "fa-bell", "Bills"], ["receipts", "fa-file-invoice", "Receipts"], ["reports", "fa-file-export", "Reports"],
    ["analytics", "fa-chart-line", "Analytics"], ["ai", "fa-wand-magic-sparkles", "AI Insights"], ["profile", "fa-user-gear", "Profile"],
    ["settings", "fa-gear", "Settings"], ["admin", "fa-user-shield", "Admin"]
  ];
  const componentProps = { state, patchState, user, notify, backend };
  const pages = {
    dashboard: <Dashboard {...componentProps} />,
    income: <MoneyModule key="income" {...componentProps} type="income" />,
    expenses: <MoneyModule key="expense" {...componentProps} type="expense" />,
    budgets: <BudgetModule {...componentProps} />,
    goals: <GoalsModule {...componentProps} />,
    recurring: <RecurringModule {...componentProps} />,
    bills: <BillsModule {...componentProps} />,
    receipts: <ReceiptsModule {...componentProps} />,
    reports: <ReportsModule {...componentProps} />,
    analytics: <AnalyticsModule {...componentProps} />,
    ai: <AiModule {...componentProps} />,
    profile: <ProfileModule {...componentProps} />,
    settings: <SettingsModule {...componentProps} />,
    admin: <AdminModule {...componentProps} />
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark"><i className="fa-solid fa-wallet"></i><span>SmartExpense</span></div>
        <nav>{nav.map(([id, icon, label]) => <button key={id} className={`nav-button ${active === id ? "active" : ""}`} onClick={() => setActive(id)}><i className={`fa-solid ${icon}`}></i><span>{label}</span></button>)}</nav>
      </aside>
      <main className="main">
        <header className="topbar d-flex justify-content-between align-items-center gap-3">
          <div className="d-flex align-items-center gap-3"><Avatar user={user} /><div><strong>Welcome {user?.fullName || "Admin"}</strong><div className="text-secondary small">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div></div>
          <div className="d-flex gap-2"><button className="btn btn-outline-primary" onClick={() => patchState({ theme: state.theme === "dark" ? "light" : "dark" })}><i className="fa-solid fa-circle-half-stroke"></i></button><button className="btn btn-primary" onClick={logout}><i className="fa-solid fa-right-from-bracket me-2"></i>Logout</button></div>
        </header>
        <section className="content fade-in">{pages[active]}</section>
        <button className="btn btn-primary back-top" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}><i className="fa-solid fa-arrow-up"></i></button>
      </main>
    </div>
  );
}

function useUserData(state, user) {
  return useMemo(() => {
    const userId = user?.id;
    const incomes = state.incomes.filter((item) => item.userId === userId);
    const expenses = state.expenses.filter((item) => item.userId === userId);
    const goals = state.goals.filter((item) => item.userId === userId);
    const bills = state.bills.filter((item) => item.userId === userId);
    const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const saved = goals.reduce((sum, item) => sum + Number(item.current), 0);
    return { incomes, expenses, goals, bills, totalIncome, totalExpenses, saved, balance: Number(user?.monthlySalary || 0) + totalIncome - totalExpenses, budgetUsed: pct(totalExpenses, Number(user?.monthlyBudget || 0)) };
  }, [state, user]);
}

function Dashboard({ state, user }) {
  const data = useUserData(state, user);
  const health = Math.max(10, Math.min(100, 82 - Math.round(data.budgetUsed / 3) + (data.saved > 0 ? 8 : 0)));
  return (
    <>
      <Title title="Dashboard" subtitle="Live summary from your own entered records." />
      <div className="stat-grid mb-3">
        <Metric icon="fa-wallet" label="Current Balance" value={money(data.balance, user.currency)} />
        <Metric icon="fa-sack-dollar" label="Monthly Salary" value={money(user.monthlySalary, user.currency)} />
        <Metric icon="fa-arrow-up" label="Total Income" value={money(data.totalIncome, user.currency)} />
        <Metric icon="fa-arrow-down" label="Total Expenses" value={money(data.totalExpenses, user.currency)} />
        <Metric icon="fa-scale-balanced" label="Remaining Balance" value={money(data.balance, user.currency)} />
        <Metric icon="fa-piggy-bank" label="Savings" value={money(data.saved, user.currency)} />
        <Metric icon="fa-chart-simple" label="Budget Progress" value={`${data.budgetUsed}%`} progress={data.budgetUsed} />
        <Metric icon="fa-heart-pulse" label="Financial Health Score" value={`${health}/100`} progress={health} />
      </div>
      <div className="dash-grid">
        <div className="panel panel-pad"><h3 className="h5 fw-bold">Recent Transactions</h3><TransactionTable rows={[...data.incomes.map((x) => ({ ...x, kind: "Income" })), ...data.expenses.map((x) => ({ ...x, kind: "Expense" }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)} currency={user.currency} /></div>
        <div className="panel panel-pad">
          <h3 className="h5 fw-bold">Upcoming Bills</h3>
          {data.bills.length ? data.bills.slice(0, 5).map((bill) => <div className="list-row" key={bill.id}><div><strong>{bill.name}</strong><div className="small text-secondary">Due {bill.dueDate}</div></div><span>{money(bill.amount, user.currency)}</span></div>) : <Empty text="No bills added yet." />}
          <hr />
          <h3 className="h5 fw-bold">Goal Progress</h3>
          {data.goals.length ? data.goals.map((goal) => <ProgressLine key={goal.id} label={goal.name} value={pct(goal.current, goal.target)} />) : <Empty text="Create a savings goal to track progress." />}
        </div>
      </div>
    </>
  );
}

function MoneyModule({ state, patchState, user, notify, type, backend }) {
  const isIncome = type === "income";
  const key = isIncome ? "incomes" : "expenses";
  const initial = isIncome
    ? { source: "", amount: "", date: todayISO(), payment: user.defaultPayment || "UPI", description: "", attachment: "" }
    : { amount: "", category: "Food", subCategory: "", date: todayISO(), time: "09:00", payment: user.defaultPayment || "UPI", merchant: "", notes: "", receipt: "", location: "" };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ q: "", category: "All", month: "All", amount: "" });
  const rows = state[key].filter((item) => item.userId === user.id);
  const filtered = rows.filter((item) => {
    const blob = JSON.stringify(item).toLowerCase();
    return (!filter.q || blob.includes(filter.q.toLowerCase())) && (filter.category === "All" || item.category === filter.category) && (filter.month === "All" || item.date?.startsWith(filter.month)) && (!filter.amount || Number(item.amount) <= Number(filter.amount));
  });
  const submit = async (event) => {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return notify("Amount is required", isIncome ? "Income" : "Expense");
    let item = { ...form, id: editing || uid(key), userId: user.id, amount: Number(form.amount) };
    try {
      if (isIncome) {
        const payload = { income_source: form.source, amount: form.amount, date: form.date, payment_method_name: form.payment, description: form.description };
        const saved = editing ? await backend.update("/finance/income/", editing, payload) : await backend.create("/finance/income/", payload);
        item = incomeFromApi(saved);
      } else {
        const payload = { amount: form.amount, category_name: form.category, sub_category_name: form.subCategory, date: form.date, time: form.time, payment_method_name: form.payment, merchant_name: form.merchant, notes: form.notes, location: form.location };
        const saved = editing ? await backend.update("/finance/expenses/", editing, payload) : await backend.create("/finance/expenses/", payload);
        item = expenseFromApi(saved);
      }
    } catch (error) {
      notify("Backend save unavailable, record saved locally", "API Fallback");
    }
    patchState((prev) => ({ ...prev, [key]: editing ? prev[key].map((row) => row.id === editing ? item : row) : [item, ...prev[key]] }));
    notify(`${isIncome ? "Income" : "Expense"} ${editing ? "updated" : "added"}`, isIncome ? "Income" : "Expense");
    setEditing(null);
    setForm(initial);
  };
  const edit = (item) => { setEditing(item.id); setForm(item); };
  const remove = async (id) => {
    try {
      await backend.remove(isIncome ? "/finance/income/" : "/finance/expenses/", id);
    } catch (error) {
      notify("Backend delete unavailable, removed locally", "API Fallback");
    }
    patchState((prev) => ({ ...prev, [key]: prev[key].filter((item) => item.id !== id) }));
    notify(`${isIncome ? "Income" : "Expense"} deleted`, isIncome ? "Income" : "Expense");
  };
  return (
    <>
      <Title title={isIncome ? "Income Module" : "Expense Module"} subtitle="Every record is manually entered by the user." />
      <div className="module-grid">
        <form className="panel panel-pad" onSubmit={submit}>
          <h3 className="h5 fw-bold">{editing ? "Edit" : "Add"} {isIncome ? "Income" : "Expense"}</h3>
          {isIncome ? (
            <>
              <Field label="Income Source" value={form.source} onChange={(value) => setForm({ ...form, source: value })} required />
              <Field label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} required />
              <Field label="Date" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} required />
              <Select label="Payment Method" value={form.payment} options={paymentMethods} onChange={(value) => setForm({ ...form, payment: value })} />
              <Field label="Description" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
              <Field label="Attachment" type="file" onChange={(value) => setForm({ ...form, attachment: value })} />
            </>
          ) : (
            <>
              <Field label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} required />
              <Select label="Category" value={form.category} options={categories} onChange={(value) => setForm({ ...form, category: value })} />
              <Field label="Sub Category" value={form.subCategory} onChange={(value) => setForm({ ...form, subCategory: value })} />
              <div className="row g-2"><div className="col-6"><Field label="Date" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} required /></div><div className="col-6"><Field label="Time" type="time" value={form.time} onChange={(value) => setForm({ ...form, time: value })} /></div></div>
              <Select label="Payment Method" value={form.payment} options={paymentMethods} onChange={(value) => setForm({ ...form, payment: value })} />
              <Field label="Merchant Name" value={form.merchant} onChange={(value) => setForm({ ...form, merchant: value })} />
              <Field label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
              <Field label="Upload Receipt" type="file" onChange={(value) => setForm({ ...form, receipt: value })} />
              <Field label="Location (Optional)" value={form.location} onChange={(value) => setForm({ ...form, location: value })} />
            </>
          )}
          <button className="btn btn-primary w-100" type="submit"><i className="fa-solid fa-floppy-disk me-2"></i>{editing ? "Update" : "Add"} {isIncome ? "Income" : "Expense"}</button>
        </form>
        <div className="panel panel-pad">
          <div className="toolbar">
            <input className="form-control" placeholder={`Search ${isIncome ? "income" : "expense"}`} value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
            <select className="form-select" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })} disabled={isIncome}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <input className="form-control" type="month" onChange={(e) => setFilter({ ...filter, month: e.target.value || "All" })} />
            <input className="form-control" placeholder="Max amount" type="number" value={filter.amount} onChange={(e) => setFilter({ ...filter, amount: e.target.value })} />
          </div>
          <TransactionTable rows={filtered} currency={user.currency} onEdit={edit} onDelete={remove} />
        </div>
      </div>
    </>
  );
}

function BudgetModule({ state, patchState, user, notify, backend }) {
  const [form, setForm] = useState({ type: "Monthly", category: "All", amount: "" });
  const { totalExpenses } = useUserData(state, user);
  const budgets = state.budgets.filter((item) => item.userId === user.id);
  const submit = async (event) => {
    event.preventDefault();
    if (!form.amount) return;
    let item = { ...form, id: uid("budget"), userId: user.id, amount: Number(form.amount) };
    try {
      const saved = await backend.create("/finance/budgets/", { period: form.type.toLowerCase(), category_name: form.category, amount: form.amount });
      item = budgetFromApi(saved);
    } catch (error) {
      notify("Backend budget unavailable, saved locally", "API Fallback");
    }
    patchState((prev) => ({ ...prev, budgets: [item, ...prev.budgets] }));
    notify("Budget saved", "Budget");
    setForm({ type: "Monthly", category: "All", amount: "" });
  };
  return (
    <>
      <Title title="Budget Module" subtitle="Track monthly, weekly, daily, and category budgets." />
      <div className="module-grid">
        <form className="panel panel-pad" onSubmit={submit}>
          <Select label="Budget Type" value={form.type} options={["Monthly", "Weekly", "Daily", "Category"]} onChange={(value) => setForm({ ...form, type: value })} />
          <Select label="Category Budget" value={form.category} options={["All", ...categories]} onChange={(value) => setForm({ ...form, category: value })} />
          <Field label="Budget Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} required />
          <button className="btn btn-primary w-100"><i className="fa-solid fa-plus me-2"></i>Add Budget</button>
        </form>
        <div className="panel panel-pad">
          {budgets.map((budget) => {
            const used = budget.category === "All" ? totalExpenses : state.expenses.filter((x) => x.userId === user.id && x.category === budget.category).reduce((s, x) => s + Number(x.amount), 0);
            const percent = pct(used, budget.amount);
            return <div className="mb-3" key={budget.id}><div className="d-flex justify-content-between"><strong>{budget.type} - {budget.category}</strong><span>{money(used, user.currency)} / {money(budget.amount, user.currency)}</span></div><ProgressLine label={percent > 100 ? "Overspending Alert" : "Remaining Budget"} value={percent} danger={percent > 100} /></div>;
          })}
          {!budgets.length && <Empty text="No budget records yet." />}
        </div>
      </div>
    </>
  );
}

function GoalsModule({ state, patchState, user, notify, backend }) {
  const [form, setForm] = useState({ name: "", target: "", current: "", deadline: "", priority: "Medium" });
  const goals = state.goals.filter((item) => item.userId === user.id);
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.target || !form.deadline) return;
    let item = { ...form, id: uid("goal"), userId: user.id, target: Number(form.target), current: Number(form.current || 0) };
    try {
      const saved = await backend.create("/finance/savings-goals/", { goal_name: form.name, target_amount: form.target, current_saved_amount: form.current || 0, deadline: form.deadline, priority: form.priority.toLowerCase() });
      item = goalFromApi(saved);
    } catch (error) {
      notify("Backend goal unavailable, saved locally", "API Fallback");
    }
    patchState((prev) => ({ ...prev, goals: [item, ...prev.goals] }));
    notify("Savings goal created", "Goal");
    setForm({ name: "", target: "", current: "", deadline: "", priority: "Medium" });
  };
  return <SimpleCreateList title="Savings Goal Module" subtitle="Create goals with priority, deadline, percentage, remaining amount, and days left." form={form} setForm={setForm} submit={submit} items={goals} user={user} kind="goal" />;
}

function RecurringModule({ state, patchState, user, notify, backend }) {
  const [form, setForm] = useState({ name: "", amount: "", frequency: "Monthly", type: "Expense", nextDate: todayISO() });
  const items = state.recurring.filter((item) => item.userId === user.id);
  const submit = async (event) => {
    event.preventDefault();
    let item = { ...form, id: uid("rec"), userId: user.id, amount: Number(form.amount) };
    try {
      const saved = await backend.create("/finance/recurring-transactions/", { name: form.name, amount: form.amount, transaction_type: form.type.toLowerCase(), frequency: form.frequency.toLowerCase(), next_run_date: form.nextDate });
      item = { id: saved.id, userId: saved.user, name: saved.name, amount: Number(saved.amount), type: saved.transaction_type, frequency: saved.frequency, nextDate: saved.next_run_date };
    } catch (error) {
      notify("Backend recurring unavailable, saved locally", "API Fallback");
    }
    patchState((prev) => ({ ...prev, recurring: [item, ...prev.recurring] }));
    notify("Recurring reminder created", "Recurring");
  };
  return <SimpleCreateList title="Recurring Transactions" subtitle="Salary, rent, EMI, electricity, water, internet, Netflix, Spotify and more." form={form} setForm={setForm} submit={submit} items={items} user={user} kind="recurring" />;
}

function BillsModule({ state, patchState, user, notify, backend }) {
  const [form, setForm] = useState({ name: "", amount: "", dueDate: todayISO(), remindBefore: "3" });
  const items = state.bills.filter((item) => item.userId === user.id);
  const submit = async (event) => {
    event.preventDefault();
    let item = { ...form, id: uid("bill"), userId: user.id, amount: Number(form.amount) };
    try {
      const saved = await backend.create("/finance/bills/", { bill_name: form.name, amount: form.amount, due_date: form.dueDate, reminder_days_before_due_date: form.remindBefore });
      item = billFromApi(saved);
    } catch (error) {
      notify("Backend bill unavailable, saved locally", "API Fallback");
    }
    patchState((prev) => ({ ...prev, bills: [item, ...prev.bills] }));
    notify("Bill reminder saved", "Bill Reminder");
  };
  return <SimpleCreateList title="Bills Reminder" subtitle="Get notified before due dates." form={form} setForm={setForm} submit={submit} items={items} user={user} kind="bill" />;
}

function ReceiptsModule({ state, patchState, user, notify }) {
  const [form, setForm] = useState({ name: "", file: "", expenseId: "" });
  const expenses = state.expenses.filter((item) => item.userId === user.id);
  const receipts = state.receipts.filter((item) => item.userId === user.id);
  const submit = (event) => {
    event.preventDefault();
    patchState((prev) => ({ ...prev, receipts: [{ ...form, id: uid("receipt"), userId: user.id, date: todayISO() }, ...prev.receipts] }));
    notify("Receipt linked with expense", "Receipt");
  };
  return (
    <>
      <Title title="Receipt Module" subtitle="Upload image/PDF receipts, preview, download, delete, and link to expenses." />
      <div className="module-grid">
        <form className="panel panel-pad" onSubmit={submit}>
          <Field label="Receipt Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
          <Field label="Image or PDF" type="file" onChange={(value) => setForm({ ...form, file: value })} required />
          <Select label="Linked Expense" value={form.expenseId} options={["", ...expenses.map((item) => `${item.id}|${item.merchant || item.category} - ${money(item.amount, user.currency)}`)]} onChange={(value) => setForm({ ...form, expenseId: value.split("|")[0] })} />
          <button className="btn btn-primary w-100"><i className="fa-solid fa-upload me-2"></i>Upload Receipt</button>
        </form>
        <div className="panel panel-pad">{receipts.length ? receipts.map((item) => <div className="list-row" key={item.id}><div><strong>{item.name}</strong><div className="small text-secondary">{item.file || "Uploaded file"}</div></div><div className="btn-group"><button className="btn btn-sm btn-outline-primary"><i className="fa-solid fa-eye"></i></button><button className="btn btn-sm btn-outline-primary"><i className="fa-solid fa-download"></i></button><button className="btn btn-sm btn-outline-danger" onClick={() => patchState((prev) => ({ ...prev, receipts: prev.receipts.filter((x) => x.id !== item.id) }))}><i className="fa-solid fa-trash"></i></button></div></div>) : <Empty text="No receipts uploaded yet." />}</div>
      </div>
    </>
  );
}

function ReportsModule({ state, user }) {
  const data = useUserData(state, user);
  const reports = ["Daily Report", "Weekly Report", "Monthly Report", "Yearly Report", "Income Report", "Expense Report", "Budget Report", "Savings Report", "Cash Flow Report"];
  return (
    <>
      <Title title="Reports Module" subtitle="Generate and export PDF, Excel, CSV, or print-ready reports." />
      <div className="stat-grid">{reports.map((report) => <div className="panel panel-pad" key={report}><i className="fa-solid fa-file-lines text-primary fs-3 mb-3"></i><h3 className="h6 fw-bold">{report}</h3><p className="text-secondary small">Income {money(data.totalIncome, user.currency)} | Expense {money(data.totalExpenses, user.currency)}</p><div className="btn-group w-100"><button className="btn btn-sm btn-outline-primary">PDF</button><button className="btn btn-sm btn-outline-primary">Excel</button><button className="btn btn-sm btn-outline-primary">CSV</button><button className="btn btn-sm btn-outline-primary"><i className="fa-solid fa-print"></i></button></div></div>)}</div>
    </>
  );
}

function AnalyticsModule({ state, user }) {
  const data = useUserData(state, user);
  return (
    <>
      <Title title="Dashboard Analytics" subtitle="Charts update as you add or edit data." />
      <div className="dash-grid">
        <ChartPanel title="Expense Pie Chart" type="pie" labels={categories} values={categories.map((cat) => data.expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0))} />
        <ChartPanel title="Income vs Expense Bar Chart" type="bar" labels={["Income", "Expense", "Savings"]} values={[data.totalIncome, data.totalExpenses, data.saved]} />
        <ChartPanel title="Monthly Trend Line Chart" type="line" labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]} values={[0, 0, 0, 0, 0, 0, data.totalExpenses]} />
        <ChartPanel title="Budget vs Expense" type="bar" labels={["Budget", "Expense"]} values={[Number(user.monthlyBudget || 0), data.totalExpenses]} />
      </div>
    </>
  );
}

function AiModule({ state, user }) {
  const data = useUserData(state, user);
  const topCategory = categories.map((cat) => ({ cat, value: data.expenses.filter((e) => e.category === cat).reduce((s, e) => s + Number(e.amount), 0) })).sort((a, b) => b.value - a.value)[0];
  const insights = [
    ["AI Spending Analysis", data.expenses.length ? `Your highest spending category is ${topCategory.cat} at ${money(topCategory.value, user.currency)}.` : "Add expenses to generate spending analysis."],
    ["Expense Prediction", `At the current pace, projected monthly expense is about ${money(data.totalExpenses, user.currency)}.`],
    ["Budget Recommendation", data.budgetUsed > 80 ? "Reduce flexible spending or raise the monthly budget." : "Your budget usage is currently within a healthy range."],
    ["Saving Suggestions", data.saved ? "Keep funding active goals before discretionary expenses." : "Create a savings goal and assign a recurring contribution."],
    ["Financial Health Score", `Current score is ${Math.max(10, 90 - data.budgetUsed)}/100 based only on your records.`],
    ["Smart Insights", data.totalExpenses > data.totalIncome + Number(user.monthlySalary || 0) ? "Expenses exceed available income." : "Cash flow is positive."],
    ["Monthly Summary", `Income ${money(data.totalIncome, user.currency)}, expenses ${money(data.totalExpenses, user.currency)}, balance ${money(data.balance, user.currency)}.`],
    ["Unnecessary Expense Detection", topCategory.value > Number(user.monthlyBudget || 0) * 0.35 ? `${topCategory.cat} may need review.` : "No unusual category concentration detected yet."]
  ];
  return <><Title title="AI Features" subtitle="Insights are derived only from the logged-in user's local data." /><div className="stat-grid">{insights.map(([title, body]) => <div className="panel panel-pad" key={title}><i className="fa-solid fa-wand-magic-sparkles text-primary fs-4 mb-3"></i><h3 className="h6 fw-bold">{title}</h3><p className="text-secondary mb-0">{body}</p></div>)}</div></>;
}

function ProfileModule({ state, patchState, user, notify }) {
  const [form, setForm] = useState(user);
  const history = state.loginHistory.filter((item) => item.userId === user.id);
  const save = (event) => {
    event.preventDefault();
    patchState((prev) => ({ ...prev, users: prev.users.map((entry) => entry.id === user.id ? { ...entry, ...form } : entry) }));
    notify("Profile updated", "Profile");
  };
  return (
    <>
      <Title title="Profile Module" subtitle="Edit profile, picture, password, email, currency, account, and login history." />
      <div className="module-grid">
        <form className="panel panel-pad" onSubmit={save}>
          <Field label="Full Name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
          <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <Select label="Currency" value={form.currency} options={currencies} onChange={(value) => setForm({ ...form, currency: value })} />
          <Field label="Profile Picture" type="file" onChange={(value) => setForm({ ...form, avatar: value })} />
          <Field label="Change Password" type="password" onChange={(value) => setForm({ ...form, passwordHash: value ? hashPassword(value) : form.passwordHash })} />
          <button className="btn btn-primary w-100">Save Profile</button>
          <button type="button" className="btn btn-outline-danger w-100 mt-2">Delete Account</button>
        </form>
        <div className="panel panel-pad"><h3 className="h5 fw-bold">Login History</h3>{history.map((item) => <div className="list-row" key={item.id}><div>{item.date}<div className="small text-secondary">{item.device}</div></div></div>)}</div>
      </div>
    </>
  );
}

function SettingsModule({ state, patchState, user, notify }) {
  const save = (key, value) => {
    patchState((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));
    notify("Settings updated", "Settings");
  };
  return (
    <>
      <Title title="Settings Module" subtitle="Theme, language, currency, timezone, notifications, backup, and restore." />
      <div className="stat-grid">
        <div className="panel panel-pad"><h3 className="h6 fw-bold">Appearance</h3><button className="btn btn-primary" onClick={() => patchState({ theme: state.theme === "dark" ? "light" : "dark" })}>{state.theme === "dark" ? "Light Mode" : "Dark Mode"}</button></div>
        <div className="panel panel-pad"><Select label="Language" value={state.settings.language} options={["English", "Hindi", "Spanish", "French"]} onChange={(value) => save("language", value)} /></div>
        <div className="panel panel-pad"><Select label="Time Zone" value={state.settings.timezone} options={["Asia/Calcutta", "UTC", "America/New_York", "Europe/London"]} onChange={(value) => save("timezone", value)} /></div>
        <div className="panel panel-pad"><label className="form-check"><input className="form-check-input" type="checkbox" checked={state.settings.notifications} onChange={(e) => save("notifications", e.target.checked)} /> <span className="form-check-label">Notification Settings</span></label></div>
        <div className="panel panel-pad"><button className="btn btn-outline-primary w-100">Backup Data</button></div>
        <div className="panel panel-pad"><button className="btn btn-outline-primary w-100">Restore Data</button></div>
      </div>
    </>
  );
}

function AdminModule({ state, patchState, user, notify }) {
  const totals = [
    ["Total Users", state.users.length], ["Total Income Records", state.incomes.length], ["Total Expense Records", state.expenses.length],
    ["Total Transactions", state.incomes.length + state.expenses.length], ["Total Budgets", state.budgets.length], ["Total Savings Goals", state.goals.length],
    ["Active Users", state.users.filter((u) => !u.blocked).length], ["Daily Activity", state.loginHistory.filter((x) => x.date.includes(new Date().toLocaleDateString())).length]
  ];
  return (
    <>
      <Title title="Admin Panel" subtitle="Secure admin dashboard for users, categories, transactions, reports, and analytics." />
      <div className="stat-grid mb-3">{totals.map(([label, value]) => <Metric key={label} icon="fa-database" label={label} value={value} />)}</div>
      <div className="panel panel-pad">
        <h3 className="h5 fw-bold">View Users</h3>
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>User</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>{state.users.map((entry) => <tr key={entry.id}><td>{entry.fullName}</td><td>{entry.email}</td><td><span className="badge badge-soft">{entry.blocked ? "Blocked" : "Active"}</span></td><td><div className="btn-group"><button className="btn btn-sm btn-outline-primary" onClick={() => patchState((prev) => ({ ...prev, users: prev.users.map((u) => u.id === entry.id ? { ...u, blocked: !u.blocked } : u) }))}>{entry.blocked ? "Unblock" : "Block"}</button><button className="btn btn-sm btn-outline-danger" onClick={() => patchState((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== entry.id) }))}>Delete</button><button className="btn btn-sm btn-outline-primary" onClick={() => notify("Password reset link prepared", "Admin")}>Reset Password</button></div></td></tr>)}</tbody></table></div>
      </div>
    </>
  );
}

function SimpleCreateList({ title, subtitle, form, setForm, submit, items, user, kind }) {
  return (
    <>
      <Title title={title} subtitle={subtitle} />
      <div className="module-grid">
        <form className="panel panel-pad" onSubmit={submit}>
          {Object.keys(form).map((key) => key === "priority" ? <Select key={key} label="Priority" value={form[key]} options={["High", "Medium", "Low"]} onChange={(value) => setForm({ ...form, [key]: value })} /> : key === "frequency" ? <Select key={key} label="Frequency" value={form[key]} options={["Daily", "Weekly", "Monthly", "Yearly"]} onChange={(value) => setForm({ ...form, [key]: value })} /> : key === "type" ? <Select key={key} label="Type" value={form[key]} options={["Income", "Expense"]} onChange={(value) => setForm({ ...form, [key]: value })} /> : <Field key={key} label={labelize(key)} type={key.toLowerCase().includes("date") || key === "deadline" ? "date" : key.toLowerCase().includes("amount") || ["target", "current", "remindBefore"].includes(key) ? "number" : "text"} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} required />)}
          <button className="btn btn-primary w-100"><i className="fa-solid fa-plus me-2"></i>Create</button>
        </form>
        <div className="panel panel-pad">
          {items.length ? items.map((item) => <div className="list-row" key={item.id}><div><strong>{item.name}</strong><div className="small text-secondary">{Object.entries(item).filter(([k]) => !["id", "userId", "name"].includes(k)).map(([k, v]) => `${labelize(k)}: ${v}`).join(" | ")}</div>{kind === "goal" && <ProgressLine label={`${pct(item.current, item.target)}% saved`} value={pct(item.current, item.target)} />}</div>{item.amount && <span>{money(item.amount, user.currency)}</span>}{item.target && <span>{money(item.target - item.current, user.currency)} left</span>}</div>) : <Empty text="No records yet." />}
        </div>
      </div>
    </>
  );
}

function ChartPanel({ title, type, labels, values }) {
  const ref = useRef(null);
  useEffect(() => {
    const chart = new Chart(ref.current, {
      type,
      data: { labels, datasets: [{ label: title, data: values, backgroundColor: ["#0e7c86", "#d94f45", "#168a55", "#d59612", "#6f7bd9", "#2c9bb3"], borderColor: "#0e7c86", tension: 0.32 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
    });
    return () => chart.destroy();
  }, [title, type, JSON.stringify(labels), JSON.stringify(values)]);
  return <div className="panel panel-pad" style={{ minHeight: 320 }}><h3 className="h5 fw-bold">{title}</h3><div style={{ height: 245 }}><canvas ref={ref}></canvas></div></div>;
}

function TransactionTable({ rows, currency, onEdit, onDelete }) {
  if (!rows.length) return <Empty text="No records found." />;
  return <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Method</th><th className="text-end">Amount</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.date}</td><td><span className="badge badge-soft">{row.kind || (row.source ? "Income" : "Expense")}</span></td><td><strong>{row.source || row.merchant || row.category}</strong><div className="small text-secondary">{row.description || row.notes || row.subCategory}</div></td><td>{row.payment}</td><td className="text-end fw-bold">{money(row.amount, currency)}</td><td className="text-end">{onEdit && <div className="btn-group"><button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(row)}><i className="fa-solid fa-pen"></i></button><button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(row.id)}><i className="fa-solid fa-trash"></i></button></div>}</td></tr>)}</tbody></table></div>;
}

function Field({ label, value, onChange, type = "text", error, required }) {
  return <div className="mb-3"><label className="form-label fw-semibold">{label}</label><input className={`form-control ${error ? "is-invalid" : ""}`} type={type} value={type === "file" ? undefined : (value || "")} onChange={(event) => onChange(type === "file" ? event.target.files?.[0]?.name || "" : event.target.value)} required={required} />{error && <div className="invalid-feedback">{error}</div>}</div>;
}

function Select({ label, value, options, onChange }) {
  return <div className="mb-3"><label className="form-label fw-semibold">{label}</label><select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{String(option).includes("|") ? String(option).split("|")[1] : option || "Select"}</option>)}</select></div>;
}

function Title({ title, subtitle }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <div className="text-secondary">{subtitle}</div>}</div></div>;
}

function Metric({ icon, label, value, progress }) {
  return <div className="panel metric-card"><div className="icon-pill"><i className={`fa-solid ${icon}`}></i></div><span>{label}</span><strong>{value}</strong>{progress !== undefined && <ProgressLine value={progress} />}</div>;
}

function ProgressLine({ label, value, danger }) {
  return <div className="mt-2"><div className="d-flex justify-content-between small text-secondary"><span>{label || ""}</span><span>{value}%</span></div><div className="progress"><div className={`progress-bar ${danger ? "bg-danger" : ""}`} style={{ width: `${Math.min(value, 100)}%`, backgroundColor: danger ? undefined : "var(--primary)" }}></div></div></div>;
}

function Avatar({ user }) {
  return user?.avatar ? <img className="avatar" src={user.avatar} alt="" /> : <div className="avatar">{(user?.fullName || "A").slice(0, 1).toUpperCase()}</div>;
}

function Empty({ text }) {
  return <div className="text-center text-secondary py-4"><div className="skeleton mb-3 mx-auto" style={{ width: 160 }}></div>{text}</div>;
}

function labelize(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
