-- Sequential, human-friendly sale number for easier control.
-- Oldest sale = #1, next = #2, ... and every new sale gets the next number.

CREATE SEQUENCE IF NOT EXISTS public.sales_sale_number_seq;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_number BIGINT;

-- Backfill existing rows in chronological order (oldest first).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY date ASC, created_at ASC, id ASC) AS rn
  FROM public.sales
)
UPDATE public.sales s
SET sale_number = ordered.rn
FROM ordered
WHERE s.id = ordered.id AND s.sale_number IS NULL;

-- Advance the sequence past the highest assigned number so new sales continue from there.
SELECT setval(
  'public.sales_sale_number_seq',
  COALESCE((SELECT MAX(sale_number) FROM public.sales), 0) + 1,
  false
);

-- New sales automatically receive the next number.
ALTER TABLE public.sales ALTER COLUMN sale_number SET DEFAULT nextval('public.sales_sale_number_seq');
ALTER SEQUENCE public.sales_sale_number_seq OWNED BY public.sales.sale_number;

ALTER TABLE public.sales ALTER COLUMN sale_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_sale_number_key ON public.sales(sale_number);
