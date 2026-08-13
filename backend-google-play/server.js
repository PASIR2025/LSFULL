'use strict';

const express = require('express');
const { GoogleAuth } = require('google-auth-library');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || 'com.pasir.simuplc';
const PRODUCT_ID = process.env.PLAY_PRODUCT_ID || 'simuplc_pro_lifetime';
const PORT = Number(process.env.PORT || 8080);
const ALLOWED_ORIGINS = new Set(
  String(process.env.ALLOWED_ORIGINS || 'https://simuplc.escuelapasir.com,https://escuelapasir.github.io')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/androidpublisher']
});

function safeTokenTail(token) {
  const value = String(token || '');
  return value ? '…' + value.slice(-6) : '(sin token)';
}

function setCors(req, res) {
  const origin = String(req.headers.origin || '');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

app.use((req, res, next) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    const origin = String(req.headers.origin || '');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  next();
});

async function getAccessToken() {
  const token = await auth.getAccessToken();
  if (!token) throw new Error('No se pudo obtener un token OAuth para Android Publisher API.');
  return token;
}

async function googleRequest(url, options = {}) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  let body = null;
  const text = await response.text();
  if (text) {
    try { body = JSON.parse(text); }
    catch (_) { body = { raw: text.slice(0, 500) }; }
  }
  return { response, body };
}

function purchaseUrl(token) {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/productsv2/tokens/${encodeURIComponent(token)}`;
}

function acknowledgeUrl(token) {
  return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/products/${encodeURIComponent(PRODUCT_ID)}/tokens/${encodeURIComponent(token)}:acknowledge`;
}

function normalizePurchase(data) {
  const lineItems = Array.isArray(data && data.productLineItem) ? data.productLineItem : [];
  const productIds = lineItems.map(x => String(x && x.productId || '')).filter(Boolean);
  return {
    purchaseState: String(data && data.purchaseStateContext && data.purchaseStateContext.purchaseState || 'PURCHASE_STATE_UNSPECIFIED'),
    acknowledgementState: String(data && data.acknowledgementState || 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED'),
    orderId: String(data && data.orderId || ''),
    productIds,
    completionTime: String(data && data.purchaseCompletionTime || ''),
    regionCode: String(data && data.regionCode || '')
  };
}

async function fetchPurchase(token) {
  const { response, body } = await googleRequest(purchaseUrl(token));
  if (response.ok) return { found: true, status: response.status, data: body };

  // Un token revocado/reembolsado puede dejar de ser recuperable con esta API.
  // En ese caso no debe conservarse el derecho Premium.
  if (response.status === 404 || response.status === 410) {
    return { found: false, status: response.status, data: body };
  }

  const message = body && body.error && body.error.message ? body.error.message : `HTTP ${response.status}`;
  const err = new Error(`Google Play Developer API: ${message}`);
  err.httpStatus = response.status;
  throw err;
}

async function acknowledgePurchase(token) {
  const { response, body } = await googleRequest(acknowledgeUrl(token), {
    method: 'POST',
    body: JSON.stringify({})
  });
  if (response.ok) return true;

  const message = body && body.error && body.error.message ? body.error.message : `HTTP ${response.status}`;
  const err = new Error(`No se pudo reconocer la compra en Google Play: ${message}`);
  err.httpStatus = response.status;
  throw err;
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'simuplc-play-billing-backend',
    packageName: PACKAGE_NAME,
    productId: PRODUCT_ID,
    time: new Date().toISOString()
  });
});

app.post('/verify-ack', async (req, res) => {
  const origin = String(req.headers.origin || '');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'Origen no permitido.' });
  }

  const purchaseToken = String(req.body && req.body.purchaseToken || '').trim();
  const requestedProductId = String(req.body && req.body.productId || '').trim();

  if (!purchaseToken || purchaseToken.length < 20 || purchaseToken.length > 4096) {
    return res.status(400).json({ ok: false, error: 'purchaseToken inválido.' });
  }
  if (requestedProductId && requestedProductId !== PRODUCT_ID) {
    return res.status(400).json({ ok: false, error: 'productId no permitido.' });
  }

  try {
    let current = await fetchPurchase(purchaseToken);
    if (!current.found) {
      console.warn('[billing] token revocado/no encontrado', safeTokenTail(purchaseToken), current.status);
      return res.json({
        ok: true,
        entitled: false,
        purchaseState: 'REVOKED_OR_NOT_FOUND',
        acknowledgementState: 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED'
      });
    }

    let info = normalizePurchase(current.data);
    if (!info.productIds.includes(PRODUCT_ID)) {
      return res.status(400).json({ ok: false, error: 'El token no corresponde al producto de SimuPLC.' });
    }

    if (info.purchaseState !== 'PURCHASED') {
      return res.json({ ok: true, entitled: false, ...info });
    }

    let acknowledgedNow = false;
    if (info.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      await acknowledgePurchase(purchaseToken);
      acknowledgedNow = true;
      current = await fetchPurchase(purchaseToken);
      if (!current.found) {
        return res.json({
          ok: true,
          entitled: false,
          purchaseState: 'REVOKED_OR_NOT_FOUND',
          acknowledgementState: 'ACKNOWLEDGEMENT_STATE_UNSPECIFIED'
        });
      }
      info = normalizePurchase(current.data);
    }

    const entitled =
      info.purchaseState === 'PURCHASED' &&
      info.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' &&
      info.productIds.includes(PRODUCT_ID);

    console.log('[billing] verificación', safeTokenTail(purchaseToken), info.purchaseState, info.acknowledgementState);
    return res.json({ ok: true, entitled, acknowledgedNow, ...info });
  } catch (err) {
    console.error('[billing] error', safeTokenTail(purchaseToken), err && err.message);
    return res.status(502).json({
      ok: false,
      error: 'No se pudo verificar la compra con Google Play.',
      detail: String(err && err.message || err || 'Error desconocido')
    });
  }
});

app.listen(PORT, () => {
  console.log(`SimuPLC Play Billing backend escuchando en puerto ${PORT}`);
});
