import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

@Injectable()
export default class PasswordHelper {
  constructor() {}

  generatePassword(length = 16) {
    if (length < 4) {
      throw new Error(
        'Length must be at least 4 characters to ensure complexity.',
      );
    }

    const charset = {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numbers: '0123456789',
      symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-=',
    };

    // 1. Ensure at least one character from each pool is selected
    const passwordArray = [
      charset.lowercase[this.getRandomInt(charset.lowercase.length)],
      charset.uppercase[this.getRandomInt(charset.uppercase.length)],
      charset.numbers[this.getRandomInt(charset.numbers.length)],
      charset.symbols[this.getRandomInt(charset.symbols.length)],
    ];

    // 2. Fill the remaining length with a completely random mixture
    const allChars = Object.values(charset).join('');
    for (let i = passwordArray.length; i < length; i++) {
      passwordArray.push(allChars[this.getRandomInt(allChars.length)]);
    }

    // 3. Shuffle the array to mask the predictable positions of the first 4 characters
    return this.shuffleArray(passwordArray).join('');
  }

  // Cryptographically secure random integer generation
  private getRandomInt(max) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    return randomBuffer[0] % max;
  }

  // Fisher-Yates shuffle algorithm using secure random values
  private shuffleArray(array: string[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.getRandomInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async hashUserPassword(password: string): Promise<string> {
    const saltRounds = 12;
    const secureHash = await bcrypt.hash(password, saltRounds);
    return secureHash;
  }

  async verifyUserPassword(
    inputPassword: string,
    storedHash: string,
  ): Promise<boolean> {
    const isMatch = await bcrypt.compare(inputPassword, storedHash);
    return isMatch;
  }

  hashbySHA256(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }
}
