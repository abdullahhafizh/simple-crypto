import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { RateLimitGuard } from '../rate-limit.guard';

@Controller('user')
@UseGuards(RateLimitGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async register(@Body() body: RegisterUserDto) {
    return this.userService.register(body.username);
  }
}
