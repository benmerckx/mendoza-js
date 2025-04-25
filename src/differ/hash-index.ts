import {xorHash} from './hash'
import type {HashEntry} from './hash-list'

export class HashIndex {
  readonly data: Map<string, number[]> = new Map()
  readonly xorData: Map<string, number[]> = new Map()

  constructor(entries: HashEntry[]) {
    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx]

      // Store full hash => idx mapping
      const key = hashKey(entry.hash)
      push(this.data, key, idx)

      // Store xor hash => idx mapping for structured nodes
      if (entry.xorHash) {
        let xor = entry.xorHash
        let child = entries[idx].sibling

        while (child !== -1) {
          xor = xorHash(xor, entries[child].hash)
          const xorK = hashKey(xor)
          const current = this.xorData.get(xorK)

          if (!current || current[current.length - 1] !== idx) {
            push(this.xorData, xorK, idx)
          }

          child = entries[child].sibling
        }
      }
    }
  }
}

function push(map: Map<string, number[]>, key: string, idx: number) {
  if (!map.has(key)) map.set(key, [])
  map.get(key)!.push(idx)
}

function hashKey(hash: Uint8Array): string {
  return Array.from(hash).join(',')
}
