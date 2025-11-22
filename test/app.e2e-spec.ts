process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '3600000';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RateLimitGuard } from '../src/rate-limit.guard';

describe('Simple Crypto API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  async function resetDatabase() {
    RateLimitGuard.reset();
    await (prisma as any).$transaction([
      (prisma as any).transaction.deleteMany(),
      (prisma as any).userTransferStats.deleteMany(),
      (prisma as any).user.deleteMany(),
    ]);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should support wallet and reporting happy path', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const aliceUsername = 'alice_e2e';
    const bobUsername = 'bob_e2e';

    // Register Alice
    const registerAliceRes = await request(server)
      .post('/user')
      .send({ username: aliceUsername })
      .expect(201);

    expect(typeof registerAliceRes.body.token).toBe('string');

    // Register Bob
    await request(server)
      .post('/user')
      .send({ username: bobUsername })
      .expect(201);

    // Login as Alice to get JWT
    const loginAliceRes = await request(server)
      .post('/login')
      .send({ username: aliceUsername })
      .expect(201);

    const aliceToken = loginAliceRes.body.token as string;

    // Topup Alice balance
    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amount: 1000 })
      .expect(204);

    // Check Alice balance after topup
    const balanceAfterTopup = await request(server)
      .get('/balance')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(balanceAfterTopup.body).toEqual({ balance: 1000 });

    // Transfer from Alice to Bob
    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ to_username: bobUsername, amount: 400 })
      .expect(204);

    // Login as Bob to inspect his balance
    const loginBobRes = await request(server)
      .post('/login')
      .send({ username: bobUsername })
      .expect(201);

    const bobToken = loginBobRes.body.token as string;

    // Alice balance should now be 600
    const aliceBalanceAfterTransfer = await request(server)
      .get('/balance')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(aliceBalanceAfterTransfer.body).toEqual({ balance: 600 });

    // Bob balance should be 400
    const bobBalanceAfterTransfer = await request(server)
      .get('/balance')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    expect(bobBalanceAfterTransfer.body).toEqual({ balance: 400 });

    // Top transactions per user for Alice
    const topTransactionsForAlice = await request(server)
      .get('/top_transactions_per_user')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(Array.isArray(topTransactionsForAlice.body)).toBe(true);
    expect(topTransactionsForAlice.body.length).toBeGreaterThanOrEqual(1);
    expect(topTransactionsForAlice.body[0]).toMatchObject({
      username: bobUsername,
      amount: -400,
    });

    // Top users should reflect Alice as having outbound 400
    const topUsersRes = await request(server)
      .get('/top_users')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(Array.isArray(topUsersRes.body)).toBe(true);
    expect(topUsersRes.body.length).toBeGreaterThanOrEqual(1);
    expect(topUsersRes.body[0]).toMatchObject({
      username: aliceUsername,
      transacted_value: 400,
    });
  });

  it('rejects duplicate username registration', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const username = 'dup_user_e2e';

    await request(server)
      .post('/user')
      .send({ username })
      .expect(201);

    await request(server)
      .post('/user')
      .send({ username })
      .expect(409);
  });

  it('rejects invalid topup amounts', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const username = 'topup_invalid_e2e';

    const registerRes = await request(server)
      .post('/user')
      .send({ username })
      .expect(201);

    expect(typeof registerRes.body.token).toBe('string');

    const loginRes = await request(server)
      .post('/login')
      .send({ username })
      .expect(201);

    const token = loginRes.body.token as string;

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10.5 })
      .expect(400);

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 0 })
      .expect(400);

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: -1 })
      .expect(400);

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10_000_000 })
      .expect(400);
  });

  it('rejects transfer with insufficient balance', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const sender = 'sender_no_balance_e2e';
    const receiver = 'receiver_no_balance_e2e';

    await request(server)
      .post('/user')
      .send({ username: sender })
      .expect(201);

    await request(server)
      .post('/user')
      .send({ username: receiver })
      .expect(201);

    const loginSenderRes = await request(server)
      .post('/login')
      .send({ username: sender })
      .expect(201);

    const senderToken = loginSenderRes.body.token as string;

    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ to_username: receiver, amount: 100 })
      .expect(400);
  });

  it('requires JWT for protected endpoints', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    await request(server)
      .post('/topup')
      .send({ amount: 1000 })
      .expect(401);

    await request(server)
      .get('/balance')
      .expect(401);

    await request(server)
      .post('/transfer')
      .send({ to_username: 'someone', amount: 100 })
      .expect(401);

    await request(server)
      .get('/top_transactions_per_user')
      .expect(401);

    await request(server)
      .get('/top_users')
      .expect(401);
  });

  it('accepts raw JWT without Bearer prefix', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const username = 'raw_token_user_e2e';

    await request(server)
      .post('/user')
      .send({ username })
      .expect(201);

    const loginRes = await request(server)
      .post('/login')
      .send({ username })
      .expect(201);

    const token = loginRes.body.token as string;

    await request(server)
      .post('/topup')
      .set('Authorization', token)
      .send({ amount: 500 })
      .expect(204);

    const balanceRes = await request(server)
      .get('/balance')
      .set('Authorization', token)
      .expect(200);

    expect(balanceRes.body).toEqual({ balance: 500 });
  });

  it('returns empty reporting when user has no transactions', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const username = 'no_tx_user_e2e';

    await request(server)
      .post('/user')
      .send({ username })
      .expect(201);

    const loginRes = await request(server)
      .post('/login')
      .send({ username })
      .expect(201);

    const token = loginRes.body.token as string;

    const topTxRes = await request(server)
      .get('/top_transactions_per_user')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(topTxRes.body).toEqual([]);

    const topUsersRes = await request(server)
      .get('/top_users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(topUsersRes.body).toEqual([]);
  });

  it('ranks top users by total outbound desc', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const highSender = 'sender_high_e2e';
    const lowSender = 'sender_low_e2e';
    const receiver = 'receiver_stats_e2e';

    await request(server)
      .post('/user')
      .send({ username: highSender })
      .expect(201);

    await request(server)
      .post('/user')
      .send({ username: lowSender })
      .expect(201);

    await request(server)
      .post('/user')
      .send({ username: receiver })
      .expect(201);

    const loginHighRes = await request(server)
      .post('/login')
      .send({ username: highSender })
      .expect(201);

    const highToken = loginHighRes.body.token as string;

    const loginLowRes = await request(server)
      .post('/login')
      .send({ username: lowSender })
      .expect(201);

    const lowToken = loginLowRes.body.token as string;

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${highToken}`)
      .send({ amount: 1000 })
      .expect(204);

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${lowToken}`)
      .send({ amount: 1000 })
      .expect(204);

    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${highToken}`)
      .send({ to_username: receiver, amount: 300 })
      .expect(204);

    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${lowToken}`)
      .send({ to_username: receiver, amount: 100 })
      .expect(204);

    const topUsersRes = await request(server)
      .get('/top_users')
      .set('Authorization', `Bearer ${highToken}`)
      .expect(200);

    const topUsers = topUsersRes.body;
    expect(Array.isArray(topUsers)).toBe(true);
    expect(topUsers.length).toBeGreaterThanOrEqual(2);
    expect(topUsers[0]).toMatchObject({
      username: highSender,
      transacted_value: 300,
    });
    expect(topUsers[1]).toMatchObject({
      username: lowSender,
      transacted_value: 100,
    });
  });

  it('orders top transactions per user by absolute amount desc', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const sender = 'tx_sort_sender_e2e';
    const receiver = 'tx_sort_receiver_e2e';

    await request(server)
      .post('/user')
      .send({ username: sender })
      .expect(201);

    await request(server)
      .post('/user')
      .send({ username: receiver })
      .expect(201);

    const loginSenderRes = await request(server)
      .post('/login')
      .send({ username: sender })
      .expect(201);

    const senderToken = loginSenderRes.body.token as string;

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount: 1000 })
      .expect(204);

    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ to_username: receiver, amount: 100 })
      .expect(204);

    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ to_username: receiver, amount: 300 })
      .expect(204);

    const topTxRes = await request(server)
      .get('/top_transactions_per_user')
      .set('Authorization', `Bearer ${senderToken}`)
      .expect(200);

    const items = topTxRes.body;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toMatchObject({
      username: receiver,
      amount: -300,
    });
    expect(items[1]).toMatchObject({
      username: receiver,
      amount: -100,
    });
  });

  it('handles concurrent transfers without allowing negative balance', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const sender = 'concurrent_sender_e2e';
    const receiver = 'concurrent_receiver_e2e';

    await request(server)
      .post('/user')
      .send({ username: sender })
      .expect(201);

    await request(server)
      .post('/user')
      .send({ username: receiver })
      .expect(201);

    const loginSenderRes = await request(server)
      .post('/login')
      .send({ username: sender })
      .expect(201);

    const senderToken = loginSenderRes.body.token as string;

    await request(server)
      .post('/topup')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ amount: 1000 })
      .expect(204);

    const transferReq = () =>
      request(server)
        .post('/transfer')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({ to_username: receiver, amount: 800 });

    const [res1, res2] = await Promise.all([transferReq(), transferReq()]);
    const statuses = [res1.status, res2.status].sort((a, b) => a - b);

    expect(statuses).toEqual([204, 400]);

    const loginReceiverRes = await request(server)
      .post('/login')
      .send({ username: receiver })
      .expect(201);

    const receiverToken = loginReceiverRes.body.token as string;

    const senderBalanceRes = await request(server)
      .get('/balance')
      .set('Authorization', `Bearer ${senderToken}`)
      .expect(200);

    const receiverBalanceRes = await request(server)
      .get('/balance')
      .set('Authorization', `Bearer ${receiverToken}`)
      .expect(200);

    expect(senderBalanceRes.body).toEqual({ balance: 200 });
    expect(receiverBalanceRes.body).toEqual({ balance: 800 });
  });

  it('returns 404 when transferring to a non-existent target user', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const sender = 'sender_notfound_target_e2e';

    await request(server)
      .post('/user')
      .send({ username: sender })
      .expect(201);

    const loginSenderRes = await request(server)
      .post('/login')
      .send({ username: sender })
      .expect(201);

    const senderToken = loginSenderRes.body.token as string;

    await request(server)
      .post('/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ to_username: 'non_existent_user_e2e', amount: 100 })
      .expect(404);
  });

  it('rejects requests with an invalid JWT', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const invalidToken = 'invalid.token.value';

    await request(server)
      .get('/balance')
      .set('Authorization', `Bearer ${invalidToken}`)
      .expect(401);
  });

  it('applies rate limiting on login', async () => {
    await resetDatabase();
    const server = app.getHttpServer();

    const username = 'rate_limit_login_user_e2e';

    await request(server)
      .post('/user')
      .send({ username })
      .expect(201);

    for (let i = 0; i < 50; i++) {
      await request(server)
        .post('/login')
        .send({ username })
        .expect(201);
    }

    await request(server)
      .post('/login')
      .send({ username })
      .expect(429);
  });
});
