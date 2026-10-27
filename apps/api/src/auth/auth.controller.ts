import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RATE_LIMITS } from '../common/rate-limit.config';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { GoogleCredentialDto } from './dto/google-credential.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.register, scope: 'ip' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.login, scope: 'ip' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.google, scope: 'ip' })
  google(@Body() dto: GoogleCredentialDto) {
    return this.authService.loginWithGoogle(
      dto.credential,
      dto.device,
      dto.referralCode,
    );
  }

  @Post('google/link')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @RateLimit({ ...RATE_LIMITS.google, scope: 'user' })
  linkGoogle(@CurrentUser() user: AuthUser, @Body() dto: GoogleCredentialDto) {
    return this.authService.linkGoogle(user.userId, dto.credential);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.sessionId);
  }
}
