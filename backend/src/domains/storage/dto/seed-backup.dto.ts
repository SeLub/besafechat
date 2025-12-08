import { IsString, IsNumber, IsObject } from 'class-validator';

export class UploadSeedBackupDto {
  @IsString()
  encrypted!: string;

  @IsString()
  salt!: string;

  @IsString()
  iv!: string;

  @IsString()
  authTag!: string;

  @IsNumber()
  version!: number;

  @IsObject()
  kdfParams!: {
    algorithm: string;
    timeCost: number;
    memoryCost: number;
    parallelism: number;
    hashLength: number;
  };
}

export class SeedBackupResponseDto {
  encrypted!: string;
  salt!: string;
  iv!: string;
  authTag!: string;
  version!: number;
  kdfParams: any;
  publicKey!: string;
  createdAt!: number;
}
