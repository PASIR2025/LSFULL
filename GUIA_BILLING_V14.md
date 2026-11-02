# SimuPLC V14 — orden correcto de publicación

## Estado del paquete

V14 conserva las mejoras de V13 y cambia el sistema de Google Play Billing para que la activación Premium dependa de una verificación real en Google Play.

La compra solo se considera entregada cuando el backend confirma simultáneamente:

- `purchaseState = PURCHASED`
- `acknowledgementState = ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED`

## Antes de subir V14 al repositorio

1. Desplegar la carpeta `backend-google-play` en Google Cloud Run o un servicio HTTPS equivalente.
2. La identidad del backend debe tener acceso a Google Play Developer API para la app `com.pasir.simuplc`.
3. Activar Google Play Android Developer API en el proyecto de Google Cloud usado por el backend.
4. Vincular/autorizar la cuenta de servicio correspondiente en Play Console con permisos suficientes para consultar y administrar pedidos/compras.
5. Probar `GET /health` del backend.
6. Abrir `assets/js/billing-config.js` y reemplazar:

   `https://REEMPLAZAR-CON-TU-BACKEND.run.app`

   por la URL HTTPS real.
7. No colocar credenciales privadas dentro de `billing-config.js`, HTML, JavaScript público o GitHub.
8. Subir recién entonces V14 al repositorio.
9. Generar el nuevo AAB con el mismo package ID y firma, Target API 36 y una versión de Google Play Billing admitida por Play Console.
10. Publicar primero en prueba interna y realizar una compra de prueba.

## Flujo V14

```text
PaymentRequest
  ↓
purchaseToken
  ↓
Backend V14
  ↓
Google Play Developer API
  ↓
¿PURCHASED?
  ↓ sí
¿ACKNOWLEDGED?
  ├─ sí → confirmar derecho
  └─ no → acknowledge → volver a verificar
  ↓
Premium
```

## Compra pendiente

Una compra `PENDING` no activa Premium. V14 guarda el estado pendiente y vuelve a comprobarlo cuando la app regresa al primer plano, recupera Internet o se inicia nuevamente.

## Reembolsos

V14 separa la fuente de activación:

- Google Play: puede revocarse cuando Play ya no reconoce el derecho.
- Licencia manual: continúa siendo administrada por el sistema existente de Apps Script.

Por tanto, un reembolso de Google Play no debe borrar una licencia manual válida.

## Diagnóstico

Desde la consola del navegador/TWA se puede ejecutar:

```javascript
await window.simuplcBillingDiagnostics()
```

El diagnóstico muestra configuración, disponibilidad de Billing, compras visibles, estado local y eventos recientes. Los tokens se muestran solo por sus últimos caracteres.
