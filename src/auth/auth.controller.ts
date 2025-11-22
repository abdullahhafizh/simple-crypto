import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller()
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Post('login')
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
