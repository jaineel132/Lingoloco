create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  "id" uuid primary key references auth.users(id) on delete cascade,
  "email" text not null unique,
  "name" text not null default 'Language Learner',
  "image" text default '',
  "targetLanguage" text not null default 'es',
  "level" text not null default 'Beginner',
  "xp" integer not null default 0,
  "streak" integer not null default 0,
  "dailyGoalMinutes" integer not null default 10,
  "dailyProgressMinutes" integer not null default 0,
  "dailyXpToday" integer not null default 0,
  "dailyScenariosToday" integer not null default 0,
  "lessonsCompleted" integer not null default 0,
  "totalTimeHours" numeric(10,2) not null default 0,
  "lastPracticeDateKey" text not null default '',
  "lastPracticeAt" timestamptz,
  "practiceCompletedSetKeys" text[] not null default '{}'::text[],
  "practiceCompletedSessionIds" integer[] not null default '{}'::integer[],
  "lastPracticeSessionId" integer,
  "lastPracticeSetId" integer,
  "lastPracticeSessionLabel" text not null default '',
  "lastPracticeSetLabel" text not null default '',
  "squadId" integer,
  "squadJoinedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.onboarding_profiles (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null unique references auth.users(id) on delete cascade,
  "courseId" text not null,
  "level" text not null,
  "commitment" integer not null,
  "remindersEnabled" boolean not null,
  "reminderTime" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.duel_notifications (
  "id" uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.profiles("id") on delete cascade,
  "senderEmail" text not null,
  "senderName" text not null,
  "senderImage" text not null default '',
  "senderTargetLanguage" text not null default '',
  "status" text not null default 'pending' check ("status" in ('pending', 'accepted', 'declined')),
  "createdAt" timestamptz not null default now(),
  "respondedAt" timestamptz
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists onboarding_profiles_set_updated_at on public.onboarding_profiles;
create trigger onboarding_profiles_set_updated_at
before update on public.onboarding_profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    "id",
    "email",
    "name",
    "image"
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), 'Language Learner'),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict ("id") do update set
    "email" = excluded."email",
    "name" = excluded."name",
    "image" = excluded."image";

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    "email" = new.email,
    "name" = coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), "name"),
    "image" = coalesce(new.raw_user_meta_data->>'avatar_url', "image"),
    "updatedAt" = now()
  where "id" = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_user_update();
