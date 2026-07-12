-- Setup de Supabase para guardar las tos consentidas.
-- Cómo usarlo: en tu proyecto de Supabase -> SQL Editor -> pega esto -> Run.
-- Luego, en Storage, crea un bucket PRIVADO llamado exactamente "coughs".

create table if not exists public.coughs (
    id           bigint generated always as identity primary key,
    created_at   timestamptz not null default now(),
    prediction   text        not null,          -- 'Negative' o 'Positive'
    probability  real        not null,          -- probabilidad estimada de COVID (0-1)
    consent      boolean     not null default true,
    genero       text,                          -- opcional
    edad         integer,                       -- opcional
    audio_path   text        not null           -- ruta del wav en el bucket 'coughs'
);

-- Dejo RLS activado por seguridad. El backend escribe con la SERVICE KEY, que
-- salta RLS, así que NO hacen falta políticas para que la app guarde datos.
-- Al no crear políticas de lectura, la tabla queda privada por defecto.
alter table public.coughs enable row level security;
