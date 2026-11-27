import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { PrismaClient, Plan, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 1024 * 1024 });
const prisma = new PrismaClient();
const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map(s => s.trim());
await app.register(helmet);
await app.register(cors, { origin: allowedOrigins, credentials: true });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
await app.register(jwt, { secret: process.env.JWT_SECRET, sign: { expiresIn: '7d' } });

const s3 = process.env.OBJECT_STORAGE_ENDPOINT && process.env.OBJECT_STORAGE_ACCESS_KEY && process.env.OBJECT_STORAGE_SECRET_KEY
  ? new S3Client({ region: process.env.OBJECT_STORAGE_REGION ?? 'auto', endpoint: process.env.OBJECT_STORAGE_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY, secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY } })
  : null;
const emailSchema = z.string().email().max(254).transform(v => v.toLowerCase());
const registerSchema = z.object({ email: emailSchema, password: z.string().min(10).max(128), displayName: z.string().trim().min(2).max(60) });
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
const paymentSchema = z.object({ plan: z.enum(['PREMIUM']), phoneNumber: z.string().min(7).max(20) });
type AuthUser = { id: string; email: string; role: string; plan: Plan };
declare module '@fastify/jwt' { interface FastifyJWT { payload: AuthUser; user: AuthUser } }
app.decorate('authenticate', async function (request: any, reply: any) {
  try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: 'Authentication required' }); }
});
const auth = { preHandler: (app as any).authenticate };
const publicUser = (u: any) => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role, plan: u.plan });
app.get('/health', async () => ({ ok: true, service: 'musiki-api', version: '1.0.0', database: await prisma.$queryRaw`SELECT 1`.then(() => 'connected').catch(() => 'unavailable') }));

app.post('/v1/auth/register', async (req, reply) => {
  const parsed = registerSchema.safeParse(req.body); if (!parsed.success) return reply.code(400).send({ error: 'Invalid registration details', details: parsed.error.flatten() });
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } }); if (exists) return reply.code(409).send({ error: 'An account with this email already exists' });
  const user = await prisma.user.create({ data: { email: parsed.data.email, displayName: parsed.data.displayName, passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  const token = app.jwt.sign({ id: user.id, email: user.email, role: user.role, plan: user.plan });
  return reply.code(201).send({ user: publicUser(user), token });
});
app.post('/v1/auth/login', async (req, reply) => {
  const parsed = loginSchema.safeParse(req.body); if (!parsed.success) return reply.code(400).send({ error: 'Invalid login details' });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return reply.code(401).send({ error: 'Email or password is incorrect' });
  return { user: publicUser(user), token: app.jwt.sign({ id: user.id, email: user.email, role: user.role, plan: user.plan }) };
});
app.get('/v1/auth/me', auth, async (req: any, reply) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } }); if (!user) return reply.code(401).send({ error: 'Account not found' }); return { user: publicUser(user) };
});

app.get('/v1/catalog', async (req) => {
  const q = z.object({ q: z.string().trim().max(100).optional(), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().optional() }).parse(req.query);
  const where = { published: true, ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' as const } }, { artist: { stageName: { contains: q.q, mode: 'insensitive' as const } } }] } : {}) };
  const items = await prisma.track.findMany({ where, take: q.limit, ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}), orderBy: { createdAt: 'desc' }, include: { artist: { select: { stageName: true } } } });
  return { items: items.map(t => ({ id: t.id, title: t.title, artist: t.artist.stageName, coverUrl: t.coverUrl, durationSeconds: t.durationSeconds, promoDownload: t.promoDownload, offlineAllowed: t.offlineAllowed })), nextCursor: items.length === q.limit ? items.at(-1)?.id : null };
});
app.get('/v1/playlists', auth, async (req: any) => prisma.playlist.findMany({ where: { userId: req.user.id }, include: { tracks: { include: { track: { include: { artist: { select: { stageName: true } } } } }, orderBy: { position: 'asc' } } }, orderBy: { createdAt: 'desc' } }));
app.post('/v1/playlists', auth, async (req: any, reply) => {
  const p = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body); if (!p.success) return reply.code(400).send({ error: 'Playlist name is required' });
  return reply.code(201).send(await prisma.playlist.create({ data: { name: p.data.name, userId: req.user.id } }));
});
app.post('/v1/playlists/:id/tracks', auth, async (req: any, reply) => {
  const p = z.object({ trackId: z.string().min(1) }).safeParse(req.body); if (!p.success) return reply.code(400).send({ error: 'trackId is required' });
  const playlist = await prisma.playlist.findFirst({ where: { id: req.params.id, userId: req.user.id } }); if (!playlist) return reply.code(404).send({ error: 'Playlist not found' });
  const track = await prisma.track.findFirst({ where: { id: p.data.trackId, published: true } }); if (!track) return reply.code(404).send({ error: 'Track not found' });
  const count = await prisma.playlistTrack.count({ where: { playlistId: playlist.id } });
  return reply.code(201).send(await prisma.playlistTrack.upsert({ where: { playlistId_trackId: { playlistId: playlist.id, trackId: track.id } }, create: { playlistId: playlist.id, trackId: track.id, position: count }, update: {} }));
});

