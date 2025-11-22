import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RateLimitGuard } from '../rate-limit.guard';

@Controller()
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  @UseGuards(RateLimitGuard)
  async login(@Body() body: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: body.username },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const token = this.authService.signUser({
      id: user.id,
      username: user.username,
    });

    return { token };
  }
}
