-- Polo leaderboard schema. Run this in the Supabase SQL editor, then set
-- VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the app's environment.

create table if not exists players (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

create table if not exists game_stats (
  player_id uuid not null references players(id) on delete cascade,
  game_id text not null check (game_id in (
    'swatch','mix','echo','between','shift','tally',
    'form','tilt','chain','round','shapeshift','shapetally'
  )),
  points_total int not null default 0 check (points_total >= 0),
  streak_best int not null default 0 check (streak_best >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

create index if not exists game_stats_points_idx on game_stats (game_id, points_total desc);
create index if not exists game_stats_streak_idx on game_stats (game_id, streak_best desc);

alter table players enable row level security;
alter table game_stats enable row level security;

-- Public read for the boards; all writes go through the RPC below.
create policy "public read players" on players for select using (true);
create policy "public read stats" on game_stats for select using (true);

-- Server-side gatekeeper: clamps values, only lets totals grow, and is the
-- ONLY write path (runs as definer, so no insert/update policies needed).
create or replace function submit_score(
  p_player_id uuid,
  p_name text,
  p_game_id text,
  p_points_total int,
  p_streak_best int
) returns void
language plpgsql security definer as $$
begin
  if p_game_id not in (
    'swatch','mix','echo','between','shift','tally',
    'form','tilt','chain','round','shapeshift','shapetally'
  ) then
    raise exception 'bad game';
  end if;

  insert into players (id, name)
  values (p_player_id, left(trim(p_name), 24))
  on conflict (id) do update set name = excluded.name;

  insert into game_stats (player_id, game_id, points_total, streak_best, updated_at)
  values (
    p_player_id, p_game_id,
    least(greatest(p_points_total, 0), 10000000),
    least(greatest(p_streak_best, 0), 100000),
    now()
  )
  on conflict (player_id, game_id) do update set
    points_total = greatest(game_stats.points_total, excluded.points_total),
    streak_best = greatest(game_stats.streak_best, excluded.streak_best),
    updated_at = now();
end;
$$;

grant execute on function submit_score to anon;
