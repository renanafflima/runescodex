import { Module, forwardRef } from '@nestjs/common';
import { ReferralsModule } from '../referrals/referrals.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { assertJwtSecret, resolveAppEnv } from '../common/database-target';
import { AuthController } from './auth.controller';
import { AuthDevicesController } from './auth-devices.controller';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { GoogleIdentityService } from './google-identity';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    forwardRef(() => ReferralsModule),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET is not set');
        }
        assertJwtSecret(resolveAppEnv(process.env), secret);

        return {
          secret,
          signOptions: {
            expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as `${number}d`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, AuthDevicesController],
  providers: [AuthService, DeviceService, GoogleIdentityService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
