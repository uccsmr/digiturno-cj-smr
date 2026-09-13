-- Después de crear el usuario administrador en Supabase Authentication,
-- copie su UUID y reemplácelo aquí.

insert into public.perfiles (id_usuario, nombre, email, rol, estado)
values ('REEMPLACE_UUID_AUTH_USER', 'Administrador Digiturno', 'admin@digiturno.local', 'Administrador', 'Activo')
on conflict (id_usuario) do update set rol = 'Administrador', estado = 'Activo';
