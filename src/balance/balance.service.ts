import { BadRequestException, Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { ulid } from 'ulid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async topup(userId: string, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new BadRequestException('Invalid amount');
    }

    if (amount <= 0 || amount >= 10_000_000) {
      throw new BadRequestException('Amount out of allowed range');
    }

    const amountBigInt = BigInt(amount);
    const txId = ulid();

    await this.prisma.$transaction(async (tx) => {
      // Row-level lock on the user to ensure mutual exclusion for balance-changing operations
      await tx.$executeRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      await tx.transaction.create({
        data: {
          id: txId,
          amount: amountBigInt,
          type: TransactionType.CREDIT,
          toUserId: userId,
          fromUserId: null,
        },
      });
    });
  }

  async getBalance(userId: string): Promise<{ balance: number }> {
    const [creditAgg, debitAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { toUserId: userId, type: TransactionType.CREDIT },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { fromUserId: userId, type: TransactionType.DEBIT },
        _sum: { amount: true },
      }),
    ]);

    const creditSum = creditAgg._sum.amount ?? 0n;
    const debitSum = debitAgg._sum.amount ?? 0n;

    const balanceBigInt = creditSum - debitSum;
    const balance = Number(balanceBigInt);

    return { balance };
  }
}
