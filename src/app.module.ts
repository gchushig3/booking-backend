import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { CommonModule } from './common/common.module';
// import { AlojamientosModule } from './modules/alojamientos/alojamientos.module';
// import { AutosModule } from './modules/autos/autos.module';
import { AtraccionesModule } from './modules/atracciones/atracciones.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { JwtStrategy } from './common/auth/jwt.strategy';
import { RolesGuard } from './common/auth/roles.guard';
// import { VuelosModule } from './modules/vuelos/vuelos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    CommonModule,
    AuthModule,
    AtraccionesModule,
  ],
  controllers: [],
  providers: [
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
