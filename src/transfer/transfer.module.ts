import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../rate-limit.guard';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';

@Module({
  controllers: [TransferController],
  providers: [TransferService, PrismaService, JwtAuthGuard, RateLimitGuard],
})
export class TransferModule {}
