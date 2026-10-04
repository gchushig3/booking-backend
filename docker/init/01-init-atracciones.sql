CREATE TABLE IF NOT EXISTS atracciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre varchar(255) NOT NULL,
  descripcion text NOT NULL,
  ciudad varchar(100) NOT NULL,
  provincia varchar(100) NOT NULL DEFAULT '',
  region varchar(50) NOT NULL DEFAULT '',
  categoria varchar(80) NOT NULL DEFAULT 'Tours',
  imagenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  "precioBase" numeric(10, 2) NOT NULL DEFAULT 0,
  "cuposTotales" integer NOT NULL DEFAULT 30,
  "tipoExperienciaPermitidos" jsonb NOT NULL DEFAULT '["SINGLE_TICKET","GUIDED_TOUR","PACKAGE"]'::jsonb,
  "horariosDisponibles" jsonb NOT NULL DEFAULT '["08:00","10:00","14:00"]'::jsonb,
  price jsonb,
  operator jsonb,
  product_type varchar NOT NULL DEFAULT 'SINGLE_TICKET'
    CHECK (product_type IN ('SINGLE_TICKET', 'GUIDED_TOUR', 'PACKAGE')),
  categories jsonb,
  includes jsonb,
  supported_languages jsonb,
  badges jsonb,
  locations jsonb,
  photos jsonb,
  latitud numeric(10, 6) NOT NULL,
  longitud numeric(10, 6) NOT NULL,
  "precioTicket" numeric(10, 2) NOT NULL,
  "duracionHoras" integer NOT NULL,
  "estaActivo" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "deletedAt" timestamp
);

