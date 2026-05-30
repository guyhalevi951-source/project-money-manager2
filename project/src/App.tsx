import { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  Utensils,
  Heart,
  Film,
  Home,
  HelpCircle,
  Tag,
  X,
  ShoppingBag,
  Car,
  Gift,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  type LucideIcon
} from 'lucide-react';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  // Canonical date stored as ISO 'YYYY-MM-DD' for reliable month filtering.
  date: string;
}

interface Category {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIES: Category[] = [
  { value: 'אוכל', label: 'אוכל', icon: Utensils, color: 'bg-amber-500' },
  { value: 'בריאות', label: 'בריאות', icon: Heart, color: 'bg-rose-500' },
  { value: 'בילויים', label: 'בילויים', icon: Film, color: 'bg-purple-500' },
  { value: 'שכר דירה', label: 'שכר דירה', icon: Home, color: 'bg-cyan-500' },
  { value: 'אחר', label: 'אחר', icon: HelpCircle, color: 'bg-gray-500' },
];

// Sentinel value used by the category <select> to trigger the "add custom" flow
const ADD_CUSTOM_VALUE = '__add_custom__';

// Icons can't be serialized to localStorage, so custom categories store an icon
// *name* and we resolve it back to a component through this registry.
const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Tag', icon: Tag },
  { name: 'Heart', icon: Heart },
  { name: 'Utensils', icon: Utensils },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'Car', icon: Car },
  { name: 'Home', icon: Home },
  { name: 'Gift', icon: Gift },
  { name: 'Film', icon: Film },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, o.icon])
);

const resolveIcon = (name: string): LucideIcon => ICON_MAP[name] ?? Tag;

// Pre-defined badge colors the user can pick from when creating a category.
const COLOR_OPTIONS: { name: string; class: string }[] = [
  { name: 'אמרלד', class: 'bg-emerald-500' },
  { name: 'סגול', class: 'bg-purple-500' },
  { name: 'כחול', class: 'bg-blue-500' },
  { name: 'ענבר', class: 'bg-amber-500' },
  { name: 'ורוד', class: 'bg-rose-500' },
  { name: 'טורקיז', class: 'bg-teal-500' },
  { name: 'אינדיגו', class: 'bg-indigo-500' },
  { name: 'כתום', class: 'bg-orange-500' },
];

// --- Date helpers -----------------------------------------------------------
const pad2 = (n: number) => String(n).padStart(2, '0');

// ISO date string ('YYYY-MM-DD') in local time.
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Month bucket key ('YYYY-MM') used to group/filter expenses.
const monthKeyOf = (iso: string) => iso.slice(0, 7);
const monthKeyOfDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

// Accepts either an ISO date or a legacy he-IL 'D.M.YYYY' string and returns ISO.
// Keeps historical data working after the move to ISO storage.
const normalizeDate = (raw: string): string => {
  if (!raw) return toISODate(new Date());
  if (raw.includes('-')) return raw;
  const cleaned = raw.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const [d, m, y] = parts;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  return toISODate(new Date());
};

// ISO -> localized display date.
const formatDisplayDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('he-IL');
};

