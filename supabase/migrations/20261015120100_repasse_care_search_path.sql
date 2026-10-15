-- Advisor function_search_path_mutable: fixa o search_path da função auxiliar do Repasse Care+.
alter function private.care_condition_from_stock(text) set search_path = public, private;
