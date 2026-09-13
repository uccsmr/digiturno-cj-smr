
-- ============================================================
-- DIGITURNO JURÍDICO UCC - MIGRACIÓN PREMIUM V2.0
-- Carrusel de imágenes + nombre del usuario en turno + prioridad real
-- Ejecutar en Supabase SQL Editor.
-- ============================================================

-- 1. Nuevos campos requeridos por la versión premium.
alter table public.turnos
  add column if not exists nombre_usuario text;

alter table public.configuracion
  add column if not exists imagenes_pantalla text;

comment on column public.turnos.nombre_usuario is 'Nombre visible del usuario/cliente que solicita el turno desde el kiosco.';
comment on column public.configuracion.imagenes_pantalla is 'Listado de imágenes del carrusel de la pantalla TV, una ruta o URL por línea.';

-- 2. Configuración inicial para carrusel de imágenes.
update public.configuracion
set
  imagenes_pantalla = coalesce(nullif(imagenes_pantalla, ''), 'assets/img/logo_ucc_horizontal.png
assets/img/logo_consultorio_juridico.png'),
  franja_inferior = coalesce(nullif(franja_inferior, ''), 'Consultorio Jurídico y Centro de Conciliación · Tome asiento y esté atento al llamado de su turno'),
  mensaje_pantalla = regexp_replace(coalesce(mensaje_pantalla, 'Bienvenido. Tome asiento y esté atento al llamado de su turno.'), '^(Bienvenido\.\s*)+', 'Bienvenido. ', 'i')
where id_configuracion = 1;

-- 3. Índices útiles para pantalla, asesor y reportes.
create index if not exists idx_turnos_fecha_prioridad_generado
on public.turnos(fecha, prioridad desc, hora_generado asc);

create index if not exists idx_turnos_nombre_usuario
on public.turnos(nombre_usuario);

-- 4. Nueva función para generar turno con nombre y prioridad.
create or replace function public.generar_turno_cliente(
  p_id_servicio bigint,
  p_nombre_usuario text default null,
  p_prioridad integer default 0
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_servicio public.servicios%rowtype;
  v_consecutivo integer;
  v_codigo text;
  v_turno public.turnos%rowtype;
  v_nombre text;
  v_prioridad integer;
begin
  select * into v_servicio
  from public.servicios
  where id_servicio = p_id_servicio
    and estado = 'Activo';

  if not found then
    raise exception 'Servicio no disponible';
  end if;

  v_nombre := nullif(trim(regexp_replace(coalesce(p_nombre_usuario, ''), '\s+', ' ', 'g')), '');
  if v_nombre is null then
    v_nombre := 'Usuario';
  end if;

  v_prioridad := case when coalesce(p_prioridad, 0) > 0 then 1 else 0 end;

  select coalesce(count(*),0) + 1 into v_consecutivo
  from public.turnos
  where id_servicio = p_id_servicio
    and fecha = current_date;

  v_codigo := v_servicio.prefijo || '-' || lpad(v_consecutivo::text, 3, '0');

  insert into public.turnos (
    codigo_turno,
    id_servicio,
    nombre_usuario,
    estado,
    fecha,
    hora_generado,
    prioridad
  )
  values (
    v_codigo,
    p_id_servicio,
    v_nombre,
    'En espera',
    current_date,
    now(),
    v_prioridad
  )
  returning * into v_turno;

  return v_turno;
end;
$$;

grant execute on function public.generar_turno_cliente(bigint, text, integer) to anon, authenticated;

-- 5. Actualizar función existente para que siga funcionando con nombre genérico.
create or replace function public.generar_turno(p_id_servicio bigint)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.generar_turno_cliente(p_id_servicio, 'Usuario', 0);
end;
$$;

grant execute on function public.generar_turno(bigint) to anon, authenticated;

-- 6. Políticas RLS necesarias para lectura de configuración, turnos y operación asesor.
alter table public.turnos enable row level security;
alter table public.configuracion enable row level security;

drop policy if exists "turnos_select" on public.turnos;
create policy "turnos_select"
on public.turnos
for select
using (true);

drop policy if exists "turnos_insert_public" on public.turnos;
create policy "turnos_insert_public"
on public.turnos
for insert
with check (true);

create or replace function public.es_asesor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.perfiles
      where id_usuario = auth.uid()
        and rol in ('Administrador', 'Asesor')
        and estado = 'Activo'
    ),
    false
  );
$$;

grant execute on function public.es_asesor() to anon, authenticated;

drop policy if exists "turnos_update_asesor" on public.turnos;
create policy "turnos_update_asesor"
on public.turnos
for update
using (public.es_asesor())
with check (public.es_asesor());

drop policy if exists "configuracion_select_public" on public.configuracion;
create policy "configuracion_select_public"
on public.configuracion
for select
using (true);

-- 7. Verificación rápida.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('turnos','configuracion')
  and column_name in ('nombre_usuario','imagenes_pantalla')
order by table_name, column_name;
