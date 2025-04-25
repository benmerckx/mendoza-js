import {describe, expect, it} from 'vitest'

import {createPatch} from '../src/differ'
import type {RawPatch} from '../src/patch'
import {applyPatch} from '../src/simple-patcher'

const cases: [string, unknown, unknown][] = [
  ['empty objects', {}, {}],
  ['simple add field', {}, {a: 1}],
  ['nested object', {a: {b: 1}}, {a: {b: 2, c: 3}}],
  ['array to string', [1, 2, 3], '123'],
  ['string diff', 'abc', 'abcdef'],
  ['object delete field', {a: 1, b: 2}, {a: 1}],
  ['array slice', ['a', 'b', 'c'], ['a', 'b']],
  ['nested add field', {a: {b: 1}}, {a: {b: 1, c: 2}}],
  ['nested remove field', {a: {b: 1, c: 2}}, {a: {b: 1}}],
  ['string insert in middle', 'abcde', 'abXYZcde'],
  [
    'long common prefix in strings',
    'this is a very long shared prefix',
    'this is a very long shared prefix and more',
  ],
  ['empty array to object', [], {a: 1}],
  ['object field to array', {a: 1}, {a: [1]}],
  ['array shrink', [1, 2, 3, 4, 5], [1, 2]],
  ['replace object with string', {a: 1}, 'oops'],
  ['replace string with object', 'hello', {message: 'hello'}],
  ['deep object mutation', {a: {b: {c: {d: 1}}}}, {a: {b: {c: {d: 2}}}}],
]

describe('createPatch + applyPatch roundtrip', () => {
  for (const [label, left, right] of cases) {
    it(label, async () => {
      const patch: RawPatch = await createPatch(left, right)
      const result = applyPatch(left, patch)
      expect(result).toEqual(right)
    })
  }
})
