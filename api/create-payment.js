// ─── Vercel Serverless Function — Helcim Payment ───────────────────────────
// This creates a Helcim checkout session for membership payments.
// Endpoint: POST /api/create-payment
// Body: { planId, amount, customerEmail, customerName }
//
// Environment variables needed:
//   HELCIM_API_TOKEN   — Your Helcim API token
//   HELCIM_ACCOUNT_ID  — Your Helcim account ID
// ────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { planId, amount, customerEmail, customerName } = req.body;

  if (!amount || !customerEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const HELCIM_API_TOKEN  = process.env.HELCIM_API_TOKEN;
  const HELCIM_ACCOUNT_ID = process.env.HELCIM_ACCOUNT_ID;

  if (!HELCIM_API_TOKEN) {
    return res.status(500).json({ error: 'Helcim not configured' });
  }

  try {
    // Create a Helcim payment page / checkout session
    const response = await fetch('https://api.helcim.com/v2/helcim-pay/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-token': HELCIM_API_TOKEN,
        ...(HELCIM_ACCOUNT_ID && { 'account-id': HELCIM_ACCOUNT_ID }),
      },
      body: JSON.stringify({
        paymentType: 'purchase',
        amount: amount,
        currency: 'CAD',
        customerCode: customerEmail,
        invoiceNumber: `RENU-${planId}-${Date.now()}`,
        paymentMethod: 'cc-ach',
        allowPartial: 0,
        taxAmount: (amount * 0.05).toFixed(2), // 5% GST for Alberta
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Helcim API error');
    }

    // Return the checkout URL and token to the frontend
    return res.status(200).json({
      checkoutToken: data.checkoutToken,
      secretToken: data.secretToken,
    });
  } catch (err) {
    console.error('Helcim error:', err);
    return res.status(500).json({ error: err.message || 'Payment failed' });
  }
}
