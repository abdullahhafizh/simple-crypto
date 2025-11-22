import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildDatabaseUrlFromEnv } from '../db-url';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = buildDatabaseUrlFromEnv();
    const adapter = new PrismaPg({ connectionString });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.$executeRaw`SET TIME ZONE 'Asia/Jakarta'`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
