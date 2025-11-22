import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtCryptoService } from './jwt-crypto.service';
import { AuthController } from './auth.controller';
import { RateLimitGuard } from '../rate-limit.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<JwtModuleOptions> => {
        const raw = configService.get<string>('JWT_EXPIRES_IN');
        const defaultMs = 15 * 60 * 1000; // 15 minutes in ms
        const fromEnv = raw !== undefined ? Number(raw) : NaN;
        const ms = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : defaultMs;
        const expiresInSeconds = Math.floor(ms / 1000);

        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService, JwtCryptoService, RateLimitGuard],
  exports: [AuthService],
})
export class AuthModule {}
