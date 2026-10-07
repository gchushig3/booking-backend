# Diseño API-first y preparación para futura integración

## Alcance y arquitectura existente

La evidencia API-first de este proyecto es un contrato HTTP explícito que permite consumir el backend sin depender de las pantallas Angular. No se afirma que el contrato se haya diseñado antes de todo el código: OpenAPI se genera a partir de los controllers y DTOs implementados y se verifica contra las rutas realmente montadas.

El consumidor actual es Angular; el backend es un **monolito modular NestJS**, con AuthModule, AtraccionesModule y ObservabilidadModule montados en AppModule. PostgreSQL se accede mediante TypeORM detrás del backend. No hay microservicios, Kafka ni RabbitMQ en esta arquitectura.

El flujo real es: Angular → HTTP `/api/v1` → controllers/DTOs/guards → servicios de negocio → TypeORM/PostgreSQL. SSE utiliza una respuesta HTTP persistente del backend hacia el dashboard ADMIN.

## Evidencia verificable

| EVIDENCIA | IMPLEMENTACIÓN |
|---|---|
| Versionado API | `booking-backend/src/main.ts`: `app.setGlobalPrefix('api/v1')`. |
| Consumidor actual | Angular; `booking-frontend/src/app/services/atracciones.service.ts` utiliza HttpClient. |
| Separación Angular ↔ NestJS | Token `API_URL` en `booking-frontend/src/app/core/api.config.ts`; environments configuran `/api/v1` o `http://localhost:3000/api/v1`. Angular consume recursos HTTP, sin acceso directo a PostgreSQL. |
| DTOs de entrada | `LoginDto`, `GetAtraccionesFilterDto`, `ReservationRequestDto`, `CancelReservationRequestDto`, `CreateComentarioDto`, `BrowserBatchDto`, entre otros. |
| Contratos de respuesta | `AuthResponseDto`, `AtraccionesListResponseDto`, `AvailabilityResponseDto`, `ReservationResponseDto`, `ComentarioResponseDto` y DTOs de telemetría; nombres contrastados con OpenAPI. |
| Validación | ValidationPipe global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`; class-validator/class-transformer en DTOs y validaciones adicionales en servicios. |
| Contrato publicado | `booking-backend/src/swagger.config.ts`; Swagger UI `/api/docs`, JSON `/api/docs-json`, YAML `/api/docs-yaml`. |
| Contrato exportado | `booking-backend/contracts/openapi.json` y `atracciones-openapi.yaml`; el archivo YAML contiene las APIs montadas, pese a su nombre histórico. |
| Verificación de contrato | `booking-backend/test/swagger-openapi.test.cjs` compara metadatos Nest, rutas Express y operaciones OpenAPI; valida métodos, seguridad y headers de idempotencia. |
| Autenticación | JwtStrategy, JwtAuthGuard y Bearer `JWT-auth` en OpenAPI. |
| Autorización | RolesGuard y `@Roles('ADMIN')`; rol CLIENTE/ADMIN; comprobación de propiedad de reservas en AtraccionesService. |
| Idempotencia | Header `X-Idempotency-Key`, fingerprint de checkout y UNIQUE de `idempotency_key`; cancelación protegida por estado/locks. |
| Autoridad de negocio | AtraccionesService y PricingService obtienen paquete/políticas/capacidad de PostgreSQL y calculan precio/cupos. |
| Persistencia | PostgreSQL, TypeORM, migraciones; `synchronize: false` en AppModule y DataSource. |
| Extensión de pagos | PaymentProvider, token PAYMENT_PROVIDER y PaymentService; proveedor conectado actualmente: MockPaymentProvider. |
| Consumidores futuros | Móvil, marketplace u operador podrían consumir el contrato HTTP; no existen integraciones implementadas con ellos. |

## Versionado y desacoplamiento

Las rutas de negocio se publican bajo `/api/v1`. `/api/docs` y sus variantes JSON/YAML son rutas de documentación, fuera de ese prefijo de negocio. El `info.version` de Swagger es `1.0`; no representa una segunda API desplegada.

Angular configura la dirección del backend mediante API_URL y utiliza servicios HTTP para catálogo, autenticación, reservas y telemetría. `auth.interceptor.ts` añade Authorization Bearer únicamente a peticiones dirigidas a la API configurada. Los componentes no acceden a entidades TypeORM ni a tablas. Esto evidencia separación por HTTP aunque el repositorio contenga ambos proyectos.

El prefijo permite identificar la versión actual; no se afirma que exista `/api/v2`, negociación de versiones o una política de compatibilidad automatizada. Un cambio incompatible futuro requiere definir su evolución y mantener o migrar consumidores explícitamente.

## DTOs, validación y respuestas

Los controllers reciben DTOs y publican schemas de entrada/salida mediante decoradores Swagger. Los DTOs describen campos requeridos/opcionales, UUID, enums, arrays, fechas y objetos anidados. La validación real combina decoradores y servicios: por ejemplo, `date` de ReservationRequestDto tiene `IsString`, mientras el servicio verifica el formato y la fecha; no debe atribuirse toda validación al schema OpenAPI.

El pipe global rechaza propiedades desconocidas en cuerpos validados. Los contratos de salida separan la representación HTTP de las entidades: `ReservationResponseDto` expone `reservation_id`, `total_price` y participantes, no una serialización arbitraria de la tabla. La documentación de OpenAPI representa el contrato implementado y constituye la referencia consultable para consumidores.

## Operaciones reales y ejemplos del contrato

Las rutas siguientes usan la sintaxis exacta de OpenAPI (`{id}`, `{reservationId}`); el consumidor sustituye esos parámetros por UUID reales. Los ejemplos de query usan los valores publicados por Swagger y no implican una disponibilidad o reserva ejecutada durante esta auditoría documental.

| Operación | Entrada/contrato | Respuesta de éxito | Acceso |
|---|---|---|---|
| POST `/api/v1/auth/login` | LoginDto: email/password | 200, AuthResponseDto | Público |
| GET `/api/v1/atracciones` | query page, limit, product_type opcionales | 200, AtraccionesListResponseDto | Público |
| GET `/api/v1/atracciones/{id}` | UUID id | 200, AtraccionResponseDto | Público |
| GET `/api/v1/atracciones/{id}/paquetes` | UUID id | 200, array PaqueteExperienciaResponseDto | Público |
| GET `/api/v1/atracciones/{id}/availability` | UUID id; date requerida; product_type/time opcionales | 200, AvailabilityResponseDto | Público |
| POST `/api/v1/atracciones/{id}/reservations` | UUID id; ReservationRequestDto; X-Idempotency-Key | 201, ReservationResponseDto y header Location | JWT |
| GET `/api/v1/atracciones/reservations` | Identidad del JWT | 200, array ReservationResponseDto | JWT; reservas propias |
| GET `/api/v1/atracciones/reservations/{reservationId}` | UUID reservationId | 200, ReservationResponseDto | JWT; propietario o ADMIN |
| POST `/api/v1/atracciones/reservations/{reservationId}/cancel` | UUID reservationId; CancelReservationRequestDto; X-Idempotency-Key | 200, ReservationResponseDto | JWT; propietario o ADMIN |
| GET `/api/v1/atracciones/{id}/comentarios` | UUID id | 200, array ComentarioResponseDto | JWT |
| POST `/api/v1/atracciones/{id}/comentarios` | CreateComentarioDto: reservation_id, puntuacion, comentario | 201, ComentarioResponseDto | JWT; reserva CONFIRMADA propia de esa atracción |
| GET `/api/v1/admin/reservas` | Sin body/query | 200, array ReservationResponseDto | JWT + ADMIN |
| POST `/api/v1/observabilidad/eventos` | BrowserBatchDto | 202, TelemetryAcceptedDto | Público, validado y limitado |
| GET `/api/v1/admin/observabilidad/eventos` | Sin body/query | 200, TelemetrySnapshotDto | JWT + ADMIN |
| GET `/api/v1/admin/observabilidad/resumen` | Sin body/query | 200, TelemetrySummaryDto | JWT + ADMIN |
| GET `/api/v1/admin/observabilidad/stream` | Authorization Bearer | 200, text/event-stream, evento snapshot | JWT + ADMIN |

Ejemplos concretos de consulta: `GET /api/v1/atracciones?page=1&limit=100&product_type=SINGLE_TICKET` y `GET /api/v1/atracciones/{id}/availability?date=2026-10-10&time=10%3A00`. `id` debe proceder del catálogo; `paquete_id`, de los paquetes de esa atracción. El listado filtra por modalidad; no se prometen filtros adicionales que el servicio no implemente. En POST search, actualmente se aplican product_type y rows; los demás filtros aceptados tienen la limitación documentada en Swagger.

El inventario completo está en `booking-backend/contracts/active-endpoints.json` y `CRITERIO-3-OPENAPI.md`: **24 operaciones montadas, 19 paths**. Además de esta tabla incluye register, search/details, health y CRUD ADMIN de atracciones. No incluye módulos comentados o código no montado.

## Checkout: intención de compra y fuente de verdad

El cuerpo real ReservationRequestDto permite enviar:

- `paquete_id`: UUID de un paquete obtenido del backend.
- `date` y `time`: fecha y turno elegidos; time es opcional en el DTO.
- `num_adultos` y `ninos: [{ edad: ... }]`: intención de participantes; edades entre 0 y 17.
- `customer_name` requerido y `customer_email` opcional.
- `metodo_pago`: CREDIT_CARD/PAYPAL opcional; el servicio utiliza CREDIT_CARD por defecto.
- `titular_tarjeta` y `ultimos_cuatro_digitos` opcionales; no PAN completo ni CVV.

`ticket_count` es compatibilidad para adultos si no se envía num_adultos; `product_type`, si se envía, debe coincidir con el paquete. No sustituyen la autoridad del paquete real.

El consumidor no envía un precio final, capacidad, ocupación, estado o políticas autoritativos. El servicio carga el paquete y sus políticas, comprueba que pertenece a la atracción, valida horarios y participantes, y PricingService calcula subtotal, descuentos y total. Los niños gratuitos siguen ocupando cupos. Las propiedades de precio/límites/políticas que no pertenecen al DTO son rechazadas.

Checkout usa transacción y locks PostgreSQL para comprobar/incrementar capacidad y persistir reserva, pago y eventos de éxito. El frontend presenta `total_price` y estado devueltos por backend. Una consulta previa de disponibilidad informa al usuario, pero la adjudicación definitiva ocurre dentro del checkout, porque otros clientes pueden comprar entre ambas peticiones.

Una app móvil o un marketplace futuro puede enviar esa misma intención y recibir el mismo contrato sin reproducir reglas de pricing, ocupación o estados. Todavía necesitaría implementar autenticación, tratamiento de errores y reintentos; la compatibilidad no implica una integración externa ya conectada.

## JWT y autorización

Login recibe credenciales por HTTP y devuelve AuthResponseDto con accessToken/user. El consumidor utiliza `Authorization: Bearer <accessToken>`; no debe incluir JWT en URLs. JwtStrategy verifica firma y expiración. En producción requiere JWT_SECRET configurado; existe un fallback de desarrollo en el código actual.

JwtAuthGuard es global y permite omitir autenticación exclusivamente en operaciones `@Public()`. RolesGuard aplica metadatos `@Roles('ADMIN')` a CRUD de atracciones, listado ADMIN de reservas y consulta/stream de observabilidad. Un CLIENTE autenticado recibe 403 cuando intenta una operación ADMIN. La propiedad de una reserva se valida en el servicio: conocer su UUID o código no autoriza consultar información privada, modificarla ni cancelarla.

La ingesta de telemetría es pública, limitada y sanitizada; no se considera identidad autenticada ni prueba de acciones de negocio. Las lecturas administrativas sí requieren JWT y ADMIN.

## Idempotencia real

Checkout y cancelación requieren `X-Idempotency-Key` con formato **UUID v4**. El cliente conserva la key para reintentos de una misma compra.

**Checkout:** misma key y payload normalizado compatible —incluido usuario, atracción, paquete y selección— devuelve la reserva/pago existentes sin duplicar ocupación. Reutilización incompatible produce **409 IDEMPOTENCY_KEY_REUSED**. Hay una restricción UNIQUE en PostgreSQL y comprobaciones dentro de la transacción para carreras concurrentes.

**Cancelación:** repetir la cancelación de la misma reserva no libera capacidad dos veces, por comprobación de estado y locks. El endpoint valida la key; si coincide con una key de checkout ya guardada para otra reserva, responde **400**, no 409. Si no encuentra esa key, resuelve por reservationId y valida propiedad. No existe un almacenamiento independiente de keys de cancelación ni fingerprint de reason; reason requiere al menos 3 caracteres tras trim y no se persiste. Un 409 de cancelación puede indicar inconsistencia de cupos. No se atribuye a cancelación la semántica de fingerprint del checkout.

Estas garantías están verificadas en `test/postgres-checkout.test.cjs`, incluidos reintentos y cancelaciones concurrentes contra PostgreSQL real.

## Errores HTTP

La API utiliza excepciones Nest y respuestas HTTP documentadas por operación. `ApiErrorResponseDto` representa message (string o array de errores de validación) y campos opcionales statusCode/error/code; no todas las respuestas contienen todos esos campos.

| HTTP | Uso real |
|---|---|
| 200 | Consultas, login, edición PATCH y cancelación. |
| 201 | Registro, creación de atracción, checkout y comentario. |
| 202 | Lote de telemetría aceptado y persistido. |
| 204 | PUT y DELETE de atracciones, sin body. |
| 400 | DTO/parámetros inválidos, incompatibilidad de selección o key de cancelación asociada a otra reserva. |
| 401 | JWT ausente/inválido/expirado en rutas protegidas; credenciales inválidas en login. |
| 403 | Rol o propiedad insuficientes; comentario sin reserva propia confirmada. |
| 404 | Recurso inexistente donde la operación lo contempla. |
| 409 | Cupos insuficientes, key de checkout incompatible, pago mock rechazado o comentario duplicado, según operación. |
| 429 | Throttler: 100 solicitudes/minuto por defecto, ingesta 20 lotes/minuto y observabilidad ADMIN 60 solicitudes/minuto. |

Errores inesperados pueden producir 500; no se prometen respuestas de negocio exitosas ante fallos internos. Un consumidor debe evaluar HTTP y, cuando exista, code; no depender exclusivamente del texto de message.

## Implementado actualmente y posible integración futura

| Destino | IMPLEMENTADO ACTUALMENTE | POSIBLE INTEGRACIÓN FUTURA / trabajo pendiente |
|---|---|---|
| Aplicación móvil | Contrato REST versionado con catálogo, login, disponibilidad, checkout y reservas. Consumidor actual Angular. | Implementar consumidor móvil, manejo seguro de credenciales/tokens y errores. No existe app móvil integrada. |
| Marketplace externo | Operaciones HTTP y DTOs reutilizables bajo permisos actuales. | Consumidor externo y acuerdos de identidad, CORS si aplica y compatibilidad. No existen OAuth para partners, credenciales B2B ni webhooks externos implementados. |
| Operador turístico | CRUD de atracciones protegido con ADMIN; paquetes y disponibilidad consultables. | Definir alcance por operador/tenant y permisos específicos. No hay rol OPERADOR activo ni aislamiento multiempresa que pueda asumirse. |
| Check-in / validación QR | QR local de presentación del identificador de reserva, sin PII; detalle real protegido por JWT/propiedad. | Crear scanner, contrato de validación/check-in y autorización apropiada. No existe endpoint de check-in, lector de cámara ni estado USADA. El QR actual no autoriza operaciones. |
| Proveedor de pagos real | Interfaz PaymentProvider e inyección PAYMENT_PROVIDER; PaymentService delega charge; MockPaymentProvider conectado. | Adaptador real, tokenización, callbacks/verificación, idempotencia del proveedor y compensación/reconciliación entre proveedor y transacción PostgreSQL. No hay cobros bancarios reales ni transacción distribuida implementada. |

Observabilidad persiste eventos y sirve SSE autenticado; eso no constituye un bus de integración de negocio. No hay publicación en Kafka/RabbitMQ, entrega garantizada de eventos a partners ni arquitectura EDA externa implementada.

## Verificación documental

El 2026-10-06 se consultó `/api/docs-json` del backend local y se contrastaron métodos, paths, schemas, parámetros, respuestas y seguridad con controllers/DTOs/guards/servicios y consumidor Angular. Las operaciones de la tabla existen en el documento servido. El inventario de 24 operaciones coincide con la evidencia OpenAPI del criterio 3.

Esta tarea crea únicamente documentación; no modifica endpoints, base de datos, frontend ni lógica funcional y no requiere repetir builds o toda la suite. Las evidencias funcionales previas se encuentran en `CRITERIO-2-MARKETPLACE.md`, `CRITERIO-3-OPENAPI.md` y `CRITERIO-4-BASE-DE-DATOS.md`. La preparación descrita evidencia reutilización del contrato y puntos de extensión actuales; no certifica integraciones externas inexistentes.
