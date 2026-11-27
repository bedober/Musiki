# Musiki architecture
## Trust boundaries
The API is the authority for identity, catalogue visibility, subscription state, promotional-download eligibility and signed media URLs. Never trust a client-supplied plan or download flag.
## Offline entitlement
1. Authenticated client requests an offline grant for a track.
2. API checks active Premium subscription OR track.promoDownload=true for Free users, plus territory/label rights and offlineAllowed.
3. API returns a short-lived download URL and a signed entitlement receipt with expiry.
4. Android stores media in app-private storage and validates the receipt locally.
5. On reconnect, the app refreshes entitlements and removes or disables expired protected downloads according to licensing policy.
## Media rights
Only ingest recordings for which Musiki has distribution/streaming/offline rights. Promotional tracks require explicit rights-holder approval.
## Payments
Create Pesapal orders server-side; verify callbacks against Pesapal transaction status before changing a user's plan. Never activate Premium based only on a browser redirect.
