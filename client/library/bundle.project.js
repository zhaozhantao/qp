require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":4,"isarray":3}],3:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],"Comm":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'e4b30QLjPFAdp7aIGBFGWx/', 'Comm');
// commSrc/Comm.js

"use strict";

// require('pomelo-cocos2d-js');
module.exports = {};

cc._RF.pop();
},{}],"GameCardUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'f650dzkzG5J9JdelxtPyjcc', 'GameCardUi');
// ui/game/GameCardUi.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    // use this for initialization
    onLoad: function onLoad() {}

});

cc._RF.pop();
},{}],"GamePlayerUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, '4cf32VTMk9HmZyTK3AjpJ1s', 'GamePlayerUi');
// ui/game/GamePlayerUi.js

"use strict";

var RoomData = require("../../commSrc/data/RoomData");
var GameCardUi = require("./GameCardUi");
cc.Class({
    extends: cc.Component,

    properties: {
        saySprite: cc.Sprite,
        sayPrepare: cc.SpriteFrame,
        GameCardUiPrefab: cc.Prefab
    },

    // use this for initialization
    onLoad: function onLoad() {},
    // 初始化ui
    initUi: function initUi() {
        var chair = RoomData.data.chr[this.serverIdx];
        if (chair == null) {
            this.node.active = false;
        } else {
            this.node.active = true;
            this.saySprite.node.active = chair.pre == true;
        }
    },
    // 设置本地椅子号
    setLocalChairIndex: function setLocalChairIndex(chairIndex) {
        // 本地椅子号
        this.localIdx = chairIndex;

        // 本地椅子号转服务器椅子号
        var serverChair = (RoomData.myChair + chairIndex) % 5;
        this.serverIdx = serverChair;
        this.initUi();
    },
    // 准备
    prepare: function prepare() {
        this.saySprite.spriteFrame = this.sayPrepare;
        this.saySprite.node.active = true;
    },
    // 发牌
    dispatch: function dispatch() {
        this.saySprite.node.active = false;
        this.cardUi = cc.instantiate(this.GameCardUiPrefab);
        this.cardUi.parent = this.node;
        this.cardUi.x = 90;
    }
});

cc._RF.pop();
},{"../../commSrc/data/RoomData":"RoomData","./GameCardUi":"GameCardUi"}],"GameUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'cf61eIb0DlAuI0AYfm5hxFj', 'GameUi');
// ui/game/GameUi.js

"use strict";

var RoomData = require("../../commSrc/data/RoomData");
var GamePlayerUi = require("./GamePlayerUi");
var GamePlayerUi = require("./GamePlayerUi");
cc.Class({
    extends: cc.Component,

    properties: {
        chairs: { default: [], type: cc.Node },
        GamePlayerPrefab: cc.Prefab,
        prepareButton: cc.Button,
        optNode: cc.Node,
        lookBtn: cc.Button,
        compareBtn: cc.Button,
        followBtn: cc.Button,
        addBtn: cc.Button,
        giveupBtn: cc.Button
    },

    // use this for initialization
    onLoad: function onLoad() {
        this.chairUis = [];
        for (var i = this.chairs.length - 1; i >= 0; i--) {
            this.chairUis[i] = cc.instantiate(this.GamePlayerPrefab);
            this.chairUis[i].parent = this.chairs[i];
        }

        for (var i = 0; i < 5; i++) {
            this.chairUis[i].getComponent(GamePlayerUi).setLocalChairIndex(i);
        }

        this.registPomeloOn();
        // 刷新按钮状态
        this.refreshButton();
    },
    // 当被消毁的时候调用
    onDestroy: function onDestroy() {
        pomelo.off("onEnterRoom");
    },
    // 注册pomelo监听
    registPomeloOn: function registPomeloOn() {
        pomelo.on("onEnterRoom", this.onEnterRoom.bind(this));
        pomelo.on("onExitRoom", this.onExitRoom.bind(this));
        pomelo.on("onPrepare", this.onPrepare.bind(this));
        pomelo.on("onDispatch", this.onDispatch.bind(this));
    },
    // 有玩家进入房间
    onEnterRoom: function onEnterRoom(data) {
        console.log("onEnterRoom", data);
        RoomData.enter(data.chair, data.uid, data.gold);

        var localChair = (data.chair - RoomData.myChair + 5) % 5;
        this.chairs[localChair].active = true;
        this.chairUis[localChair].getComponent(GamePlayerUi).initUi();
    },
    // 有玩家退出房间
    onExitRoom: function onExitRoom(data) {
        console.log("onExitRoom", data);
        RoomData.exit(data.chair);

        var localChair = (data.chair - RoomData.myChair + 5) % 5;
        this.chairs[localChair].active = false;
    },
    // 有玩家退出房间
    onPrepare: function onPrepare(data) {
        console.log("onPrepare", data);
        RoomData.prepare(data.chair);

        var localChair = (data.chair - RoomData.myChair + 5) % 5;
        this.chairUis[localChair].getComponent("GamePlayerUi").prepare();
    },
    // 开始游戏（发牌）
    onDispatch: function onDispatch(data) {
        console.log("onDispatch", data);
        RoomData.start();

        for (var i = 0; i < 5; i++) {
            var player = RoomData.data.chr[i];
            if (player != null && player.pre == true) {
                var localChair = (i - RoomData.myChair + 5) % 5;
                this.chairUis[localChair].getComponent("GamePlayerUi").dispatch();
            }
        }
        this.refreshButton();
    },

    // 点击了准备
    onPrepareClick: function onPrepareClick() {
        var self = this;
        pomelo.request("connector.entryHandler.prepare", {}, function () {
            self.refreshButton();
        });
    },
    // 刷新按钮状态
    refreshButton: function refreshButton() {
        var myChairData = RoomData.data.chr[RoomData.myChair];
        this.prepareButton.node.active = RoomData.data.ing != true && myChairData.pre != true;
        this.optNode.active = RoomData.data.ing == true;
        this.lookBtn.interactable = myChairData.look != true;
        this.compareBtn.interactable = RoomData.data.s == RoomData.myChair;
        this.followBtn.interactable = RoomData.data.s == RoomData.myChair;
        this.addBtn.interactable = RoomData.data.s == RoomData.myChair;
        this.giveupBtn.interactable = RoomData.data.s == RoomData.myChair;
    }
});

cc._RF.pop();
},{"../../commSrc/data/RoomData":"RoomData","./GamePlayerUi":"GamePlayerUi"}],"LoginUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'f2bebyF6dFG1rT5fsGJzyCe', 'LoginUi');
// ui/login/LoginUi.js

"use strict";

var Comm = require("../../commSrc/Comm");
var serverCfg = require("../../cfg/serverCfg");
cc.Class({
    extends: cc.Component,

    properties: {
        usernameLabel: cc.EditBox
    },

    onLoginClick: function onLoginClick() {
        var self = this;
        pomelo.init({
            host: serverCfg.serverIp,
            // host:"127.0.0.1",
            port: serverCfg.serverPort
        }, function (err) {
            pomelo.request("connector.entryHandler.login", { username: self.usernameLabel.string }, function (data) {
                if (data.ret == 0) {
                    Comm.scene.login();
                }
            });
        });
    }
});

cc._RF.pop();
},{"../../cfg/serverCfg":"serverCfg","../../commSrc/Comm":"Comm"}],"MainUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'a2b8epXqJJMapWjuM1ssyAG', 'MainUi');
// ui/main/MainUi.js

"use strict";

var RoomData = require("../../commSrc/data/RoomData");
var Comm = require("../../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {},

    onRoom1Click: function onRoom1Click() {
        pomelo.request("connector.entryHandler.enterRoom", {}, function (data) {
            if (data.ret == 0) {
                console.log(data.data.roomData);
                console.log(data.data.chair);
                console.log(data.data.roomId);
                RoomData.data = data.data.roomData;
                RoomData.myChair = data.data.chair;
                RoomData.roomId = data.data.roomId;
                Comm.scene.enterRoom();
            }
        });
    }
});

cc._RF.pop();
},{"../../commSrc/Comm":"Comm","../../commSrc/data/RoomData":"RoomData"}],"RoomData":[function(require,module,exports){
"use strict";
cc._RF.push(module, '79cb235G6pCWITaveCnAxVK', 'RoomData');
// commSrc/data/RoomData.js

"use strict";

module.exports = {
    data: { chr: [null, null, null, null] },
    // 进入房间
    enter: function enter(chair, uid, gold) {
        this.data.chr[chair] = { uid: uid, gold: gold };
    },
    // 退出房间
    exit: function exit(chair) {
        this.data.chr[chair] = null;
    },
    // 准备
    prepare: function prepare(chair) {
        this.data.chr[chair].pre = true;
    },
    // 发牌,开始
    start: function start() {
        this.data.ing = true;
    },
    // 设置发言人
    setSpeaker: function setSpeaker(speaker, speakerTime) {
        this.data.s = speaker;
        this.data.st = speakerTime;
    }

};

cc._RF.pop();
},{}],"Scene":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'f5ff9ez97lOS5FEPUppTjqg', 'Scene');
// scene/Scene.js

"use strict";

var Comm = require("../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {
        loginUiPrefab: cc.Prefab,
        mainUiPrefab: cc.Prefab,
        gameUiPrefab: cc.Prefab
    },

    // use this for initialization
    onLoad: function onLoad() {
        Comm.scene = this;
        this.loginUi = cc.instantiate(this.loginUiPrefab);
        this.loginUi.parent = this.node;
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
    login: function login() {
        console.log("login");
        this.loginUi.destroy();
        this.loginUi = null;
        this.mainUi = cc.instantiate(this.mainUiPrefab);
        this.mainUi.parent = this.node;
    },
    enterRoom: function enterRoom() {
        console.log("enterRoom");
        this.mainUi.destroy();
        this.mainUi = null;
        this.gameUi = cc.instantiate(this.gameUiPrefab);
        this.gameUi.parent = this.node;
    }
});

cc._RF.pop();
},{"../commSrc/Comm":"Comm"}],"emitter":[function(require,module,exports){
"use strict";
cc._RF.push(module, '2f7d8B81zNPp5XGaEBxva6N', 'emitter');
// pomelo/emitter.js

"use strict";

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

window.EventEmitter = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on = Emitter.prototype.addEventListener = function (event, fn) {
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || []).push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function (event, fn) {
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function (event, fn) {
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function (event) {
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1),
      callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function (event) {
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function (event) {
  return !!this.listeners(event).length;
};

cc._RF.pop();
},{}],"pomelo-client":[function(require,module,exports){
"use strict";
cc._RF.push(module, '5a16615+jhNwKnTwHjYOx9W', 'pomelo-client');
// pomelo/pomelo-client.js

'use strict';

(function () {
  var JS_WS_CLIENT_TYPE = 'js-websocket';
  var JS_WS_CLIENT_VERSION = '0.0.1';

  var Proctocol = require("protocol");
  var Package = Protocol.Package;
  var Message = Protocol.Message;
  var EventEmitter = window.EventEmitter;

  if (typeof window != "undefined" && typeof sys != 'undefined' && sys.localStorage) {
    window.localStorage = sys.localStorage;
  }

  var RES_OK = 200;
  var RES_FAIL = 500;
  var RES_OLD_CLIENT = 501;

  if (typeof Object.create !== 'function') {
    Object.create = function (o) {
      function F() {}
      F.prototype = o;
      return new F();
    };
  }

  var root = window;
  var pomelo = Object.create(EventEmitter.prototype); // object extend from object
  root.pomelo = pomelo;
  var socket = null;
  var reqId = 0;
  var callbacks = {};
  var handlers = {};
  //Map from request id to route
  var routeMap = {};

  var heartbeatInterval = 0;
  var heartbeatTimeout = 0;
  var nextHeartbeatTimeout = 0;
  var gapThreshold = 100; // heartbeat gap threashold
  var heartbeatId = null;
  var heartbeatTimeoutId = null;

  var handshakeCallback = null;

  var decode = null;
  var encode = null;

  var useCrypto;

  var handshakeBuffer = {
    'sys': {
      type: JS_WS_CLIENT_TYPE,
      version: JS_WS_CLIENT_VERSION
    },
    'user': {}
  };

  var initCallback = null;

  pomelo.init = function (params, cb) {
    initCallback = cb;
    var host = params.host;
    var port = params.port;

    var url = 'ws://' + host;
    if (port) {
      url += ':' + port;
    }

    handshakeBuffer.user = params.user;
    handshakeCallback = params.handshakeCallback;
    initWebSocket(url, cb);
  };

  var initWebSocket = function initWebSocket(url, cb) {
    var onopen = function onopen(event) {
      var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(handshakeBuffer)));
      send(obj);
    };
    var onmessage = function onmessage(event) {
      processPackage(Package.decode(event.data), cb);
      // new package arrived, update the heartbeat timeout
      if (heartbeatTimeout) {
        nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
      }
    };
    var onerror = function onerror(event) {
      pomelo.emit('io-error', event);
      cc.error('socket error: ', event);
    };
    var onclose = function onclose(event) {
      pomelo.emit('close', event);
      pomelo.emit('disconnect', event);
      cc.error('socket close: ', event);
    };
    socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = onopen;
    socket.onmessage = onmessage;
    socket.onerror = onerror;
    socket.onclose = onclose;
  };

  pomelo.disconnect = function () {
    if (socket) {
      if (socket.disconnect) socket.disconnect();
      if (socket.close) socket.close();
      cc.log('disconnect');
      socket = null;
    }

    if (heartbeatId) {
      clearTimeout(heartbeatId);
      heartbeatId = null;
    }
    if (heartbeatTimeoutId) {
      clearTimeout(heartbeatTimeoutId);
      heartbeatTimeoutId = null;
    }
  };

  pomelo.request = function (route, msg, cb) {
    if (arguments.length === 2 && typeof msg === 'function') {
      cb = msg;
      msg = {};
    } else {
      msg = msg || {};
    }
    route = route || msg.route;
    if (!route) {
      return;
    }

    reqId++;
    sendMessage(reqId, route, msg);

    callbacks[reqId] = cb;
    routeMap[reqId] = route;
  };

  pomelo.notify = function (route, msg) {
    msg = msg || {};
    sendMessage(0, route, msg);
  };

  var sendMessage = function sendMessage(reqId, route, msg) {
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY;

    //compress message by protobuf
    var protos = !!pomelo.data.protos ? pomelo.data.protos.client : {};
    if (!!protos[route]) {
      msg = protobuf.encode(route, msg);
    } else {
      msg = Protocol.strencode(JSON.stringify(msg));
    }

    var compressRoute = 0;
    if (pomelo.dict && pomelo.dict[route]) {
      route = pomelo.dict[route];
      compressRoute = 1;
    }

    msg = Message.encode(reqId, type, compressRoute, route, msg);
    var packet = Package.encode(Package.TYPE_DATA, msg);
    send(packet);
  };

  var send = function send(packet) {
    socket.send(packet.buffer);
  };

  var handler = {};

  var heartbeat = function heartbeat(data) {
    if (!heartbeatInterval) {
      // no heartbeat
      return;
    }

    var obj = Package.encode(Package.TYPE_HEARTBEAT);
    if (heartbeatTimeoutId) {
      clearTimeout(heartbeatTimeoutId);
      heartbeatTimeoutId = null;
    }

    if (heartbeatId) {
      // already in a heartbeat interval
      return;
    }

    heartbeatId = setTimeout(function () {
      heartbeatId = null;
      send(obj);

      nextHeartbeatTimeout = Date.now() + heartbeatTimeout;
      heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, heartbeatTimeout);
    }, heartbeatInterval);
  };

  var heartbeatTimeoutCb = function heartbeatTimeoutCb() {
    var gap = nextHeartbeatTimeout - Date.now();
    if (gap > gapThreshold) {
      heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb, gap);
    } else {
      cc.error('server heartbeat timeout');
      pomelo.emit('heartbeat timeout');
      pomelo.disconnect();
    }
  };

  var handshake = function handshake(data) {
    data = JSON.parse(Protocol.strdecode(data));
    if (data.code === RES_OLD_CLIENT) {
      pomelo.emit('error', 'client version not fullfill');
      return;
    }

    if (data.code !== RES_OK) {
      pomelo.emit('error', 'handshake fail');
      return;
    }

    handshakeInit(data);

    var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK);
    send(obj);
    if (initCallback) {
      initCallback(socket);
      initCallback = null;
    }
  };

  var onData = function onData(data) {
    //probuff decode
    var msg = Message.decode(data);

    if (msg.id > 0) {
      msg.route = routeMap[msg.id];
      delete routeMap[msg.id];
      if (!msg.route) {
        return;
      }
    }

    msg.body = deCompose(msg);

    processMessage(pomelo, msg);
  };

  var onKick = function onKick(data) {
    data = JSON.parse(Protocol.strdecode(data));
    pomelo.emit('onKick', data);
  };

  handlers[Package.TYPE_HANDSHAKE] = handshake;
  handlers[Package.TYPE_HEARTBEAT] = heartbeat;
  handlers[Package.TYPE_DATA] = onData;
  handlers[Package.TYPE_KICK] = onKick;

  var processPackage = function processPackage(msgs) {
    if (Array.isArray(msgs)) {
      for (var i = 0; i < msgs.length; i++) {
        var msg = msgs[i];
        handlers[msg.type](msg.body);
      }
    } else {
      handlers[msgs.type](msgs.body);
    }
  };

  var processMessage = function processMessage(pomelo, msg) {
    if (!msg.id) {
      // server push message
      pomelo.emit(msg.route, msg.body);
    }

    //if have a id then find the callback function with the request
    var cb = callbacks[msg.id];

    delete callbacks[msg.id];
    if (typeof cb !== 'function') {
      return;
    }

    cb(msg.body);
    return;
  };

  var processMessageBatch = function processMessageBatch(pomelo, msgs) {
    for (var i = 0, l = msgs.length; i < l; i++) {
      processMessage(pomelo, msgs[i]);
    }
  };

  var deCompose = function deCompose(msg) {
    var protos = !!pomelo.data.protos ? pomelo.data.protos.server : {};
    var abbrs = pomelo.data.abbrs;
    var route = msg.route;

    //Decompose route from dict
    if (msg.compressRoute) {
      if (!abbrs[route]) {
        return {};
      }

      route = msg.route = abbrs[route];
    }
    if (!!protos[route]) {
      return protobuf.decode(route, msg.body);
    } else {
      return JSON.parse(Protocol.strdecode(msg.body));
    }

    return msg;
  };

  var handshakeInit = function handshakeInit(data) {
    if (data.sys && data.sys.heartbeat) {
      heartbeatInterval = data.sys.heartbeat * 1000; // heartbeat interval
      heartbeatTimeout = heartbeatInterval * 2; // max heartbeat timeout
    } else {
      heartbeatInterval = 0;
      heartbeatTimeout = 0;
    }

    initData(data);

    if (typeof handshakeCallback === 'function') {
      handshakeCallback(data.user);
    }
  };

  //Initilize data used in pomelo client
  var initData = function initData(data) {
    if (!data || !data.sys) {
      return;
    }
    pomelo.data = pomelo.data || {};
    var dict = data.sys.dict;
    var protos = data.sys.protos;

    //Init compress dict
    if (dict) {
      pomelo.data.dict = dict;
      pomelo.data.abbrs = {};

      for (var route in dict) {
        pomelo.data.abbrs[dict[route]] = route;
      }
    }

    //Init protobuf protos
    if (protos) {
      pomelo.data.protos = {
        server: protos.server || {},
        client: protos.client || {}
      };
      if (!!protobuf) {
        protobuf.init({ encoderProtos: protos.client, decoderProtos: protos.server });
      }
    }
  };

  module.exports = pomelo;
})();

cc._RF.pop();
},{"protocol":"protocol"}],"protobuf":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'd82faejXmBEDaAIDZf4clkO', 'protobuf');
// pomelo/protobuf.js

"use strict";

/* ProtocolBuffer client 0.1.0*/

/**
 * pomelo-protobuf
 * @author <zhang0935@gmail.com>
 */

/**
 * Protocol buffer root
 * In browser, it will be window.protbuf
 */
(function (exports, global) {
  var Protobuf = exports;

  Protobuf.init = function (opts) {
    //On the serverside, use serverProtos to encode messages send to client
    Protobuf.encoder.init(opts.encoderProtos);

    //On the serverside, user clientProtos to decode messages receive from clients
    Protobuf.decoder.init(opts.decoderProtos);
  };

  Protobuf.encode = function (key, msg) {
    return Protobuf.encoder.encode(key, msg);
  };

  Protobuf.decode = function (key, msg) {
    return Protobuf.decoder.decode(key, msg);
  };

  // exports to support for components
  module.exports = Protobuf;
  if (typeof window != "undefined") {
    window.protobuf = Protobuf;
  }
})(typeof window == "undefined" ? module.exports : {}, undefined);

/**
 * constants
 */
