import { NestFactory } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../app.module';
import { Atraccion } from '../../modules/atracciones/entities/atraccion.entity';
import { ProductType } from '../../modules/atracciones/dto/create-atraccion.dto';

type SeedPlace = {
  nombre: string; ciudad: string; provincia: string; region: string; categoria: string;
  descripcion: string; latitud: number; longitud: number; precio: number; cupos: number;
  imagen: string; duracion: number; producto: ProductType;
};

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;
// Referencias oficiales de ubicación y contexto turístico:
// https://ecuador.travel/quito-guayaquil-y-cuenca-ciudades-de-contrastes/
// https://ecuador.travel/mindo-un-tesoro-natural/
// https://onlyin.ecuador.travel/es/andes/
// https://www.ambiente.gob.ec/wp-content/uploads/downloads/2019/03/PARQUE-NACIONAL-MACHALILLA1.pdf
// https://galapagos.gob.ec/los-sitios-de-visita-de-galapagos-registraron-gran-movimiento-en-el-feriado/
// Prices, capacity allocations, and sample daily slots below are initial catalog defaults,
// not official tariffs or park-authority visitor limits.
const places: SeedPlace[] = [
  { nombre: 'Centro Histórico de Quito', ciudad: 'Quito', provincia: 'Pichincha', region: 'Sierra', categoria: 'Museos y cultura', descripcion: 'Recorrido por plazas, iglesias y calles patrimoniales del centro histórico de Quito, declarado Patrimonio Mundial por la UNESCO.', latitud: -0.2202, longitud: -78.5123, precio: 18, cupos: 30, imagen: img('photo-1519501025264-65ba15a82390'), duracion: 3, producto: ProductType.GUIDED_TOUR },
  { nombre: 'TelefériQo de Quito', ciudad: 'Quito', provincia: 'Pichincha', region: 'Sierra', categoria: 'Naturaleza y aire libre', descripcion: 'Ascenso desde Quito hacia las laderas del volcán Pichincha para disfrutar de senderos y vistas panorámicas de los Andes.', latitud: -0.1857, longitud: -78.5169, precio: 9, cupos: 50, imagen: img('photo-1464822759023-fed622ff2c3b'), duracion: 3, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Bosque Nublado de Mindo', ciudad: 'Mindo', provincia: 'Pichincha', region: 'Sierra', categoria: 'Tours', descripcion: 'Experiencia guiada en el bosque nublado de Mindo, conocido por su biodiversidad, observación de aves y rutas de naturaleza.', latitud: -0.0511, longitud: -78.7775, precio: 38, cupos: 25, imagen: img('photo-1448375240586-882707db888b'), duracion: 5, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Parque Nacional Cajas', ciudad: 'Cuenca', provincia: 'Azuay', region: 'Sierra', categoria: 'Naturaleza y aire libre', descripcion: 'Caminata entre lagunas altoandinas, páramo y bosques de polylepis en el área protegida del Parque Nacional Cajas.', latitud: -2.8500, longitud: -79.2000, precio: 42, cupos: 25, imagen: img('photo-1470770841072-f978cf4d019e'), duracion: 7, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Centro Histórico de Cuenca', ciudad: 'Cuenca', provincia: 'Azuay', region: 'Sierra', categoria: 'Museos y cultura', descripcion: 'Paseo por el centro histórico de Cuenca, sus plazas, arquitectura republicana y edificios patrimoniales junto al río Tomebamba.', latitud: -2.9001, longitud: -79.0059, precio: 15, cupos: 30, imagen: img('photo-1564399579883-451a5d44ec08'), duracion: 3, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Laguna de Cuicocha', ciudad: 'Cotacachi', provincia: 'Imbabura', region: 'Sierra', categoria: 'Naturaleza y aire libre', descripcion: 'Visita a la laguna de origen volcánico situada en la caldera del volcán Cotacachi, con miradores y senderos de altura.', latitud: 0.3040, longitud: -78.3650, precio: 12, cupos: 30, imagen: img('photo-1470770841072-f978cf4d019e'), duracion: 4, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Parque Nacional Cotopaxi', ciudad: 'Latacunga', provincia: 'Cotopaxi', region: 'Sierra', categoria: 'Naturaleza y aire libre', descripcion: 'Excursión por el paisaje de páramo del Parque Nacional Cotopaxi, con visita a miradores y rutas autorizadas del área protegida.', latitud: -0.6838, longitud: -78.4372, precio: 55, cupos: 25, imagen: img('photo-1464822759023-fed622ff2c3b'), duracion: 8, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Reserva de Producción de Fauna Chimborazo', ciudad: 'Riobamba', provincia: 'Chimborazo', region: 'Sierra', categoria: 'Naturaleza y aire libre', descripcion: 'Recorrido de alta montaña por la reserva que protege los ecosistemas del volcán Chimborazo y poblaciones de vicuña.', latitud: -1.4693, longitud: -78.8170, precio: 35, cupos: 25, imagen: img('photo-1464822759023-fed622ff2c3b'), duracion: 6, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Malecón 2000', ciudad: 'Guayaquil', provincia: 'Guayas', region: 'Costa', categoria: 'Tours', descripcion: 'Paseo urbano junto al río Guayas con jardines, plazas, monumentos, espacios culturales y opciones recreativas en el centro de Guayaquil.', latitud: -2.1900, longitud: -79.8800, precio: 0, cupos: 50, imagen: img('photo-1519501025264-65ba15a82390'), duracion: 2, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Parque Histórico Guayaquil', ciudad: 'Samborondón', provincia: 'Guayas', region: 'Costa', categoria: 'Museos y cultura', descripcion: 'Espacio de patrimonio, naturaleza y cultura que presenta arquitectura tradicional, jardines y fauna de la región litoral.', latitud: -2.1455, longitud: -79.8690, precio: 5, cupos: 30, imagen: img('photo-1448375240586-882707db888b'), duracion: 3, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Playa Los Frailes', ciudad: 'Machalilla', provincia: 'Manabí', region: 'Costa', categoria: 'Naturaleza y aire libre', descripcion: 'Visita a una de las playas del Parque Nacional Machalilla, con paisaje costero protegido, senderos y miradores.', latitud: -1.4850, longitud: -80.7900, precio: 10, cupos: 30, imagen: img('photo-1507525428034-b723cf961d3e'), duracion: 4, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Puerto López y avistamiento de fauna marina', ciudad: 'Puerto López', provincia: 'Manabí', region: 'Costa', categoria: 'Tours', descripcion: 'Salida turística desde Puerto López para conocer la costa de Machalilla y observar fauna marina de forma responsable.', latitud: -1.5570, longitud: -80.8090, precio: 45, cupos: 25, imagen: img('photo-1500375592092-40eb2168fd21'), duracion: 5, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Playa de Atacames', ciudad: 'Atacames', provincia: 'Esmeraldas', region: 'Costa', categoria: 'Naturaleza y aire libre', descripcion: 'Experiencia de playa en Atacames, con paseo por el litoral esmeraldeño y actividades recreativas junto al Pacífico.', latitud: 0.8680, longitud: -79.8450, precio: 12, cupos: 30, imagen: img('photo-1507525428034-b723cf961d3e'), duracion: 3, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Playa de Mompiche', ciudad: 'Mompiche', provincia: 'Esmeraldas', region: 'Costa', categoria: 'Naturaleza y aire libre', descripcion: 'Recorrido por la playa y el entorno natural de Mompiche, destino costero reconocido por su paisaje tropical y olas del Pacífico.', latitud: 0.4990, longitud: -80.0200, precio: 15, cupos: 30, imagen: img('photo-1500375592092-40eb2168fd21'), duracion: 3, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Malecón de Salinas', ciudad: 'Salinas', provincia: 'Santa Elena', region: 'Costa', categoria: 'Tours', descripcion: 'Paseo por el malecón y las playas de Salinas, con vistas de la bahía y acceso a servicios turísticos del balneario.', latitud: -2.2067, longitud: -80.9650, precio: 10, cupos: 50, imagen: img('photo-1507525428034-b723cf961d3e'), duracion: 2, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Montañita y su costa', ciudad: 'Montañita', provincia: 'Santa Elena', region: 'Costa', categoria: 'Tours', descripcion: 'Paseo por Montañita y su costa, conocida por sus playas, ambiente cultural y actividades recreativas junto al mar.', latitud: -1.8260, longitud: -80.7520, precio: 18, cupos: 30, imagen: img('photo-1500375592092-40eb2168fd21'), duracion: 3, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Parque Nacional Yasuní', ciudad: 'El Coca', provincia: 'Orellana', region: 'Amazonía', categoria: 'Naturaleza y aire libre', descripcion: 'Experiencia de naturaleza amazónica en el entorno del Parque Nacional Yasuní, reserva de extraordinaria biodiversidad y territorio de pueblos indígenas.', latitud: -0.6750, longitud: -76.4000, precio: 120, cupos: 20, imagen: img('photo-1448375240586-882707db888b'), duracion: 10, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Puerto Misahuallí', ciudad: 'Misahuallí', provincia: 'Napo', region: 'Amazonía', categoria: 'Tours', descripcion: 'Recorrido por la comunidad ribereña de Misahuallí y su entorno de selva tropical, junto al río Napo.', latitud: -1.0330, longitud: -77.6670, precio: 35, cupos: 25, imagen: img('photo-1448375240586-882707db888b'), duracion: 5, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Cavernas de Jumandy', ciudad: 'Archidona', provincia: 'Napo', region: 'Amazonía', categoria: 'Naturaleza y aire libre', descripcion: 'Visita guiada a las formaciones y galerías de las cavernas de Jumandy, en el entorno tropical de Archidona.', latitud: -0.9080, longitud: -77.8010, precio: 15, cupos: 25, imagen: img('photo-1448375240586-882707db888b'), duracion: 3, producto: ProductType.GUIDED_TOUR },
  { nombre: 'Puyo y su entorno amazónico', ciudad: 'Puyo', provincia: 'Pastaza', region: 'Amazonía', categoria: 'Tours', descripcion: 'Recorrido cultural y de naturaleza desde Puyo para conocer paisajes, ríos y emprendimientos turísticos de la provincia de Pastaza.', latitud: -1.4920, longitud: -78.0020, precio: 30, cupos: 25, imagen: img('photo-1448375240586-882707db888b'), duracion: 5, producto: ProductType.GUIDED_TOUR },
  // Baños y el Pailón del Diablo están en Tungurahua (Sierra), no en Pastaza.
  { nombre: 'Pailón del Diablo, Ruta de las Cascadas', ciudad: 'Baños de Agua Santa', provincia: 'Tungurahua', region: 'Sierra', categoria: 'Naturaleza y aire libre', descripcion: 'Excursión a la cascada Pailón del Diablo por la Ruta de las Cascadas, en el cantón Baños de Agua Santa.', latitud: -1.3964, longitud: -78.4247, precio: 12, cupos: 30, imagen: img('photo-1432405972618-c60b0225b8f9'), duracion: 4, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Estación Científica Charles Darwin', ciudad: 'Puerto Ayora, isla Santa Cruz', provincia: 'Galápagos', region: 'Galápagos', categoria: 'Museos y cultura', descripcion: 'Visita a la estación científica y centro de interpretación dedicado a la conservación y conocimiento de la biodiversidad de Galápagos.', latitud: -0.7420, longitud: -90.3130, precio: 0, cupos: 30, imagen: img('photo-1564399579883-451a5d44ec08'), duracion: 2, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Playa Tortuga Bay', ciudad: 'Puerto Ayora, isla Santa Cruz', provincia: 'Galápagos', region: 'Galápagos', categoria: 'Naturaleza y aire libre', descripcion: 'Sendero de acceso a Tortuga Bay, playa de arena blanca y hábitat costero protegido de la isla Santa Cruz.', latitud: -0.7580, longitud: -90.3360, precio: 0, cupos: 30, imagen: img('photo-1507525428034-b723cf961d3e'), duracion: 4, producto: ProductType.SINGLE_TICKET },
  { nombre: 'Centro de Interpretación de San Cristóbal', ciudad: 'Puerto Baquerizo Moreno, isla San Cristóbal', provincia: 'Galápagos', region: 'Galápagos', categoria: 'Museos y cultura', descripcion: 'Exposición interpretativa sobre la historia natural, humana y los esfuerzos de conservación de las islas Galápagos.', latitud: -0.9010, longitud: -89.6100, precio: 0, cupos: 30, imagen: img('photo-1564399579883-451a5d44ec08'), duracion: 2, producto: ProductType.SINGLE_TICKET },
];

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const repository = app.get(DataSource).getRepository(Atraccion);
    await repository.query(`
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS provincia varchar(100) NOT NULL DEFAULT '';
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS region varchar(50) NOT NULL DEFAULT '';
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS categoria varchar(80) NOT NULL DEFAULT 'Tours';
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS "precioBase" numeric(10,2) NOT NULL DEFAULT 0;
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS "cuposTotales" integer NOT NULL DEFAULT 30;
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS "tipoExperienciaPermitidos" jsonb NOT NULL DEFAULT '["SINGLE_TICKET","GUIDED_TOUR","PACKAGE"]'::jsonb;
      ALTER TABLE atracciones ADD COLUMN IF NOT EXISTS "horariosDisponibles" jsonb NOT NULL DEFAULT '["08:00","10:00","14:00"]'::jsonb;
    `);

    for (const place of places) {
      const current = await repository.findOne({ where: { nombre: place.nombre, ciudad: place.ciudad } });
      const picture = { url: place.imagen };
      const record = repository.create({
        ...(current ? { id: current.id } : {}),
        nombre: place.nombre, descripcion: place.descripcion, ciudad: place.ciudad,
        provincia: place.provincia, region: place.region, categoria: place.categoria,
        categories: [place.categoria], imagenes: [picture], photos: [picture],
        latitud: place.latitud, longitud: place.longitud,
        precioBase: place.precio, precioTicket: place.precio,
        price: { currency: 'USD', total: place.precio },
        cuposTotales: place.cupos,
        tipoExperienciaPermitidos: Object.values(ProductType),
        horariosDisponibles: ['08:00', '10:00', '14:00'],
        product_type: place.producto,
        package_prices: null,
        operator: { id: 900, name: 'Operador turístico local' },
        includes: ['Experiencia según disponibilidad local'],
        supported_languages: ['es', 'en'], badges: [],
        locations: [{ address: place.nombre, city: place.ciudad, country: 'ec', coordinates: { latitude: place.latitud, longitude: place.longitud }, type: 'attraction' }],
        duracionHoras: place.duracion, estaActivo: true,
      });
      await repository.save(record);
    }
    console.log(`Seed completado: ${places.length} atracciones creadas o actualizadas.`);
  } finally {
    await app.close();
  }
}

void seed().catch((error: unknown) => {
  console.error('Falló el seed turístico:', error);
  process.exitCode = 1;
});
