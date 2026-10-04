-- Cuenta de desarrollo para validar el acceso administrador.
-- Password: Admin123! (bcryptjs, cost 12)
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Booking Administrator',
  'admin@booking.com',
  '$2b$12$E4lK8r5cGFb0uKBHTn8eI.Hcqjrf7k/RJ3LSI3zCjVUT4O40Zv/iS',
  'ADMIN'
)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;
