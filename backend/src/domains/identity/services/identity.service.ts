import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Identity } from '../identity.entity';

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>
  ) {}

  async registerIdentity(publicKeyBase64: string): Promise<Identity> {
    let publicKeyBuffer: Buffer;
    try {
      publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
      if (publicKeyBuffer.length !== 32) {
        throw new Error('Invalid public key length');
      }
    } catch {
      throw new ConflictException('Invalid public key format');
    }

    // Check for existing identity
    const existingIdentity = await this.identityRepository.findOne({
      where: { masterPublicKey: publicKeyBuffer },
    });

    if (existingIdentity) {
      return existingIdentity;
    }

    // Create new identity
    const identity = this.identityRepository.create({
      masterPublicKey: publicKeyBuffer,
    });
    return await this.identityRepository.save(identity);
  }

  async findByIdentityId(identityId: string) {
    return await this.identityRepository.findOne({
      where: { id: identityId },
    });
  }

  async findByIdentityPublicKey(publicKeyBase64: string) {
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    return await this.identityRepository.findOne({
      where: { masterPublicKey: publicKey },
    });
  }
}
