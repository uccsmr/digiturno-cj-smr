-- ============================================================
-- DIGITURNO JURÍDICO UCC PREMIUM V2.1
-- Nombre + prioridad + direccionamiento a asesor jurídico + redirección entre asesores
-- Ejecutar en Supabase SQL Editor antes de subir/probar los archivos V2.1.
-- ============================================================

-- 1. Campo opcional para dirigir un turno de Asesoría Jurídica a un asesor específico.
alter table public.turnos
  add column if not exists id_asesor_destino uuid references public.perfiles(id_usuario);

comment on column public.turnos.id_asesor_destino is 'Asesor destino opcional. Si es NULL, el turno queda libre para cualquier asesor asignado al servicio.';

-- 2. Campo destino en transferencias para registrar redirecciones entre asesores.
alter table public.transferencias
  add column if not exists id_usuario_destino uuid references public.perfiles(id_usuario);

comment on column public.transferencias.id_usuario_destino is 'Usuario asesor destino de una redirección o transferencia.';

-- 3. Índices de apoyo para mejorar consultas del Panel Asesor y Pantalla TV.
create index if not exists idx_turnos_asesor_destino_estado
on public.turnos(id_asesor_destino, fecha, estado);

create index if not exists idx_turnos_fecha_estado_prioridad
on public.turnos(fecha, estado, prioridad desc, hora_generado asc);

-- 4. Función pública segura para listar asesores activos de Asesoría Jurídica.
-- Evita exponer toda la tabla perfiles al Kiosco anónimo.
create or replace function public.asesores_asesoria_juridica()
returns table(
  id_usuario uuid,
  nombre text,
  email text,
  nombre_punto text
)
language sql
security definer
set search_path = public
as $$
  select
    p.id_usuario,
    p.nombre,
    p.email,
    coalesce(pa.nombre_punto, 'Sin punto') as nombre_punto
  from public.perfiles p
  join public.usuario_servicio us on us.id_usuario = p.id_usuario
  join public.servicios s on s.id_servicio = us.id_servicio
  left join public.puntos_atencion pa on pa.id_punto = p.id_punto_atencion
  where p.rol = 'Asesor'
    and p.estado = 'Activo'
    and s.prefijo = 'ASE'
    and s.estado = 'Activo'
  order by p.nombre;
$$;

grant execute on function public.asesores_asesoria_juridica() to anon, authenticated;

-- 5. Función para generar turnos con nombre, prioridad y asesor destino opcional.
-- Si p_id_asesor_destino viene NULL, el turno queda disponible para cualquier asesor del servicio.
create or replace function public.generar_turno_cliente(
  p_id_servicio bigint,
  p_nombre_usuario text default null,
  p_prioridad integer default 0,
  p_id_asesor_destino uuid default null
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
  v_asesor_valido boolean;
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

  -- Solo Asesoría Jurídica permite destino opcional a asesor específico.
  if p_id_asesor_destino is not null then
    if upper(v_servicio.prefijo) <> 'ASE' then
      raise exception 'El direccionamiento a asesor específico solo aplica para Asesoría Jurídica';
    end if;

    select exists(
      select 1
      from public.perfiles p
      join public.usuario_servicio us on us.id_usuario = p.id_usuario
      where p.id_usuario = p_id_asesor_destino
        and p.rol = 'Asesor'
        and p.estado = 'Activo'
        and us.id_servicio = p_id_servicio
    ) into v_asesor_valido;

    if not v_asesor_valido then
      raise exception 'El asesor destino no está activo o no tiene asignado el servicio de Asesoría Jurídica';
    end if;
  end if;

  select coalesce(count(*),0) + 1 into v_consecutivo
  from public.turnos
  where id_servicio = p_id_servicio
    and fecha = current_date;

  v_codigo := v_servicio.prefijo || '-' || lpad(v_consecutivo::text, 3, '0');

  insert into public.turnos (
    codigo_turno,
    id_servicio,
    nombre_usuario,
    id_asesor_destino,
    estado,
    fecha,
    hora_generado,
    prioridad
  ) values (
    v_codigo,
    p_id_servicio,
    v_nombre,
    p_id_asesor_destino,
    'En espera',
    current_date,
    now(),
    v_prioridad
  ) returning * into v_turno;

  return v_turno;
end;
$$;

grant execute on function public.generar_turno_cliente(bigint, text, integer, uuid) to anon, authenticated;

-- 6. Compatibilidad con llamadas anteriores.
create or replace function public.generar_turno(p_id_servicio bigint)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.generar_turno_cliente(p_id_servicio, 'Usuario', 0, null);
end;
$$;

grant execute on function public.generar_turno(bigint) to anon, authenticated;

-- 7. RLS: mantener operación de turnos por asesor/admin y lectura pública para pantalla.
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

alter table public.turnos enable row level security;
alter table public.transferencias enable row level security;

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

drop policy if exists "turnos_update_asesor" on public.turnos;
create policy "turnos_update_asesor"
on public.turnos
for update
using (public.es_asesor())
with check (public.es_asesor());

drop policy if exists "transferencias_select" on public.transferencias;
create policy "transferencias_select"
on public.transferencias
for select
using (public.es_asesor());

drop policy if exists "transferencias_insert" on public.transferencias;
create policy "transferencias_insert"
on public.transferencias
for insert
with check (public.es_asesor());

-- 8. Verificación rápida.
select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'turnos'
  and column_name in ('nombre_usuario','prioridad','id_asesor_destino')
order by column_name;

select * from public.asesores_asesoria_juridica();
