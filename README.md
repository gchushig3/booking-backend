# Backend NestJS

Monolito modular de autenticación, atracciones/reservas/comentarios y observabilidad. Alojamientos/autos/vuelos de la plantilla no están montados. No hay Apollo Federation ni microservicios implementados.

Instrucciones vigentes de requisitos, PostgreSQL, variables de entorno, instalación, migraciones, seed, ejecución y tests: [README principal](../README.md). Ejecutar los scripts desde esta carpeta.

OpenAPI es la referencia HTTP: `/api/docs` (UI), `/api/docs-json` y `/api/docs-yaml`. Véanse [arquitectura](../docs/ARQUITECTURA.md), [modelo](../docs/MODELO-DATOS.md) y [contrato de checkout](CONTRATO-CHECKOUT.md). Documentos FASE y módulos de plantilla son antecedentes, no evidencia de endpoints activos.

Checkout crea CONFIRMADA tras SUCCESS de MockPaymentProvider. PENDIENTE histórico expira según PENDING_RESERVATION_TTL_MINUTES (15 minutos por defecto); CANCELADA no libera capacidad dos veces. No hay cobros bancarios reales ni transacción distribuida. Integraciones futuras: [interoperabilidad](../docs/INTEROPERABILIDAD.md) y [SOA/EDA](../docs/SOA-EDA.md).
