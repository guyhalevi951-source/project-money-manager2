/*
  # Budget Tracker Schema

  1. New Tables
    - `user_budget` - Stores the user's monthly budget limit
      - `id` (uuid, primary key)
      - `budget_amount` (decimal) - The total monthly budget amount
      - `month` (text) - The month in YYYY-MM format
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `expenses` - Individual expense entries
      - `id` (uuid, primary key)
      - `description` (text) - Description of the expense
      - `amount` (decimal) - Amount spent
      - `category` (text) - Category: אוכל, בריאות, בילויים, שכר דירה, אחר
      - `date` (date) - Date of the expense
      - `month` (text) - Month in YYYY-MM format for easy filtering
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own budget and expenses
*/

-- Create user_budget table
CREATE TABLE IF NOT EXISTS user_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_amount decimal(12,2) NOT NULL DEFAULT 0,
  month text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(user_id, month)
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount decimal(12,2) NOT NULL,
  category text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  month text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE user_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_budget
CREATE POLICY "Users can view own budget"
  ON user_budget FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget"
  ON user_budget FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget"
  ON user_budget FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget"
  ON user_budget FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for expenses
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses(user_id, month);
CREATE INDEX IF NOT EXISTS idx_budget_user_month ON user_budget(user_id, month);
