
-- Create budgets table
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create budget_items table
CREATE TABLE public.budget_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for budgets
CREATE POLICY "Owner full access on budgets"
  ON public.budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS policies for budget_items (via budget ownership)
CREATE POLICY "Owner access via budget"
  ON public.budget_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_items.budget_id AND budgets.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_items.budget_id AND budgets.user_id = auth.uid()));
