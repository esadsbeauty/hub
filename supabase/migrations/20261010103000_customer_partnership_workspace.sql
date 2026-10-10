-- Partnership management without contract automation.
alter table public.customer_accounts
  add column if not exists drive_folder_url text,
  add column if not exists renewal_reminder_days integer not null default 30;
alter table public.customer_accounts
  drop constraint if exists customer_accounts_renewal_reminder_days_check;
alter table public.customer_accounts
  add constraint customer_accounts_renewal_reminder_days_check check (renewal_reminder_days between 0 and 365);
