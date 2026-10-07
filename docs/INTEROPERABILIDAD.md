# Interoperabilidad futura

## Alcance y evidencia actual

La plataforma ofrece contratos REST NestJS bajo `/api/v1`, consumidos actualmente por Angular. PostgreSQL permanece detrás de la API. La arquitectura es un monolito modular; no hay app móvil, marketplace externo conectado, operador externo conectado, API Gateway, microservicios, Kafka ni RabbitMQ implementados.

Se consultó el OpenAPI servido en `http://localhost:3000/api/docs-json` el 2026-10-06. Swagger UI está en `/api/docs`; el contrato exportado y el inventario están en `booking-backend/contracts/openapi.json` y `active-endpoints.json`. Véase también [API-first](API-FIRST.md).

**IMPLEMENTADO** en la matriz significa que el endpoint o la abstracción interna existe hoy, no que el sistema externo indicado esté integrado. **FUTURO** significa una integración pendiente. Los parámetros `{id}` y `{reservationId}` utilizan la sintaxis exacta de Swagger y deben sustituirse por UUID reales. La dirección indica quién inicia la solicitud; las respuestas vuelven al consumidor, salvo el flujo SSE indicado.

## Matriz de contratos

| SISTEMA | CASO DE USO | CONTRATO/ENDPOINT | MÉTODO | AUTENTICACIÓN | DATOS PRINCIPALES | DIRECCIÓN | ESTADO |
|---|---|---|---|---|---|---|---|
| App móvil futura | Registrar cliente | `/api/v1/auth/register` | POST | Público | RegisterDto; AuthResponseDto; rol CLIENTE | Consumidor → plataforma | IMPLEMENTADO |
| App móvil futura | Autenticar | `/api/v1/auth/login` | POST | Público | LoginDto: email/password; accessToken/user | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / marketplace futuros | Consultar catálogo | `/api/v1/atracciones` | GET | Público | page, limit, product_type; AtraccionesListResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / marketplace futuros | Abrir detalle | `/api/v1/atracciones/{id}` | GET | Público | id; AtraccionResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / marketplace futuros | Consultar paquetes | `/api/v1/atracciones/{id}/paquetes` | GET | Público | id; array PaqueteExperienciaResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / marketplace futuros | Consultar disponibilidad | `/api/v1/atracciones/{id}/availability` | GET | Público | date requerida; time/product_type opcionales; AvailabilityResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / marketplace futuros | Checkout | `/api/v1/atracciones/{id}/reservations` | POST | JWT; X-Idempotency-Key UUID v4 | ReservationRequestDto: paquete_id, date/time, adultos/edades, cliente, método de pago; ReservationResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| App móvil futura | Mis reservas | `/api/v1/atracciones/reservations` | GET | JWT; usuario autenticado | Array ReservationResponseDto filtrado por propietario | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / futura validación QR | Consultar reserva bajo permisos existentes | `/api/v1/atracciones/reservations/{reservationId}` | GET | JWT; propietario o ADMIN | reservationId; ReservationResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| Móvil / gestión operativa autorizada | Cancelar reserva | `/api/v1/atracciones/reservations/{reservationId}/cancel` | POST | JWT; propietario o ADMIN; X-Idempotency-Key UUID v4 | CancelReservationRequestDto: reason; ReservationResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| App móvil futura | Leer comentarios | `/api/v1/atracciones/{id}/comentarios` | GET | JWT | id; array ComentarioResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| App móvil futura | Crear comentario | `/api/v1/atracciones/{id}/comentarios` | POST | JWT; reserva CONFIRMADA propia de esa atracción | reservation_id, puntuacion, comentario; ComentarioResponseDto | Consumidor → plataforma | IMPLEMENTADO |
| Operador turístico futuro | Publicar atracción bajo permisos actuales | `/api/v1/atracciones` | POST | JWT + ADMIN | CreateAtraccionDto; AtraccionResponseDto | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Operador turístico futuro | Editar atracción parcialmente | `/api/v1/atracciones/{id}` | PATCH | JWT + ADMIN | UpdateAtraccionDto; AtraccionResponseDto | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Operador turístico futuro | Reemplazar representación editable | `/api/v1/atracciones/{id}` | PUT | JWT + ADMIN | CreateAtraccionDto; HTTP 204 sin body | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Operador turístico futuro | Desactivar mediante soft delete | `/api/v1/atracciones/{id}` | DELETE | JWT + ADMIN | id; HTTP 204 sin body | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Operador turístico futuro | Consultar reservas administrativas | `/api/v1/admin/reservas` | GET | JWT + ADMIN | Array ReservationResponseDto | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Consumidor de navegador | Enviar telemetría limitada | `/api/v1/observabilidad/eventos` | POST | Público; rate limiting | BrowserBatchDto; TelemetryAcceptedDto; sin identidad verificada | Consumidor → plataforma | IMPLEMENTADO |
| Gestión operativa autorizada | Consultar eventos | `/api/v1/admin/observabilidad/eventos` | GET | JWT + ADMIN | TelemetrySnapshotDto | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Gestión operativa autorizada | Consultar resumen | `/api/v1/admin/observabilidad/resumen` | GET | JWT + ADMIN | TelemetrySummaryDto | Consumidor autorizado → plataforma | IMPLEMENTADO |
| Gestión operativa autorizada | Recibir snapshots SSE | `/api/v1/admin/observabilidad/stream` | GET | JWT + ADMIN, Authorization | text/event-stream; evento snapshot | Consumidor abre HTTP; plataforma → consumidor | IMPLEMENTADO |
| Proveedor de pagos | Abstracción interna de cobro mock | PaymentProvider.charge / PAYMENT_PROVIDER | charge(request), interno; no HTTP | Inyección interna, sin credenciales de proveedor externo | PaymentRequest: amount/method/cardholder/lastFour; PaymentResult SUCCESS/FAILED | PaymentService → MockPaymentProvider | IMPLEMENTADO |
| App móvil / marketplace / operador | Conectar un nuevo consumidor | Contratos anteriores; integración del consumidor pendiente | Según endpoint real | Según permisos actuales; mecanismo B2B pendiente | DTOs actuales | Sistema futuro → plataforma | FUTURO |
| Servicio de check-in | Validar entrada a partir del QR | PROPUESTA FUTURA: contrato de check-in por definir; sin ruta HTTP propuesta | Por definir | Autorización específica por definir | UUID de reserva; resultado mínimo de validación | Servicio futuro → plataforma | FUTURO |
| Proveedor de pagos real | Adaptador real de cobro | PROPUESTA FUTURA: implementación de PaymentProvider y contrato con proveedor por definir | charge y API del proveedor por definir | Credenciales/tokenización del proveedor por definir | PaymentRequest/PaymentResult más conciliación por definir | Plataforma → proveedor futuro | FUTURO |