(function (exports, global) {
  var constants = exports.constants = {};

  constants.TYPES = {
    uInt32: 0,
    sInt32: 0,
    int32: 0,
    double: 1,
    string: 2,
    message: 2,
    float: 5
  };
})('undefined' !== typeof protobuf ? protobuf : module.exports, undefined);

/**
 * util module
 */
(function (exports, global) {

  var Util = exports.util = {};

  Util.isSimpleType = function (type) {
    return type === 'uInt32' || type === 'sInt32' || type === 'int32' || type === 'uInt64' || type === 'sInt64' || type === 'float' || type === 'double';
  };
})('undefined' !== typeof protobuf ? protobuf : module.exports, undefined);

/**
 * codec module
 */
(function (exports, global) {

  var Codec = exports.codec = {};

  var buffer = new ArrayBuffer(8);
  var float32Array = new Float32Array(buffer);
  var float64Array = new Float64Array(buffer);
  var uInt8Array = new Uint8Array(buffer);

  Codec.encodeUInt32 = function (n) {
    var n = parseInt(n);
    if (isNaN(n) || n < 0) {
      return null;
    }

    var result = [];
    do {
      var tmp = n % 128;
      var next = Math.floor(n / 128);

      if (next !== 0) {
        tmp = tmp + 128;
      }
      result.push(tmp);
      n = next;
    } while (n !== 0);

    return result;
  };

  Codec.encodeSInt32 = function (n) {
    var n = parseInt(n);
    if (isNaN(n)) {
      return null;
    }
    n = n < 0 ? Math.abs(n) * 2 - 1 : n * 2;

    return Codec.encodeUInt32(n);
  };

  Codec.decodeUInt32 = function (bytes) {
    var n = 0;

    for (var i = 0; i < bytes.length; i++) {
      var m = parseInt(bytes[i]);
      n = n + (m & 0x7f) * Math.pow(2, 7 * i);
      if (m < 128) {
        return n;
      }
    }

    return n;
  };

  Codec.decodeSInt32 = function (bytes) {
    var n = this.decodeUInt32(bytes);
    var flag = n % 2 === 1 ? -1 : 1;

    n = (n % 2 + n) / 2 * flag;

    return n;
  };

  Codec.encodeFloat = function (float) {
    float32Array[0] = float;
    return uInt8Array;
  };

  Codec.decodeFloat = function (bytes, offset) {
    if (!bytes || bytes.length < offset + 4) {
      return null;
    }

    for (var i = 0; i < 4; i++) {
      uInt8Array[i] = bytes[offset + i];
    }

    return float32Array[0];
  };

  Codec.encodeDouble = function (double) {
    float64Array[0] = double;
    return uInt8Array.subarray(0, 8);
  };

  Codec.decodeDouble = function (bytes, offset) {
    if (!bytes || bytes.length < 8 + offset) {
      return null;
    }

    for (var i = 0; i < 8; i++) {
      uInt8Array[i] = bytes[offset + i];
    }

    return float64Array[0];
  };

  Codec.encodeStr = function (bytes, offset, str) {
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      var codes = encode2UTF8(code);

      for (var j = 0; j < codes.length; j++) {
        bytes[offset] = codes[j];
        offset++;
      }
    }

    return offset;
  };

  /**
   * Decode string from utf8 bytes
   */
  Codec.decodeStr = function (bytes, offset, length) {
    var array = [];
    var end = offset + length;

    while (offset < end) {
      var code = 0;

      if (bytes[offset] < 128) {
        code = bytes[offset];

        offset += 1;
      } else if (bytes[offset] < 224) {
        code = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
        offset += 2;
      } else {
        code = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
        offset += 3;
      }

      array.push(code);
    }

    var str = '';
    for (var i = 0; i < array.length;) {
      str += String.fromCharCode.apply(null, array.slice(i, i + 10000));
      i += 10000;
    }

    return str;
  };

  /**
   * Return the byte length of the str use utf8
   */
  Codec.byteLength = function (str) {
    if (typeof str !== 'string') {
      return -1;
    }

    var length = 0;

    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      length += codeLength(code);
    }

    return length;
  };

  /**
   * Encode a unicode16 char code to utf8 bytes
   */
  function encode2UTF8(charCode) {
    if (charCode <= 0x7f) {
      return [charCode];
    } else if (charCode <= 0x7ff) {
      return [0xc0 | charCode >> 6, 0x80 | charCode & 0x3f];
    } else {
      return [0xe0 | charCode >> 12, 0x80 | (charCode & 0xfc0) >> 6, 0x80 | charCode & 0x3f];
    }
  }

  function codeLength(code) {
    if (code <= 0x7f) {
      return 1;
    } else if (code <= 0x7ff) {
      return 2;
    } else {
      return 3;
    }
  }
})('undefined' !== typeof protobuf ? protobuf : module.exports, undefined);

/**
 * encoder module
 */
(function (exports, global) {

  var protobuf = exports;
  var MsgEncoder = exports.encoder = {};

  var codec = protobuf.codec;
  var constant = protobuf.constants;
  var util = protobuf.util;

  MsgEncoder.init = function (protos) {
    this.protos = protos || {};
  };

  MsgEncoder.encode = function (route, msg) {
    //Get protos from protos map use the route as key
    var protos = this.protos[route];

    //Check msg
    if (!checkMsg(msg, protos)) {
      return null;
    }

    //Set the length of the buffer 2 times bigger to prevent overflow
    var length = codec.byteLength(JSON.stringify(msg));

    //Init buffer and offset
    var buffer = new ArrayBuffer(length);
    var uInt8Array = new Uint8Array(buffer);
    var offset = 0;

    if (!!protos) {
      offset = encodeMsg(uInt8Array, offset, protos, msg);
      if (offset > 0) {
        return uInt8Array.subarray(0, offset);
      }
    }

    return null;
  };

  /**
   * Check if the msg follow the defination in the protos
   */
  function checkMsg(msg, protos) {
    if (!protos) {
      return false;
    }

    for (var name in protos) {
      var proto = protos[name];

      //All required element must exist
      switch (proto.option) {
        case 'required':
          if (typeof msg[name] === 'undefined') {
            return false;
          }
        case 'optional':
          if (typeof msg[name] !== 'undefined') {
            if (!!protos.__messages[proto.type]) {
              checkMsg(msg[name], protos.__messages[proto.type]);
            }
          }
          break;
        case 'repeated':
          //Check nest message in repeated elements
          if (!!msg[name] && !!protos.__messages[proto.type]) {
            for (var i = 0; i < msg[name].length; i++) {
              if (!checkMsg(msg[name][i], protos.__messages[proto.type])) {
                return false;
              }
            }
          }
          break;
      }
    }

    return true;
  }

  function encodeMsg(buffer, offset, protos, msg) {
    for (var name in msg) {
      if (!!protos[name]) {
        var proto = protos[name];

        switch (proto.option) {
          case 'required':
          case 'optional':
            offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
            offset = encodeProp(msg[name], proto.type, offset, buffer, protos);
            break;
          case 'repeated':
            if (msg[name].length > 0) {
              offset = encodeArray(msg[name], proto, offset, buffer, protos);
            }
            break;
        }
      }
    }

    return offset;
  }

  function encodeProp(value, type, offset, buffer, protos) {
    switch (type) {
      case 'uInt32':
        offset = writeBytes(buffer, offset, codec.encodeUInt32(value));
        break;
      case 'int32':
      case 'sInt32':
        offset = writeBytes(buffer, offset, codec.encodeSInt32(value));
        break;
      case 'float':
        writeBytes(buffer, offset, codec.encodeFloat(value));
        offset += 4;
        break;
      case 'double':
        writeBytes(buffer, offset, codec.encodeDouble(value));
        offset += 8;
        break;
      case 'string':
        var length = codec.byteLength(value);

        //Encode length
        offset = writeBytes(buffer, offset, codec.encodeUInt32(length));
        //write string
        codec.encodeStr(buffer, offset, value);
        offset += length;
        break;
      default:
        if (!!protos.__messages[type]) {
          //Use a tmp buffer to build an internal msg
          var tmpBuffer = new ArrayBuffer(codec.byteLength(JSON.stringify(value)));
          var length = 0;

          length = encodeMsg(tmpBuffer, length, protos.__messages[type], value);
          //Encode length
          offset = writeBytes(buffer, offset, codec.encodeUInt32(length));
          //contact the object
          for (var i = 0; i < length; i++) {
            buffer[offset] = tmpBuffer[i];
            offset++;
          }
        }
        break;
    }

    return offset;
  }

  /**
   * Encode reapeated properties, simple msg and object are decode differented
   */
  function encodeArray(array, proto, offset, buffer, protos) {
    var i = 0;

    if (util.isSimpleType(proto.type)) {
      offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
      offset = writeBytes(buffer, offset, codec.encodeUInt32(array.length));
      for (i = 0; i < array.length; i++) {
        offset = encodeProp(array[i], proto.type, offset, buffer);
      }
    } else {
      for (i = 0; i < array.length; i++) {
        offset = writeBytes(buffer, offset, encodeTag(proto.type, proto.tag));
        offset = encodeProp(array[i], proto.type, offset, buffer, protos);
      }
    }

    return offset;
  }

  function writeBytes(buffer, offset, bytes) {
    for (var i = 0; i < bytes.length; i++, offset++) {
      buffer[offset] = bytes[i];
    }

    return offset;
  }

  function encodeTag(type, tag) {
    var value = constant.TYPES[type] || 2;
    return codec.encodeUInt32(tag << 3 | value);
  }
})('undefined' !== typeof protobuf ? protobuf : module.exports, undefined);

/**
 * decoder module
 */
(function (exports, global) {
  var protobuf = exports;
  var MsgDecoder = exports.decoder = {};

  var codec = protobuf.codec;
  var util = protobuf.util;

  var buffer;
  var offset = 0;

  MsgDecoder.init = function (protos) {
    this.protos = protos || {};
  };

  MsgDecoder.setProtos = function (protos) {
    if (!!protos) {
      this.protos = protos;
    }
  };

  MsgDecoder.decode = function (route, buf) {
    var protos = this.protos[route];

    buffer = buf;
    offset = 0;

    if (!!protos) {
      return decodeMsg({}, protos, buffer.length);
    }

    return null;
  };

  function decodeMsg(msg, protos, length) {
    while (offset < length) {
      var head = getHead();
      var type = head.type;
      var tag = head.tag;
      var name = protos.__tags[tag];

      switch (protos[name].option) {
        case 'optional':
        case 'required':
          msg[name] = decodeProp(protos[name].type, protos);
          break;
        case 'repeated':
          if (!msg[name]) {
            msg[name] = [];
          }
          decodeArray(msg[name], protos[name].type, protos);
          break;
      }
    }

    return msg;
  }

  /**
   * Test if the given msg is finished
   */
  function isFinish(msg, protos) {
    return !protos.__tags[peekHead().tag];
  }
  /**
   * Get property head from protobuf
   */
  function getHead() {
    var tag = codec.decodeUInt32(getBytes());

    return {
      type: tag & 0x7,
      tag: tag >> 3
    };
  }

  /**
   * Get tag head without move the offset
   */
  function peekHead() {
    var tag = codec.decodeUInt32(peekBytes());

    return {
      type: tag & 0x7,
      tag: tag >> 3
    };
  }

  function decodeProp(type, protos) {
    switch (type) {
      case 'uInt32':
        return codec.decodeUInt32(getBytes());
      case 'int32':
      case 'sInt32':
        return codec.decodeSInt32(getBytes());
      case 'float':
        var float = codec.decodeFloat(buffer, offset);
        offset += 4;
        return float;
      case 'double':
        var double = codec.decodeDouble(buffer, offset);
        offset += 8;
        return double;
      case 'string':
        var length = codec.decodeUInt32(getBytes());

        var str = codec.decodeStr(buffer, offset, length);
        offset += length;

        return str;
      default:
        if (!!protos && !!protos.__messages[type]) {
          var length = codec.decodeUInt32(getBytes());
          var msg = {};
          decodeMsg(msg, protos.__messages[type], offset + length);
          return msg;
        }
        break;
    }
  }

  function decodeArray(array, type, protos) {
    if (util.isSimpleType(type)) {
      var length = codec.decodeUInt32(getBytes());

      for (var i = 0; i < length; i++) {
        array.push(decodeProp(type));
      }
    } else {
      array.push(decodeProp(type, protos));
    }
  }

  function getBytes(flag) {
    var bytes = [];
    var pos = offset;
    flag = flag || false;

    var b;

    do {
      b = buffer[pos];
      bytes.push(b);
      pos++;
    } while (b >= 128);

    if (!flag) {
      offset = pos;
    }
    return bytes;
  }

  function peekBytes() {
    return getBytes(true);
  }
})('undefined' !== typeof protobuf ? protobuf : module.exports, undefined);

