# Backend Google Play Billing — SimuPLC V14

Este backend verifica el `purchaseToken` contra Google Play Developer API y reconoce compras no consumibles antes de que SimuPLC active Premium.

## Variables

- `PLAY_PACKAGE_NAME=com.pasir.simuplc`
- `PLAY_PRODUCT_ID=simuplc_pro_lifetime`
- `ALLOWED_ORIGINS=https://simuplc.escuelapasir.com,https://escuelapasir.github.io`

## Endpoint

`POST /verify-ack`

Cuerpo:

```json
{
  "packageName": "com.pasir.simuplc",
  "productId": "simuplc_pro_lifetime",
  "purchaseToken": "TOKEN_RECIBIDO_DE_GOOGLE_PLAY"
}
```

Respuesta exitosa con derecho:

```json
{
  "ok": true,
  "entitled": true,
  "purchaseState": "PURCHASED",
  "acknowledgementState": "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
}
```

## Cloud Run

El código usa Application Default Credentials. La cuenta de servicio asignada a Cloud Run debe estar autorizada para utilizar Google Play Developer API para la aplicación.

No guardes ni subas archivos JSON de claves privadas al repositorio.

Ejemplo de despliegue desde esta carpeta (una vez instalado/configurado `gcloud`):

```bash
gcloud run deploy simuplc-play-billing \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PLAY_PACKAGE_NAME=com.pasir.simuplc,PLAY_PRODUCT_ID=simuplc_pro_lifetime,ALLOWED_ORIGINS=https://simuplc.escuelapasir.com\,https://escuelapasir.github.io
```

Después copia la URL HTTPS de Cloud Run en `assets/js/billing-config.js`.

## Prueba básica

```bash
curl https://TU-BACKEND.run.app/health
```

La prueba real de `/verify-ack` requiere un `purchaseToken` válido de Google Play y la cuenta de servicio correctamente autorizada.