## App móvil y marketplace externo

La app móvil futura puede reutilizar registro/login, catálogo, detalle, paquetes, disponibilidad, checkout, Mis reservas, detalle, cancelación y comentarios. CLIENTE es el rol obtenido por registro normal. Las operaciones marcadas JWT no todas exigen exclusivamente CLIENTE: los guards y las comprobaciones de propiedad determinan los permisos reales; las operaciones ADMIN sí exigen ese rol.

Un marketplace externo puede consultar públicamente atracciones, paquetes y disponibilidad. Para iniciar checkout debe operar con identidad autenticada y respetar los permisos existentes. El consumidor envía intención de compra; no define precio final, políticas, capacidad, ocupación ni estado. El backend obtiene paquete y reglas de PostgreSQL, calcula y responde con total/estado persistidos. Consultar disponibilidad no bloquea cupos; checkout revalida con transacción y locks.

La reutilización no equivale a tener un partner conectado. Delegación de identidad, cuentas de servicio, OAuth/scopes, acuerdos de compatibilidad y autenticación B2B son **FUTUROS**, no contratos de identidad existentes. Las llamadas desde otro navegador requerirían además configurar CORS de forma apropiada; CORS no reemplaza la autorización.

## Operador turístico y seguridad

Los contratos existentes permiten publicación/edición/desactivación de atracciones, lectura ADMIN de reservas y consulta operativa de observabilidad. Hoy requieren **JWT + ADMIN**; no existe rol OPERADOR ni aislamiento de reservas por empresa. El listado ADMIN no debe presentarse como una API limitada a un operador concreto.

No se recomienda compartir credenciales ADMIN con sistemas externos. Una integración B2B futura debe definir identidades propias, permisos mínimos y alcance por operador antes de exponer gestión externa. No se agregaron mecanismos B2B en esta tarea.

Las consultas públicas no requieren JWT. Las demás envían `Authorization: Bearer <accessToken>`, sin tokens en URLs. Falta de autenticación implica 401; rol/propiedad insuficientes, 403. Los consumidores deben interpretar errores documentados 400/404/409/429 según operación y no asumir una respuesta exitosa.

