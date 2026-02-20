import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = Record<string, unknown>> {
  @ApiProperty({
    description: 'Indicates whether the request was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'The response data (present when success is true)',
    example: { id: '123', name: 'example' },
    required: false,
  })
  data?: T;

  @ApiProperty({
    description: 'Error message (present when success is false)',
    example: 'Something went wrong',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Additional message about the response',
    example: 'Operation completed successfully',
    required: false,
  })
  message?: string;

  constructor(success: boolean, data?: T, error?: string, message?: string) {
    this.success = success;
    if (data !== undefined) this.data = data;
    if (error !== undefined) this.error = error;
    if (message !== undefined) this.message = message;
  }
}
