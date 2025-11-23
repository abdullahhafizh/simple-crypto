import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RateLimitGuard } from '../rate-limit.guard';
import { verifyPassword } from './password.util';

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

    if (!user || !user.password) {
      throw new UnauthorizedException();
    }

    const passwordValid = await verifyPassword(body.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException();
    }

    const token = this.authService.signUser({
      id: user.id,
      username: user.username,
    });

    return { token };
  }
}
