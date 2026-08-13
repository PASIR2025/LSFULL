/*
 * SimuPLC V14 - configuración de Google Play Billing.
 *
 * IMPORTANTE:
 * - El backend debe desplegarse por HTTPS antes de publicar V14.
 * - NO coloques claves privadas ni credenciales de Google aquí.
 * - Cambia backendUrl por la URL real de Cloud Run/Functions.
 */
window.SIMUPLC_BILLING_CONFIG = Object.freeze({
  productId: 'simuplc_pro_lifetime',
  packageName: 'com.pasir.simuplc',
  backendUrl: 'https://simuplc-play-billing-275066504779.us-central1.run.app',
  requireBackend: true,
  allowClientAcknowledgeFallback: false,
  verifyOnStartup: true
});
