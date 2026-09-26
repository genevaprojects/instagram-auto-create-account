-- Prior-year balances need their statement group so PY-only captions can be placed on the ETB
alter table public.py_balances add column fs_group text;
