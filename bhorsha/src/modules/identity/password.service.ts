import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly rounds: number;
  private dummyHash?: Promise<string>;

  constructor(config: ConfigService) {
    this.rounds = Number(config.get<string>('BCRYPT_ROUNDS', '12'));
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Runs a compare against a throwaway hash, so a login with an unknown phone
   * takes as long as one with a wrong password and doesn't reveal which
   * phones are registered.
   */
  async compareWithDummy(password: string): Promise<void> {
    this.dummyHash ??= bcrypt.hash('not-a-real-password', this.rounds);
    await bcrypt.compare(password, await this.dummyHash);
  }
}
