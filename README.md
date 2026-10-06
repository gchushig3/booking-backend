# Booking Prototipo - Repositorio Plantilla

Esta es la plantilla base (API-First) para el desarrollo de los 4 dominios del sistema Booking Prototipo: Alojamientos, Autos, Atracciones y Vuelos. 

La arquitectura sigue los principios de Domain-Driven Design (DDD) y está preparada para una futura migración a Microservicios y Apollo Federation utilizando UUIDs y contratos estrictos documentados con Swagger.

## Instrucciones para los Equipos

1. **Clonar este repositorio** en su entorno local.
2. **Instalar dependencias necesarias**:

Ejecuta exactamente el siguiente comando en la raíz del proyecto para instalar las librerías base de NestJS, configuración, TypeORM, Swagger y validación:

```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config class-validator class-transformer @nestjs/swagger
```

3. **Configurar el entorno**:
- Copia el archivo `.env.example` y renómbralo a `.env`.
- Levanta la base de datos usando Docker: `docker-compose up -d`.

4. **Habilitar el Módulo Correspondiente**:
- Abre el archivo `src/app.module.ts`.
- Descomenta **ÚNICAMENTE** el módulo asignado a tu equipo (por ejemplo, si eres el equipo de Autos, descomenta `AutosModule`).

5. **Ejecutar el proyecto**:
- Inicia el proyecto en modo desarrollo con `npm run start:dev`.
- Podrás ver la documentación de tu API en: `http://localhost:3000/api/docs`.

¡Mucho éxito con el desarrollo del Reto!
# Checkout y base de datos

Las reservas realizadas por el checkout actual se confirman inmediatamente después de una respuesta SUCCESS del proveedor mock (`CONFIRMADA`). Este endpoint no crea reservas `PENDIENTE`. Un `PENDIENTE` heredado o creado por un flujo futuro retiene cupos y se cancela automáticamente al superar `PENDING_RESERVATION_TTL_MINUTES` (15 minutos por defecto); la expiración bloquea la reserva y el turno, y una transición previa a `CANCELADA` impide liberar cupos por segunda vez.

El mock puede forzar el rechazo para pruebas estableciendo `MOCK_PAYMENT_RESULT=FAILED`. El DTO solo acepta titular y últimos cuatro dígitos; cualquier número de tarjeta, CVV o dato de expiración se rechaza como campo no permitido. La transacción PostgreSQL no es una transacción distribuida con un proveedor externo real. Para PayPal/Stripe se debe implementar autorización/captura y una estrategia de compensación u outbox.

Configura `DATABASE_URL` en `.env` para PostgreSQL. Desde `booking-backend`:

```sh
npm run migration:run
npm run seed
npm test
npm run migration:smoke
```

`npm test` ejecuta unit tests y el test HTTP de integración de checkout/concurrencia contra PostgreSQL, crea datos temporales y los elimina. `migration:smoke` crea una base temporal vacía (la cuenta de `DATABASE_URL` debe tener permiso CREATEDB), aplica las migraciones y elimina esa base al finalizar.

Configura `CORS_ORIGIN` con una lista separada por comas de orígenes exactos en producción; sin configuración de producción no se permiten orígenes CORS. El backend usa throttling global, Helmet y `ValidationPipe` con `whitelist`, `forbidNonWhitelisted` y `transform`. Los eventos no contienen passwords, JWT, CVV ni números completos de tarjeta. El mock no procesa tarjetas reales y esto no constituye una certificación PCI-DSS.

Estados del dominio de reservas y del ENUM PostgreSQL: `PENDIENTE`, `CONFIRMADA`, `CANCELADA`. La migración de localización convierte los valores ingleses históricos. La ruta administrativa `GET /api/v1/admin/reservas` exige JWT con rol ADMIN. Los comentarios vinculan una reserva CONFIRMADA del propio usuario y cada reserva admite como máximo un comentario.
