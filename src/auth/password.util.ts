import argon2 from 'argon2';
import { randomBytes, timingSafeEqual } from 'crypto';

const ARGON2_TIME_COST = 3;
const ARGON2_MEMORY_COST = 1 << 16; // 65536 KiB
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;
const ARGON2_SALT_LENGTH = 16;
const ARGON2_SALT_HEX_LENGTH = ARGON2_SALT_LENGTH * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(ARGON2_SALT_LENGTH);

  const hash = (await argon2.hash(password, {
    type: argon2.argon2id,
    timeCost: ARGON2_TIME_COST,
    memoryCost: ARGON2_MEMORY_COST,
    parallelism: ARGON2_PARALLELISM,
    hashLength: ARGON2_HASH_LENGTH,
    salt,
    raw: true,
  })) as Buffer;

  const saltHex = salt.toString('hex');
  const hashHex = hash.toString('hex');

  return `${saltHex}${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const storedHex = stored.trim();

    if (storedHex.length <= ARGON2_SALT_HEX_LENGTH) {
      return false;
    }

    const saltHex = storedHex.slice(0, ARGON2_SALT_HEX_LENGTH);
    const hashHex = storedHex.slice(ARGON2_SALT_HEX_LENGTH);

    const salt = Buffer.from(saltHex, 'hex');
    const storedHash = Buffer.from(hashHex, 'hex');

    const computedHash = (await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: ARGON2_TIME_COST,
      memoryCost: ARGON2_MEMORY_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: storedHash.length,
      salt,
      raw: true,
    })) as Buffer;

    if (computedHash.length !== storedHash.length) {
      return false;
    }

    return timingSafeEqual(computedHash, storedHash);
  } catch {
    return false;
  }
}
