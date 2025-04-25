import {createPatch} from 'mendoza'
import {applyPatch} from 'mendoza'
import {describe, expect, it} from 'vitest'

const documents: {left: string; right: string}[] = [
  {left: '{}', right: '{}'},
  {left: '1', right: '{}'},
  {left: '{"a": "b"}', right: '{"a": "b"}'},
  {left: '{"a": "a"}', right: '{"a": "b"}'},
  {left: '{"a": "a", "b": "b"}', right: '{"a": "b"}'},
  {left: '{"a": "a", "b": "b", "c": "c"}', right: '{"a": "a", "b": "b", "c": "c", "d": "d"}'},
  {left: '{"a": "a", "b": "b", "c": "c"}', right: '{"d": "d"}'},
  {left: '{"a": "a", "b": {"a": "a"}}', right: '{"a": "a", "b": {"a": "b", "b": "a"}}'},
  {left: '{"a": ["a", "b", "c"]}', right: '{"a": ["a", "b", "c"]}'},
  {left: '{"a": ["a", "b", "c"]}', right: '{"a": ["a", "b"]}'},
  {left: '{"a": [1, 2]}', right: '{"a": [2, 3]}'},
  {left: '{"a": "abcdef"}', right: '{"a": "abcdefg"}'},
  {left: '{"a": "abcdef"}', right: '{"a": "abcgihdef"}'},
  {left: '{"a": "abcdefghijk"}', right: '{"a": "abcdehijk"}'},
  {left: '{"a": "abcdefghijk"}', right: '{"a": "bcdeghijk"}'},
  {left: '"abc"', right: '"abcdef"'},
  {left: '"abc"', right: '"abc"'},
  {left: '"a:{},:{},"', right: '"a:{},"'},
  {left: '[[]]', right: '[]'},
  {left: '{"":""}', right: '{"":"","0000":""}'},
  {left: '{"H":{"":{}}}', right: '{"H":0}'},
  {left: '"݆݆݅Ʌ"', right: '"І݆Ʌ"'},
]

describe('roundtrip test (like mendoza_test.go)', () => {
  for (const [i, pair] of documents.entries()) {
    it(`case ${i}`, async () => {
      const left = JSON.parse(pair.left)
      const right = JSON.parse(pair.right)

      const patch1 = await createPatch(left, right)
      const patch2 = await createPatch(right, left)

      const result1 = applyPatch(left, patch1)
      expect(result1).toEqual(right)

      const result2 = applyPatch(right, patch2)
      expect(result2).toEqual(left)

      const encoded1 = JSON.stringify(patch1)
      const parsed1 = JSON.parse(encoded1)
      expect(parsed1).toEqual(patch1)

      const encoded2 = JSON.stringify(patch2)
      const parsed2 = JSON.parse(encoded2)
      expect(parsed2).toEqual(patch2)
    })
  }
})
