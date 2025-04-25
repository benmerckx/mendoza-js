export type Hash = Uint8Array // Always 32 bytes (SHA-256)

export async function sha256(input: Uint8Array): Promise<Hash> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', input)
  return new Uint8Array(hashBuffer)
}

export function xorHash(a: Hash, b: Hash): Hash {
  if (a.length !== b.length) throw new Error('Hash length mismatch in xorHash')
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

function tag(type: number): Uint8Array {
  return new Uint8Array([type])
}

export const enum TypeTag {
  String = 0,
  Float = 1,
  Map = 2,
  Slice = 3,
  True = 4,
  False = 5,
  Null = 6,
}

export async function hashString(str: string): Promise<Hash> {
  const enc = new TextEncoder().encode(str)
  return sha256(concat(tag(TypeTag.String), enc))
}

export async function hashFloat64(n: number): Promise<Hash> {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setFloat64(0, n, false) // big-endian
  return sha256(concat(tag(TypeTag.Float), new Uint8Array(buf)))
}

export const HASH_TRUE = sha256(tag(TypeTag.True))
export const HASH_FALSE = sha256(tag(TypeTag.False))
export const HASH_NULL = sha256(tag(TypeTag.Null))

function concat(...chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((a, b) => a + b.length, 0)
  const result = new Uint8Array(len)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
