# Checkout por paquete seleccionado

La auditoria confirmo que el checkout buscaba un paquete por atraccion y modalidad. No hay UNIQUE sobre esa combinacion; varios paquetes pueden compartir modalidad. El UNIQUE (id, atraccion_id) respalda la FK de reservas, no limita modalidades.

## Contrato REST

POST /api/v1/atracciones/:id/reservations, autenticado y con X-Idempotency-Key.

- paquete_id: UUID obligatorio del paquete obtenido en GET /atracciones/:id/paquetes.
- date y customer_name: obligatorios.
- time, num_adultos, ninos [{ edad: 0..17 }], customer_email y pago seguro: segun DTO actual.
- metodo_pago: CREDIT_CARD o PAYPAL; tarjeta admite titular_tarjeta y ultimos_cuatro_digitos. Nunca PAN/CVV.
- product_type: opcional solo por compatibilidad; si se envia debe coincidir con tipo_experiencia del paquete. El frontend lo omite en checkout. El backend deriva la modalidad.
- ticket_count: compatibilidad existente; el flujo frontend utiliza adultos y edades individuales.

Paquete inexistente: 404. UUID ausente/invalido: 400. Paquete perteneciente a otra atraccion: 400. Modalidad incompatible: 400. Limites de participantes: 400. Misma key con otro paquete/payload: 409 IDEMPOTENCY_KEY_REUSED.

La consulta transaccional obtiene el paquete por UUID y lo bloquea para lectura. Precio, limites y politicas proceden de PostgreSQL. La reserva persiste exactamente ese ID. El fingerprint incluye paquete_id y el replay comprueba tambien el ID persistido.

Disponibilidad mantiene product_type: el cupo fisico es compartido por atraccion, fecha y turno, sin inventario separado por paquete. No se modifica ese endpoint.

No requiere migracion de esquema: paquete_id y la FK ya existen. migration:run ejecutado: No migrations are pending.

## Ejemplo sin datos sensibles

IDs obtenidos mediante consulta de solo lectura a PostgreSQL; fecha/turno y participantes deben ajustarse a disponibilidad y limites del paquete.

POST /api/v1/atracciones/4de4df64-12dd-4e69-83b7-0cb634567df1/reservations
X-Idempotency-Key: checkout-ejemplo-001

```json
{
  "paquete_id": "37c4adbd-f789-433e-bf4d-fc9d5024d03f",
  "date": "2027-02-01",
  "time": "10:00",
  "num_adultos": 2,
  "ninos": [{ "edad": 8 }],
  "customer_name": "Cliente de ejemplo",
  "customer_email": "cliente@example.com",
  "metodo_pago": "PAYPAL"
}
```

## Validacion

Backend: build correcto; npm test 14/14 (3 archivos), incluyendo integracion PostgreSQL, overbooking y Swagger.
Frontend: build correcto; 6 Test Files y 66 Tests pasando. Aviso de bundle inicial: 521.16 kB frente a presupuesto 500 kB.

Las claves y fingerprints anteriores al nuevo contrato no se migran. Los consumidores de checkout deben enviar paquete_id; product_type solo no identifica una reserva valida.
