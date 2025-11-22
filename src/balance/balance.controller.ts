import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../rate-limit.guard';
import { BalanceService } from './balance.service';
import { TopupBalanceDto } from './dto/topup-balance.dto';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller()
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Post('topup')
  @HttpCode(HttpStatus.NO_CONTENT)
  async topup(
    @Req() req: RequestWithUser,
    @Body() body: TopupBalanceDto,
  ): Promise<void> {
    await this.balanceService.topup(req.user.id, body.amount);
  }

  @Get('balance')
  async getBalance(@Req() req: RequestWithUser) {
    return this.balanceService.getBalance(req.user.id);
  }
}
