import {type Hash, HASH_FALSE, HASH_NULL, HASH_TRUE, hashFloat64, hashString, xorHash} from './hash'
import {MapHasher, SliceHasher} from './hasher'

export type Reference = {index: number; key?: string}

export type HashEntry = {
  hash: Hash
  xorHash: Hash
  value: unknown
  size: number
  parent: number
  sibling: number
  ref: Reference
}

export class HashList {
  entries: HashEntry[] = []

  constructor(public root: unknown) {}

  async build() {
    await this.addNode(-1, {index: 0}, this.root)
    return this
  }

  async addNode(parent: number, ref: Reference, value: unknown): Promise<Hash> {
    const idx = this.entries.length
    let xor: Hash | null = null

    const entry: HashEntry = {
      hash: new Uint8Array(32), // placeholder
      xorHash: null!,
      value,
      size: 1,
      parent,
      sibling: -1,
      ref,
    }

    this.entries.push(entry)

    if (value === null) {
      entry.hash = await HASH_NULL
    } else if (typeof value === 'boolean') {
      entry.hash = await (value ? HASH_TRUE : HASH_FALSE)
    } else if (typeof value === 'number') {
      entry.hash = await hashFloat64(value)
    } else if (typeof value === 'string') {
      entry.hash = await hashString(value)
      entry.size = value.length + 1
    } else if (Array.isArray(value)) {
      const hasher = new SliceHasher()
      let prev = -1

      for (let i = 0; i < value.length; i++) {
        const child = value[i]
        const childIdx = this.entries.length
        const childHash = await this.addNode(idx, {index: i}, child)

        this.entries[childIdx].sibling = -1
        if (prev !== -1) this.entries[prev].sibling = childIdx
        prev = childIdx

        hasher.writeElement(childHash)
        entry.size += this.entries[childIdx].size + 1
      }

      entry.hash = await hasher.sum()
    } else if (typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj).sort()
      const hasher = new MapHasher()
      let prev = -1

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const val = obj[key]
        const childIdx = this.entries.length
        const childHash = await this.addNode(idx, {index: i, key}, val)

        this.entries[childIdx].sibling = -1
        if (prev !== -1) this.entries[prev].sibling = childIdx
        prev = childIdx

        hasher.writeField(key, childHash)
        xor = xor ? xorHash(xor, childHash) : childHash
        entry.size += key.length + this.entries[childIdx].size + 1
      }

      entry.hash = await hasher.sum()
    } else {
      throw new Error(`Unsupported type: ${typeof value}`)
    }

    entry.xorHash = xor!
    return entry.hash
  }
}
