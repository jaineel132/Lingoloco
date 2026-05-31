alter table public.profiles enable row level security;
alter table public.onboarding_profiles enable row level security;
alter table public.duel_notifications enable row level security;

create policy "profiles_select_own" on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "onboarding_select_own" on public.onboarding_profiles
for select
to authenticated
using ("userId" = auth.uid());

create policy "onboarding_insert_own" on public.onboarding_profiles
for insert
to authenticated
with check ("userId" = auth.uid());

create policy "onboarding_update_own" on public.onboarding_profiles
for update
to authenticated
using ("userId" = auth.uid())
with check ("userId" = auth.uid());

create policy "duel_notifications_select_own" on public.duel_notifications
for select
to authenticated
using ("userId" = auth.uid());

create policy "duel_notifications_insert_own" on public.duel_notifications
for insert
to authenticated
with check ("userId" = auth.uid());

create policy "duel_notifications_update_own" on public.duel_notifications
for update
to authenticated
using ("userId" = auth.uid())
with check ("userId" = auth.uid());
