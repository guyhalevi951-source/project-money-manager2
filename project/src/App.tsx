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
  X
} from 'lucide-react';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface Category {
  value: string;
  label: string;
  icon: typeof Utensils;
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

// Color palette cycled through when assigning a look to user-created categories
const CUSTOM_COLORS = [
  'bg-indigo-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-lime-600',
  'bg-fuchsia-500',
  'bg-sky-500',
  'bg-red-500',
];

function App() {
  const [budget, setBudget] = useState<number>(0);
  const [budgetInput, setBudgetInput] = useState<string>('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'אוכל',
  });
  const [showBudgetSaved, setShowBudgetSaved] = useState(false);

  // Custom (user-created) categories, persisted separately from the built-in ones.
  // Icon components can't be serialized, so we store only value/label/color.
  const [customCategories, setCustomCategories] = useState<
    { value: string; label: string; color: string }[]
  >([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

  // The full list of selectable categories: built-ins + user-created.
  const allCategories: Category[] = [
    ...CATEGORIES,
    ...customCategories.map((c) => ({ ...c, icon: Tag })),
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
      setExpenses(JSON.parse(savedExpenses));
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
      const expense: Expense = {
        id: Date.now().toString(),
        description: newExpense.description.trim(),
        amount: amount,
        category: newExpense.category,
        date: new Date().toLocaleDateString('he-IL'),
      };

      setExpenses([expense, ...expenses]);
      setNewExpense({ description: '', amount: '', category: 'אוכל' });
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

    const color = CUSTOM_COLORS[customCategories.length % CUSTOM_COLORS.length];
    setCustomCategories([...customCategories, { value: name, label: name, color }]);
    setNewExpense({ ...newExpense, category: name });
    setNewCategoryName('');
    setCategoryError('');
    setIsAddingCategory(false);
  };

  // Cancel the add-category flow without creating anything.
  const handleCancelAddCategory = () => {
    setIsAddingCategory(false);
    setNewCategoryName('');
    setCategoryError('');
  };

  // Calculate total expenses
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
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
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl shadow-lg">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">מנהל התקציב שלי</h1>
                <p className="text-slate-500 text-sm">נהל את ההוצאות שלך בצורה חכמה</p>
              </div>
            </div>
            <div className="text-sm text-slate-400">
              {new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Budget Setter */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">הגדר תקציב חודשי</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                סכום התקציב (₪)
              </label>
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder={budget > 0 ? `נוכחי: ₪${budget.toLocaleString()}` : 'הזן סכום'}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-lg"
                min="0"
                step="100"
              />
            </div>
            <button
              onClick={handleSetBudget}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Budget Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">תקציב חודשי</span>
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-800">₪{budget.toLocaleString()}</p>
            <p className="text-sm text-slate-400 mt-2">הסכום שהוקצב להוצאות</p>
          </div>

          {/* Total Expenses Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">סה"כ הוצאות</span>
              <div className="bg-rose-100 p-2 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-600" />
              </div>
            </div>
            <p className={`text-3xl font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-800'}`}>
              ₪{totalExpenses.toLocaleString()}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              {expenses.length} הוצאות החודש
            </p>
          </div>

          {/* Budget Status Card */}
          <div className={`rounded-2xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
            isOverBudget
              ? 'bg-rose-50 border-rose-200'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" />
            הוסף הוצאה חדשה
          </h2>

          <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">תיאור</label>
              <input
                type="text"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="לדוגמה: סופר, דלק"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">סכום (₪)</label>
              <input
                type="number"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">קטגוריה</label>
              <select
                value={newExpense.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all bg-white"
              >
                {allCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
                <option value={ADD_CUSTOM_VALUE}>+ הוסף קטגוריה חדשה</option>
              </select>

              {isAddingCategory && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
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
                      placeholder="שם הקטגוריה"
                      autoFocus
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      הוסף
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddCategory}
                      className="shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                      title="ביטול"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {categoryError && (
                    <p className="text-rose-500 text-xs mt-2">{categoryError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                הוסף הוצאה
              </button>
            </div>
          </form>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-700">רשימת ההוצאות</h2>
            <p className="text-sm text-slate-400 mt-1">{expenses.length} הוצאות רשומות</p>
          </div>

          {expenses.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingDown className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 text-lg">אין הוצאות רשומות</p>
              <p className="text-slate-400 text-sm mt-1">הוסף את ההוצאה הראשונה שלך</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {expenses.map((expense) => {
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
                          {expense.date}
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
          )}

          {/* Summary Footer */}
          {expenses.length > 0 && (
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">סה"כ הוצאות:</span>
                <span className={`text-2xl font-bold ${isOverBudget ? 'text-rose-600' : 'text-slate-800'}`}>
                  ₪{totalExpenses.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
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
