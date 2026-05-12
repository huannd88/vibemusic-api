/**
 * Environment Validation
 * =====================================================
 * Validates required env vars at startup using class-validator.
 * App fails fast with clear error messages if config is invalid.
 */

import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum AppRoleEnum {
  API = 'api',
  WORKER = 'worker',
  ALL = 'all',
}

class EnvironmentVariables {
  // === Core ===
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsEnum(AppRoleEnum)
  @IsOptional()
  APP_ROLE: AppRoleEnum = AppRoleEnum.ALL;

  // === Database ===
  @IsString()
  @IsNotEmpty({
    message:
      'DATABASE_URL is required (e.g. postgresql://user:pass@host:5432/db)',
  })
  DATABASE_URL: string;

  // === Redis ===
  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  // === Auth ===
  @IsString()
  @IsNotEmpty({
    message:
      'JWT_SECRET is required — generate a strong random secret for production',
  })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '15m';

  @IsString()
  @IsNotEmpty({
    message: 'JWT_REFRESH_SECRET is required — must differ from JWT_SECRET',
  })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '7d';

  // === AI ===
  @IsString()
  @IsOptional()
  AI_BASE_URL?: string;

  @IsString()
  @IsOptional()
  AI_API_KEY?: string;

  @IsString()
  @IsOptional()
  AI_MODEL?: string;

  // === CORS ===
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // === Encryption ===
  @IsString()
  @IsOptional()
  ENCRYPT_SECRET?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => {
        const constraints = Object.values(err.constraints || {}).join(', ');
        return `  ✗ ${err.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(
      `\n🚨 Environment validation failed:\n${messages}\n\n` +
        `→ Check .env file or environment variables.\n` +
        `→ See .env.example for reference.\n`,
    );
  }

  return validatedConfig;
}
