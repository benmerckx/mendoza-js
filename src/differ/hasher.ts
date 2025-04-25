import {type Hash, sha256, TypeTag} from './hash'

export class MapHasher {
  private parts: Uint8Array[] = [new Uint8Array([TypeTag.Map])]

  writeField(key: string, hash: Hash) {
    const enc = new TextEncoder().encode(key)
    this.parts.push(new Uint8Array([TypeTag.String]))
    this.parts.push(enc)
    this.parts.push(hash)
  }

  async sum(): Promise<Hash> {
    return sha256(concat(...this.parts))
  }
}

export class SliceHasher {
  private parts: Uint8Array[] = [new Uint8Array([TypeTag.Slice])]

  writeElement(hash: Hash) {
    this.parts.push(hash)
  }

  async sum(): Promise<Hash> {
    return sha256(concat(...this.parts))
  }
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