cc._RF.pop();
},{}],"protocol":[function(require,module,exports){
(function (Buffer){
"use strict";
cc._RF.push(module, '703b7tytHNG/JlkjCFHpGRD', 'protocol');
// pomelo/protocol.js

'use strict';

(function (exports, ByteArray, global) {
  var Protocol = exports;

  var PKG_HEAD_BYTES = 4;
  var MSG_FLAG_BYTES = 1;
  var MSG_ROUTE_CODE_BYTES = 2;
  var MSG_ID_MAX_BYTES = 5;
  var MSG_ROUTE_LEN_BYTES = 1;

  var MSG_ROUTE_CODE_MAX = 0xffff;

  var MSG_COMPRESS_ROUTE_MASK = 0x1;
  var MSG_TYPE_MASK = 0x7;

  var Package = Protocol.Package = {};
  var Message = Protocol.Message = {};

  Package.TYPE_HANDSHAKE = 1;
  Package.TYPE_HANDSHAKE_ACK = 2;
  Package.TYPE_HEARTBEAT = 3;
  Package.TYPE_DATA = 4;
  Package.TYPE_KICK = 5;

  Message.TYPE_REQUEST = 0;
  Message.TYPE_NOTIFY = 1;
  Message.TYPE_RESPONSE = 2;
  Message.TYPE_PUSH = 3;

  /**
   * pomele client encode
   * id message id;
   * route message route
   * msg message body
   * socketio current support string
   */
  Protocol.strencode = function (str) {
    var byteArray = new ByteArray(str.length * 3);
    var offset = 0;
    for (var i = 0; i < str.length; i++) {
      var charCode = str.charCodeAt(i);
      var codes = null;
      if (charCode <= 0x7f) {
        codes = [charCode];
      } else if (charCode <= 0x7ff) {
        codes = [0xc0 | charCode >> 6, 0x80 | charCode & 0x3f];
      } else {
        codes = [0xe0 | charCode >> 12, 0x80 | (charCode & 0xfc0) >> 6, 0x80 | charCode & 0x3f];
      }
      for (var j = 0; j < codes.length; j++) {
        byteArray[offset] = codes[j];
        ++offset;
      }
    }
    var _buffer = new ByteArray(offset);
    copyArray(_buffer, 0, byteArray, 0, offset);
    return _buffer;
  };

  /**
   * client decode
   * msg String data
   * return Message Object
   */
  Protocol.strdecode = function (buffer) {
    var bytes = new ByteArray(buffer);
    var array = [];
    var offset = 0;
    var charCode = 0;
    var end = bytes.length;
    while (offset < end) {
      if (bytes[offset] < 128) {
        charCode = bytes[offset];
        offset += 1;
      } else if (bytes[offset] < 224) {
        charCode = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
        offset += 2;
      } else {
        charCode = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
        offset += 3;
      }
      array.push(charCode);
    }
    return String.fromCharCode.apply(null, array);
  };

  /**
   * Package protocol encode.
   *
   * Pomelo package format:
   * +------+-------------+------------------+
   * | type | body length |       body       |
   * +------+-------------+------------------+
   *
   * Head: 4bytes
   *   0: package type,
   *      1 - handshake,
   *      2 - handshake ack,
   *      3 - heartbeat,
   *      4 - data
   *      5 - kick
   *   1 - 3: big-endian body length
   * Body: body length bytes
   *
   * @param  {Number}    type   package type
   * @param  {ByteArray} body   body content in bytes
   * @return {ByteArray}        new byte array that contains encode result
   */
  Package.encode = function (type, body) {
    var length = body ? body.length : 0;
    var buffer = new ByteArray(PKG_HEAD_BYTES + length);
    var index = 0;
    buffer[index++] = type & 0xff;
    buffer[index++] = length >> 16 & 0xff;
    buffer[index++] = length >> 8 & 0xff;
    buffer[index++] = length & 0xff;
    if (body) {
      copyArray(buffer, index, body, 0, length);
    }
    return buffer;
  };

  /**
   * Package protocol decode.
   * See encode for package format.
   *
   * @param  {ByteArray} buffer byte array containing package content
   * @return {Object}           {type: package type, buffer: body byte array}
   */
  Package.decode = function (buffer) {
    var offset = 0;
    var bytes = new ByteArray(buffer);
    var length = 0;
    var rs = [];
    while (offset < bytes.length) {
      var type = bytes[offset++];
      length = (bytes[offset++] << 16 | bytes[offset++] << 8 | bytes[offset++]) >>> 0;
      var body = length ? new ByteArray(length) : null;
      copyArray(body, 0, bytes, offset, length);
      offset += length;
      rs.push({ 'type': type, 'body': body });
    }
    return rs.length === 1 ? rs[0] : rs;
  };

  /**
   * Message protocol encode.
   *
   * @param  {Number} id            message id
   * @param  {Number} type          message type
   * @param  {Number} compressRoute whether compress route
   * @param  {Number|String} route  route code or route string
   * @param  {Buffer} msg           message body bytes
   * @return {Buffer}               encode result
   */
  Message.encode = function (id, type, compressRoute, route, msg) {
    // caculate message max length
    var idBytes = msgHasId(type) ? caculateMsgIdBytes(id) : 0;
    var msgLen = MSG_FLAG_BYTES + idBytes;

    if (msgHasRoute(type)) {
      if (compressRoute) {
        if (typeof route !== 'number') {
          throw new Error('error flag for number route!');
        }
        msgLen += MSG_ROUTE_CODE_BYTES;
      } else {
        msgLen += MSG_ROUTE_LEN_BYTES;
        if (route) {
          route = Protocol.strencode(route);
          if (route.length > 255) {
            throw new Error('route maxlength is overflow');
          }
          msgLen += route.length;
        }
      }
    }

    if (msg) {
      msgLen += msg.length;
    }

    var buffer = new ByteArray(msgLen);
    var offset = 0;

    // add flag
    offset = encodeMsgFlag(type, compressRoute, buffer, offset);

    // add message id
    if (msgHasId(type)) {
      offset = encodeMsgId(id, buffer, offset);
    }

    // add route
    if (msgHasRoute(type)) {
      offset = encodeMsgRoute(compressRoute, route, buffer, offset);
    }

    // add body
    if (msg) {
      offset = encodeMsgBody(msg, buffer, offset);
    }

    return buffer;
  };

  /**
   * Message protocol decode.
   *
   * @param  {Buffer|Uint8Array} buffer message bytes
   * @return {Object}            message object
   */
  Message.decode = function (buffer) {
    var bytes = new ByteArray(buffer);
    var bytesLen = bytes.length || bytes.byteLength;
    var offset = 0;
    var id = 0;
    var route = null;

    // parse flag
    var flag = bytes[offset++];
    var compressRoute = flag & MSG_COMPRESS_ROUTE_MASK;
    var type = flag >> 1 & MSG_TYPE_MASK;

    // parse id
    if (msgHasId(type)) {
      var m = parseInt(bytes[offset]);
      var i = 0;
      do {
        var m = parseInt(bytes[offset]);
        id = id + (m & 0x7f) * Math.pow(2, 7 * i);
        offset++;
        i++;
      } while (m >= 128);
    }

    // parse route
    if (msgHasRoute(type)) {
      if (compressRoute) {
        route = bytes[offset++] << 8 | bytes[offset++];
      } else {
        var routeLen = bytes[offset++];
        if (routeLen) {
          route = new ByteArray(routeLen);
          copyArray(route, 0, bytes, offset, routeLen);
          route = Protocol.strdecode(route);
        } else {
          route = '';
        }
        offset += routeLen;
      }
    }

    // parse body
    var bodyLen = bytesLen - offset;
    var body = new ByteArray(bodyLen);

    copyArray(body, 0, bytes, offset, bodyLen);

    return { 'id': id, 'type': type, 'compressRoute': compressRoute,
      'route': route, 'body': body };
  };

  var copyArray = function copyArray(dest, doffset, src, soffset, length) {
    if ('function' === typeof src.copy) {
      // Buffer
      src.copy(dest, doffset, soffset, soffset + length);
    } else {
      // Uint8Array
      for (var index = 0; index < length; index++) {
        dest[doffset++] = src[soffset++];
      }
    }
  };

  var msgHasId = function msgHasId(type) {
    return type === Message.TYPE_REQUEST || type === Message.TYPE_RESPONSE;
  };

  var msgHasRoute = function msgHasRoute(type) {
    return type === Message.TYPE_REQUEST || type === Message.TYPE_NOTIFY || type === Message.TYPE_PUSH;
  };

  var caculateMsgIdBytes = function caculateMsgIdBytes(id) {
    var len = 0;
    do {
      len += 1;
      id >>= 7;
    } while (id > 0);
    return len;
  };

  var encodeMsgFlag = function encodeMsgFlag(type, compressRoute, buffer, offset) {
    if (type !== Message.TYPE_REQUEST && type !== Message.TYPE_NOTIFY && type !== Message.TYPE_RESPONSE && type !== Message.TYPE_PUSH) {
      throw new Error('unkonw message type: ' + type);
    }

    buffer[offset] = type << 1 | (compressRoute ? 1 : 0);

    return offset + MSG_FLAG_BYTES;
  };

  var encodeMsgId = function encodeMsgId(id, buffer, offset) {
    do {
      var tmp = id % 128;
      var next = Math.floor(id / 128);

      if (next !== 0) {
        tmp = tmp + 128;
      }
      buffer[offset++] = tmp;

      id = next;
    } while (id !== 0);

    return offset;
  };

  var encodeMsgRoute = function encodeMsgRoute(compressRoute, route, buffer, offset) {
    if (compressRoute) {
      if (route > MSG_ROUTE_CODE_MAX) {
        throw new Error('route number is overflow');
      }

      buffer[offset++] = route >> 8 & 0xff;
      buffer[offset++] = route & 0xff;
    } else {
      if (route) {
        buffer[offset++] = route.length & 0xff;
        copyArray(buffer, offset, route, 0, route.length);
        offset += route.length;
      } else {
        buffer[offset++] = 0;
      }
    }

    return offset;
  };

  var encodeMsgBody = function encodeMsgBody(msg, buffer, offset) {
    copyArray(buffer, offset, msg, 0, msg.length);
    return offset + msg.length;
  };

  module.exports = Protocol;
  if (typeof window != "undefined") {
    window.Protocol = Protocol;
  }
})(typeof window == "undefined" ? module.exports : {}, typeof window == "undefined" ? Buffer : Uint8Array, undefined);

cc._RF.pop();
}).call(this,require("buffer").Buffer)

},{"buffer":2}],"serverCfg":[function(require,module,exports){
"use strict";
cc._RF.push(module, '91319YjT21Embokl+Ez0eOm', 'serverCfg');
// cfg/serverCfg.js

"use strict";

// 服务器地址配置
module.exports = {
    serverIp: "192.168.8.104",
    serverPort: 3010
};

cc._RF.pop();
},{}]},{},["serverCfg","Comm","RoomData","emitter","pomelo-client","protobuf","protocol","Scene","GameCardUi","GamePlayerUi","GameUi","LoginUi","MainUi"])

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFzc2V0cy9jb21tU3JjL0NvbW0uanMiLCJhc3NldHMvdWkvZ2FtZS9HYW1lQ2FyZFVpLmpzIiwiYXNzZXRzL3VpL2dhbWUvR2FtZVBsYXllclVpLmpzIiwiYXNzZXRzL3VpL2dhbWUvR2FtZVVpLmpzIiwiYXNzZXRzL3VpL2xvZ2luL0xvZ2luVWkuanMiLCJhc3NldHMvdWkvbWFpbi9NYWluVWkuanMiLCJhc3NldHMvY29tbVNyYy9kYXRhL1Jvb21EYXRhLmpzIiwiYXNzZXRzL3NjZW5lL1NjZW5lLmpzIiwiYXNzZXRzL3BvbWVsby9lbWl0dGVyLmpzIiwiYXNzZXRzL3BvbWVsby9wb21lbG8tY2xpZW50LmpzIiwiYXNzZXRzL3BvbWVsby9wcm90b2J1Zi5qcyIsImFzc2V0cy9wb21lbG8vcHJvdG9jb2wuanMiLCJhc3NldHMvY2ZnL3NlcnZlckNmZy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBOzs7Ozs7Ozs7O0FDREE7QUFDSTs7QUFFQTtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBVlE7O0FBYVo7QUFDQTs7QUFqQks7Ozs7Ozs7Ozs7QUNBVDtBQUNBO0FBQ0E7QUFDSTs7QUFFQTtBQUNJO0FBQ0E7QUFDQTtBQUhROztBQU1aO0FBQ0E7QUFHQTtBQUNBO0FBQ0k7QUFDQTtBQUNJO0FBQ0g7QUFDRztBQUNBO0FBQ0g7QUFDSjtBQUNEO0FBQ0E7QUFDSTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0g7QUE1Q0k7Ozs7Ozs7Ozs7QUNGVDtBQUNBO0FBQ0E7QUFDQTtBQUNJOztBQUVBO0FBQ0k7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBVFE7O0FBWVo7QUFDQTtBQUNJO0FBQ0E7QUFDSTtBQUNBO0FBQ0g7O0FBRUQ7QUFDSTtBQUNIOztBQUVEO0FBQ0E7QUFDQTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTtBQUNBO0FBQ0E7QUFDSDtBQUNEO0FBQ0E7QUFDSTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7O0FBRUE7QUFDQTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7O0FBRUE7QUFDQTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7O0FBRUE7QUFDSTtBQUNBO0FBQ0k7QUFDQTtBQUVIO0FBQ0o7QUFDRDtBQUNIOztBQUVEO0FBQ0E7QUFDSTtBQUNBO0FBQ0k7QUFDSDtBQUNKO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSDtBQXBHSTs7Ozs7Ozs7OztBQ0hUO0FBQ0E7QUFDQTtBQUNJOztBQUVBO0FBQ0k7QUFEUTs7QUFJWjtBQUNJO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFIUTtBQUtSO0FBQ0k7QUFDSTtBQUNIO0FBQ0o7QUFDSjtBQUNKO0FBcEJJOzs7Ozs7Ozs7O0FDRlQ7QUFDQTtBQUNBO0FBQ0k7O0FBRUE7O0FBR0E7QUFDSTtBQUNJO0FBQ0k7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSDtBQUNKO0FBQ0o7QUFsQkk7Ozs7Ozs7Ozs7QUNGVDtBQUNJO0FBQ0E7QUFDQTtBQUNJO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDSDtBQUNEO0FBQ0E7QUFDSTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTtBQUNIOztBQXRCWTs7Ozs7Ozs7OztBQ0FqQjtBQUNBO0FBQ0k7O0FBRUE7QUFDSTtBQUNBO0FBQ0E7QUFIUTs7QUFNWjtBQUNBO0FBQ0k7QUFDQTtBQUNBO0FBQ0g7O0FBRUQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0k7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNIO0FBQ0Q7QUFDSTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0g7QUFqQ0k7Ozs7Ozs7Ozs7QUNBVDs7OztBQUlBOztBQUVBOztBQUVBOzs7Ozs7QUFNQTtBQUNFO0FBQ0Q7O0FBRUQ7Ozs7Ozs7O0FBUUE7QUFDRTtBQUNFO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7Ozs7QUFTQTtBQUVFO0FBQ0E7QUFFQTtBQUNEOztBQUVEOzs7Ozs7Ozs7O0FBVUE7QUFDRTtBQUNBOztBQUVBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNEOztBQUVEOzs7Ozs7Ozs7O0FBVUE7QUFJRTs7QUFFQTtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNFO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7QUFDRjtBQUNEO0FBQ0Q7O0FBRUQ7Ozs7Ozs7O0FBUUE7QUFDRTtBQUNBO0FBQUE7O0FBR0E7QUFDRTtBQUNBO0FBQ0U7QUFDRDtBQUNGOztBQUVEO0FBQ0Q7O0FBRUQ7Ozs7Ozs7O0FBUUE7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7Ozs7Ozs7O0FBUUE7QUFDRTtBQUNEOzs7Ozs7Ozs7O0FDcktEO0FBQ0U7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDRTtBQUNBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNFO0FBQ0U7QUFDQTtBQUZLO0FBSVA7QUFMb0I7O0FBU3RCOztBQUVBO0FBQ0U7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFDRjtBQUNEO0FBQ0U7QUFDQTtBQUNEO0FBQ0Q7QUFDRTtBQUNBO0FBQ0E7QUFDRDtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEO0FBQ0Q7QUFDRTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0U7QUFDQTtBQUNEO0FBQ0M7QUFDRDtBQUNEO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7O0FBRUE7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0U7O0FBRUE7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNDO0FBQ0Q7O0FBR0Q7QUFDQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0Q7O0FBR0Q7O0FBRUE7QUFDRTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDQTs7QUFFQTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0M7QUFDQTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7O0FBRUE7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNBOztBQUVBO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNGOztBQUVEOztBQUVBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNFO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7QUFDQztBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRDtBQUNEO0FBQ0U7QUFDRDtBQUNDO0FBQ0Q7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDQTtBQUNEO0FBQ0M7QUFDQTtBQUNEOztBQUVEOztBQUVBO0FBQ0U7QUFDRDtBQUNGOztBQUVEO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7QUFDRDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDQTtBQUNFO0FBQ0U7QUFDQTtBQUZtQjtBQUlyQjtBQUNFO0FBQ0Q7QUFDRjtBQUNGOztBQUVEO0FBQ0Q7Ozs7Ozs7Ozs7QUMvV0Q7O0FBRUE7Ozs7O0FBS0E7Ozs7QUFJQTtBQUNFOztBQUVBO0FBQ0U7QUFDQTs7QUFFQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBRUY7O0FBRUQ7OztBQUdBO0FBQ0U7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQVBnQjtBQVVuQjs7QUFFRDs7O0FBR0E7O0FBRUU7O0FBRUE7QUFDRTtBQU9EO0FBRUY7O0FBRUQ7OztBQUdBOztBQUVFOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNEO0FBQ0Q7QUFDQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0U7QUFDRDtBQUNEOztBQUVBO0FBQ0Q7O0FBRUQ7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFDRjs7QUFFRDtBQUNEOztBQUdEO0FBQ0U7QUFDQTs7QUFFQTs7QUFFQTtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBOztBQUVBO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRDs7QUFFRDs7O0FBR0E7QUFDRTtBQUNBOztBQUVBO0FBQ0U7O0FBRUE7QUFDRTs7QUFFQTtBQUNEO0FBQ0M7QUFDQTtBQUNEO0FBQ0M7QUFDQTtBQUNEOztBQUVEO0FBRUQ7O0FBRUQ7QUFDQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDs7QUFFQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0U7QUFDRDtBQUNDO0FBQ0Q7QUFDQztBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNFO0FBQ0Q7QUFDQztBQUNEO0FBQ0M7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQ7OztBQUdBOztBQUVFO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRDs7QUFFRDs7O0FBR0E7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTs7QUFFQTtBQUNBO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7QUFDSDtBQUNFO0FBQ0U7QUFDRTtBQUNEO0FBQ0Y7QUFDSDtBQUNBO0FBQ0U7QUFDQTtBQUNFO0FBQ0U7QUFDRTtBQUNEO0FBQ0Y7QUFDRjtBQUNIO0FBckJGO0FBdUJEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7O0FBRUE7QUFDRTtBQUNBO0FBQ0U7QUFDQTtBQUNGO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7QUFDSDtBQVZGO0FBWUQ7QUFDRjs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0U7QUFDRjtBQUNBO0FBQ0U7QUFDQTtBQUNGO0FBQ0E7QUFDRTtBQUNBO0FBQ0Y7QUFDQTtBQUNFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRjtBQUNBO0FBQ0U7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFO0FBQ0E7QUFDRDtBQUNGO0FBQ0g7QUF4Q0Y7O0FBMkNBO0FBQ0Q7O0FBRUQ7OztBQUdBO0FBQ0U7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7QUFDQztBQUNFO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRDtBQUNGOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0U7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDRDtBQUNGOztBQUVEO0FBQ0U7O0FBRUE7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0U7QUFDRjtBQUNBO0FBQ0U7QUFDRTtBQUNEO0FBQ0Q7QUFDRjtBQVZGO0FBWUQ7O0FBRUQ7QUFDRDs7QUFFRDs7O0FBR0E7QUFDRTtBQUNEO0FBQ0Q7OztBQUdBO0FBQ0U7O0FBRUE7QUFDRTtBQUNBO0FBRks7QUFJUjs7QUFFRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFGSztBQUlSOztBQUVEO0FBQ0U7QUFDRTtBQUNFO0FBQ0Y7QUFDQTtBQUNFO0FBQ0Y7QUFDRTtBQUNBO0FBQ0E7QUFDRjtBQUNFO0FBQ0E7QUFDQTtBQUNGO0FBQ0U7O0FBRUE7QUFDQTs7QUFFQTtBQUNGO0FBQ0U7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNEO0FBQ0g7QUE1QkY7QUE4QkQ7O0FBRUQ7QUFDRTtBQUNFOztBQUVBO0FBQ0U7QUFDRDtBQUNGO0FBQ0M7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0U7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEO0FBQ0Q7QUFDRDs7QUFFRDtBQUNFO0FBQ0Q7QUFFRjs7Ozs7Ozs7Ozs7QUN0bUJEO0FBQ0U7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7Ozs7OztBQU9BO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNDO0FBQ0Q7QUFDQztBQUNEO0FBQ0Q7QUFDRTtBQUNBO0FBQ0Q7QUFDRjtBQUNEO0FBQ0E7QUFDQTtBQUNEOztBQUVEOzs7OztBQUtBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7QUFDRDtBQUNEO0FBQ0Q7QUFDRDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNCQTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0Q7QUFDRDs7QUFFRDs7Ozs7OztBQU9BO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNEO0FBQ0Q7QUFDRDs7QUFFRDs7Ozs7Ozs7OztBQVVBO0FBQ0U7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7QUFDRDtBQUNEO0FBQ0M7QUFDQTtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0Q7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEOzs7Ozs7QUFNQTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0E7QUFDQTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNBO0FBQ0U7QUFDRTtBQUNEO0FBQ0M7QUFDQTtBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0M7QUFDRDtBQUNEO0FBQ0Q7QUFDRjs7QUFFRDtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDUTtBQUNUOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0U7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFFRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7QUFDRDtBQUNEOztBQUVEO0FBQ0U7QUFFRTtBQUNEOztBQUVEOztBQUVBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNEO0FBQ0Q7O0FBRUE7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNEO0FBQ0M7QUFDRTtBQUNBO0FBQ0E7QUFDRDtBQUNDO0FBQ0Q7QUFDRjs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7Ozs7Ozs7Ozs7OztBQzdWRDtBQUNBO0FBQ0k7QUFDQTtBQUZXIiwic291cmNlc0NvbnRlbnQiOlsiLy8gcmVxdWlyZSgncG9tZWxvLWNvY29zMmQtanMnKTtcbm1vZHVsZS5leHBvcnRzPXt9OyIsImNjLkNsYXNzKHtcbiAgICBleHRlbmRzOiBjYy5Db21wb25lbnQsXG5cbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIC8vIGZvbzoge1xuICAgICAgICAvLyAgICBkZWZhdWx0OiBudWxsLCAgICAgIC8vIFRoZSBkZWZhdWx0IHZhbHVlIHdpbGwgYmUgdXNlZCBvbmx5IHdoZW4gdGhlIGNvbXBvbmVudCBhdHRhY2hpbmdcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICB0byBhIG5vZGUgZm9yIHRoZSBmaXJzdCB0aW1lXG4gICAgICAgIC8vICAgIHVybDogY2MuVGV4dHVyZTJELCAgLy8gb3B0aW9uYWwsIGRlZmF1bHQgaXMgdHlwZW9mIGRlZmF1bHRcbiAgICAgICAgLy8gICAgc2VyaWFsaXphYmxlOiB0cnVlLCAvLyBvcHRpb25hbCwgZGVmYXVsdCBpcyB0cnVlXG4gICAgICAgIC8vICAgIHZpc2libGU6IHRydWUsICAgICAgLy8gb3B0aW9uYWwsIGRlZmF1bHQgaXMgdHJ1ZVxuICAgICAgICAvLyAgICBkaXNwbGF5TmFtZTogJ0ZvbycsIC8vIG9wdGlvbmFsXG4gICAgICAgIC8vICAgIHJlYWRvbmx5OiBmYWxzZSwgICAgLy8gb3B0aW9uYWwsIGRlZmF1bHQgaXMgZmFsc2VcbiAgICAgICAgLy8gfSxcbiAgICAgICAgLy8gLi4uXG4gICAgfSxcblxuICAgIC8vIHVzZSB0aGlzIGZvciBpbml0aWFsaXphdGlvblxuICAgIG9uTG9hZDogZnVuY3Rpb24gKCkge1xuXG4gICAgfSxcblxuICAgIC8vIGNhbGxlZCBldmVyeSBmcmFtZSwgdW5jb21tZW50IHRoaXMgZnVuY3Rpb24gdG8gYWN0aXZhdGUgdXBkYXRlIGNhbGxiYWNrXG4gICAgLy8gdXBkYXRlOiBmdW5jdGlvbiAoZHQpIHtcblxuICAgIC8vIH0sXG59KTtcbiIsInZhciBSb29tRGF0YSA9IHJlcXVpcmUoXCIuLi8uLi9jb21tU3JjL2RhdGEvUm9vbURhdGFcIik7XG52YXIgR2FtZUNhcmRVaSA9IHJlcXVpcmUoXCIuL0dhbWVDYXJkVWlcIik7XG5jYy5DbGFzcyh7XG4gICAgZXh0ZW5kczogY2MuQ29tcG9uZW50LFxuXG4gICAgcHJvcGVydGllczoge1xuICAgICAgICBzYXlTcHJpdGU6Y2MuU3ByaXRlLFxuICAgICAgICBzYXlQcmVwYXJlOmNjLlNwcml0ZUZyYW1lLFxuICAgICAgICBHYW1lQ2FyZFVpUHJlZmFiOmNjLlByZWZhYixcbiAgICB9LFxuXG4gICAgLy8gdXNlIHRoaXMgZm9yIGluaXRpYWxpemF0aW9uXG4gICAgb25Mb2FkOiBmdW5jdGlvbiAoKSB7XG5cbiAgICB9LFxuICAgIC8vIOWIneWni+WMlnVpXG4gICAgaW5pdFVpOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNoYWlyID0gUm9vbURhdGEuZGF0YS5jaHJbdGhpcy5zZXJ2ZXJJZHhdO1xuICAgICAgICBpZiAoY2hhaXIgPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5ub2RlLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5ub2RlLmFjdGl2ZSA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnNheVNwcml0ZS5ub2RlLmFjdGl2ZSA9IChjaGFpci5wcmUgPT0gdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8vIOiuvue9ruacrOWcsOakheWtkOWPt1xuICAgIHNldExvY2FsQ2hhaXJJbmRleCA6IGZ1bmN0aW9uKGNoYWlySW5kZXgpIHtcbiAgICAgICAgLy8g5pys5Zyw5qSF5a2Q5Y+3XG4gICAgICAgIHRoaXMubG9jYWxJZHggPSBjaGFpckluZGV4O1xuXG4gICAgICAgIC8vIOacrOWcsOakheWtkOWPt+i9rOacjeWKoeWZqOakheWtkOWPt1xuICAgICAgICB2YXIgc2VydmVyQ2hhaXIgPSAoUm9vbURhdGEubXlDaGFpciArIGNoYWlySW5kZXgpJTU7XG4gICAgICAgIHRoaXMuc2VydmVySWR4ID0gc2VydmVyQ2hhaXI7XG4gICAgICAgIHRoaXMuaW5pdFVpKCk7XG4gICAgfSxcbiAgICAvLyDlh4blpIdcbiAgICBwcmVwYXJlOmZ1bmN0aW9uKCl7XG4gICAgICAgIHRoaXMuc2F5U3ByaXRlLnNwcml0ZUZyYW1lID0gdGhpcy5zYXlQcmVwYXJlO1xuICAgICAgICB0aGlzLnNheVNwcml0ZS5ub2RlLmFjdGl2ZSA9IHRydWU7XG4gICAgfSxcbiAgICAvLyDlj5HniYxcbiAgICBkaXNwYXRjaDpmdW5jdGlvbigpe1xuICAgICAgICB0aGlzLnNheVNwcml0ZS5ub2RlLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmNhcmRVaSA9IGNjLmluc3RhbnRpYXRlKHRoaXMuR2FtZUNhcmRVaVByZWZhYik7XG4gICAgICAgIHRoaXMuY2FyZFVpLnBhcmVudCA9IHRoaXMubm9kZTtcbiAgICAgICAgdGhpcy5jYXJkVWkueCA9IDkwO1xuICAgIH0sXG59KTtcbiIsInZhciBSb29tRGF0YSA9IHJlcXVpcmUoXCIuLi8uLi9jb21tU3JjL2RhdGEvUm9vbURhdGFcIik7XG52YXIgR2FtZVBsYXllclVpID0gcmVxdWlyZShcIi4vR2FtZVBsYXllclVpXCIpO1xudmFyIEdhbWVQbGF5ZXJVaSA9IHJlcXVpcmUoXCIuL0dhbWVQbGF5ZXJVaVwiKTtcbmNjLkNsYXNzKHtcbiAgICBleHRlbmRzOiBjYy5Db21wb25lbnQsXG5cbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNoYWlyczp7ZGVmYXVsdDpbXSx0eXBlOmNjLk5vZGV9LFxuICAgICAgICBHYW1lUGxheWVyUHJlZmFiOmNjLlByZWZhYixcbiAgICAgICAgcHJlcGFyZUJ1dHRvbjpjYy5CdXR0b24sXG4gICAgICAgIG9wdE5vZGU6Y2MuTm9kZSxcbiAgICAgICAgbG9va0J0bjpjYy5CdXR0b24sXG4gICAgICAgIGNvbXBhcmVCdG46Y2MuQnV0dG9uLFxuICAgICAgICBmb2xsb3dCdG46Y2MuQnV0dG9uLFxuICAgICAgICBhZGRCdG46Y2MuQnV0dG9uLFxuICAgICAgICBnaXZldXBCdG46Y2MuQnV0dG9uLFxuICAgIH0sXG5cbiAgICAvLyB1c2UgdGhpcyBmb3IgaW5pdGlhbGl6YXRpb25cbiAgICBvbkxvYWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5jaGFpclVpcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5jaGFpcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIHRoaXMuY2hhaXJVaXNbaV0gPSBjYy5pbnN0YW50aWF0ZSh0aGlzLkdhbWVQbGF5ZXJQcmVmYWIpO1xuICAgICAgICAgICAgdGhpcy5jaGFpclVpc1tpXS5wYXJlbnQgPSB0aGlzLmNoYWlyc1tpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcih2YXIgaT0wOyBpIDwgNTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmNoYWlyVWlzW2ldLmdldENvbXBvbmVudChHYW1lUGxheWVyVWkpLnNldExvY2FsQ2hhaXJJbmRleChpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVnaXN0UG9tZWxvT24oKTtcbiAgICAgICAgLy8g5Yi35paw5oyJ6ZKu54q25oCBXG4gICAgICAgIHRoaXMucmVmcmVzaEJ1dHRvbigpO1xuICAgIH0sXG4gICAgLy8g5b2T6KKr5raI5q+B55qE5pe25YCZ6LCD55SoXG4gICAgb25EZXN0cm95OmZ1bmN0aW9uKCl7XG4gICAgICAgIHBvbWVsby5vZmYoXCJvbkVudGVyUm9vbVwiKTtcbiAgICB9LFxuICAgIC8vIOazqOWGjHBvbWVsb+ebkeWQrFxuICAgIHJlZ2lzdFBvbWVsb09uOmZ1bmN0aW9uKCl7XG4gICAgICAgIHBvbWVsby5vbihcIm9uRW50ZXJSb29tXCIsIHRoaXMub25FbnRlclJvb20uYmluZCh0aGlzKSk7XG4gICAgICAgIHBvbWVsby5vbihcIm9uRXhpdFJvb21cIiwgdGhpcy5vbkV4aXRSb29tLmJpbmQodGhpcykpO1xuICAgICAgICBwb21lbG8ub24oXCJvblByZXBhcmVcIiwgdGhpcy5vblByZXBhcmUuYmluZCh0aGlzKSk7XG4gICAgICAgIHBvbWVsby5vbihcIm9uRGlzcGF0Y2hcIiwgdGhpcy5vbkRpc3BhdGNoLmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgLy8g5pyJ546p5a626L+b5YWl5oi/6Ze0XG4gICAgb25FbnRlclJvb206ZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25FbnRlclJvb21cIiwgZGF0YSk7XG4gICAgICAgIFJvb21EYXRhLmVudGVyKGRhdGEuY2hhaXIsIGRhdGEudWlkLCBkYXRhLmdvbGQpO1xuXG4gICAgICAgIHZhciBsb2NhbENoYWlyID0gKGRhdGEuY2hhaXIgLSBSb29tRGF0YS5teUNoYWlyKzUpJTU7XG4gICAgICAgIHRoaXMuY2hhaXJzW2xvY2FsQ2hhaXJdLmFjdGl2ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuY2hhaXJVaXNbbG9jYWxDaGFpcl0uZ2V0Q29tcG9uZW50KEdhbWVQbGF5ZXJVaSkuaW5pdFVpKCk7XG4gICAgfSxcbiAgICAvLyDmnInnjqnlrrbpgIDlh7rmiL/pl7RcbiAgICBvbkV4aXRSb29tOmZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBjb25zb2xlLmxvZyhcIm9uRXhpdFJvb21cIiwgZGF0YSk7XG4gICAgICAgIFJvb21EYXRhLmV4aXQoZGF0YS5jaGFpcik7XG5cbiAgICAgICAgdmFyIGxvY2FsQ2hhaXIgPSAoZGF0YS5jaGFpciAtIFJvb21EYXRhLm15Q2hhaXIrNSklNTtcbiAgICAgICAgdGhpcy5jaGFpcnNbbG9jYWxDaGFpcl0uYWN0aXZlID0gZmFsc2U7XG4gICAgfSxcbiAgICAvLyDmnInnjqnlrrbpgIDlh7rmiL/pl7RcbiAgICBvblByZXBhcmU6ZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25QcmVwYXJlXCIsIGRhdGEpO1xuICAgICAgICBSb29tRGF0YS5wcmVwYXJlKGRhdGEuY2hhaXIpO1xuXG4gICAgICAgIHZhciBsb2NhbENoYWlyID0gKGRhdGEuY2hhaXIgLSBSb29tRGF0YS5teUNoYWlyKzUpJTU7XG4gICAgICAgIHRoaXMuY2hhaXJVaXNbbG9jYWxDaGFpcl0uZ2V0Q29tcG9uZW50KFwiR2FtZVBsYXllclVpXCIpLnByZXBhcmUoKTtcbiAgICB9LFxuICAgIC8vIOW8gOWni+a4uOaIj++8iOWPkeeJjO+8iVxuICAgIG9uRGlzcGF0Y2g6ZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25EaXNwYXRjaFwiLCBkYXRhKTtcbiAgICAgICAgUm9vbURhdGEuc3RhcnQoKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDU7IGkrKykge1xuICAgICAgICAgICAgdmFyIHBsYXllciA9IFJvb21EYXRhLmRhdGEuY2hyW2ldO1xuICAgICAgICAgICAgaWYgKHBsYXllciAhPSBudWxsICYmIHBsYXllci5wcmUgPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHZhciBsb2NhbENoYWlyID0gKGkgLSBSb29tRGF0YS5teUNoYWlyKzUpJTU7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGFpclVpc1tsb2NhbENoYWlyXS5nZXRDb21wb25lbnQoXCJHYW1lUGxheWVyVWlcIikuZGlzcGF0Y2goKTtcblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVmcmVzaEJ1dHRvbigpO1xuICAgIH0sXG5cbiAgICAvLyDngrnlh7vkuoblh4blpIdcbiAgICBvblByZXBhcmVDbGljazpmdW5jdGlvbigpe1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHBvbWVsby5yZXF1ZXN0KFwiY29ubmVjdG9yLmVudHJ5SGFuZGxlci5wcmVwYXJlXCIsIHt9LCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgc2VsZi5yZWZyZXNoQnV0dG9uKCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgLy8g5Yi35paw5oyJ6ZKu54q25oCBXG4gICAgcmVmcmVzaEJ1dHRvbjpmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG15Q2hhaXJEYXRhID0gUm9vbURhdGEuZGF0YS5jaHJbUm9vbURhdGEubXlDaGFpcl07XG4gICAgICAgIHRoaXMucHJlcGFyZUJ1dHRvbi5ub2RlLmFjdGl2ZSA9ICgoUm9vbURhdGEuZGF0YS5pbmcgIT0gdHJ1ZSkgJiYgbXlDaGFpckRhdGEucHJlICE9IHRydWUpO1xuICAgICAgICB0aGlzLm9wdE5vZGUuYWN0aXZlID0gKFJvb21EYXRhLmRhdGEuaW5nID09IHRydWUpO1xuICAgICAgICB0aGlzLmxvb2tCdG4uaW50ZXJhY3RhYmxlID0gKG15Q2hhaXJEYXRhLmxvb2sgIT0gdHJ1ZSk7XG4gICAgICAgIHRoaXMuY29tcGFyZUJ0bi5pbnRlcmFjdGFibGUgPSAoUm9vbURhdGEuZGF0YS5zID09IFJvb21EYXRhLm15Q2hhaXIpO1xuICAgICAgICB0aGlzLmZvbGxvd0J0bi5pbnRlcmFjdGFibGUgPSAoUm9vbURhdGEuZGF0YS5zID09IFJvb21EYXRhLm15Q2hhaXIpO1xuICAgICAgICB0aGlzLmFkZEJ0bi5pbnRlcmFjdGFibGUgPSAoUm9vbURhdGEuZGF0YS5zID09IFJvb21EYXRhLm15Q2hhaXIpO1xuICAgICAgICB0aGlzLmdpdmV1cEJ0bi5pbnRlcmFjdGFibGUgPSAoUm9vbURhdGEuZGF0YS5zID09IFJvb21EYXRhLm15Q2hhaXIpO1xuICAgIH0sXG59KTtcbiIsInZhciBDb21tID0gcmVxdWlyZShcIi4uLy4uL2NvbW1TcmMvQ29tbVwiKTtcbnZhciBzZXJ2ZXJDZmcgPSByZXF1aXJlKFwiLi4vLi4vY2ZnL3NlcnZlckNmZ1wiKTtcbmNjLkNsYXNzKHtcbiAgICBleHRlbmRzOiBjYy5Db21wb25lbnQsXG5cbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIHVzZXJuYW1lTGFiZWw6Y2MuRWRpdEJveCxcbiAgICB9LFxuXG4gICAgb25Mb2dpbkNsaWNrOmZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgcG9tZWxvLmluaXQoe1xuICAgICAgICAgICAgaG9zdDpzZXJ2ZXJDZmcuc2VydmVySXAsXG4gICAgICAgICAgICAvLyBob3N0OlwiMTI3LjAuMC4xXCIsXG4gICAgICAgICAgICBwb3J0OnNlcnZlckNmZy5zZXJ2ZXJQb3J0LFxuICAgICAgICB9LCBmdW5jdGlvbihlcnIpe1xuICAgICAgICAgICAgcG9tZWxvLnJlcXVlc3QoXCJjb25uZWN0b3IuZW50cnlIYW5kbGVyLmxvZ2luXCIsIHt1c2VybmFtZTpzZWxmLnVzZXJuYW1lTGFiZWwuc3RyaW5nfSwgZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEucmV0ID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgQ29tbS5zY2VuZS5sb2dpbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxufSk7XG4iLCJ2YXIgUm9vbURhdGEgPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9kYXRhL1Jvb21EYXRhXCIpO1xudmFyIENvbW0gPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9Db21tXCIpO1xuY2MuQ2xhc3Moe1xuICAgIGV4dGVuZHM6IGNjLkNvbXBvbmVudCxcblxuICAgIHByb3BlcnRpZXM6IHtcbiAgICB9LFxuXG4gICAgb25Sb29tMUNsaWNrOmZ1bmN0aW9uKCl7XG4gICAgICAgIHBvbWVsby5yZXF1ZXN0KFwiY29ubmVjdG9yLmVudHJ5SGFuZGxlci5lbnRlclJvb21cIiwge30sIGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICAgICAgaWYgKGRhdGEucmV0ID09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhLmRhdGEucm9vbURhdGEpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEuZGF0YS5jaGFpcik7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YS5kYXRhLnJvb21JZCk7XG4gICAgICAgICAgICAgICAgUm9vbURhdGEuZGF0YSA9IGRhdGEuZGF0YS5yb29tRGF0YTtcbiAgICAgICAgICAgICAgICBSb29tRGF0YS5teUNoYWlyID0gZGF0YS5kYXRhLmNoYWlyO1xuICAgICAgICAgICAgICAgIFJvb21EYXRhLnJvb21JZCA9IGRhdGEuZGF0YS5yb29tSWQ7XG4gICAgICAgICAgICAgICAgQ29tbS5zY2VuZS5lbnRlclJvb20oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgZGF0YSA6IHtjaHI6W251bGwsbnVsbCxudWxsLG51bGxdfSxcbiAgICAvLyDov5vlhaXmiL/pl7RcbiAgICBlbnRlciA6IGZ1bmN0aW9uKGNoYWlyLCB1aWQsIGdvbGQpe1xuICAgICAgICB0aGlzLmRhdGEuY2hyW2NoYWlyXSA9IHt1aWQ6dWlkLGdvbGQ6Z29sZH07XG4gICAgfSxcbiAgICAvLyDpgIDlh7rmiL/pl7RcbiAgICBleGl0IDogZnVuY3Rpb24oY2hhaXIpe1xuICAgICAgICB0aGlzLmRhdGEuY2hyW2NoYWlyXSA9IG51bGw7XG4gICAgfSxcbiAgICAvLyDlh4blpIdcbiAgICBwcmVwYXJlOmZ1bmN0aW9uKGNoYWlyKSB7XG4gICAgICAgIHRoaXMuZGF0YS5jaHJbY2hhaXJdLnByZSA9IHRydWU7XG4gICAgfSxcbiAgICAvLyDlj5HniYws5byA5aeLXG4gICAgc3RhcnQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmRhdGEuaW5nID0gdHJ1ZTtcbiAgICB9LFxuICAgIC8vIOiuvue9ruWPkeiogOS6ulxuICAgIHNldFNwZWFrZXI6ZnVuY3Rpb24oc3BlYWtlciwgc3BlYWtlclRpbWUpIHtcbiAgICAgICAgdGhpcy5kYXRhLnMgPSBzcGVha2VyO1xuICAgICAgICB0aGlzLmRhdGEuc3QgPSBzcGVha2VyVGltZTtcbiAgICB9LFxuXG59O1xuIiwidmFyIENvbW0gPSByZXF1aXJlKFwiLi4vY29tbVNyYy9Db21tXCIpO1xuY2MuQ2xhc3Moe1xuICAgIGV4dGVuZHM6IGNjLkNvbXBvbmVudCxcblxuICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgbG9naW5VaVByZWZhYjpjYy5QcmVmYWIsXG4gICAgICAgIG1haW5VaVByZWZhYjpjYy5QcmVmYWIsXG4gICAgICAgIGdhbWVVaVByZWZhYjpjYy5QcmVmYWIsXG4gICAgfSxcblxuICAgIC8vIHVzZSB0aGlzIGZvciBpbml0aWFsaXphdGlvblxuICAgIG9uTG9hZDogZnVuY3Rpb24gKCkge1xuICAgICAgICBDb21tLnNjZW5lID0gdGhpcztcbiAgICAgICAgdGhpcy5sb2dpblVpID0gY2MuaW5zdGFudGlhdGUodGhpcy5sb2dpblVpUHJlZmFiKTtcbiAgICAgICAgdGhpcy5sb2dpblVpLnBhcmVudCA9IHRoaXMubm9kZTtcbiAgICB9LFxuXG4gICAgLy8gY2FsbGVkIGV2ZXJ5IGZyYW1lLCB1bmNvbW1lbnQgdGhpcyBmdW5jdGlvbiB0byBhY3RpdmF0ZSB1cGRhdGUgY2FsbGJhY2tcbiAgICAvLyB1cGRhdGU6IGZ1bmN0aW9uIChkdCkge1xuXG4gICAgLy8gfSxcbiAgICBsb2dpbjpmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJsb2dpblwiKTtcbiAgICAgICAgdGhpcy5sb2dpblVpLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5sb2dpblVpID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYWluVWkgPSBjYy5pbnN0YW50aWF0ZSh0aGlzLm1haW5VaVByZWZhYik7XG4gICAgICAgIHRoaXMubWFpblVpLnBhcmVudCA9IHRoaXMubm9kZTtcbiAgICB9LFxuICAgIGVudGVyUm9vbTpmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJlbnRlclJvb21cIik7XG4gICAgICAgIHRoaXMubWFpblVpLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5tYWluVWkgPSBudWxsO1xuICAgICAgICB0aGlzLmdhbWVVaSA9IGNjLmluc3RhbnRpYXRlKHRoaXMuZ2FtZVVpUHJlZmFiKTtcbiAgICAgICAgdGhpcy5nYW1lVWkucGFyZW50ID0gdGhpcy5ub2RlO1xuICAgIH0sXG59KTtcbiIsIlxuLyoqXG4gKiBFeHBvc2UgYEVtaXR0ZXJgLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gRW1pdHRlcjtcblxud2luZG93LkV2ZW50RW1pdHRlciA9IEVtaXR0ZXI7XG5cbi8qKlxuICogSW5pdGlhbGl6ZSBhIG5ldyBgRW1pdHRlcmAuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBFbWl0dGVyKG9iaikge1xuICBpZiAob2JqKSByZXR1cm4gbWl4aW4ob2JqKTtcbn07XG5cbi8qKlxuICogTWl4aW4gdGhlIGVtaXR0ZXIgcHJvcGVydGllcy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBtaXhpbihvYmopIHtcbiAgZm9yICh2YXIga2V5IGluIEVtaXR0ZXIucHJvdG90eXBlKSB7XG4gICAgb2JqW2tleV0gPSBFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xuICB9XG4gIHJldHVybiBvYmo7XG59XG5cbi8qKlxuICogTGlzdGVuIG9uIHRoZSBnaXZlbiBgZXZlbnRgIHdpdGggYGZuYC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5vbiA9XG5FbWl0dGVyLnByb3RvdHlwZS5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuICAodGhpcy5fY2FsbGJhY2tzW2V2ZW50XSA9IHRoaXMuX2NhbGxiYWNrc1tldmVudF0gfHwgW10pXG4gICAgLnB1c2goZm4pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQWRkcyBhbiBgZXZlbnRgIGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGEgc2luZ2xlXG4gKiB0aW1lIHRoZW4gYXV0b21hdGljYWxseSByZW1vdmVkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbihldmVudCwgZm4pe1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblxuICBmdW5jdGlvbiBvbigpIHtcbiAgICBzZWxmLm9mZihldmVudCwgb24pO1xuICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICBvbi5mbiA9IGZuO1xuICB0aGlzLm9uKGV2ZW50LCBvbik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgdGhlIGdpdmVuIGNhbGxiYWNrIGZvciBgZXZlbnRgIG9yIGFsbFxuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7RW1pdHRlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUub2ZmID1cbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID1cbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9XG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXG4gIC8vIGFsbFxuICBpZiAoMCA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgdGhpcy5fY2FsbGJhY2tzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBzcGVjaWZpYyBldmVudFxuICB2YXIgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzW2V2ZW50XTtcbiAgaWYgKCFjYWxsYmFja3MpIHJldHVybiB0aGlzO1xuXG4gIC8vIHJlbW92ZSBhbGwgaGFuZGxlcnNcbiAgaWYgKDEgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xuICAgIGRlbGV0ZSB0aGlzLl9jYWxsYmFja3NbZXZlbnRdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gcmVtb3ZlIHNwZWNpZmljIGhhbmRsZXJcbiAgdmFyIGNiO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgIGNiID0gY2FsbGJhY2tzW2ldO1xuICAgIGlmIChjYiA9PT0gZm4gfHwgY2IuZm4gPT09IGZuKSB7XG4gICAgICBjYWxsYmFja3Muc3BsaWNlKGksIDEpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBFbWl0IGBldmVudGAgd2l0aCB0aGUgZ2l2ZW4gYXJncy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7TWl4ZWR9IC4uLlxuICogQHJldHVybiB7RW1pdHRlcn1cbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24oZXZlbnQpe1xuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG4gIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG4gICAgLCBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbZXZlbnRdO1xuXG4gIGlmIChjYWxsYmFja3MpIHtcbiAgICBjYWxsYmFja3MgPSBjYWxsYmFja3Muc2xpY2UoMCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNhbGxiYWNrcy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgY2FsbGJhY2tzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBSZXR1cm4gYXJyYXkgb2YgY2FsbGJhY2tzIGZvciBgZXZlbnRgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHJldHVybiB7QXJyYXl9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuICByZXR1cm4gdGhpcy5fY2FsbGJhY2tzW2V2ZW50XSB8fCBbXTtcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhpcyBlbWl0dGVyIGhhcyBgZXZlbnRgIGhhbmRsZXJzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUuaGFzTGlzdGVuZXJzID0gZnVuY3Rpb24oZXZlbnQpe1xuICByZXR1cm4gISEgdGhpcy5saXN0ZW5lcnMoZXZlbnQpLmxlbmd0aDtcbn07XG4iLCIoZnVuY3Rpb24oKSB7XG4gIHZhciBKU19XU19DTElFTlRfVFlQRSA9ICdqcy13ZWJzb2NrZXQnO1xuICB2YXIgSlNfV1NfQ0xJRU5UX1ZFUlNJT04gPSAnMC4wLjEnO1xuXG4gIHZhciBQcm9jdG9jb2wgPSByZXF1aXJlKFwicHJvdG9jb2xcIik7XG4gIHZhciBQYWNrYWdlID0gUHJvdG9jb2wuUGFja2FnZTtcbiAgdmFyIE1lc3NhZ2UgPSBQcm90b2NvbC5NZXNzYWdlO1xuICB2YXIgRXZlbnRFbWl0dGVyID0gd2luZG93LkV2ZW50RW1pdHRlcjtcblxuICBpZih0eXBlb2Yod2luZG93KSAhPSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZihzeXMpICE9ICd1bmRlZmluZWQnICYmIHN5cy5sb2NhbFN0b3JhZ2UpIHtcbiAgICB3aW5kb3cubG9jYWxTdG9yYWdlID0gc3lzLmxvY2FsU3RvcmFnZTtcbiAgfVxuXG4gIHZhciBSRVNfT0sgPSAyMDA7XG4gIHZhciBSRVNfRkFJTCA9IDUwMDtcbiAgdmFyIFJFU19PTERfQ0xJRU5UID0gNTAxO1xuXG4gIGlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIE9iamVjdC5jcmVhdGUgPSBmdW5jdGlvbiAobykge1xuICAgICAgZnVuY3Rpb24gRigpIHt9XG4gICAgICBGLnByb3RvdHlwZSA9IG87XG4gICAgICByZXR1cm4gbmV3IEYoKTtcbiAgICB9O1xuICB9XG5cbiAgdmFyIHJvb3QgPSB3aW5kb3c7XG4gIHZhciBwb21lbG8gPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpOyAvLyBvYmplY3QgZXh0ZW5kIGZyb20gb2JqZWN0XG4gIHJvb3QucG9tZWxvID0gcG9tZWxvO1xuICB2YXIgc29ja2V0ID0gbnVsbDtcbiAgdmFyIHJlcUlkID0gMDtcbiAgdmFyIGNhbGxiYWNrcyA9IHt9O1xuICB2YXIgaGFuZGxlcnMgPSB7fTtcbiAgLy9NYXAgZnJvbSByZXF1ZXN0IGlkIHRvIHJvdXRlXG4gIHZhciByb3V0ZU1hcCA9IHt9O1xuXG4gIHZhciBoZWFydGJlYXRJbnRlcnZhbCA9IDA7XG4gIHZhciBoZWFydGJlYXRUaW1lb3V0ID0gMDtcbiAgdmFyIG5leHRIZWFydGJlYXRUaW1lb3V0ID0gMDtcbiAgdmFyIGdhcFRocmVzaG9sZCA9IDEwMDsgICAvLyBoZWFydGJlYXQgZ2FwIHRocmVhc2hvbGRcbiAgdmFyIGhlYXJ0YmVhdElkID0gbnVsbDtcbiAgdmFyIGhlYXJ0YmVhdFRpbWVvdXRJZCA9IG51bGw7XG5cbiAgdmFyIGhhbmRzaGFrZUNhbGxiYWNrID0gbnVsbDtcblxuICB2YXIgZGVjb2RlID0gbnVsbDtcbiAgdmFyIGVuY29kZSA9IG51bGw7XG5cbiAgdmFyIHVzZUNyeXB0bztcblxuICB2YXIgaGFuZHNoYWtlQnVmZmVyID0ge1xuICAgICdzeXMnOiB7XG4gICAgICB0eXBlOiBKU19XU19DTElFTlRfVFlQRSxcbiAgICAgIHZlcnNpb246IEpTX1dTX0NMSUVOVF9WRVJTSU9OXG4gICAgfSxcbiAgICAndXNlcic6IHtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGluaXRDYWxsYmFjayA9IG51bGw7XG5cbiAgcG9tZWxvLmluaXQgPSBmdW5jdGlvbihwYXJhbXMsIGNiKXtcbiAgICBpbml0Q2FsbGJhY2sgPSBjYjtcbiAgICB2YXIgaG9zdCA9IHBhcmFtcy5ob3N0O1xuICAgIHZhciBwb3J0ID0gcGFyYW1zLnBvcnQ7XG5cbiAgICB2YXIgdXJsID0gJ3dzOi8vJyArIGhvc3Q7XG4gICAgaWYocG9ydCkge1xuICAgICAgdXJsICs9ICAnOicgKyBwb3J0O1xuICAgIH1cblxuICAgIGhhbmRzaGFrZUJ1ZmZlci51c2VyID0gcGFyYW1zLnVzZXI7XG4gICAgaGFuZHNoYWtlQ2FsbGJhY2sgPSBwYXJhbXMuaGFuZHNoYWtlQ2FsbGJhY2s7XG4gICAgaW5pdFdlYlNvY2tldCh1cmwsIGNiKTtcbiAgfTtcblxuICB2YXIgaW5pdFdlYlNvY2tldCA9IGZ1bmN0aW9uKHVybCxjYil7XG4gICAgdmFyIG9ub3BlbiA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgIHZhciBvYmogPSBQYWNrYWdlLmVuY29kZShQYWNrYWdlLlRZUEVfSEFORFNIQUtFLCBQcm90b2NvbC5zdHJlbmNvZGUoSlNPTi5zdHJpbmdpZnkoaGFuZHNoYWtlQnVmZmVyKSkpO1xuICAgICAgc2VuZChvYmopO1xuICAgIH07XG4gICAgdmFyIG9ubWVzc2FnZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICBwcm9jZXNzUGFja2FnZShQYWNrYWdlLmRlY29kZShldmVudC5kYXRhKSwgY2IpO1xuICAgICAgLy8gbmV3IHBhY2thZ2UgYXJyaXZlZCwgdXBkYXRlIHRoZSBoZWFydGJlYXQgdGltZW91dFxuICAgICAgaWYoaGVhcnRiZWF0VGltZW91dCkge1xuICAgICAgICBuZXh0SGVhcnRiZWF0VGltZW91dCA9IERhdGUubm93KCkgKyBoZWFydGJlYXRUaW1lb3V0O1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIG9uZXJyb3IgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgcG9tZWxvLmVtaXQoJ2lvLWVycm9yJywgZXZlbnQpO1xuICAgICAgY2MuZXJyb3IoJ3NvY2tldCBlcnJvcjogJywgZXZlbnQpO1xuICAgIH07XG4gICAgdmFyIG9uY2xvc2UgPSBmdW5jdGlvbihldmVudCl7XG4gICAgICBwb21lbG8uZW1pdCgnY2xvc2UnLGV2ZW50KTtcbiAgICAgIHBvbWVsby5lbWl0KCdkaXNjb25uZWN0JywgZXZlbnQpO1xuICAgICAgY2MuZXJyb3IoJ3NvY2tldCBjbG9zZTogJywgZXZlbnQpO1xuICAgIH07XG4gICAgc29ja2V0ID0gbmV3IFdlYlNvY2tldCh1cmwpO1xuICAgIHNvY2tldC5iaW5hcnlUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICBzb2NrZXQub25vcGVuID0gb25vcGVuO1xuICAgIHNvY2tldC5vbm1lc3NhZ2UgPSBvbm1lc3NhZ2U7XG4gICAgc29ja2V0Lm9uZXJyb3IgPSBvbmVycm9yO1xuICAgIHNvY2tldC5vbmNsb3NlID0gb25jbG9zZTtcbiAgfTtcblxuICBwb21lbG8uZGlzY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmKHNvY2tldCkge1xuICAgICAgaWYoc29ja2V0LmRpc2Nvbm5lY3QpIHNvY2tldC5kaXNjb25uZWN0KCk7XG4gICAgICBpZihzb2NrZXQuY2xvc2UpIHNvY2tldC5jbG9zZSgpO1xuICAgICAgY2MubG9nKCdkaXNjb25uZWN0Jyk7XG4gICAgICBzb2NrZXQgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKGhlYXJ0YmVhdElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQoaGVhcnRiZWF0SWQpO1xuICAgICAgaGVhcnRiZWF0SWQgPSBudWxsO1xuICAgIH1cbiAgICBpZihoZWFydGJlYXRUaW1lb3V0SWQpIHtcbiAgICAgIGNsZWFyVGltZW91dChoZWFydGJlYXRUaW1lb3V0SWQpO1xuICAgICAgaGVhcnRiZWF0VGltZW91dElkID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgcG9tZWxvLnJlcXVlc3QgPSBmdW5jdGlvbihyb3V0ZSwgbXNnLCBjYikge1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIgJiYgdHlwZW9mIG1zZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2IgPSBtc2c7XG4gICAgICBtc2cgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID0gbXNnIHx8IHt9O1xuICAgIH1cbiAgICByb3V0ZSA9IHJvdXRlIHx8IG1zZy5yb3V0ZTtcbiAgICBpZighcm91dGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZXFJZCsrO1xuICAgIHNlbmRNZXNzYWdlKHJlcUlkLCByb3V0ZSwgbXNnKTtcblxuICAgIGNhbGxiYWNrc1tyZXFJZF0gPSBjYjtcbiAgICByb3V0ZU1hcFtyZXFJZF0gPSByb3V0ZTtcbiAgfTtcblxuICBwb21lbG8ubm90aWZ5ID0gZnVuY3Rpb24ocm91dGUsIG1zZykge1xuICAgIG1zZyA9IG1zZyB8fCB7fTtcbiAgICBzZW5kTWVzc2FnZSgwLCByb3V0ZSwgbXNnKTtcbiAgfTtcblxuICB2YXIgc2VuZE1lc3NhZ2UgPSBmdW5jdGlvbihyZXFJZCwgcm91dGUsIG1zZykge1xuICAgIHZhciB0eXBlID0gcmVxSWQgPyBNZXNzYWdlLlRZUEVfUkVRVUVTVCA6IE1lc3NhZ2UuVFlQRV9OT1RJRlk7XG5cbiAgICAvL2NvbXByZXNzIG1lc3NhZ2UgYnkgcHJvdG9idWZcbiAgICB2YXIgcHJvdG9zID0gISFwb21lbG8uZGF0YS5wcm90b3M/cG9tZWxvLmRhdGEucHJvdG9zLmNsaWVudDp7fTtcbiAgICBpZighIXByb3Rvc1tyb3V0ZV0pe1xuICAgICAgbXNnID0gcHJvdG9idWYuZW5jb2RlKHJvdXRlLCBtc2cpO1xuICAgIH1lbHNle1xuICAgICAgbXNnID0gUHJvdG9jb2wuc3RyZW5jb2RlKEpTT04uc3RyaW5naWZ5KG1zZykpO1xuICAgIH1cblxuXG4gICAgdmFyIGNvbXByZXNzUm91dGUgPSAwO1xuICAgIGlmKHBvbWVsby5kaWN0ICYmIHBvbWVsby5kaWN0W3JvdXRlXSl7XG4gICAgICByb3V0ZSA9IHBvbWVsby5kaWN0W3JvdXRlXTtcbiAgICAgIGNvbXByZXNzUm91dGUgPSAxO1xuICAgIH1cblxuICAgIG1zZyA9IE1lc3NhZ2UuZW5jb2RlKHJlcUlkLCB0eXBlLCBjb21wcmVzc1JvdXRlLCByb3V0ZSwgbXNnKTtcbiAgICB2YXIgcGFja2V0ID0gUGFja2FnZS5lbmNvZGUoUGFja2FnZS5UWVBFX0RBVEEsIG1zZyk7XG4gICAgc2VuZChwYWNrZXQpO1xuICB9O1xuXG4gIHZhciBzZW5kID0gZnVuY3Rpb24ocGFja2V0KXtcbiAgICBzb2NrZXQuc2VuZChwYWNrZXQuYnVmZmVyKTtcbiAgfTtcblxuXG4gIHZhciBoYW5kbGVyID0ge307XG5cbiAgdmFyIGhlYXJ0YmVhdCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBpZighaGVhcnRiZWF0SW50ZXJ2YWwpIHtcbiAgICAgIC8vIG5vIGhlYXJ0YmVhdFxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBvYmogPSBQYWNrYWdlLmVuY29kZShQYWNrYWdlLlRZUEVfSEVBUlRCRUFUKTtcbiAgICBpZihoZWFydGJlYXRUaW1lb3V0SWQpIHtcbiAgICAgIGNsZWFyVGltZW91dChoZWFydGJlYXRUaW1lb3V0SWQpO1xuICAgICAgaGVhcnRiZWF0VGltZW91dElkID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZihoZWFydGJlYXRJZCkge1xuICAgICAgLy8gYWxyZWFkeSBpbiBhIGhlYXJ0YmVhdCBpbnRlcnZhbFxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGhlYXJ0YmVhdElkID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgIGhlYXJ0YmVhdElkID0gbnVsbDtcbiAgICAgIHNlbmQob2JqKTtcblxuICAgICAgbmV4dEhlYXJ0YmVhdFRpbWVvdXQgPSBEYXRlLm5vdygpICsgaGVhcnRiZWF0VGltZW91dDtcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXRJZCA9IHNldFRpbWVvdXQoaGVhcnRiZWF0VGltZW91dENiLCBoZWFydGJlYXRUaW1lb3V0KTtcbiAgICB9LCBoZWFydGJlYXRJbnRlcnZhbCk7XG4gIH07XG5cbiAgdmFyIGhlYXJ0YmVhdFRpbWVvdXRDYiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBnYXAgPSBuZXh0SGVhcnRiZWF0VGltZW91dCAtIERhdGUubm93KCk7XG4gICAgaWYoZ2FwID4gZ2FwVGhyZXNob2xkKSB7XG4gICAgICBoZWFydGJlYXRUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGhlYXJ0YmVhdFRpbWVvdXRDYiwgZ2FwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2MuZXJyb3IoJ3NlcnZlciBoZWFydGJlYXQgdGltZW91dCcpO1xuICAgICAgcG9tZWxvLmVtaXQoJ2hlYXJ0YmVhdCB0aW1lb3V0Jyk7XG4gICAgICBwb21lbG8uZGlzY29ubmVjdCgpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgaGFuZHNoYWtlID0gZnVuY3Rpb24oZGF0YSl7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UoUHJvdG9jb2wuc3RyZGVjb2RlKGRhdGEpKTtcbiAgICBpZihkYXRhLmNvZGUgPT09IFJFU19PTERfQ0xJRU5UKSB7XG4gICAgICBwb21lbG8uZW1pdCgnZXJyb3InLCAnY2xpZW50IHZlcnNpb24gbm90IGZ1bGxmaWxsJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoZGF0YS5jb2RlICE9PSBSRVNfT0spIHtcbiAgICAgIHBvbWVsby5lbWl0KCdlcnJvcicsICdoYW5kc2hha2UgZmFpbCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGhhbmRzaGFrZUluaXQoZGF0YSk7XG5cbiAgICB2YXIgb2JqID0gUGFja2FnZS5lbmNvZGUoUGFja2FnZS5UWVBFX0hBTkRTSEFLRV9BQ0spO1xuICAgIHNlbmQob2JqKTtcbiAgICBpZihpbml0Q2FsbGJhY2spIHtcbiAgICAgIGluaXRDYWxsYmFjayhzb2NrZXQpO1xuICAgICAgaW5pdENhbGxiYWNrID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgdmFyIG9uRGF0YSA9IGZ1bmN0aW9uKGRhdGEpe1xuICAgIC8vcHJvYnVmZiBkZWNvZGVcbiAgICB2YXIgbXNnID0gTWVzc2FnZS5kZWNvZGUoZGF0YSk7XG5cbiAgICBpZihtc2cuaWQgPiAwKXtcbiAgICAgIG1zZy5yb3V0ZSA9IHJvdXRlTWFwW21zZy5pZF07XG4gICAgICBkZWxldGUgcm91dGVNYXBbbXNnLmlkXTtcbiAgICAgIGlmKCFtc2cucm91dGUpe1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgbXNnLmJvZHkgPSBkZUNvbXBvc2UobXNnKTtcblxuICAgIHByb2Nlc3NNZXNzYWdlKHBvbWVsbywgbXNnKTtcbiAgfTtcblxuICB2YXIgb25LaWNrID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKFByb3RvY29sLnN0cmRlY29kZShkYXRhKSk7XG4gICAgcG9tZWxvLmVtaXQoJ29uS2ljaycsIGRhdGEpO1xuICB9O1xuXG4gIGhhbmRsZXJzW1BhY2thZ2UuVFlQRV9IQU5EU0hBS0VdID0gaGFuZHNoYWtlO1xuICBoYW5kbGVyc1tQYWNrYWdlLlRZUEVfSEVBUlRCRUFUXSA9IGhlYXJ0YmVhdDtcbiAgaGFuZGxlcnNbUGFja2FnZS5UWVBFX0RBVEFdID0gb25EYXRhO1xuICBoYW5kbGVyc1tQYWNrYWdlLlRZUEVfS0lDS10gPSBvbktpY2s7XG5cbiAgdmFyIHByb2Nlc3NQYWNrYWdlID0gZnVuY3Rpb24obXNncykge1xuICAgIGlmKEFycmF5LmlzQXJyYXkobXNncykpIHtcbiAgICAgIGZvcih2YXIgaT0wOyBpPG1zZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG1zZyA9IG1zZ3NbaV07XG4gICAgICAgIGhhbmRsZXJzW21zZy50eXBlXShtc2cuYm9keSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZXJzW21zZ3MudHlwZV0obXNncy5ib2R5KTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIHByb2Nlc3NNZXNzYWdlID0gZnVuY3Rpb24ocG9tZWxvLCBtc2cpIHtcbiAgICBpZighbXNnLmlkKSB7XG4gICAgICAvLyBzZXJ2ZXIgcHVzaCBtZXNzYWdlXG4gICAgICBwb21lbG8uZW1pdChtc2cucm91dGUsIG1zZy5ib2R5KTtcbiAgICB9XG5cbiAgICAvL2lmIGhhdmUgYSBpZCB0aGVuIGZpbmQgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHdpdGggdGhlIHJlcXVlc3RcbiAgICB2YXIgY2IgPSBjYWxsYmFja3NbbXNnLmlkXTtcblxuICAgIGRlbGV0ZSBjYWxsYmFja3NbbXNnLmlkXTtcbiAgICBpZih0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYihtc2cuYm9keSk7XG4gICAgcmV0dXJuO1xuICB9O1xuXG4gIHZhciBwcm9jZXNzTWVzc2FnZUJhdGNoID0gZnVuY3Rpb24ocG9tZWxvLCBtc2dzKSB7XG4gICAgZm9yKHZhciBpPTAsIGw9bXNncy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBwcm9jZXNzTWVzc2FnZShwb21lbG8sIG1zZ3NbaV0pO1xuICAgIH1cbiAgfTtcblxuICB2YXIgZGVDb21wb3NlID0gZnVuY3Rpb24obXNnKXtcbiAgICB2YXIgcHJvdG9zID0gISFwb21lbG8uZGF0YS5wcm90b3M/cG9tZWxvLmRhdGEucHJvdG9zLnNlcnZlcjp7fTtcbiAgICB2YXIgYWJicnMgPSBwb21lbG8uZGF0YS5hYmJycztcbiAgICB2YXIgcm91dGUgPSBtc2cucm91dGU7XG5cbiAgICAvL0RlY29tcG9zZSByb3V0ZSBmcm9tIGRpY3RcbiAgICBpZihtc2cuY29tcHJlc3NSb3V0ZSkge1xuICAgICAgaWYoIWFiYnJzW3JvdXRlXSl7XG4gICAgICAgIHJldHVybiB7fTtcbiAgICAgIH1cblxuICAgICAgcm91dGUgPSBtc2cucm91dGUgPSBhYmJyc1tyb3V0ZV07XG4gICAgfVxuICAgIGlmKCEhcHJvdG9zW3JvdXRlXSl7XG4gICAgICByZXR1cm4gcHJvdG9idWYuZGVjb2RlKHJvdXRlLCBtc2cuYm9keSk7XG4gICAgfWVsc2V7XG4gICAgICByZXR1cm4gSlNPTi5wYXJzZShQcm90b2NvbC5zdHJkZWNvZGUobXNnLmJvZHkpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbXNnO1xuICB9O1xuXG4gIHZhciBoYW5kc2hha2VJbml0ID0gZnVuY3Rpb24oZGF0YSl7XG4gICAgaWYoZGF0YS5zeXMgJiYgZGF0YS5zeXMuaGVhcnRiZWF0KSB7XG4gICAgICBoZWFydGJlYXRJbnRlcnZhbCA9IGRhdGEuc3lzLmhlYXJ0YmVhdCAqIDEwMDA7ICAgLy8gaGVhcnRiZWF0IGludGVydmFsXG4gICAgICBoZWFydGJlYXRUaW1lb3V0ID0gaGVhcnRiZWF0SW50ZXJ2YWwgKiAyOyAgICAgICAgLy8gbWF4IGhlYXJ0YmVhdCB0aW1lb3V0XG4gICAgfSBlbHNlIHtcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsID0gMDtcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQgPSAwO1xuICAgIH1cblxuICAgIGluaXREYXRhKGRhdGEpO1xuXG4gICAgaWYodHlwZW9mIGhhbmRzaGFrZUNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBoYW5kc2hha2VDYWxsYmFjayhkYXRhLnVzZXIpO1xuICAgIH1cbiAgfTtcblxuICAvL0luaXRpbGl6ZSBkYXRhIHVzZWQgaW4gcG9tZWxvIGNsaWVudFxuICB2YXIgaW5pdERhdGEgPSBmdW5jdGlvbihkYXRhKXtcbiAgICBpZighZGF0YSB8fCAhZGF0YS5zeXMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcG9tZWxvLmRhdGEgPSBwb21lbG8uZGF0YSB8fCB7fTtcbiAgICB2YXIgZGljdCA9IGRhdGEuc3lzLmRpY3Q7XG4gICAgdmFyIHByb3RvcyA9IGRhdGEuc3lzLnByb3RvcztcblxuICAgIC8vSW5pdCBjb21wcmVzcyBkaWN0XG4gICAgaWYoZGljdCl7XG4gICAgICBwb21lbG8uZGF0YS5kaWN0ID0gZGljdDtcbiAgICAgIHBvbWVsby5kYXRhLmFiYnJzID0ge307XG5cbiAgICAgIGZvcih2YXIgcm91dGUgaW4gZGljdCl7XG4gICAgICAgIHBvbWVsby5kYXRhLmFiYnJzW2RpY3Rbcm91dGVdXSA9IHJvdXRlO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vSW5pdCBwcm90b2J1ZiBwcm90b3NcbiAgICBpZihwcm90b3Mpe1xuICAgICAgcG9tZWxvLmRhdGEucHJvdG9zID0ge1xuICAgICAgICBzZXJ2ZXIgOiBwcm90b3Muc2VydmVyIHx8IHt9LFxuICAgICAgICBjbGllbnQgOiBwcm90b3MuY2xpZW50IHx8IHt9XG4gICAgICB9O1xuICAgICAgaWYoISFwcm90b2J1Zil7XG4gICAgICAgIHByb3RvYnVmLmluaXQoe2VuY29kZXJQcm90b3M6IHByb3Rvcy5jbGllbnQsIGRlY29kZXJQcm90b3M6IHByb3Rvcy5zZXJ2ZXJ9KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBwb21lbG87XG59KSgpO1xuIiwiLyogUHJvdG9jb2xCdWZmZXIgY2xpZW50IDAuMS4wKi9cblxuLyoqXG4gKiBwb21lbG8tcHJvdG9idWZcbiAqIEBhdXRob3IgPHpoYW5nMDkzNUBnbWFpbC5jb20+XG4gKi9cblxuLyoqXG4gKiBQcm90b2NvbCBidWZmZXIgcm9vdFxuICogSW4gYnJvd3NlciwgaXQgd2lsbCBiZSB3aW5kb3cucHJvdGJ1ZlxuICovXG4oZnVuY3Rpb24gKGV4cG9ydHMsIGdsb2JhbCl7XG4gIHZhciBQcm90b2J1ZiA9IGV4cG9ydHM7XG5cbiAgUHJvdG9idWYuaW5pdCA9IGZ1bmN0aW9uKG9wdHMpe1xuICAgIC8vT24gdGhlIHNlcnZlcnNpZGUsIHVzZSBzZXJ2ZXJQcm90b3MgdG8gZW5jb2RlIG1lc3NhZ2VzIHNlbmQgdG8gY2xpZW50XG4gICAgUHJvdG9idWYuZW5jb2Rlci5pbml0KG9wdHMuZW5jb2RlclByb3Rvcyk7XG5cbiAgICAvL09uIHRoZSBzZXJ2ZXJzaWRlLCB1c2VyIGNsaWVudFByb3RvcyB0byBkZWNvZGUgbWVzc2FnZXMgcmVjZWl2ZSBmcm9tIGNsaWVudHNcbiAgICBQcm90b2J1Zi5kZWNvZGVyLmluaXQob3B0cy5kZWNvZGVyUHJvdG9zKTtcbiAgfTtcblxuICBQcm90b2J1Zi5lbmNvZGUgPSBmdW5jdGlvbihrZXksIG1zZyl7XG4gICAgcmV0dXJuIFByb3RvYnVmLmVuY29kZXIuZW5jb2RlKGtleSwgbXNnKTtcbiAgfTtcblxuICBQcm90b2J1Zi5kZWNvZGUgPSBmdW5jdGlvbihrZXksIG1zZyl7XG4gICAgcmV0dXJuIFByb3RvYnVmLmRlY29kZXIuZGVjb2RlKGtleSwgbXNnKTtcbiAgfTtcblxuICAvLyBleHBvcnRzIHRvIHN1cHBvcnQgZm9yIGNvbXBvbmVudHNcbiAgbW9kdWxlLmV4cG9ydHMgPSBQcm90b2J1ZjtcbiAgaWYodHlwZW9mKHdpbmRvdykgIT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbmRvdy5wcm90b2J1ZiA9IFByb3RvYnVmO1xuICB9XG5cbn0pKHR5cGVvZih3aW5kb3cpID09IFwidW5kZWZpbmVkXCIgPyBtb2R1bGUuZXhwb3J0cyA6e30sIHRoaXMpO1xuXG4vKipcbiAqIGNvbnN0YW50c1xuICovXG4oZnVuY3Rpb24gKGV4cG9ydHMsIGdsb2JhbCl7XG4gIHZhciBjb25zdGFudHMgPSBleHBvcnRzLmNvbnN0YW50cyA9IHt9O1xuXG4gIGNvbnN0YW50cy5UWVBFUyA9IHtcbiAgICB1SW50MzIgOiAwLFxuICAgIHNJbnQzMiA6IDAsXG4gICAgaW50MzIgOiAwLFxuICAgIGRvdWJsZSA6IDEsXG4gICAgc3RyaW5nIDogMixcbiAgICBtZXNzYWdlIDogMixcbiAgICBmbG9hdCA6IDVcbiAgfTtcblxufSkoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwcm90b2J1ZiA/IHByb3RvYnVmIDogbW9kdWxlLmV4cG9ydHMsIHRoaXMpO1xuXG4vKipcbiAqIHV0aWwgbW9kdWxlXG4gKi9cbihmdW5jdGlvbiAoZXhwb3J0cywgZ2xvYmFsKXtcblxuICB2YXIgVXRpbCA9IGV4cG9ydHMudXRpbCA9IHt9O1xuXG4gIFV0aWwuaXNTaW1wbGVUeXBlID0gZnVuY3Rpb24odHlwZSl7XG4gICAgcmV0dXJuICggdHlwZSA9PT0gJ3VJbnQzMicgfHxcbiAgICAgICAgICAgICB0eXBlID09PSAnc0ludDMyJyB8fFxuICAgICAgICAgICAgIHR5cGUgPT09ICdpbnQzMicgIHx8XG4gICAgICAgICAgICAgdHlwZSA9PT0gJ3VJbnQ2NCcgfHxcbiAgICAgICAgICAgICB0eXBlID09PSAnc0ludDY0JyB8fFxuICAgICAgICAgICAgIHR5cGUgPT09ICdmbG9hdCcgIHx8XG4gICAgICAgICAgICAgdHlwZSA9PT0gJ2RvdWJsZScgKTtcbiAgfTtcblxufSkoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwcm90b2J1ZiA/IHByb3RvYnVmIDogbW9kdWxlLmV4cG9ydHMsIHRoaXMpO1xuXG4vKipcbiAqIGNvZGVjIG1vZHVsZVxuICovXG4oZnVuY3Rpb24gKGV4cG9ydHMsIGdsb2JhbCl7XG5cbiAgdmFyIENvZGVjID0gZXhwb3J0cy5jb2RlYyA9IHt9O1xuXG4gIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoOCk7XG4gIHZhciBmbG9hdDMyQXJyYXkgPSBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlcik7XG4gIHZhciBmbG9hdDY0QXJyYXkgPSBuZXcgRmxvYXQ2NEFycmF5KGJ1ZmZlcik7XG4gIHZhciB1SW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcblxuICBDb2RlYy5lbmNvZGVVSW50MzIgPSBmdW5jdGlvbihuKXtcbiAgICB2YXIgbiA9IHBhcnNlSW50KG4pO1xuICAgIGlmKGlzTmFOKG4pIHx8IG4gPCAwKXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBkb3tcbiAgICAgIHZhciB0bXAgPSBuICUgMTI4O1xuICAgICAgdmFyIG5leHQgPSBNYXRoLmZsb29yKG4vMTI4KTtcblxuICAgICAgaWYobmV4dCAhPT0gMCl7XG4gICAgICAgIHRtcCA9IHRtcCArIDEyODtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5wdXNoKHRtcCk7XG4gICAgICBuID0gbmV4dDtcbiAgICB9d2hpbGUobiAhPT0gMCk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIENvZGVjLmVuY29kZVNJbnQzMiA9IGZ1bmN0aW9uKG4pe1xuICAgIHZhciBuID0gcGFyc2VJbnQobik7XG4gICAgaWYoaXNOYU4obikpe1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIG4gPSBuPDA/KE1hdGguYWJzKG4pKjItMSk6bioyO1xuXG4gICAgcmV0dXJuIENvZGVjLmVuY29kZVVJbnQzMihuKTtcbiAgfTtcblxuICBDb2RlYy5kZWNvZGVVSW50MzIgPSBmdW5jdGlvbihieXRlcyl7XG4gICAgdmFyIG4gPSAwO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSsrKXtcbiAgICAgIHZhciBtID0gcGFyc2VJbnQoYnl0ZXNbaV0pO1xuICAgICAgbiA9IG4gKyAoKG0gJiAweDdmKSAqIE1hdGgucG93KDIsKDcqaSkpKTtcbiAgICAgIGlmKG0gPCAxMjgpe1xuICAgICAgICByZXR1cm4gbjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbjtcbiAgfTtcblxuXG4gIENvZGVjLmRlY29kZVNJbnQzMiA9IGZ1bmN0aW9uKGJ5dGVzKXtcbiAgICB2YXIgbiA9IHRoaXMuZGVjb2RlVUludDMyKGJ5dGVzKTtcbiAgICB2YXIgZmxhZyA9ICgobiUyKSA9PT0gMSk/LTE6MTtcblxuICAgIG4gPSAoKG4lMiArIG4pLzIpKmZsYWc7XG5cbiAgICByZXR1cm4gbjtcbiAgfTtcblxuICBDb2RlYy5lbmNvZGVGbG9hdCA9IGZ1bmN0aW9uKGZsb2F0KXtcbiAgICBmbG9hdDMyQXJyYXlbMF0gPSBmbG9hdDtcbiAgICByZXR1cm4gdUludDhBcnJheTtcbiAgfTtcblxuICBDb2RlYy5kZWNvZGVGbG9hdCA9IGZ1bmN0aW9uKGJ5dGVzLCBvZmZzZXQpe1xuICAgIGlmKCFieXRlcyB8fCBieXRlcy5sZW5ndGggPCAob2Zmc2V0ICs0KSl7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgNDsgaSsrKXtcbiAgICAgIHVJbnQ4QXJyYXlbaV0gPSBieXRlc1tvZmZzZXQgKyBpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmxvYXQzMkFycmF5WzBdO1xuICB9O1xuXG4gIENvZGVjLmVuY29kZURvdWJsZSA9IGZ1bmN0aW9uKGRvdWJsZSl7XG4gICAgZmxvYXQ2NEFycmF5WzBdID0gZG91YmxlO1xuICAgIHJldHVybiB1SW50OEFycmF5LnN1YmFycmF5KDAsIDgpO1xuICB9O1xuXG4gIENvZGVjLmRlY29kZURvdWJsZSA9IGZ1bmN0aW9uKGJ5dGVzLCBvZmZzZXQpe1xuICAgIGlmKCFieXRlcyB8fCBieXRlcy5sZW5ndGggPCAoOCArIG9mZnNldCkpe1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IDg7IGkrKyl7XG4gICAgICB1SW50OEFycmF5W2ldID0gYnl0ZXNbb2Zmc2V0ICsgaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZsb2F0NjRBcnJheVswXTtcbiAgfTtcblxuICBDb2RlYy5lbmNvZGVTdHIgPSBmdW5jdGlvbihieXRlcywgb2Zmc2V0LCBzdHIpe1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspe1xuICAgICAgdmFyIGNvZGUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgIHZhciBjb2RlcyA9IGVuY29kZTJVVEY4KGNvZGUpO1xuXG4gICAgICBmb3IodmFyIGogPSAwOyBqIDwgY29kZXMubGVuZ3RoOyBqKyspe1xuICAgICAgICBieXRlc1tvZmZzZXRdID0gY29kZXNbal07XG4gICAgICAgIG9mZnNldCsrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH07XG5cbiAgLyoqXG4gICAqIERlY29kZSBzdHJpbmcgZnJvbSB1dGY4IGJ5dGVzXG4gICAqL1xuICBDb2RlYy5kZWNvZGVTdHIgPSBmdW5jdGlvbihieXRlcywgb2Zmc2V0LCBsZW5ndGgpe1xuICAgIHZhciBhcnJheSA9IFtdO1xuICAgIHZhciBlbmQgPSBvZmZzZXQgKyBsZW5ndGg7XG5cbiAgICB3aGlsZShvZmZzZXQgPCBlbmQpe1xuICAgICAgdmFyIGNvZGUgPSAwO1xuXG4gICAgICBpZihieXRlc1tvZmZzZXRdIDwgMTI4KXtcbiAgICAgICAgY29kZSA9IGJ5dGVzW29mZnNldF07XG5cbiAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICB9ZWxzZSBpZihieXRlc1tvZmZzZXRdIDwgMjI0KXtcbiAgICAgICAgY29kZSA9ICgoYnl0ZXNbb2Zmc2V0XSAmIDB4M2YpPDw2KSArIChieXRlc1tvZmZzZXQrMV0gJiAweDNmKTtcbiAgICAgICAgb2Zmc2V0ICs9IDI7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgY29kZSA9ICgoYnl0ZXNbb2Zmc2V0XSAmIDB4MGYpPDwxMikgKyAoKGJ5dGVzW29mZnNldCsxXSAmIDB4M2YpPDw2KSArIChieXRlc1tvZmZzZXQrMl0gJiAweDNmKTtcbiAgICAgICAgb2Zmc2V0ICs9IDM7XG4gICAgICB9XG5cbiAgICAgIGFycmF5LnB1c2goY29kZSk7XG5cbiAgICB9XG5cbiAgICB2YXIgc3RyID0gJyc7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDspe1xuICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYXJyYXkuc2xpY2UoaSwgaSArIDEwMDAwKSk7XG4gICAgICBpICs9IDEwMDAwO1xuICAgIH1cblxuICAgIHJldHVybiBzdHI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgYnl0ZSBsZW5ndGggb2YgdGhlIHN0ciB1c2UgdXRmOFxuICAgKi9cbiAgQ29kZWMuYnl0ZUxlbmd0aCA9IGZ1bmN0aW9uKHN0cil7XG4gICAgaWYodHlwZW9mKHN0cikgIT09ICdzdHJpbmcnKXtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG5cbiAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspe1xuICAgICAgdmFyIGNvZGUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgIGxlbmd0aCArPSBjb2RlTGVuZ3RoKGNvZGUpO1xuICAgIH1cblxuICAgIHJldHVybiBsZW5ndGg7XG4gIH07XG5cbiAgLyoqXG4gICAqIEVuY29kZSBhIHVuaWNvZGUxNiBjaGFyIGNvZGUgdG8gdXRmOCBieXRlc1xuICAgKi9cbiAgZnVuY3Rpb24gZW5jb2RlMlVURjgoY2hhckNvZGUpe1xuICAgIGlmKGNoYXJDb2RlIDw9IDB4N2Ype1xuICAgICAgcmV0dXJuIFtjaGFyQ29kZV07XG4gICAgfWVsc2UgaWYoY2hhckNvZGUgPD0gMHg3ZmYpe1xuICAgICAgcmV0dXJuIFsweGMwfChjaGFyQ29kZT4+NiksIDB4ODB8KGNoYXJDb2RlICYgMHgzZildO1xuICAgIH1lbHNle1xuICAgICAgcmV0dXJuIFsweGUwfChjaGFyQ29kZT4+MTIpLCAweDgwfCgoY2hhckNvZGUgJiAweGZjMCk+PjYpLCAweDgwfChjaGFyQ29kZSAmIDB4M2YpXTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjb2RlTGVuZ3RoKGNvZGUpe1xuICAgIGlmKGNvZGUgPD0gMHg3Zil7XG4gICAgICByZXR1cm4gMTtcbiAgICB9ZWxzZSBpZihjb2RlIDw9IDB4N2ZmKXtcbiAgICAgIHJldHVybiAyO1xuICAgIH1lbHNle1xuICAgICAgcmV0dXJuIDM7XG4gICAgfVxuICB9XG59KSgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHByb3RvYnVmID8gcHJvdG9idWYgOiBtb2R1bGUuZXhwb3J0cywgdGhpcyk7XG5cbi8qKlxuICogZW5jb2RlciBtb2R1bGVcbiAqL1xuKGZ1bmN0aW9uIChleHBvcnRzLCBnbG9iYWwpe1xuXG4gIHZhciBwcm90b2J1ZiA9IGV4cG9ydHM7XG4gIHZhciBNc2dFbmNvZGVyID0gZXhwb3J0cy5lbmNvZGVyID0ge307XG5cbiAgdmFyIGNvZGVjID0gcHJvdG9idWYuY29kZWM7XG4gIHZhciBjb25zdGFudCA9IHByb3RvYnVmLmNvbnN0YW50cztcbiAgdmFyIHV0aWwgPSBwcm90b2J1Zi51dGlsO1xuXG4gIE1zZ0VuY29kZXIuaW5pdCA9IGZ1bmN0aW9uKHByb3Rvcyl7XG4gICAgdGhpcy5wcm90b3MgPSBwcm90b3MgfHwge307XG4gIH07XG5cbiAgTXNnRW5jb2Rlci5lbmNvZGUgPSBmdW5jdGlvbihyb3V0ZSwgbXNnKXtcbiAgICAvL0dldCBwcm90b3MgZnJvbSBwcm90b3MgbWFwIHVzZSB0aGUgcm91dGUgYXMga2V5XG4gICAgdmFyIHByb3RvcyA9IHRoaXMucHJvdG9zW3JvdXRlXTtcblxuICAgIC8vQ2hlY2sgbXNnXG4gICAgaWYoIWNoZWNrTXNnKG1zZywgcHJvdG9zKSl7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvL1NldCB0aGUgbGVuZ3RoIG9mIHRoZSBidWZmZXIgMiB0aW1lcyBiaWdnZXIgdG8gcHJldmVudCBvdmVyZmxvd1xuICAgIHZhciBsZW5ndGggPSBjb2RlYy5ieXRlTGVuZ3RoKEpTT04uc3RyaW5naWZ5KG1zZykpO1xuXG4gICAgLy9Jbml0IGJ1ZmZlciBhbmQgb2Zmc2V0XG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihsZW5ndGgpO1xuICAgIHZhciB1SW50OEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgICB2YXIgb2Zmc2V0ID0gMDtcblxuICAgIGlmKCEhcHJvdG9zKXtcbiAgICAgIG9mZnNldCA9IGVuY29kZU1zZyh1SW50OEFycmF5LCBvZmZzZXQsIHByb3RvcywgbXNnKTtcbiAgICAgIGlmKG9mZnNldCA+IDApe1xuICAgICAgICByZXR1cm4gdUludDhBcnJheS5zdWJhcnJheSgwLCBvZmZzZXQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgbXNnIGZvbGxvdyB0aGUgZGVmaW5hdGlvbiBpbiB0aGUgcHJvdG9zXG4gICAqL1xuICBmdW5jdGlvbiBjaGVja01zZyhtc2csIHByb3Rvcyl7XG4gICAgaWYoIXByb3Rvcyl7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZm9yKHZhciBuYW1lIGluIHByb3Rvcyl7XG4gICAgICB2YXIgcHJvdG8gPSBwcm90b3NbbmFtZV07XG5cbiAgICAgIC8vQWxsIHJlcXVpcmVkIGVsZW1lbnQgbXVzdCBleGlzdFxuICAgICAgc3dpdGNoKHByb3RvLm9wdGlvbil7XG4gICAgICAgIGNhc2UgJ3JlcXVpcmVkJyA6XG4gICAgICAgICAgaWYodHlwZW9mKG1zZ1tuYW1lXSkgPT09ICd1bmRlZmluZWQnKXtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIGNhc2UgJ29wdGlvbmFsJyA6XG4gICAgICAgICAgaWYodHlwZW9mKG1zZ1tuYW1lXSkgIT09ICd1bmRlZmluZWQnKXtcbiAgICAgICAgICAgIGlmKCEhcHJvdG9zLl9fbWVzc2FnZXNbcHJvdG8udHlwZV0pe1xuICAgICAgICAgICAgICBjaGVja01zZyhtc2dbbmFtZV0sIHByb3Rvcy5fX21lc3NhZ2VzW3Byb3RvLnR5cGVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyZXBlYXRlZCcgOlxuICAgICAgICAgIC8vQ2hlY2sgbmVzdCBtZXNzYWdlIGluIHJlcGVhdGVkIGVsZW1lbnRzXG4gICAgICAgICAgaWYoISFtc2dbbmFtZV0gJiYgISFwcm90b3MuX19tZXNzYWdlc1twcm90by50eXBlXSl7XG4gICAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbXNnW25hbWVdLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgICAgaWYoIWNoZWNrTXNnKG1zZ1tuYW1lXVtpXSwgcHJvdG9zLl9fbWVzc2FnZXNbcHJvdG8udHlwZV0pKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlTXNnKGJ1ZmZlciwgb2Zmc2V0LCBwcm90b3MsIG1zZyl7XG4gICAgZm9yKHZhciBuYW1lIGluIG1zZyl7XG4gICAgICBpZighIXByb3Rvc1tuYW1lXSl7XG4gICAgICAgIHZhciBwcm90byA9IHByb3Rvc1tuYW1lXTtcblxuICAgICAgICBzd2l0Y2gocHJvdG8ub3B0aW9uKXtcbiAgICAgICAgICBjYXNlICdyZXF1aXJlZCcgOlxuICAgICAgICAgIGNhc2UgJ29wdGlvbmFsJyA6XG4gICAgICAgICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBlbmNvZGVUYWcocHJvdG8udHlwZSwgcHJvdG8udGFnKSk7XG4gICAgICAgICAgICBvZmZzZXQgPSBlbmNvZGVQcm9wKG1zZ1tuYW1lXSwgcHJvdG8udHlwZSwgb2Zmc2V0LCBidWZmZXIsIHByb3Rvcyk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncmVwZWF0ZWQnIDpcbiAgICAgICAgICAgIGlmKG1zZ1tuYW1lXS5sZW5ndGggPiAwKXtcbiAgICAgICAgICAgICAgb2Zmc2V0ID0gZW5jb2RlQXJyYXkobXNnW25hbWVdLCBwcm90bywgb2Zmc2V0LCBidWZmZXIsIHByb3Rvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlUHJvcCh2YWx1ZSwgdHlwZSwgb2Zmc2V0LCBidWZmZXIsIHByb3Rvcyl7XG4gICAgc3dpdGNoKHR5cGUpe1xuICAgICAgY2FzZSAndUludDMyJzpcbiAgICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlVUludDMyKHZhbHVlKSk7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2ludDMyJyA6XG4gICAgICBjYXNlICdzSW50MzInOlxuICAgICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVTSW50MzIodmFsdWUpKTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZmxvYXQnOlxuICAgICAgICB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVGbG9hdCh2YWx1ZSkpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZG91YmxlJzpcbiAgICAgICAgd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlRG91YmxlKHZhbHVlKSk7XG4gICAgICAgIG9mZnNldCArPSA4O1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICB2YXIgbGVuZ3RoID0gY29kZWMuYnl0ZUxlbmd0aCh2YWx1ZSk7XG5cbiAgICAgICAgLy9FbmNvZGUgbGVuZ3RoXG4gICAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZVVJbnQzMihsZW5ndGgpKTtcbiAgICAgICAgLy93cml0ZSBzdHJpbmdcbiAgICAgICAgY29kZWMuZW5jb2RlU3RyKGJ1ZmZlciwgb2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIG9mZnNldCArPSBsZW5ndGg7XG4gICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQgOlxuICAgICAgICBpZighIXByb3Rvcy5fX21lc3NhZ2VzW3R5cGVdKXtcbiAgICAgICAgICAvL1VzZSBhIHRtcCBidWZmZXIgdG8gYnVpbGQgYW4gaW50ZXJuYWwgbXNnXG4gICAgICAgICAgdmFyIHRtcEJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihjb2RlYy5ieXRlTGVuZ3RoKEpTT04uc3RyaW5naWZ5KHZhbHVlKSkpO1xuICAgICAgICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgICAgICAgbGVuZ3RoID0gZW5jb2RlTXNnKHRtcEJ1ZmZlciwgbGVuZ3RoLCBwcm90b3MuX19tZXNzYWdlc1t0eXBlXSwgdmFsdWUpO1xuICAgICAgICAgIC8vRW5jb2RlIGxlbmd0aFxuICAgICAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZVVJbnQzMihsZW5ndGgpKTtcbiAgICAgICAgICAvL2NvbnRhY3QgdGhlIG9iamVjdFxuICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBidWZmZXJbb2Zmc2V0XSA9IHRtcEJ1ZmZlcltpXTtcbiAgICAgICAgICAgIG9mZnNldCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBFbmNvZGUgcmVhcGVhdGVkIHByb3BlcnRpZXMsIHNpbXBsZSBtc2cgYW5kIG9iamVjdCBhcmUgZGVjb2RlIGRpZmZlcmVudGVkXG4gICAqL1xuICBmdW5jdGlvbiBlbmNvZGVBcnJheShhcnJheSwgcHJvdG8sIG9mZnNldCwgYnVmZmVyLCBwcm90b3Mpe1xuICAgIHZhciBpID0gMDtcblxuICAgIGlmKHV0aWwuaXNTaW1wbGVUeXBlKHByb3RvLnR5cGUpKXtcbiAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGVuY29kZVRhZyhwcm90by50eXBlLCBwcm90by50YWcpKTtcbiAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZVVJbnQzMihhcnJheS5sZW5ndGgpKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKXtcbiAgICAgICAgb2Zmc2V0ID0gZW5jb2RlUHJvcChhcnJheVtpXSwgcHJvdG8udHlwZSwgb2Zmc2V0LCBidWZmZXIpO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgZm9yKGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspe1xuICAgICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBlbmNvZGVUYWcocHJvdG8udHlwZSwgcHJvdG8udGFnKSk7XG4gICAgICAgIG9mZnNldCA9IGVuY29kZVByb3AoYXJyYXlbaV0sIHByb3RvLnR5cGUsIG9mZnNldCwgYnVmZmVyLCBwcm90b3MpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBieXRlcyl7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSsrLCBvZmZzZXQrKyl7XG4gICAgICBidWZmZXJbb2Zmc2V0XSA9IGJ5dGVzW2ldO1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVUYWcodHlwZSwgdGFnKXtcbiAgICB2YXIgdmFsdWUgPSBjb25zdGFudC5UWVBFU1t0eXBlXXx8MjtcbiAgICByZXR1cm4gY29kZWMuZW5jb2RlVUludDMyKCh0YWc8PDMpfHZhbHVlKTtcbiAgfVxufSkoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwcm90b2J1ZiA/IHByb3RvYnVmIDogbW9kdWxlLmV4cG9ydHMsIHRoaXMpO1xuXG4vKipcbiAqIGRlY29kZXIgbW9kdWxlXG4gKi9cbihmdW5jdGlvbiAoZXhwb3J0cywgZ2xvYmFsKXtcbiAgdmFyIHByb3RvYnVmID0gZXhwb3J0cztcbiAgdmFyIE1zZ0RlY29kZXIgPSBleHBvcnRzLmRlY29kZXIgPSB7fTtcblxuICB2YXIgY29kZWMgPSBwcm90b2J1Zi5jb2RlYztcbiAgdmFyIHV0aWwgPSBwcm90b2J1Zi51dGlsO1xuXG4gIHZhciBidWZmZXI7XG4gIHZhciBvZmZzZXQgPSAwO1xuXG4gIE1zZ0RlY29kZXIuaW5pdCA9IGZ1bmN0aW9uKHByb3Rvcyl7XG4gICAgdGhpcy5wcm90b3MgPSBwcm90b3MgfHwge307XG4gIH07XG5cbiAgTXNnRGVjb2Rlci5zZXRQcm90b3MgPSBmdW5jdGlvbihwcm90b3Mpe1xuICAgIGlmKCEhcHJvdG9zKXtcbiAgICAgIHRoaXMucHJvdG9zID0gcHJvdG9zO1xuICAgIH1cbiAgfTtcblxuICBNc2dEZWNvZGVyLmRlY29kZSA9IGZ1bmN0aW9uKHJvdXRlLCBidWYpe1xuICAgIHZhciBwcm90b3MgPSB0aGlzLnByb3Rvc1tyb3V0ZV07XG5cbiAgICBidWZmZXIgPSBidWY7XG4gICAgb2Zmc2V0ID0gMDtcblxuICAgIGlmKCEhcHJvdG9zKXtcbiAgICAgIHJldHVybiBkZWNvZGVNc2coe30sIHByb3RvcywgYnVmZmVyLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH07XG5cbiAgZnVuY3Rpb24gZGVjb2RlTXNnKG1zZywgcHJvdG9zLCBsZW5ndGgpe1xuICAgIHdoaWxlKG9mZnNldDxsZW5ndGgpe1xuICAgICAgdmFyIGhlYWQgPSBnZXRIZWFkKCk7XG4gICAgICB2YXIgdHlwZSA9IGhlYWQudHlwZTtcbiAgICAgIHZhciB0YWcgPSBoZWFkLnRhZztcbiAgICAgIHZhciBuYW1lID0gcHJvdG9zLl9fdGFnc1t0YWddO1xuXG4gICAgICBzd2l0Y2gocHJvdG9zW25hbWVdLm9wdGlvbil7XG4gICAgICAgIGNhc2UgJ29wdGlvbmFsJyA6XG4gICAgICAgIGNhc2UgJ3JlcXVpcmVkJyA6XG4gICAgICAgICAgbXNnW25hbWVdID0gZGVjb2RlUHJvcChwcm90b3NbbmFtZV0udHlwZSwgcHJvdG9zKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3JlcGVhdGVkJyA6XG4gICAgICAgICAgaWYoIW1zZ1tuYW1lXSl7XG4gICAgICAgICAgICBtc2dbbmFtZV0gPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGVjb2RlQXJyYXkobXNnW25hbWVdLCBwcm90b3NbbmFtZV0udHlwZSwgcHJvdG9zKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1zZztcbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IGlmIHRoZSBnaXZlbiBtc2cgaXMgZmluaXNoZWRcbiAgICovXG4gIGZ1bmN0aW9uIGlzRmluaXNoKG1zZywgcHJvdG9zKXtcbiAgICByZXR1cm4gKCFwcm90b3MuX190YWdzW3BlZWtIZWFkKCkudGFnXSk7XG4gIH1cbiAgLyoqXG4gICAqIEdldCBwcm9wZXJ0eSBoZWFkIGZyb20gcHJvdG9idWZcbiAgICovXG4gIGZ1bmN0aW9uIGdldEhlYWQoKXtcbiAgICB2YXIgdGFnID0gY29kZWMuZGVjb2RlVUludDMyKGdldEJ5dGVzKCkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGUgOiB0YWcmMHg3LFxuICAgICAgdGFnIDogdGFnPj4zXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGFnIGhlYWQgd2l0aG91dCBtb3ZlIHRoZSBvZmZzZXRcbiAgICovXG4gIGZ1bmN0aW9uIHBlZWtIZWFkKCl7XG4gICAgdmFyIHRhZyA9IGNvZGVjLmRlY29kZVVJbnQzMihwZWVrQnl0ZXMoKSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdHlwZSA6IHRhZyYweDcsXG4gICAgICB0YWcgOiB0YWc+PjNcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlUHJvcCh0eXBlLCBwcm90b3Mpe1xuICAgIHN3aXRjaCh0eXBlKXtcbiAgICAgIGNhc2UgJ3VJbnQzMic6XG4gICAgICAgIHJldHVybiBjb2RlYy5kZWNvZGVVSW50MzIoZ2V0Qnl0ZXMoKSk7XG4gICAgICBjYXNlICdpbnQzMicgOlxuICAgICAgY2FzZSAnc0ludDMyJyA6XG4gICAgICAgIHJldHVybiBjb2RlYy5kZWNvZGVTSW50MzIoZ2V0Qnl0ZXMoKSk7XG4gICAgICBjYXNlICdmbG9hdCcgOlxuICAgICAgICB2YXIgZmxvYXQgPSBjb2RlYy5kZWNvZGVGbG9hdChidWZmZXIsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSA0O1xuICAgICAgICByZXR1cm4gZmxvYXQ7XG4gICAgICBjYXNlICdkb3VibGUnIDpcbiAgICAgICAgdmFyIGRvdWJsZSA9IGNvZGVjLmRlY29kZURvdWJsZShidWZmZXIsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSA4O1xuICAgICAgICByZXR1cm4gZG91YmxlO1xuICAgICAgY2FzZSAnc3RyaW5nJyA6XG4gICAgICAgIHZhciBsZW5ndGggPSBjb2RlYy5kZWNvZGVVSW50MzIoZ2V0Qnl0ZXMoKSk7XG5cbiAgICAgICAgdmFyIHN0ciA9ICBjb2RlYy5kZWNvZGVTdHIoYnVmZmVyLCBvZmZzZXQsIGxlbmd0aCk7XG4gICAgICAgIG9mZnNldCArPSBsZW5ndGg7XG5cbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgIGRlZmF1bHQgOlxuICAgICAgICBpZighIXByb3RvcyAmJiAhIXByb3Rvcy5fX21lc3NhZ2VzW3R5cGVdKXtcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gY29kZWMuZGVjb2RlVUludDMyKGdldEJ5dGVzKCkpO1xuICAgICAgICAgIHZhciBtc2cgPSB7fTtcbiAgICAgICAgICBkZWNvZGVNc2cobXNnLCBwcm90b3MuX19tZXNzYWdlc1t0eXBlXSwgb2Zmc2V0K2xlbmd0aCk7XG4gICAgICAgICAgcmV0dXJuIG1zZztcbiAgICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlQXJyYXkoYXJyYXksIHR5cGUsIHByb3Rvcyl7XG4gICAgaWYodXRpbC5pc1NpbXBsZVR5cGUodHlwZSkpe1xuICAgICAgdmFyIGxlbmd0aCA9IGNvZGVjLmRlY29kZVVJbnQzMihnZXRCeXRlcygpKTtcblxuICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICAgICAgYXJyYXkucHVzaChkZWNvZGVQcm9wKHR5cGUpKTtcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGFycmF5LnB1c2goZGVjb2RlUHJvcCh0eXBlLCBwcm90b3MpKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRCeXRlcyhmbGFnKXtcbiAgICB2YXIgYnl0ZXMgPSBbXTtcbiAgICB2YXIgcG9zID0gb2Zmc2V0O1xuICAgIGZsYWcgPSBmbGFnIHx8IGZhbHNlO1xuXG4gICAgdmFyIGI7XG5cbiAgICBkb3tcbiAgICAgIGIgPSBidWZmZXJbcG9zXTtcbiAgICAgIGJ5dGVzLnB1c2goYik7XG4gICAgICBwb3MrKztcbiAgICB9d2hpbGUoYiA+PSAxMjgpO1xuXG4gICAgaWYoIWZsYWcpe1xuICAgICAgb2Zmc2V0ID0gcG9zO1xuICAgIH1cbiAgICByZXR1cm4gYnl0ZXM7XG4gIH1cblxuICBmdW5jdGlvbiBwZWVrQnl0ZXMoKXtcbiAgICByZXR1cm4gZ2V0Qnl0ZXModHJ1ZSk7XG4gIH1cblxufSkoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwcm90b2J1ZiA/IHByb3RvYnVmIDogbW9kdWxlLmV4cG9ydHMsIHRoaXMpO1xuXG4iLCIoZnVuY3Rpb24gKGV4cG9ydHMsIEJ5dGVBcnJheSwgZ2xvYmFsKSB7XG4gIHZhciBQcm90b2NvbCA9IGV4cG9ydHM7XG5cbiAgdmFyIFBLR19IRUFEX0JZVEVTID0gNDtcbiAgdmFyIE1TR19GTEFHX0JZVEVTID0gMTtcbiAgdmFyIE1TR19ST1VURV9DT0RFX0JZVEVTID0gMjtcbiAgdmFyIE1TR19JRF9NQVhfQllURVMgPSA1O1xuICB2YXIgTVNHX1JPVVRFX0xFTl9CWVRFUyA9IDE7XG5cbiAgdmFyIE1TR19ST1VURV9DT0RFX01BWCA9IDB4ZmZmZjtcblxuICB2YXIgTVNHX0NPTVBSRVNTX1JPVVRFX01BU0sgPSAweDE7XG4gIHZhciBNU0dfVFlQRV9NQVNLID0gMHg3O1xuXG4gIHZhciBQYWNrYWdlID0gUHJvdG9jb2wuUGFja2FnZSA9IHt9O1xuICB2YXIgTWVzc2FnZSA9IFByb3RvY29sLk1lc3NhZ2UgPSB7fTtcblxuICBQYWNrYWdlLlRZUEVfSEFORFNIQUtFID0gMTtcbiAgUGFja2FnZS5UWVBFX0hBTkRTSEFLRV9BQ0sgPSAyO1xuICBQYWNrYWdlLlRZUEVfSEVBUlRCRUFUID0gMztcbiAgUGFja2FnZS5UWVBFX0RBVEEgPSA0O1xuICBQYWNrYWdlLlRZUEVfS0lDSyA9IDU7XG5cbiAgTWVzc2FnZS5UWVBFX1JFUVVFU1QgPSAwO1xuICBNZXNzYWdlLlRZUEVfTk9USUZZID0gMTtcbiAgTWVzc2FnZS5UWVBFX1JFU1BPTlNFID0gMjtcbiAgTWVzc2FnZS5UWVBFX1BVU0ggPSAzO1xuXG4gIC8qKlxuICAgKiBwb21lbGUgY2xpZW50IGVuY29kZVxuICAgKiBpZCBtZXNzYWdlIGlkO1xuICAgKiByb3V0ZSBtZXNzYWdlIHJvdXRlXG4gICAqIG1zZyBtZXNzYWdlIGJvZHlcbiAgICogc29ja2V0aW8gY3VycmVudCBzdXBwb3J0IHN0cmluZ1xuICAgKi9cbiAgUHJvdG9jb2wuc3RyZW5jb2RlID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgdmFyIGJ5dGVBcnJheSA9IG5ldyBCeXRlQXJyYXkoc3RyLmxlbmd0aCAqIDMpO1xuICAgIHZhciBvZmZzZXQgPSAwO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspe1xuICAgICAgdmFyIGNoYXJDb2RlID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICB2YXIgY29kZXMgPSBudWxsO1xuICAgICAgaWYoY2hhckNvZGUgPD0gMHg3Zil7XG4gICAgICAgIGNvZGVzID0gW2NoYXJDb2RlXTtcbiAgICAgIH1lbHNlIGlmKGNoYXJDb2RlIDw9IDB4N2ZmKXtcbiAgICAgICAgY29kZXMgPSBbMHhjMHwoY2hhckNvZGU+PjYpLCAweDgwfChjaGFyQ29kZSAmIDB4M2YpXTtcbiAgICAgIH1lbHNle1xuICAgICAgICBjb2RlcyA9IFsweGUwfChjaGFyQ29kZT4+MTIpLCAweDgwfCgoY2hhckNvZGUgJiAweGZjMCk+PjYpLCAweDgwfChjaGFyQ29kZSAmIDB4M2YpXTtcbiAgICAgIH1cbiAgICAgIGZvcih2YXIgaiA9IDA7IGogPCBjb2Rlcy5sZW5ndGg7IGorKyl7XG4gICAgICAgIGJ5dGVBcnJheVtvZmZzZXRdID0gY29kZXNbal07XG4gICAgICAgICsrb2Zmc2V0O1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgX2J1ZmZlciA9IG5ldyBCeXRlQXJyYXkob2Zmc2V0KTtcbiAgICBjb3B5QXJyYXkoX2J1ZmZlciwgMCwgYnl0ZUFycmF5LCAwLCBvZmZzZXQpO1xuICAgIHJldHVybiBfYnVmZmVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBjbGllbnQgZGVjb2RlXG4gICAqIG1zZyBTdHJpbmcgZGF0YVxuICAgKiByZXR1cm4gTWVzc2FnZSBPYmplY3RcbiAgICovXG4gIFByb3RvY29sLnN0cmRlY29kZSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgIHZhciBieXRlcyA9IG5ldyBCeXRlQXJyYXkoYnVmZmVyKTtcbiAgICB2YXIgYXJyYXkgPSBbXTtcbiAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICB2YXIgY2hhckNvZGUgPSAwO1xuICAgIHZhciBlbmQgPSBieXRlcy5sZW5ndGg7XG4gICAgd2hpbGUob2Zmc2V0IDwgZW5kKXtcbiAgICAgIGlmKGJ5dGVzW29mZnNldF0gPCAxMjgpe1xuICAgICAgICBjaGFyQ29kZSA9IGJ5dGVzW29mZnNldF07XG4gICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgfWVsc2UgaWYoYnl0ZXNbb2Zmc2V0XSA8IDIyNCl7XG4gICAgICAgIGNoYXJDb2RlID0gKChieXRlc1tvZmZzZXRdICYgMHgzZik8PDYpICsgKGJ5dGVzW29mZnNldCsxXSAmIDB4M2YpO1xuICAgICAgICBvZmZzZXQgKz0gMjtcbiAgICAgIH1lbHNle1xuICAgICAgICBjaGFyQ29kZSA9ICgoYnl0ZXNbb2Zmc2V0XSAmIDB4MGYpPDwxMikgKyAoKGJ5dGVzW29mZnNldCsxXSAmIDB4M2YpPDw2KSArIChieXRlc1tvZmZzZXQrMl0gJiAweDNmKTtcbiAgICAgICAgb2Zmc2V0ICs9IDM7XG4gICAgICB9XG4gICAgICBhcnJheS5wdXNoKGNoYXJDb2RlKTtcbiAgICB9XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYXJyYXkpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQYWNrYWdlIHByb3RvY29sIGVuY29kZS5cbiAgICpcbiAgICogUG9tZWxvIHBhY2thZ2UgZm9ybWF0OlxuICAgKiArLS0tLS0tKy0tLS0tLS0tLS0tLS0rLS0tLS0tLS0tLS0tLS0tLS0tK1xuICAgKiB8IHR5cGUgfCBib2R5IGxlbmd0aCB8ICAgICAgIGJvZHkgICAgICAgfFxuICAgKiArLS0tLS0tKy0tLS0tLS0tLS0tLS0rLS0tLS0tLS0tLS0tLS0tLS0tK1xuICAgKlxuICAgKiBIZWFkOiA0Ynl0ZXNcbiAgICogICAwOiBwYWNrYWdlIHR5cGUsXG4gICAqICAgICAgMSAtIGhhbmRzaGFrZSxcbiAgICogICAgICAyIC0gaGFuZHNoYWtlIGFjayxcbiAgICogICAgICAzIC0gaGVhcnRiZWF0LFxuICAgKiAgICAgIDQgLSBkYXRhXG4gICAqICAgICAgNSAtIGtpY2tcbiAgICogICAxIC0gMzogYmlnLWVuZGlhbiBib2R5IGxlbmd0aFxuICAgKiBCb2R5OiBib2R5IGxlbmd0aCBieXRlc1xuICAgKlxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9ICAgIHR5cGUgICBwYWNrYWdlIHR5cGVcbiAgICogQHBhcmFtICB7Qnl0ZUFycmF5fSBib2R5ICAgYm9keSBjb250ZW50IGluIGJ5dGVzXG4gICAqIEByZXR1cm4ge0J5dGVBcnJheX0gICAgICAgIG5ldyBieXRlIGFycmF5IHRoYXQgY29udGFpbnMgZW5jb2RlIHJlc3VsdFxuICAgKi9cbiAgUGFja2FnZS5lbmNvZGUgPSBmdW5jdGlvbih0eXBlLCBib2R5KXtcbiAgICB2YXIgbGVuZ3RoID0gYm9keSA/IGJvZHkubGVuZ3RoIDogMDtcbiAgICB2YXIgYnVmZmVyID0gbmV3IEJ5dGVBcnJheShQS0dfSEVBRF9CWVRFUyArIGxlbmd0aCk7XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICBidWZmZXJbaW5kZXgrK10gPSB0eXBlICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAobGVuZ3RoID4+IDE2KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKGxlbmd0aCA+PiA4KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gbGVuZ3RoICYgMHhmZjtcbiAgICBpZihib2R5KSB7XG4gICAgICBjb3B5QXJyYXkoYnVmZmVyLCBpbmRleCwgYm9keSwgMCwgbGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfTtcblxuICAvKipcbiAgICogUGFja2FnZSBwcm90b2NvbCBkZWNvZGUuXG4gICAqIFNlZSBlbmNvZGUgZm9yIHBhY2thZ2UgZm9ybWF0LlxuICAgKlxuICAgKiBAcGFyYW0gIHtCeXRlQXJyYXl9IGJ1ZmZlciBieXRlIGFycmF5IGNvbnRhaW5pbmcgcGFja2FnZSBjb250ZW50XG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgIHt0eXBlOiBwYWNrYWdlIHR5cGUsIGJ1ZmZlcjogYm9keSBieXRlIGFycmF5fVxuICAgKi9cbiAgUGFja2FnZS5kZWNvZGUgPSBmdW5jdGlvbihidWZmZXIpe1xuICAgIHZhciBvZmZzZXQgPSAwO1xuICAgIHZhciBieXRlcyA9IG5ldyBCeXRlQXJyYXkoYnVmZmVyKTtcbiAgICB2YXIgbGVuZ3RoID0gMDtcbiAgICB2YXIgcnMgPSBbXTtcbiAgICB3aGlsZShvZmZzZXQgPCBieXRlcy5sZW5ndGgpIHtcbiAgICAgIHZhciB0eXBlID0gYnl0ZXNbb2Zmc2V0KytdO1xuICAgICAgbGVuZ3RoID0gKChieXRlc1tvZmZzZXQrK10pIDw8IDE2IHwgKGJ5dGVzW29mZnNldCsrXSkgPDwgOCB8IGJ5dGVzW29mZnNldCsrXSkgPj4+IDA7XG4gICAgICB2YXIgYm9keSA9IGxlbmd0aCA/IG5ldyBCeXRlQXJyYXkobGVuZ3RoKSA6IG51bGw7XG4gICAgICBjb3B5QXJyYXkoYm9keSwgMCwgYnl0ZXMsIG9mZnNldCwgbGVuZ3RoKTtcbiAgICAgIG9mZnNldCArPSBsZW5ndGg7XG4gICAgICBycy5wdXNoKHsndHlwZSc6IHR5cGUsICdib2R5JzogYm9keX0pO1xuICAgIH1cbiAgICByZXR1cm4gcnMubGVuZ3RoID09PSAxID8gcnNbMF06IHJzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBNZXNzYWdlIHByb3RvY29sIGVuY29kZS5cbiAgICpcbiAgICogQHBhcmFtICB7TnVtYmVyfSBpZCAgICAgICAgICAgIG1lc3NhZ2UgaWRcbiAgICogQHBhcmFtICB7TnVtYmVyfSB0eXBlICAgICAgICAgIG1lc3NhZ2UgdHlwZVxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9IGNvbXByZXNzUm91dGUgd2hldGhlciBjb21wcmVzcyByb3V0ZVxuICAgKiBAcGFyYW0gIHtOdW1iZXJ8U3RyaW5nfSByb3V0ZSAgcm91dGUgY29kZSBvciByb3V0ZSBzdHJpbmdcbiAgICogQHBhcmFtICB7QnVmZmVyfSBtc2cgICAgICAgICAgIG1lc3NhZ2UgYm9keSBieXRlc1xuICAgKiBAcmV0dXJuIHtCdWZmZXJ9ICAgICAgICAgICAgICAgZW5jb2RlIHJlc3VsdFxuICAgKi9cbiAgTWVzc2FnZS5lbmNvZGUgPSBmdW5jdGlvbihpZCwgdHlwZSwgY29tcHJlc3NSb3V0ZSwgcm91dGUsIG1zZyl7XG4gICAgLy8gY2FjdWxhdGUgbWVzc2FnZSBtYXggbGVuZ3RoXG4gICAgdmFyIGlkQnl0ZXMgPSBtc2dIYXNJZCh0eXBlKSA/IGNhY3VsYXRlTXNnSWRCeXRlcyhpZCkgOiAwO1xuICAgIHZhciBtc2dMZW4gPSBNU0dfRkxBR19CWVRFUyArIGlkQnl0ZXM7XG5cbiAgICBpZihtc2dIYXNSb3V0ZSh0eXBlKSkge1xuICAgICAgaWYoY29tcHJlc3NSb3V0ZSkge1xuICAgICAgICBpZih0eXBlb2Ygcm91dGUgIT09ICdudW1iZXInKXtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2Vycm9yIGZsYWcgZm9yIG51bWJlciByb3V0ZSEnKTtcbiAgICAgICAgfVxuICAgICAgICBtc2dMZW4gKz0gTVNHX1JPVVRFX0NPREVfQllURVM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtc2dMZW4gKz0gTVNHX1JPVVRFX0xFTl9CWVRFUztcbiAgICAgICAgaWYocm91dGUpIHtcbiAgICAgICAgICByb3V0ZSA9IFByb3RvY29sLnN0cmVuY29kZShyb3V0ZSk7XG4gICAgICAgICAgaWYocm91dGUubGVuZ3RoPjI1NSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyb3V0ZSBtYXhsZW5ndGggaXMgb3ZlcmZsb3cnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbXNnTGVuICs9IHJvdXRlLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmKG1zZykge1xuICAgICAgbXNnTGVuICs9IG1zZy5sZW5ndGg7XG4gICAgfVxuXG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBCeXRlQXJyYXkobXNnTGVuKTtcbiAgICB2YXIgb2Zmc2V0ID0gMDtcblxuICAgIC8vIGFkZCBmbGFnXG4gICAgb2Zmc2V0ID0gZW5jb2RlTXNnRmxhZyh0eXBlLCBjb21wcmVzc1JvdXRlLCBidWZmZXIsIG9mZnNldCk7XG5cbiAgICAvLyBhZGQgbWVzc2FnZSBpZFxuICAgIGlmKG1zZ0hhc0lkKHR5cGUpKSB7XG4gICAgICBvZmZzZXQgPSBlbmNvZGVNc2dJZChpZCwgYnVmZmVyLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIC8vIGFkZCByb3V0ZVxuICAgIGlmKG1zZ0hhc1JvdXRlKHR5cGUpKSB7XG4gICAgICBvZmZzZXQgPSBlbmNvZGVNc2dSb3V0ZShjb21wcmVzc1JvdXRlLCByb3V0ZSwgYnVmZmVyLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIC8vIGFkZCBib2R5XG4gICAgaWYobXNnKSB7XG4gICAgICBvZmZzZXQgPSBlbmNvZGVNc2dCb2R5KG1zZywgYnVmZmVyLCBvZmZzZXQpO1xuICAgIH1cblxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgcHJvdG9jb2wgZGVjb2RlLlxuICAgKlxuICAgKiBAcGFyYW0gIHtCdWZmZXJ8VWludDhBcnJheX0gYnVmZmVyIG1lc3NhZ2UgYnl0ZXNcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAgIG1lc3NhZ2Ugb2JqZWN0XG4gICAqL1xuICBNZXNzYWdlLmRlY29kZSA9IGZ1bmN0aW9uKGJ1ZmZlcikge1xuICAgIHZhciBieXRlcyA9ICBuZXcgQnl0ZUFycmF5KGJ1ZmZlcik7XG4gICAgdmFyIGJ5dGVzTGVuID0gYnl0ZXMubGVuZ3RoIHx8IGJ5dGVzLmJ5dGVMZW5ndGg7XG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgdmFyIGlkID0gMDtcbiAgICB2YXIgcm91dGUgPSBudWxsO1xuXG4gICAgLy8gcGFyc2UgZmxhZ1xuICAgIHZhciBmbGFnID0gYnl0ZXNbb2Zmc2V0KytdO1xuICAgIHZhciBjb21wcmVzc1JvdXRlID0gZmxhZyAmIE1TR19DT01QUkVTU19ST1VURV9NQVNLO1xuICAgIHZhciB0eXBlID0gKGZsYWcgPj4gMSkgJiBNU0dfVFlQRV9NQVNLO1xuXG4gICAgLy8gcGFyc2UgaWRcbiAgICBpZihtc2dIYXNJZCh0eXBlKSkge1xuICAgICAgdmFyIG0gPSBwYXJzZUludChieXRlc1tvZmZzZXRdKTtcbiAgICAgIHZhciBpID0gMDtcbiAgICAgIGRve1xuICAgICAgICB2YXIgbSA9IHBhcnNlSW50KGJ5dGVzW29mZnNldF0pO1xuICAgICAgICBpZCA9IGlkICsgKChtICYgMHg3ZikgKiBNYXRoLnBvdygyLCg3KmkpKSk7XG4gICAgICAgIG9mZnNldCsrO1xuICAgICAgICBpKys7XG4gICAgICB9d2hpbGUobSA+PSAxMjgpO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHJvdXRlXG4gICAgaWYobXNnSGFzUm91dGUodHlwZSkpIHtcbiAgICAgIGlmKGNvbXByZXNzUm91dGUpIHtcbiAgICAgICAgcm91dGUgPSAoYnl0ZXNbb2Zmc2V0KytdKSA8PCA4IHwgYnl0ZXNbb2Zmc2V0KytdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIHJvdXRlTGVuID0gYnl0ZXNbb2Zmc2V0KytdO1xuICAgICAgICBpZihyb3V0ZUxlbikge1xuICAgICAgICAgIHJvdXRlID0gbmV3IEJ5dGVBcnJheShyb3V0ZUxlbik7XG4gICAgICAgICAgY29weUFycmF5KHJvdXRlLCAwLCBieXRlcywgb2Zmc2V0LCByb3V0ZUxlbik7XG4gICAgICAgICAgcm91dGUgPSBQcm90b2NvbC5zdHJkZWNvZGUocm91dGUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJvdXRlID0gJyc7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ICs9IHJvdXRlTGVuO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHBhcnNlIGJvZHlcbiAgICB2YXIgYm9keUxlbiA9IGJ5dGVzTGVuIC0gb2Zmc2V0O1xuICAgIHZhciBib2R5ID0gbmV3IEJ5dGVBcnJheShib2R5TGVuKTtcblxuICAgIGNvcHlBcnJheShib2R5LCAwLCBieXRlcywgb2Zmc2V0LCBib2R5TGVuKTtcblxuICAgIHJldHVybiB7J2lkJzogaWQsICd0eXBlJzogdHlwZSwgJ2NvbXByZXNzUm91dGUnOiBjb21wcmVzc1JvdXRlLFxuICAgICAgICAgICAgJ3JvdXRlJzogcm91dGUsICdib2R5JzogYm9keX07XG4gIH07XG5cbiAgdmFyIGNvcHlBcnJheSA9IGZ1bmN0aW9uKGRlc3QsIGRvZmZzZXQsIHNyYywgc29mZnNldCwgbGVuZ3RoKSB7XG4gICAgaWYoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNyYy5jb3B5KSB7XG4gICAgICAvLyBCdWZmZXJcbiAgICAgIHNyYy5jb3B5KGRlc3QsIGRvZmZzZXQsIHNvZmZzZXQsIHNvZmZzZXQgKyBsZW5ndGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVaW50OEFycmF5XG4gICAgICBmb3IodmFyIGluZGV4PTA7IGluZGV4PGxlbmd0aDsgaW5kZXgrKyl7XG4gICAgICAgIGRlc3RbZG9mZnNldCsrXSA9IHNyY1tzb2Zmc2V0KytdO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICB2YXIgbXNnSGFzSWQgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgcmV0dXJuIHR5cGUgPT09IE1lc3NhZ2UuVFlQRV9SRVFVRVNUIHx8IHR5cGUgPT09IE1lc3NhZ2UuVFlQRV9SRVNQT05TRTtcbiAgfTtcblxuICB2YXIgbXNnSGFzUm91dGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgcmV0dXJuIHR5cGUgPT09IE1lc3NhZ2UuVFlQRV9SRVFVRVNUIHx8IHR5cGUgPT09IE1lc3NhZ2UuVFlQRV9OT1RJRlkgfHxcbiAgICAgICAgICAgdHlwZSA9PT0gTWVzc2FnZS5UWVBFX1BVU0g7XG4gIH07XG5cbiAgdmFyIGNhY3VsYXRlTXNnSWRCeXRlcyA9IGZ1bmN0aW9uKGlkKSB7XG4gICAgdmFyIGxlbiA9IDA7XG4gICAgZG8ge1xuICAgICAgbGVuICs9IDE7XG4gICAgICBpZCA+Pj0gNztcbiAgICB9IHdoaWxlKGlkID4gMCk7XG4gICAgcmV0dXJuIGxlbjtcbiAgfTtcblxuICB2YXIgZW5jb2RlTXNnRmxhZyA9IGZ1bmN0aW9uKHR5cGUsIGNvbXByZXNzUm91dGUsIGJ1ZmZlciwgb2Zmc2V0KSB7XG4gICAgaWYodHlwZSAhPT0gTWVzc2FnZS5UWVBFX1JFUVVFU1QgJiYgdHlwZSAhPT0gTWVzc2FnZS5UWVBFX05PVElGWSAmJlxuICAgICAgIHR5cGUgIT09IE1lc3NhZ2UuVFlQRV9SRVNQT05TRSAmJiB0eXBlICE9PSBNZXNzYWdlLlRZUEVfUFVTSCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bmtvbncgbWVzc2FnZSB0eXBlOiAnICsgdHlwZSk7XG4gICAgfVxuXG4gICAgYnVmZmVyW29mZnNldF0gPSAodHlwZSA8PCAxKSB8IChjb21wcmVzc1JvdXRlID8gMSA6IDApO1xuXG4gICAgcmV0dXJuIG9mZnNldCArIE1TR19GTEFHX0JZVEVTO1xuICB9O1xuXG4gIHZhciBlbmNvZGVNc2dJZCA9IGZ1bmN0aW9uKGlkLCBidWZmZXIsIG9mZnNldCkge1xuICAgIGRve1xuICAgICAgdmFyIHRtcCA9IGlkICUgMTI4O1xuICAgICAgdmFyIG5leHQgPSBNYXRoLmZsb29yKGlkLzEyOCk7XG5cbiAgICAgIGlmKG5leHQgIT09IDApe1xuICAgICAgICB0bXAgPSB0bXAgKyAxMjg7XG4gICAgICB9XG4gICAgICBidWZmZXJbb2Zmc2V0KytdID0gdG1wO1xuXG4gICAgICBpZCA9IG5leHQ7XG4gICAgfSB3aGlsZShpZCAhPT0gMCk7XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9O1xuXG4gIHZhciBlbmNvZGVNc2dSb3V0ZSA9IGZ1bmN0aW9uKGNvbXByZXNzUm91dGUsIHJvdXRlLCBidWZmZXIsIG9mZnNldCkge1xuICAgIGlmIChjb21wcmVzc1JvdXRlKSB7XG4gICAgICBpZihyb3V0ZSA+IE1TR19ST1VURV9DT0RFX01BWCl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigncm91dGUgbnVtYmVyIGlzIG92ZXJmbG93Jyk7XG4gICAgICB9XG5cbiAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSAocm91dGUgPj4gOCkgJiAweGZmO1xuICAgICAgYnVmZmVyW29mZnNldCsrXSA9IHJvdXRlICYgMHhmZjtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYocm91dGUpIHtcbiAgICAgICAgYnVmZmVyW29mZnNldCsrXSA9IHJvdXRlLmxlbmd0aCAmIDB4ZmY7XG4gICAgICAgIGNvcHlBcnJheShidWZmZXIsIG9mZnNldCwgcm91dGUsIDAsIHJvdXRlLmxlbmd0aCk7XG4gICAgICAgIG9mZnNldCArPSByb3V0ZS5sZW5ndGg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gMDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9O1xuXG4gIHZhciBlbmNvZGVNc2dCb2R5ID0gZnVuY3Rpb24obXNnLCBidWZmZXIsIG9mZnNldCkge1xuICAgIGNvcHlBcnJheShidWZmZXIsIG9mZnNldCwgbXNnLCAwLCBtc2cubGVuZ3RoKTtcbiAgICByZXR1cm4gb2Zmc2V0ICsgbXNnLmxlbmd0aDtcbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IFByb3RvY29sO1xuICBpZih0eXBlb2Yod2luZG93KSAhPSBcInVuZGVmaW5lZFwiKSB7XG4gICAgd2luZG93LlByb3RvY29sID0gUHJvdG9jb2w7XG4gIH1cbn0pKHR5cGVvZih3aW5kb3cpPT1cInVuZGVmaW5lZFwiID8gbW9kdWxlLmV4cG9ydHMgOiB7fSwgdHlwZW9mKHdpbmRvdyk9PVwidW5kZWZpbmVkXCIgPyBCdWZmZXIgOiBVaW50OEFycmF5LCB0aGlzKTtcbiIsIi8vIOacjeWKoeWZqOWcsOWdgOmFjee9rlxubW9kdWxlLmV4cG9ydHM9e1xuICAgIHNlcnZlcklwOlwiMTkyLjE2OC44LjEwNFwiLFxuICAgIHNlcnZlclBvcnQ6MzAxMCxcbn07Il0sInNvdXJjZVJvb3QiOiIifQ==