function App() {
  const [budget, setBudget] = useState<number>(0);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'אוכל',
    date: toISODate(new Date()),
  });
  const [showBudgetSaved, setShowBudgetSaved] = useState(false);

  // The month currently being viewed (stored as the 1st of that month).
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Custom (user-created) categories, persisted separately from the built-in ones.
  // Icon components can't be serialized, so we store an icon *name* + color class.
  const [customCategories, setCustomCategories] = useState<
    { value: string; label: string; color: string; iconName: string }[]
  >([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(COLOR_OPTIONS[0].class);
  const [newCategoryIcon, setNewCategoryIcon] = useState(ICON_OPTIONS[0].name);
  const [categoryError, setCategoryError] = useState('');

  // The full list of selectable categories: built-ins + user-created.
  const allCategories: Category[] = [
    ...CATEGORIES,
    ...customCategories.map((c) => ({
      value: c.value,
      label: c.label,
      color: c.color,
      icon: resolveIcon(c.iconName),
    })),
  ];

  // Load data from localStorage on mount
  useEffect(() => {
    const savedBudget = localStorage.getItem('monthlyBudget');
    const savedExpenses = localStorage.getItem('expenses');
    const savedCategories = localStorage.getItem('customCategories');

    if (savedBudget) {
      setBudget(parseFloat(savedBudget));
    }
    if (savedExpenses) {
      const parsed: Expense[] = JSON.parse(savedExpenses);
      // Migrate any legacy (he-IL) dates to the canonical ISO format.
      setExpenses(parsed.map((e) => ({ ...e, date: normalizeDate(e.date) })));
    }
    if (savedCategories) {
      setCustomCategories(JSON.parse(savedCategories));
    }
  }, []);

  // Save custom categories to localStorage
  useEffect(() => {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Save budget to localStorage
  const handleSetBudget = () => {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount >= 0) {
      setBudget(amount);
      localStorage.setItem('monthlyBudget', amount.toString());
      setBudgetInput('');
      setShowBudgetSaved(true);
      setTimeout(() => setShowBudgetSaved(false), 2000);
    }
  };

  // Save expenses to localStorage
  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Add new expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newExpense.amount);

    if (newExpense.description.trim() && !isNaN(amount) && amount > 0) {
      const isoDate = normalizeDate(newExpense.date);
      const expense: Expense = {
        id: Date.now().toString(),
        description: newExpense.description.trim(),
        amount: amount,
        category: newExpense.category,
        date: isoDate,
      };

      setExpenses([expense, ...expenses]);
      setNewExpense({ description: '', amount: '', category: 'אוכל', date: toISODate(new Date()) });

      // Jump the view to the month of the new expense so it's immediately visible.
      const [y, m] = isoDate.split('-').map((n) => parseInt(n, 10));
      setSelectedDate(new Date(y, m - 1, 1));
    }
  };

  // Delete expense
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(expense => expense.id !== id));
  };

  // Handle category dropdown change. Selecting the sentinel opens the "add" input
  // instead of changing the selected category.
  const handleCategoryChange = (value: string) => {
    if (value === ADD_CUSTOM_VALUE) {
      setIsAddingCategory(true);
      setCategoryError('');
      return;
    }
    setNewExpense({ ...newExpense, category: value });
  };

  // Create a new custom category and select it immediately.
  const handleAddCategory = () => {
    const name = newCategoryName.trim();

    if (!name) {
      setCategoryError('יש להזין שם קטגוריה');
      return;
    }
    if (name === ADD_CUSTOM_VALUE) {
      setCategoryError('שם לא חוקי');
      return;
    }

    const exists = allCategories.some((c) => c.value === name);
    if (exists) {
      setCategoryError('קטגוריה בשם זה כבר קיימת');
      return;
    }

    setCustomCategories([
      ...customCategories,
      { value: name, label: name, color: newCategoryColor, iconName: newCategoryIcon },
    ]);
    setNewExpense({ ...newExpense, category: name });
    resetCategoryForm();
    setIsAddingCategory(false);
  };

  // Reset the inline create-category form to its defaults.
  const resetCategoryForm = () => {
    setNewCategoryName('');
    setNewCategoryColor(COLOR_OPTIONS[0].class);
    setNewCategoryIcon(ICON_OPTIONS[0].name);
    setCategoryError('');
  };

  // Cancel the add-category flow without creating anything.
  const handleCancelAddCategory = () => {
    setIsAddingCategory(false);
    resetCategoryForm();
  };

  // Month navigation
  const selectedMonthKey = monthKeyOfDate(selectedDate);
  const monthLabel = selectedDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const isCurrentMonth = selectedMonthKey === monthKeyOfDate(new Date());
  const goToMonth = (offset: number) =>
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Expenses for the selected month only (filtered by ISO date).
  const monthExpenses = expenses.filter((e) => monthKeyOf(e.date) === selectedMonthKey);

  // Calculate total expenses (for the selected month)
  const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const budgetPercentage = budget > 0 ? (totalExpenses / budget) * 100 : 0;
  const isOverBudget = totalExpenses > budget && budget > 0;
  const remaining = budget - totalExpenses;

  // Get category info
  const getCategoryInfo = (categoryValue: string): Category => {
    return allCategories.find(c => c.value === categoryValue) || CATEGORIES[4];
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header
        className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 sm:p-3 rounded-xl shadow-lg shrink-0">
                <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold text-slate-800 truncate">מנהל התקציב שלי</h1>
                <p className="text-slate-500 text-xs sm:text-sm truncate">נהל את ההוצאות שלך בצורה חכמה</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-slate-400 shrink-0 text-left">
              {new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Month Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 mb-6 sm:mb-8">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => goToMonth(-1)}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
              aria-label="חודש קודם"
              title="חודש קודם"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div className="flex flex-col items-center min-w-0">
              <div className="flex items-center gap-2 text-slate-800">
                <CalendarDays className="w-5 h-5 text-emerald-500 shrink-0" />
                <span className="text-base sm:text-lg font-semibold capitalize truncate">
                  {monthLabel}
                </span>
              </div>
              {!isCurrentMonth && (
                <button
                  onClick={goToCurrentMonth}
                  className="mt-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 active:opacity-70 transition-colors"
                >
                  חזרה לחודש הנוכחי
                </button>
              )}
            </div>

            <button
              onClick={() => goToMonth(1)}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:scale-95 transition-all"
              aria-label="חודש הבא"
              title="חודש הבא"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Budget Setter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-slate-700 mb-4">הגדר תקציב חודשי</h2>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="flex-1 sm:max-w-xs">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                סכום התקציב (₪)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder={budget > 0 ? `נוכחי: ₪${budget.toLocaleString()}` : 'הזן סכום'}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-base sm:text-lg"
                min="0"
                step="100"
              />
            </div>
            <button
              onClick={handleSetBudget}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {showBudgetSaved ? (
                <>
                  <Check className="w-5 h-5" />
                  נשמר!
                </>
              ) : (
                'עדכן תקציב'
              )}
            </button>
          </div>
        </div>

        {/* Dashboard Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Budget Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-slate-500">תקציב חודשי</span>
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-800">₪{budget.toLocaleString()}</p>
            <p className="text-sm text-slate-400 mt-2">הסכום שהוקצב להוצאות</p>
          </div>

          {/* Total Expenses Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-slate-500">סה"כ הוצאות</span>
              <div className="bg-rose-100 p-2 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-600" />
              </div>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-800'}`}>
              ₪{totalExpenses.toLocaleString()}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              {monthExpenses.length} הוצאות ב{monthLabel}
            </p>
          </div>

          {/* Budget Status Card */}
          <div className={`rounded-2xl shadow-sm border p-4 sm:p-6 hover:shadow-md transition-shadow sm:col-span-2 md:col-span-1 ${
            isOverBudget
              ? 'bg-rose-50 border-rose-200'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-slate-500">מצב התקציב</span>
              <div className={`p-2 rounded-lg ${isOverBudget ? 'bg-rose-200' : 'bg-blue-100'}`}>
                {isOverBudget ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : (
                  <Wallet className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </div>

            {isOverBudget && (
              <div className="bg-rose-600 text-white text-xs font-medium px-2 py-1 rounded-full inline-block mb-3">
                חרגת מהתקציב!
              </div>
            )}

            <p className={`text-2xl font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-800'}`}>
              {remaining >= 0 ? `₪${remaining.toLocaleString()}` : `-₪${Math.abs(remaining).toLocaleString()}`}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              {remaining >= 0 ? 'נותר בתקציב' : 'חריגה מהתקציב'}
            </p>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>ניצולת</span>
                <span>{Math.min(100, budgetPercentage).toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget
                      ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                      : budgetPercentage > 80
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, budgetPercentage)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Add Expense Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-slate-700 mb-4 sm:mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            הוסף הוצאה חדשה
          </h2>

          <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">תיאור</label>
              <input
                type="text"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="לדוגמה: סופר, דלק"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">סכום (₪)</label>
              <input
                type="number"
                inputMode="decimal"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-base"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">תאריך</label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">קטגוריה</label>
              <select
                value={newExpense.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all bg-white text-base"
              >
                {allCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
                <option value={ADD_CUSTOM_VALUE}>+ הוסף קטגוריה חדשה</option>
              </select>

              {isAddingCategory && (
                <div className="mt-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      שם הקטגוריה
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        if (categoryError) setCategoryError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      placeholder="לדוגמה: תחבורה, מתנות"
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-base bg-white"
                    />
                  </div>

                  {/* Color picker */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">צבע</label>
                    <div className="flex flex-wrap gap-2.5">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.class}
                          type="button"
                          onClick={() => setNewCategoryColor(c.class)}
                          title={c.name}
                          aria-label={c.name}
                          className={`w-9 h-9 rounded-full ${c.class} transition-all ${
                            newCategoryColor === c.class
                              ? 'ring-2 ring-offset-2 ring-slate-700 scale-110'
                              : 'hover:scale-110 active:scale-95'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Icon picker */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">אייקון</label>
                    <div className="flex flex-wrap gap-2.5">
                      {ICON_OPTIONS.map((o) => {
                        const IconComp = o.icon;
                        const selected = newCategoryIcon === o.name;
                        return (
                          <button
                            key={o.name}
                            type="button"
                            onClick={() => setNewCategoryIcon(o.name)}
                            aria-label={o.name}
                            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
                              selected
                                ? 'bg-emerald-500 text-white ring-2 ring-offset-2 ring-emerald-300'
                                : 'bg-white text-slate-500 border border-slate-300 hover:border-emerald-400 hover:text-emerald-500 active:scale-95'
                            }`}
                          >
                            <IconComp className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">תצוגה מקדימה:</span>
                    {(() => {
                      const PreviewIcon = resolveIcon(newCategoryIcon);
                      return (
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${newCategoryColor} text-white`}
                        >
                          <PreviewIcon className="w-4 h-4" />
                          {newCategoryName.trim() || 'קטגוריה חדשה'}
                        </span>
                      );
                    })()}
                  </div>

                  {categoryError && (
                    <p className="text-rose-500 text-xs">{categoryError}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
                      הוסף קטגוריה
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddCategory}
                      className="shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2.5 rounded-lg transition-all"
                      title="ביטול"
                      aria-label="ביטול"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                הוסף הוצאה
              </button>
            </div>
          </form>
        </div>

        {/* Expenses List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-base sm:text-lg font-semibold text-slate-700">רשימת ההוצאות</h2>
            <p className="text-sm text-slate-400 mt-1">
              {monthExpenses.length} הוצאות ב{monthLabel}
            </p>
          </div>

          {monthExpenses.length === 0 ? (
            <div className="p-10 sm:p-12 text-center">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingDown className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 text-base sm:text-lg">אין הוצאות בחודש זה</p>
              <p className="text-slate-400 text-sm mt-1">הוסף הוצאה חדשה או בחר חודש אחר</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list (native-app feel) */}
              <ul className="md:hidden divide-y divide-slate-100">
                {monthExpenses.map((expense) => {
                  const categoryInfo = getCategoryInfo(expense.category);
                  const IconComponent = categoryInfo.icon;

                  return (
                    <li key={expense.id} className="p-4 active:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${categoryInfo.color} text-white`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800 truncate">{expense.description}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            <span className="truncate">{expense.category}</span>
                            <span className="text-slate-300">•</span>
                            <span className="shrink-0">{formatDisplayDate(expense.date)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-left">
                          <p className="text-base font-semibold text-slate-800 whitespace-nowrap">
                            ₪{expense.amount.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="shrink-0 text-slate-400 hover:text-rose-500 active:bg-rose-50 p-2.5 rounded-lg transition-all"
                          title="מחק"
                          aria-label="מחק הוצאה"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">תיאור</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">סכום</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">קטגוריה</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">תאריך</th>
                      <th className="px-6 py-4 text-sm font-semibold text-slate-600">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthExpenses.map((expense) => {
                      const categoryInfo = getCategoryInfo(expense.category);
                      const IconComponent = categoryInfo.icon;

                      return (
                        <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-slate-800">{expense.description}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-lg font-semibold text-slate-800">
                              ₪{expense.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${categoryInfo.color} text-white`}>
                              <IconComponent className="w-4 h-4" />
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {formatDisplayDate(expense.date)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                              title="מחק"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Summary Footer */}
          {monthExpenses.length > 0 && (
            <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">סה"כ הוצאות:</span>
                <span className={`text-xl sm:text-2xl font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-800'}`}>
                  ₪{totalExpenses.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-slate-200 bg-white mt-8 sm:mt-12"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-slate-400">
            מנהל התקציב שלי - נהל את הכסף שלך בצורה חכמה
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