CREATE TABLE IF NOT EXISTS reservas_atracciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" uuid NOT NULL UNIQUE,
  "userId" uuid,
  date date NOT NULL,
  time varchar,
  ticket_count integer NOT NULL,
  customer_name varchar(150) NOT NULL,
  customer_email varchar(150),
  status varchar NOT NULL DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'PENDING', 'CANCELLED')),
  atraccion_id uuid NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "FK_reservas_atracciones_atraccion_id"
    FOREIGN KEY (atraccion_id) REFERENCES atracciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'USER',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000001',
  'Tour guiado al Parque Nacional Cotopaxi',
  'Excursión desde Latacunga con caminata al refugio José Rivas y vistas del volcán Cotopaxi.',
  'Latacunga',
  '{"currency":"USD","total":55.00}'::jsonb,
  '{"id":101,"name":"Andes Adventure Ecuador"}'::jsonb,
  'GUIDED_TOUR',
  '["naturaleza","aventura","montaña"]'::jsonb,
  '["Transporte","Guía bilingüe certificado","Almuerzo"]'::jsonb,
  '["es","en"]'::jsonb,
  '["naturaleza","aventura"]'::jsonb,
  '[{"address":"Parque Nacional Cotopaxi","city":0,"country":"ec","coordinates":{"latitude":-0.6838,"longitude":-78.4372},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -0.683800, -78.437200, 55.00, 8, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000002',
  'Mirador y senderos de la laguna de Quilotoa',
  'Acceso a los miradores y senderos de la laguna turquesa dentro del cráter de Quilotoa.',
  'Zumbahua',
  '{"currency":"USD","total":15.00}'::jsonb,
  '{"id":102,"name":"Quilotoa Community Tourism"}'::jsonb,
  'SINGLE_TICKET',
  '["naturaleza","fotografía"]'::jsonb,
  '["Ingreso al área protegida","Acceso a senderos"]'::jsonb,
  '["es"]'::jsonb,
  '["naturaleza"]'::jsonb,
  '[{"address":"Laguna de Quilotoa","city":0,"country":"ec","coordinates":{"latitude":-0.8591,"longitude":-78.9025},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -0.859100, -78.902500, 15.00, 4, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000003',
  'Ruta de cascadas y aventura en Baños',
  'Recorrido por la Ruta de las Cascadas con visita al Pailón del Diablo y paradas panorámicas.',
  'Baños de Agua Santa',
  '{"currency":"USD","total":48.00}'::jsonb,
  '{"id":103,"name":"Baños Adventure Tours"}'::jsonb,
  'PACKAGE',
  '["aventura","cascadas","naturaleza"]'::jsonb,
  '["Transporte local","Visita al Pailón del Diablo","Guía"]'::jsonb,
  '["es","en"]'::jsonb,
  '["aventura","popular"]'::jsonb,
  '[{"address":"Ruta de las Cascadas","city":0,"country":"ec","coordinates":{"latitude":-1.3964,"longitude":-78.4247},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -1.396400, -78.424700, 48.00, 8, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000004',
  'Excursión marina en las Islas Galápagos',
  'Navegación desde Santa Cruz con snorkel y observación responsable de fauna endémica.',
  'Puerto Ayora',
  '{"currency":"USD","total":180.00}'::jsonb,
  '{"id":104,"name":"Galapagos Marine Expeditions"}'::jsonb,
  'GUIDED_TOUR',
  '["naturaleza","fauna","mar"]'::jsonb,
  '["Navegación","Equipo de snorkel","Guía naturalista","Almuerzo"]'::jsonb,
  '["es","en"]'::jsonb,
  '["fauna","mar"]'::jsonb,
  '[{"address":"Puerto Ayora, Isla Santa Cruz","city":0,"country":"ec","coordinates":{"latitude":-0.7402,"longitude":-90.3134},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -0.740200, -90.313400, 180.00, 10, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000005',
  'Senderismo en el Parque Nacional Cajas',
  'Caminata guiada entre lagunas altoandinas, bosques de polylepis y paisajes del Parque Cajas.',
  'Cuenca',
  '{"currency":"USD","total":42.00}'::jsonb,
  '{"id":105,"name":"Cajas Highland Guides"}'::jsonb,
  'GUIDED_TOUR',
  '["naturaleza","senderismo","montaña"]'::jsonb,
  '["Transporte desde Cuenca","Guía","Refrigerio"]'::jsonb,
  '["es","en"]'::jsonb,
  '["senderismo","naturaleza"]'::jsonb,
  '[{"address":"Parque Nacional Cajas","city":0,"country":"ec","coordinates":{"latitude":-2.85,"longitude":-79.2},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -2.850000, -79.200000, 42.00, 7, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000006',
  'Avistamiento de aves y bosque nublado de Mindo',
  'Experiencia de naturaleza en el bosque nublado con caminata y observación de aves.',
  'Mindo',
  '{"currency":"USD","total":38.00}'::jsonb,
  '{"id":106,"name":"Mindo Cloud Forest Eco Tours"}'::jsonb,
  'GUIDED_TOUR',
  '["naturaleza","aves","ecoturismo"]'::jsonb,
  '["Guía local","Caminata interpretativa","Binoculares"]'::jsonb,
  '["es","en"]'::jsonb,
  '["ecoturismo","aves"]'::jsonb,
  '[{"address":"Bosque nublado de Mindo","city":0,"country":"ec","coordinates":{"latitude":-0.05,"longitude":-78.78},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -0.050000, -78.780000, 38.00, 5, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000007',
  'Paseo y observación de aves en Yahuarcocha',
  'Recorrido panorámico junto a la laguna Yahuarcocha y su entorno natural en Ibarra.',
  'Ibarra',
  '{"currency":"USD","total":20.00}'::jsonb,
  '{"id":107,"name":"Imbabura Travel Experiences"}'::jsonb,
  'SINGLE_TICKET',
  '["naturaleza","cultura","paisaje"]'::jsonb,
  '["Recorrido guiado","Paradas fotográficas"]'::jsonb,
  '["es"]'::jsonb,
  '["paisaje"]'::jsonb,
  '[{"address":"Laguna de Yahuarcocha","city":0,"country":"ec","coordinates":{"latitude":0.3667,"longitude":-78.0833},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  0.366700, -78.083300, 20.00, 3, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000008',
  'Lagunas de Mojanda y Fuya Fuya',
  'Ascenso guiado por el complejo lacustre de Mojanda con vistas panorámicas de los Andes.',
  'Otavalo',
  '{"currency":"USD","total":35.00}'::jsonb,
  '{"id":108,"name":"Otavalo Andean Guides"}'::jsonb,
  'GUIDED_TOUR',
  '["senderismo","naturaleza","montaña"]'::jsonb,
  '["Transporte desde Otavalo","Guía local"]'::jsonb,
  '["es","en"]'::jsonb,
  '["senderismo","montaña"]'::jsonb,
  '[{"address":"Lagunas de Mojanda","city":0,"country":"ec","coordinates":{"latitude":0.15,"longitude":-78.27},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  0.150000, -78.270000, 35.00, 6, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000009',
  'Tren del Hielo desde Riobamba',
  'Viaje ferroviario panorámico por paisajes andinos y comunidades de la provincia de Chimborazo.',
  'Riobamba',
  '{"currency":"USD","total":35.00}'::jsonb,
  '{"id":109,"name":"Tren Ecuador Experiences"}'::jsonb,
  'SINGLE_TICKET',
  '["cultura","paisaje","tren"]'::jsonb,
  '["Billete de tren","Asistencia a bordo"]'::jsonb,
  '["es","en"]'::jsonb,
  '["cultural","popular"]'::jsonb,
  '[{"address":"Estación del tren de Riobamba","city":0,"country":"ec","coordinates":{"latitude":-1.67,"longitude":-78.65},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -1.670000, -78.650000, 35.00, 6, true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO atracciones (
  id, nombre, descripcion, ciudad, price, operator, product_type,
  categories, includes, supported_languages, badges, locations, photos,
  latitud, longitud, "precioTicket", "duracionHoras", "estaActivo"
) VALUES (
  'a1000000-0000-4000-8000-000000000010',
  'Ruta de queserías y paisaje andino de Salinas de Guaranda',
  'Visita guiada a Salinas de Guaranda para conocer sus emprendimientos comunitarios y paisajes.',
  'Salinas de Guaranda',
  '{"currency":"USD","total":30.00}'::jsonb,
  '{"id":110,"name":"Salinerito Community Tours"}'::jsonb,
  'GUIDED_TOUR',
  '["cultura","gastronomía","comunidad"]'::jsonb,
  '["Visita a emprendimientos","Degustación","Guía local"]'::jsonb,
  '["es"]'::jsonb,
  '["comunitario","gastronomía"]'::jsonb,
  '[{"address":"Salinas de Guaranda","city":0,"country":"ec","coordinates":{"latitude":-1.4,"longitude":-79.0},"type":"attraction"}]'::jsonb,
  '[{"url":"https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80"}]'::jsonb,
  -1.400000, -79.000000, 30.00, 4, true
) ON CONFLICT (id) DO NOTHING;
