// src/domains/user/controllers/auth.controller.ts
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
import { UserService } from '../services/user.service'; // ← импорт

@Controller('auth')
export class AuthController {
  constructor(private userService: UserService) {} // ← инъекция

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.userService.registerUser(
      registerDto.publicKey,
      registerDto.displayName
    );
    return {
      success: true,
      message: 'User registered successfully',
      userId: user.id,
    };
  }
}
