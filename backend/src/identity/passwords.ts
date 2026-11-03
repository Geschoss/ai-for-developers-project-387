import { randomBytes } from "node:crypto";

import { argon2Verify, argon2id } from "hash-wasm";

// OWASP argon2id: 19 MiB of memory, 2 iterations, parallelism 1, 32-byte tag, 16-byte salt.
// oxlint-disable-next-line eslint/no-magic-numbers -- hash length in bytes
const hashLength = 32;
// oxlint-disable-next-line eslint/no-magic-numbers -- OWASP argon2id iterations
const iterations = 2;
// oxlint-disable-next-line eslint/no-magic-numbers -- 19 MiB, the OWASP argon2id memory cost
const memorySize = 19_456;
const parallelism = 1;
// oxlint-disable-next-line eslint/no-magic-numbers -- 128-bit salt
const saltBytes = 16;

/** Argon2id hash in the encoded PHC form, ready to store. */
const hashPassword = async (password: string): Promise<string> => {
  const encoded = await argon2id({
    hashLength,
    iterations,
    memorySize,
    outputType: "encoded",
    parallelism,
    password,
    salt: randomBytes(saltBytes),
  });
  return encoded;
};

/** True when `password` matches a hash produced by {@link hashPassword}. */
const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> => {
  const matches = await argon2Verify({ hash: passwordHash, password });
  return matches;
};

export { hashPassword, verifyPassword };
