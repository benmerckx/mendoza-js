import {HashIndex} from './differ/hash-index'
import {type HashEntry, HashList} from './differ/hash-list'
import type {RawPatch} from './patch'
import {commonPrefix, commonSuffix, utf8resolveIndex, utf8stringSize} from './utf8'

/**
 * Generate a Mendoza patch that transforms `left` into `right`.
 */
export async function createPatch(left: unknown, right: unknown): Promise<RawPatch> {
  if (left === right) return []

  const [leftList, rightList] = await Promise.all([buildHashList(left), buildHashList(right)])

  if (equalHash(leftList.entries[0].hash, rightList.entries[0].hash)) {
    return []
  }

  const index = new HashIndex(leftList.entries)
  const differ = new Differ(leftList, rightList, index)
  return differ.build()
}

function buildHashList(doc: unknown): Promise<HashList> {
  const list = new HashList(doc)
  return list.build().then(() => list)
}

function equalHash(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

type Request = {
  contextIdx: number
  primaryIdx: number
  patch: RawPatch
  cost: number
  outputKey?: string
}

class Differ {
  constructor(
    private left: HashList,
    private right: HashList,
    private index: HashIndex,
  ) {}

  build(): RawPatch {
    const targetIdx = 0
    const target = this.right.entries[targetIdx]

    const requests: Request[] = [
      {
        contextIdx: -1,
        primaryIdx: 0,
        patch: [],
        cost: target.size + 1,
      },
    ]

    const patch = this.reconstruct(targetIdx, requests)
    return patch ?? [0, this.right.entries[0].value] // fallback to OpValue
  }

  private reconstruct(idx: number, reqs: Request[]): RawPatch | undefined {
    const entry = this.right.entries[idx]
    const contextVal = this.left.entries[0].value

    if (Array.isArray(entry.value) && Array.isArray(contextVal)) return this.reconstructArray(idx)
    if (this.isObject(entry.value) && this.isObject(contextVal)) return this.reconstructObject(idx)
    if (typeof entry.value === 'string' && typeof contextVal === 'string')
      return this.reconstructString(entry.value, reqs)
    return [0, entry.value]
  }

  private reconstructObject(idx: number): RawPatch {
    const rightFields = this.iterChildren(idx)
    const patch: RawPatch = []

    patch.push(2) // OpBlank

    if (rightFields.length === 0) {
      patch.push(4, '') // OpReturnIntoObject with dummy key to materialize object
      return patch
    }

    for (const field of rightFields) {
      const sameHashIndices = this.index.data.get(Array.from(field.hash).join(',')) || []
      let reused = false

      for (const matchIdx of sameHashIndices) {
        const match = this.left.entries[matchIdx]
        if (
          match.parent >= 0 &&
          match.ref.key === field.ref.key &&
          this.left.entries[match.parent].ref.index === this.right.entries[idx].ref.index
        ) {
          patch.push(18, match.ref.index)
          reused = true
          break
        }
      }

      if (!reused) {
        patch.push(0, field.value)
        patch.push(4, field.ref.key!)
      }
    }

    return patch
  }

  private reconstructArray(idx: number): RawPatch {
    const rightElems = this.iterChildren(idx)
    const patch: RawPatch = []

    patch.push(2) // OpBlank

    if (rightElems.length === 0) {
      patch.push(3) // OpReturnIntoArray
      patch.push(9) // OpPop
      return patch
    }

    let sliceStart = -1
    for (let i = 0; i < rightElems.length; i++) {
      const elem = rightElems[i]
      const matchIndices = this.index.data.get(Array.from(elem.hash).join(',')) || []
      const matchIdx = matchIndices.find((ix) => this.left.entries[ix].parent >= 0)

      if (matchIdx !== undefined) {
        const source = this.left.entries[matchIdx]
        const sourceIdx = source.ref.index

        if (sliceStart === -1) sliceStart = sourceIdx
        const expectedIdx = sliceStart + (i - 0)
        if (sourceIdx !== expectedIdx) {
          patch.push(21, sliceStart, sourceIdx + 1) // OpArrayAppendSlice
          sliceStart = -1
        }
      } else {
        if (sliceStart !== -1) {
          patch.push(21, sliceStart, sliceStart + (i - 0)) // OpArrayAppendSlice
          sliceStart = -1
        }
        patch.push(0, elem.value) // OpValue
        patch.push(3) // OpReturnIntoArray
      }
    }
    if (sliceStart !== -1) {
      patch.push(21, sliceStart, sliceStart + rightElems.length) // OpArrayAppendSlice
    }

    return patch
  }

  private reconstructString(rightStr: string, reqs: Request[]): RawPatch {
    const patch: RawPatch = []
    patch.push(2) // OpBlank

    for (const req of reqs) {
      const leftStr = this.left.entries[req.primaryIdx].value
      if (typeof leftStr !== 'string') continue
      if (leftStr === rightStr) return []

      const prefix = commonPrefix(leftStr, rightStr)
      const suffix = commonSuffix(leftStr, rightStr, prefix)

      if (prefix > 0) {
        patch.push(23, 0, prefix)
      }

      const midLeft = utf8resolveIndex(rightStr, prefix)
      const midRight = utf8resolveIndex(rightStr, utf8stringSize(rightStr) - suffix)
      const middle = rightStr.slice(midLeft, midRight)

      if (middle) {
        patch.push(22, middle)
      }

      if (suffix > 0) {
        const leftLen = utf8stringSize(leftStr)
        patch.push(23, leftLen - suffix, leftLen)
      }
      break
    }

    return patch
  }

  private iterChildren(idx: number): HashEntry[] {
    const result: HashEntry[] = []
    let next = idx + 1
    while (next < this.right.entries.length && this.right.entries[next].parent === idx) {
      result.push(this.right.entries[next])
      next =
        this.right.entries[next].sibling === -1
          ? this.right.entries.length
          : this.right.entries[next].sibling
    }
    return result
  }

  private isObject(val: unknown): val is Record<string, unknown> {
    return typeof val === 'object' && val !== null && !Array.isArray(val)
  }
}
