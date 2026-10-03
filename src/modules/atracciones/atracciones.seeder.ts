import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductType } from './dto/create-atraccion.dto';
import { Atraccion } from './entities/atraccion.entity';

@Injectable()
export class AtraccionesSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(AtraccionesSeeder.name);

  constructor(
    @InjectRepository(Atraccion)
    private readonly atraccionRepository: Repository<Atraccion>,
  ) {}

  async onApplicationBootstrap() {
    // Solo se ejecuta en entorno de desarrollo/local
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    this.logger.log('🧹 Limpiando registros dependientes y tabla de atracciones antes de insertar datos de prueba...');
    await this.atraccionRepository.manager.query('TRUNCATE TABLE "reservas_atracciones" CASCADE;');
    await this.atraccionRepository.manager.query('TRUNCATE TABLE "atracciones" CASCADE;');

    this.logger.log('✅ Tabla de atracciones limpiada correctamente.');

    const atraccionesDePrueba: Partial<Atraccion>[] = [
      {
        nombre: 'Tour Guiado al Volcán Cotopaxi',
        descripcion: 'Recorrido completo por el Parque Nacional Cotopaxi con caminata hasta el refugio José Rivas.',
        ciudad: 'ec',
        product_type: ProductType.GUIDED_TOUR,
        price: { total: 55.0, currency: 'USD' },
        precioTicket: 55.0,
        operator: { id: 101, name: 'Andes Adventure Ecuador' },
        duracionHoras: 8,
        latitud: -0.6838,
        longitud: -78.4372,
        includes: ['Transporte privado', 'Guía bilingüe certificado', 'Almuerzo tradicional'],
        categories: ['Naturaleza', 'Aventura', 'Montaña'],
        supported_languages: ['es', 'en'],
        free_cancellation: true,
        estaActivo: true,
      },
      {
        nombre: 'Entrada a la Laguna de Quilotoa y Mirador',
        descripcion: 'Acceso directo a los miradores de cristal y senderos autoguiados de la cráter-laguna de Quilotoa.',
        ciudad: 'ec',
        product_type: ProductType.SINGLE_TICKET,
        price: { total: 15.0, currency: 'USD' },
        precioTicket: 15.0,
        operator: { id: 102, name: 'Comunidad Quilotoa Tourism' },
        duracionHoras: 4,
        latitud: -0.8591,
        longitud: -78.9025,
        includes: ['Ingreso al área protegida', 'Mapa digital de senderos'],
        categories: ['Naturaleza', 'Fotografía'],
        supported_languages: ['es'],
        free_cancellation: true,
        estaActivo: true,
      },
      {
        nombre: 'Combo Experiencia Completa Baños de Agua Santa',
        descripcion: 'Paquete especial que incluye la Ruta de las Cascadas, Pailón del Diablo y Columpio del Fin del Mundo.',
        ciudad: 'ec',
        product_type: ProductType.PACKAGE,
        price: { total: 85.0, currency: 'USD' },
        precioTicket: 85.0,
        operator: { id: 103, name: 'Baños Extreme Tours' },
        duracionHoras: 12,
        latitud: -1.3964,
        longitud: -78.4247,
        includes: ['Ruta de las Cascadas', 'Pailón del Diablo', 'Casa del Árbol', 'Almuerzo'],
        categories: ['Aventura', 'Paquetes', 'Cascadas'],
        supported_languages: ['es', 'en'],
        free_cancellation: false,
        estaActivo: true,
      },
      {
        nombre: 'Tour en Yate por las Islas Galápagos (Santa Cruz)',
        descripcion: 'Excursión marítima con snorkel y avistamiento de fauna endémica en la Isla Santa Cruz e islotes cercanos.',
        ciudad: 'ec',
        product_type: ProductType.GUIDED_TOUR,
        price: { total: 180.0, currency: 'USD' },
        precioTicket: 180.0,
        operator: { id: 104, name: 'Galapagos Marine Expeditions' },
        duracionHoras: 10,
        latitud: -0.7402,
        longitud: -90.3134,
        includes: ['Navegación en yate', 'Equipo de snorkel', 'Guía Naturalista del PNG', 'Snacks y almuerzo'],
        categories: ['Naturaleza', 'Fauna', 'Playa'],
        supported_languages: ['es', 'en'],
        free_cancellation: true,
        estaActivo: true,
      },
    ];

    await this.atraccionRepository.save(atraccionesDePrueba);
    this.logger.log('✅ Tabla de atracciones limpiada y seeder completado: 4 atracciones creadas exitosamente.');
  }
}