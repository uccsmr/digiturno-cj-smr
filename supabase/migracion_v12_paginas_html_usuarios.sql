-- Digiturno Jurídico UCC · Migración V1.2
-- Objetivo: páginas HTML separadas, usuarios sin ingreso manual de UUID,
-- servicios/puntos de atención editables desde el panel y datos institucionales.

-- 1. Funciones de rol usadas por RLS.
create or replace function public.mi_rol()
returns text
language sql
security definer
set search_path = public
as $$
  select rol
  from public.perfiles
  where id_usuario = auth.uid()
    and estado = 'Activo'
  limit 1;
$$;

create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.mi_rol() = 'Administrador', false);
$$;

create or replace function public.es_asesor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(public.mi_rol() in ('Administrador','Asesor'), false);
$$;

grant execute on function public.mi_rol() to anon, authenticated;
grant execute on function public.es_admin() to anon, authenticated;
grant execute on function public.es_asesor() to anon, authenticated;

-- 2. Crear perfil automáticamente cuando se crea un usuario en Supabase Auth.
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (
    id_usuario,
    nombre,
    email,
    rol,
    estado
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    'Asesor',
    'Activo'
  )
  on conflict (id_usuario)
  do update set
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.crear_perfil_usuario();

-- 3. RLS para servicios y puntos de atención.
alter table public.servicios enable row level security;
alter table public.puntos_atencion enable row level security;
alter table public.perfiles enable row level security;
alter table public.usuario_servicio enable row level security;

drop policy if exists "servicios_select" on public.servicios;
create policy "servicios_select"
on public.servicios
for select
using (true);

drop policy if exists "servicios_admin_all" on public.servicios;
create policy "servicios_admin_all"
on public.servicios
for all
using (public.es_admin())
with check (public.es_admin());

drop policy if exists "puntos_select" on public.puntos_atencion;
drop policy if exists "puntos_select_public" on public.puntos_atencion;
create policy "puntos_select"
on public.puntos_atencion
for select
using (true);

drop policy if exists "puntos_admin_all" on public.puntos_atencion;
create policy "puntos_admin_all"
on public.puntos_atencion
for all
using (public.es_admin())
with check (public.es_admin());

drop policy if exists "perfiles_select" on public.perfiles;
create policy "perfiles_select"
on public.perfiles
for select
using (id_usuario = auth.uid() or public.es_admin());

drop policy if exists "perfiles_admin_all" on public.perfiles;
create policy "perfiles_admin_all"
on public.perfiles
for all
using (public.es_admin())
with check (public.es_admin());

drop policy if exists "usuario_servicio_select" on public.usuario_servicio;
create policy "usuario_servicio_select"
on public.usuario_servicio
for select
using (id_usuario = auth.uid() or public.es_admin());

drop policy if exists "usuario_servicio_admin_all" on public.usuario_servicio;
create policy "usuario_servicio_admin_all"
on public.usuario_servicio
for all
using (public.es_admin())
with check (public.es_admin());

-- 4. Reemplazar Bienestar por Derecho de Familia, si existe.
update public.servicios
set
  nombre_servicio = 'Derecho de Familia',
  prefijo = 'FAM',
  descripcion = 'Orientación jurídica en temas de familia, alimentos, custodia, visitas, unión marital, divorcio y asuntos relacionados.',
  color = '#7C3AED',
  estado = 'Activo',
  prioridad = 1
where nombre_servicio ilike 'Bienestar'
   or prefijo = 'BIE';

-- 5. Insertar servicios jurídicos base sin duplicarlos.
insert into public.servicios (nombre_servicio, prefijo, descripcion, color, estado, prioridad)
select *
from (
  values
    ('Asesoría Jurídica', 'ASE', 'Orientación jurídica inicial para usuarios del consultorio jurídico.', '#0A84FF', 'Activo', 1),
    ('Conciliación', 'CON', 'Solicitud, orientación o programación relacionada con conciliación.', '#00B894', 'Activo', 1),
    ('Radicación de Documentos', 'RAD', 'Recepción y radicación de documentos o solicitudes.', '#FF9500', 'Activo', 1),
    ('Información y Orientación', 'INF', 'Información general, direccionamiento y orientación inicial al usuario.', '#00ACC9', 'Activo', 1),
    ('Derecho de Familia', 'FAM', 'Orientación jurídica en temas de familia, alimentos, custodia, visitas, unión marital, divorcio y asuntos relacionados.', '#7C3AED', 'Activo', 1)
) as nuevos(nombre_servicio, prefijo, descripcion, color, estado, prioridad)
where not exists (
  select 1 from public.servicios s where s.prefijo = nuevos.prefijo
);

-- 6. Insertar puntos de atención base sin duplicarlos.
insert into public.puntos_atencion (nombre_punto, descripcion, estado)
select *
from (
  values
    ('Módulo 1', 'Atención principal del Consultorio Jurídico.', 'Activo'),
    ('Módulo 2', 'Atención secundaria para asesoría jurídica.', 'Activo'),
    ('Consultorio 1', 'Espacio de atención personalizada para usuarios.', 'Activo'),
    ('Consultorio 2', 'Espacio de atención jurídica y orientación especializada.', 'Activo'),
    ('Centro de Conciliación', 'Punto de atención para solicitudes y procesos de conciliación.', 'Activo')
) as nuevos(nombre_punto, descripcion, estado)
where not exists (
  select 1 from public.puntos_atencion p where lower(p.nombre_punto) = lower(nuevos.nombre_punto)
);

-- 7. Realtime seguro si ya estaba agregado.
do $$
begin
  begin
    alter publication supabase_realtime add table public.turnos;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.configuracion;
  exception when duplicate_object then null;
  end;
end $$;
