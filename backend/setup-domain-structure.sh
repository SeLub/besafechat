#!/bin/bash

# Создаём доменные папки
mkdir -p src/domains/user/{dto,controllers,services}
mkdir -p src/domains/username/{dto,controllers,services}

# =============== USER DOMAIN ===============

# DTO
cat > src/domains/user/dto/register.dto.ts << 'EOF'
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsDtoBe64()
  @Length(44, 44, { message: 'Public key must be 44 characters (base64-encoded Ed25519 key)' })
  publicKey: string;

  @IsString()
  @Length(1, 64, { message: 'Display name must be between 1 and 64 characters' })
  displayName?: string;
}

// Кастомный декоратор для base64
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsDtoBe64(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isDtoBe64',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          // Проверка base64 (44 символа = 32 байта Ed25519 в base64)
          return /^[A-Za-z0-9+/]{43}=$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Public key must be valid base64-encoded Ed25519 key';
        },
      },
    });
  };
}
EOF

# Контроллер
cat > src/domains/user/controllers/auth.controller.ts << 'EOF'
import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';

@Controller('auth')
export class AuthController {
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(@Body() registerDto: RegisterDto) {
    // Логика будет в UserService
    return {
      success: true,
      message: 'User registered successfully',
    };
  }
}
EOF

# Сервис (заглушка)
cat > src/domains/user/services/user.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  async registerUser(publicKey: string, displayName?: string) {
    // Реализация позже
    return { id: 'mock-id', publicKey };
  }
}
EOF

# Модуль
cat > src/domains/user/user.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Session } from './session.entity';
import { AuthController } from './controllers/auth.controller';
import { UserService } s './services/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AuthController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
EOF

# =============== USERNAME DOMAIN ===============

# DTO
cat > src/domains/username/dto/set-username.dto.ts << 'EOF'
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SetUsernameDto {
  @IsNotEmpty()
  @IsString()
  @Length(5, 32, { message: 'Username must be between 5 and 32 characters' })
  @Matches(/^[a-z0-9_]+$/, { message: 'Username can only contain lowercase letters, digits, and underscores' })
  username: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^(yes|no)$/, { message: 'isSearchable must be "yes" or "no"' })
  isSearchable: string;
}
EOF

# DTO для поиска
cat > src/domains/username/dto/search-username.dto.ts << 'EOF'
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SearchUsernameDto {
  @IsNotEmpty()
  @IsString()
  @Length(5, 32)
  @Matches(/^[a-z0-9_]+$/)
  username: string;
}
EOF

# Контроллер
cat > src/domains/username/controllers/username.controller.ts << 'EOF'
import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SetUsernameDto } from '../dto/set-username.dto';

@Controller('username')
export class UsernameController {
  @Post('set')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async setUsername(@Body() dto: SetUsernameDto) {
    return { success: true, message: 'Username updated' };
  }

  @Get('search/:username')
  @HttpCode(HttpStatus.OK)
  async search(@Param('username') username: string) {
    // Валидация параметра — в сервисе
    return { found: false };
  }
}
EOF

# Сервис (заглушка)
cat > src/domains/username/services/username.service.ts << 'EOF'
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsernameService {
  async setUsername(userId: string, username: string, isSearchable: boolean) {
    // Реализация позже
    return { username, isSearchable };
  }

  async findUserByUsername(username: string) {
    return null; // или данные пользователя
  }
}
EOF

# Модуль
cat > src/domains/username/username.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Username } from './username.entity';
import { UsernameController } from './controllers/username.controller';
import { UsernameService } from './services/username.service';

@Module({
  imports: [TypeOrmModule.forFeature([Username])],
  controllers: [UsernameController],
  providers: [UsernameService],
  exports: [UsernameService],
})
export class UsernameModule {}
EOF

# =============== Обновляем AppModule ===============
APP_MODULE_PATH="src/app.module.ts"

if [[ -f "$APP_MODULE_PATH" ]]; then
  # Добавляем импорты модулей
  if ! grep -q "UserModule" "$APP_MODULE_PATH"; then
    sed -i "s/import { Module } from '@nestjs\/common';/import { Module } from '@nestjs\/common';\
import { UserModule } from '.\/domains\/user\/user.module';\
import { UsernameModule } from '.\/domains\/username\/username.module';/" "$APP_MODULE_PATH"
  fi

  # Добавляем в imports
  if ! grep -q "UserModule" "$APP_MODULE_PATH"; then
    sed -i "s/  imports: \[/  imports: [UserModule, UsernameModule,/" "$APP_MODULE_PATH"
  fi

  echo "✅ AppModule обновлён: подключены UserModule и UsernameModule"
else
  echo "⚠️  Создайте src/app.module.ts вручную и добавьте:"
  echo "   import { UserModule } from './domains/user/user.module';"
  echo "   import { UsernameModule } from './domains/username/username.module';"
  echo "   imports: [UserModule, UsernameModule, ...]"
fi

echo "✅ Доменная структура создана!"
echo "📁 Структура:"
echo "   src/domains/user/{dto,controllers,services}/*.ts"
echo "   src/domains/username/{dto,controllers,services}/*.ts"
echo "🚀 Теперь каждый домен — независимый модуль NestJS"