app.post('/v1/downloads/authorize', auth, async (req: any, reply) => {
  const p = z.object({ trackId: z.string().min(1) }).safeParse(req.body); if (!p.success) return reply.code(400).send({ error: 'Invalid trackId' });
  const [user, track] = await Promise.all([prisma.user.findUnique({ where: { id: req.user.id } }), prisma.track.findFirst({ where: { id: p.data.trackId, published: true } })]);
  if (!user || !track) return reply.code(404).send({ error: 'Track not found' });
  if (!track.offlineAllowed || (user.plan !== Plan.PREMIUM && !track.promoDownload)) return reply.code(403).send({ error: 'Offline download requires Premium or a promotional download entitlement' });
  if (!s3 || !process.env.OBJECT_STORAGE_BUCKET) return reply.code(503).send({ error: 'Offline storage is not configured yet' });
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.OBJECT_STORAGE_BUCKET, Key: track.audioKey }), { expiresIn: 300 });
  await prisma.download.upsert({ where: { userId_trackId: { userId: user.id, trackId: track.id } }, create: { userId: user.id, trackId: track.id, entitlement: user.plan === Plan.PREMIUM ? 'PREMIUM' : 'PROMO' }, update: { entitlement: user.plan === Plan.PREMIUM ? 'PREMIUM' : 'PROMO' } });
  return { url, expiresIn: 300 };
});

async function pesapalToken() {
  const base = process.env.PESAPAL_ENV === 'live' ? 'https://pay.pesapal.com/v3' : 'https://cybqa.pesapal.com/pesapalv3';
  const response = await fetch(base + '/api/Auth/RequestToken', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ consumer_key: process.env.PESAPAL_CONSUMER_KEY, consumer_secret: process.env.PESAPAL_CONSUMER_SECRET }) });
  const data: any = await response.json(); if (!response.ok || !data.token) throw new Error('Pesapal authentication failed'); return { token: data.token, base };
}
app.post('/v1/payments/pesapal', auth, async (req: any, reply) => {
  const p = paymentSchema.safeParse(req.body); if (!p.success) return reply.code(400).send({ error: 'Invalid payment details' });
  if (!process.env.PESAPAL_CONSUMER_KEY || !process.env.PESAPAL_CONSUMER_SECRET || !process.env.PESAPAL_CALLBACK_URL || !process.env.PESAPAL_IPN_ID) return reply.code(503).send({ error: 'Pesapal is not fully configured' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id } }); if (!user) return reply.code(401).send({ error: 'Account not found' });
  const reference = 'MUS-' + randomUUID();
  const payment = await prisma.payment.create({ data: { userId: user.id, provider: 'PESAPAL', reference, amount: Number(process.env.PREMIUM_PRICE_UGX ?? 10000), currency: 'UGX' } });
  try {
    const { token, base } = await pesapalToken();
    const ipnRes = await fetch(base + '/api/URLSetup/GetIpnList', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }); const ipns: any = await ipnRes.json();
    if (!ipnRes.ok || !Array.isArray(ipns) || !ipns.some((x: any) => x.ipn_id === process.env.PESAPAL_IPN_ID)) throw new Error('Configured Pesapal IPN ID was not found');
    const res = await fetch(base + '/api/Transactions/SubmitOrderRequest', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ id: reference, currency: payment.currency, amount: payment.amount, description: 'Musiki Premium subscription', callback_url: process.env.PESAPAL_CALLBACK_URL, notification_id: process.env.PESAPAL_IPN_ID, billing_address: { email_address: user.email, phone_number: p.data.phoneNumber, country_code: 'UG', first_name: user.displayName } }) });
    const data: any = await res.json(); if (!res.ok || !data.redirect_url || !data.order_tracking_id) throw new Error(data.message ?? 'Pesapal order request failed');
    await prisma.payment.update({ where: { id: payment.id }, data: { provider: 'PESAPAL:' + data.order_tracking_id } });
    return { paymentId: payment.id, reference, redirectUrl: data.redirect_url };
  } catch (e: any) { await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } }); req.log.error(e); return reply.code(502).send({ error: 'Could not start Pesapal payment' }); }
});
app.get('/v1/payments/pesapal/status/:reference', auth, async (req: any, reply) => {
  const payment = await prisma.payment.findFirst({ where: { reference: req.params.reference, userId: req.user.id } }); if (!payment) return reply.code(404).send({ error: 'Payment not found' });
  return { reference: payment.reference, status: payment.status, plan: (await prisma.user.findUnique({ where: { id: req.user.id } }))?.plan };
});
app.get('/v1/payments/pesapal/ipn', async (req: any, reply) => {
  const q = z.object({ OrderTrackingId: z.string(), OrderMerchantReference: z.string() }).safeParse(req.query); if (!q.success) return reply.code(400).send({ error: 'Invalid IPN parameters' });
  const payment = await prisma.payment.findUnique({ where: { reference: q.data.OrderMerchantReference } }); if (!payment || payment.provider !== 'PESAPAL:' + q.data.OrderTrackingId) return reply.code(404).send({ error: 'Payment not found' });
  try {
    const { token, base } = await pesapalToken();
    const statusRes = await fetch(base + '/api/Transactions/GetTransactionStatus?orderTrackingId=' + encodeURIComponent(q.data.OrderTrackingId), { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    const status: any = await statusRes.json(); if (!statusRes.ok) throw new Error('Pesapal status lookup failed');
    const state = String(status.payment_status_description ?? '').toUpperCase();
    if (state === 'COMPLETED') await prisma.$transaction([prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.COMPLETED } }), prisma.user.update({ where: { id: payment.userId }, data: { plan: Plan.PREMIUM } })]);
    else if (['FAILED', 'INVALID', 'REVERSED'].includes(state)) await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    return { orderNotificationType: 'IPNCHANGE', orderTrackingId: q.data.OrderTrackingId, orderMerchantReference: q.data.OrderMerchantReference, status: 200 };
  } catch (e) { req.log.error(e); return reply.code(502).send({ error: 'Payment verification temporarily unavailable' }); }
});
app.setErrorHandler((error, req, reply) => { req.log.error(error); reply.code(500).send({ error: 'Internal server error' }); });
app.addHook('onClose', async () => { await prisma.$disconnect(); });
const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
