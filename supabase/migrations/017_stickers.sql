-- GhostTalk: stickers et GIFs

create table public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sticker_packs_name_length check (char_length(name) <= 50)
);

create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.sticker_packs (id) on delete cascade,
  emoji text not null,
  image_url text not null,
  keywords text[],
  created_at timestamptz not null default now(),
  constraint stickers_emoji_length check (char_length(emoji) <= 10)
);

create index stickers_pack_idx on public.stickers (pack_id);
create index stickers_keywords_idx on public.stickers using gin (keywords);

-- RLS
alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;

create policy "Tout le monde peut voir les packs de stickers"
  on public.sticker_packs
  for select
  to authenticated
  using (true);

create policy "Tout le monde peut voir les stickers"
  on public.stickers
  for select
  to authenticated
  using (true);

grant select on public.sticker_packs to authenticated;
grant select on public.stickers to authenticated;

-- Insérer des stickers par défaut
insert into public.sticker_packs (name, description, is_official) values
  ('Émotions', 'Stickers d''émotions de base', true),
  ('Actions', 'Stickers d''actions', true),
  ('Fun', 'Stickers fun', true);

insert into public.stickers (pack_id, emoji, image_url, keywords) values
  -- Émotions
  ((select id from public.sticker_packs where name = 'Émotions'), '😀', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f600.svg', array['happy', 'smile', 'joy']),
  ((select id from public.sticker_packs where name = 'Émotions'), '😂', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f602.svg', array['laugh', 'lol', 'funny']),
  ((select id from public.sticker_packs where name = 'Émotions'), '😍', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f60d.svg', array['love', 'heart', 'eyes']),
  ((select id from public.sticker_packs where name = 'Émotions'), '🥰', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f970.svg', array['love', 'cute']),
  ((select id from public.sticker_packs where name = 'Émotions'), '😎', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f60e.svg', array['cool', 'sunglasses']),
  ((select id from public.sticker_packs where name = 'Émotions'), '🤔', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f914.svg', array['thinking', 'hmm']),
  ((select id from public.sticker_packs where name = 'Émotions'), '😢', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f622.svg', array['sad', 'cry']),
  ((select id from public.sticker_packs where name = 'Émotions'), '😡', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f621.svg', array['angry', 'mad']),
  -- Actions
  ((select id from public.sticker_packs where name = 'Actions'), '👍', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f44d.svg', array['thumbs', 'up', 'like']),
  ((select id from public.sticker_packs where name = 'Actions'), '👎', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f44e.svg', array['thumbs', 'down', 'dislike']),
  ((select id from public.sticker_packs where name = 'Actions'), '👏', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f44f.svg', array['clap', 'applause']),
  ((select id from public.sticker_packs where name = 'Actions'), '🙌', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f64c.svg', array['raise', 'hands']),
  ((select id from public.sticker_packs where name = 'Actions'), '✌️', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/270c.svg', array['peace', 'victory']),
  -- Fun
  ((select id from public.sticker_packs where name = 'Fun'), '🎉', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f389.svg', array['party', 'celebration']),
  ((select id from public.sticker_packs where name = 'Fun'), '🔥', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f525.svg', array['fire', 'hot']),
  ((select id from public.sticker_packs where name = 'Fun'), '⭐', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2b50.svg', array['star', 'favorite']),
  ((select id from public.sticker_packs where name = 'Fun'), '💯', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4af.svg', array['100', 'score']),
  ((select id from public.sticker_packs where name = 'Fun'), '🚀', 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f680.svg', array['rocket', 'launch']);
