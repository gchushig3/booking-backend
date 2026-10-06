-- Run once on existing PostgreSQL deployments before using the relational booking API.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cedula_dni varchar(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_cedula_dni ON users(cedula_dni) WHERE cedula_dni IS NOT NULL;
UPDATE users SET role = 'CLIENTE' WHERE role = 'USER';
UPDATE users SET role = 'ADMIN' WHERE role = 'OPERATOR';
UPDATE users SET role = 'CLIENTE' WHERE role NOT IN ('CLIENTE', 'ADMIN');
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'CLIENTE';
CREATE TABLE IF NOT EXISTS disponibilidad_turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), atraccion_id uuid NOT NULL REFERENCES atracciones(id) ON DELETE CASCADE,
  fecha date NOT NULL, hora_inicio time NOT NULL, capacidad_total integer NOT NULL CHECK (capacidad_total >= 0),
  cupos_reservados integer NOT NULL DEFAULT 0 CHECK (cupos_reservados >= 0 AND cupos_reservados <= capacidad_total),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (atraccion_id, fecha, hora_inicio)
);
-- Preserve bookings already present before this capacity ledger is introduced.
INSERT INTO disponibilidad_turnos (atraccion_id, fecha, hora_inicio, capacidad_total, cupos_reservados)
SELECT r.atraccion_id, r.date, r.time::time, a."cuposTotales",
       LEAST(a."cuposTotales", SUM(r.ticket_count)::integer)
FROM reservas_atracciones r
JOIN atracciones a ON a.id = r.atraccion_id
WHERE r.time IS NOT NULL AND r.time <> '' AND r.status IN ('CONFIRMADA', 'PENDIENTE')
GROUP BY r.atraccion_id, r.date, r.time::time, a."cuposTotales"
ON CONFLICT (atraccion_id, fecha, hora_inicio) DO NOTHING;
CREATE TABLE IF NOT EXISTS paquetes_experiencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), atraccion_id uuid NOT NULL REFERENCES atracciones(id) ON DELETE CASCADE,
  tipo_experiencia varchar(30) NOT NULL CHECK (tipo_experiencia IN ('SINGLE_TICKET','GUIDED_TOUR','PACKAGE')),
  nombre_paquete varchar(100) NOT NULL, descripcion text, precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  min_participantes integer NOT NULL DEFAULT 1, max_participantes integer,
  politicas_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_atracciones_provincia ON atracciones(provincia);
CREATE INDEX IF NOT EXISTS idx_atracciones_region ON atracciones(region);
CREATE INDEX IF NOT EXISTS idx_atracciones_categoria ON atracciones(categoria);
CREATE INDEX IF NOT EXISTS idx_atracciones_nombre ON atracciones(nombre);
CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reserva_id uuid NOT NULL REFERENCES reservas_atracciones(id) ON DELETE CASCADE,
  metodo_pago varchar(20) NOT NULL CHECK (metodo_pago IN ('CREDIT_CARD','PAYPAL')),
  titular_tarjeta varchar(150), ultimos_cuatro_digitos varchar(4), monto_pagado numeric(10,2) NOT NULL CHECK (monto_pagado >= 0),
  transaccion_hash varchar(100) NOT NULL UNIQUE, fecha_pago timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), atraccion_id uuid NOT NULL REFERENCES atracciones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, puntuacion integer NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario text NOT NULL, fecha_creacion timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS observabilidad_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tipo_evento varchar(50) NOT NULL, endpoint_ruta varchar(200) NOT NULL,
  latencia_ms integer, user_id uuid, payload_json jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
