import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../rate-limit.guard';
import { TransferDto } from './dto/transfer.dto';
import { TransferService } from './transfer.service';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller()
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('transfer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async transfer(
    @Req() req: RequestWithUser,
    @Body() body: TransferDto,
  ): Promise<void> {
    await this.transferService.transfer(req.user.id, body.to_username, body.amount);
  }
}