El SSE ADMIN existente requiere Authorization. Un consumidor web puede utilizar fetch streaming para enviar ese header; EventSource nativo no permite añadirlo arbitrariamente. El contrato describe snapshots persistidos y reconexión para revalidar JWT. No es un bus de integración de eventos de negocio ni entrega garantizada a partners.

## Idempotencia para otros consumidores

Checkout y cancelación exigen `X-Idempotency-Key` UUID v4. Un consumidor conserva la key ante un timeout y reintenta la misma compra, en lugar de generar otra key y arriesgar una nueva operación.

En **checkout**, misma key y payload normalizado compatible —usuario, atracción, paquete y selección— devuelven la reserva/pago existentes. Reutilización incompatible produce **409 IDEMPOTENCY_KEY_REUSED**. PostgreSQL impone UNIQUE y el servicio usa transacciones/locks; no se duplican pagos persistidos ni cupos.

En **cancelación**, repetir la misma cancelación devuelve el estado cancelado sin liberar capacidad otra vez. No existe fingerprint ni almacenamiento independiente de keys de cancelación. Si la key ya pertenece al checkout de otra reserva, el endpoint devuelve **400**; si no encuentra esa key, resuelve la reserva por reservationId y valida propiedad. Un 409 puede indicar cupos inconsistentes. reason exige al menos 3 caracteres tras trim y no se persiste. No se atribuye a cancelación la misma semántica de conflicto del checkout.

## QR y futura validación de ingreso

Actualmente `ReservationQr` genera localmente un QR de presentación que contiene únicamente el **UUID reservation_id** de la reserva real. No utiliza el código interno BR como payload ni contiene PII/datos de pago. Para CONFIRMADA presenta QR; CANCELADA y PENDIENTE no presentan un QR válido.

El flujo futuro sería QR → UUID de reserva → servicio autorizado de validación/check-in. El GET de detalle existente requiere propietario o ADMIN y devuelve información de reserva; **no constituye un contrato de check-in** ni debe hacerse público para lectores QR. Conocer el UUID no autoriza consultar datos privados, cancelar, modificar estado o acceder a pagos.

**PROPUESTA FUTURA:** definir contrato específico de validación con respuesta mínima, permisos de personal de ingreso, reglas de validez y protección ante usos repetidos. No se define una ruta inexistente como implementada. Scanner, lector de cámara, registro de ingreso y estado USADA no existen actualmente.

## Pagos: abstracción existente y adaptación futura

`booking-backend/src/modules/atracciones/payments/payment-provider.interface.ts` define `PaymentProvider.charge(request): Promise<PaymentResult>` y PAYMENT_PROVIDER. PaymentService delega charge; AtraccionesModule vincula el token mediante `useExisting: MockPaymentProvider`.

MockPaymentProvider devuelve SUCCESS/FAILED y una referencia mock; **no realiza cobros reales**. Es una abstracción interna TypeScript, no un endpoint HTTP para proveedores ni una API externa conectada.

Un adaptador futuro podría implementar PaymentProvider, pero un proveedor real requerirá tokenización, credenciales protegidas, verificación de callbacks, idempotencia del proveedor y conciliación/compensación. La transacción PostgreSQL actual no incluye una transacción distribuida con un banco. No hay endpoints webhook de pagos implementados ni contratos externos seleccionados.

## Versionado y evolución

`/api/v1` identifica el contrato actual y permite distinguirlo de una evolución incompatible futura. Preservar DTOs/semánticas de esa versión y coordinar cambios reduce rupturas en consumidores. El prefijo por sí solo no garantiza compatibilidad: debe acompañarse de revisión de OpenAPI, pruebas y acuerdos con consumidores. No existe ni se inventa `/api/v2`.

## Validación documental

Se compararon programáticamente método/path de todas las filas HTTP IMPLEMENTADO con `/api/docs-json`. Hay **21 operaciones HTTP distintas** identificadas en esta matriz; la abstracción PaymentProvider no se contabiliza como endpoint. Las filas FUTURO no se contabilizan como integración implementada ni introducen endpoints nuevos. El inventario global sigue teniendo 24 operaciones; no es necesario usar todas para estos escenarios.

ENDPOINTS IMPLEMENTADOS DOCUMENTADOS PARA INTEROPERABILIDAD: 21

ENDPOINTS MARCADOS ERRÓNEAMENTE COMO IMPLEMENTADOS: 0

Esta tarea modifica únicamente este documento. La validación es documental y no requiere repetir builds/tests funcionales ni implementar conexiones externas.
