import { Type } from '../constants.js'
import { StringifyContext } from '../stringify/stringify.js'
import { Collection } from './Collection.js'
import { isPair, isScalar, MAP, NODE_TYPE, ParsedNode } from './Node.js'
import { Pair } from './Pair.js'
import { isScalarValue } from './Scalar.js'
import { ToJSContext } from './toJS.js'

export function findPair<K = unknown, V = unknown>(
  items: Iterable<Pair<K, V>>,
  key: unknown
) {
  const k = isScalar(key) ? key.value : key
  for (const it of items) {
    if (isPair(it)) {
      if (it.key === key || it.key === k) return it
      if (isScalar(it.key) && it.key.value === k) return it
    }
  }
  return undefined
}

export declare namespace YAMLMap {
  interface Parsed<
    K extends ParsedNode = ParsedNode,
    V extends ParsedNode | null = ParsedNode | null
  > extends YAMLMap<K, V> {
    items: Pair<K, V>[]
    range: [number, number]
  }
}

export class YAMLMap<K = unknown, V = unknown> extends Collection {
  static get tagName(): 'tag:yaml.org,2002:map' {
    return 'tag:yaml.org,2002:map'
  }

  [NODE_TYPE] = MAP

  items: Pair<K, V>[] = []

  type?: Type.FLOW_MAP | Type.MAP

  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair: Pair<K, V> | { key: K; value: V }, overwrite?: boolean) {
    let _pair: Pair<K, V>
    if (isPair(pair)) _pair = pair
    else if (!pair || typeof pair !== 'object' || !('key' in pair)) {
      // In TypeScript, this never happens.
      _pair = new Pair<K, V>(pair as any, (pair as any).value)
    } else _pair = new Pair(pair.key, pair.value)

    const prev = findPair(this.items, _pair.key)
    const sortEntries = this.schema && this.schema.sortMapEntries
    if (prev) {
      if (!overwrite) throw new Error(`Key ${_pair.key} already set`)
      // For scalars, keep the old node & its comments and anchors
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value
      else prev.value = _pair.value
    } else if (sortEntries) {
      const i = this.items.findIndex(item => sortEntries(_pair, item) < 0)
      if (i === -1) this.items.push(_pair)
      else this.items.splice(i, 0, _pair)
    } else {
      this.items.push(_pair)
    }
  }

  delete(key: K) {
    const it = findPair(this.items, key)
    if (!it) return false
    const del = this.items.splice(this.items.indexOf(it), 1)
    return del.length > 0
  }

  get(key: K, keepScalar?: boolean) {
    const it = findPair(this.items, key)
    const node = it && it.value
    return !keepScalar && isScalar(node) ? node.value : node
  }

  has(key: K) {
    return !!findPair(this.items, key)
  }

  set(key: K, value: V) {
    this.add(new Pair(key, value), true)
  }

  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_?: unknown, ctx?: ToJSContext, Type?: any) {
    const map = Type ? new Type() : ctx && ctx.mapAsMap ? new Map() : {}
    if (ctx && ctx.onCreate) ctx.onCreate(map)
    for (const item of this.items) item.addToJSMap(ctx, map)
    return map
  }

  toString(
    ctx?: StringifyContext,
    onComment?: () => void,
    onChompKeep?: () => void
  ) {
    if (!ctx) return JSON.stringify(this)
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(
          `Map items must all be pairs; found ${JSON.stringify(item)} instead`
        )
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true })
    return super._toString(
      ctx,
      {
        blockItem: n => n.str,
        flowChars: { start: '{', end: '}' },
        itemIndent: ctx.indent || ''
      },
      onComment,
      onChompKeep
    )
  }
}
