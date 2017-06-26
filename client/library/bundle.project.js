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
},{}],"GamePlayerUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, '4cf32VTMk9HmZyTK3AjpJ1s', 'GamePlayerUi');
// ui/game/GamePlayerUi.js

"use strict";

cc.Class({
    extends: cc.Component,

    properties: {
        saySprite: cc.Sprite,
        sayPrepare: cc.SpriteFrame
    },

    // use this for initialization
    onLoad: function onLoad() {},

    // 准备
    prepare: function prepare() {
        this.saySprite.spriteFrame = this.sayPrepare;
        this.saySprite.node.active = true;
        // this.saySprite.node.
    }
});

cc._RF.pop();
},{}],"GameUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'cf61eIb0DlAuI0AYfm5hxFj', 'GameUi');
// ui/game/GameUi.js

"use strict";

var RoomData = require("../../commSrc/data/RoomData");
var GamePlayerUi = require("./GamePlayerUi");
cc.Class({
    extends: cc.Component,

    properties: {
        chairs: { default: [], type: cc.Node },
        GamePlayerPrefab: cc.Prefab
    },

    // use this for initialization
    onLoad: function onLoad() {
        this.chairUis = [];
        for (var i = this.chairs.length - 1; i >= 0; i--) {
            this.chairUis[i] = cc.instantiate(this.GamePlayerPrefab);
            this.chairUis[i].parent = this.chairs[i];
        }

        for (var i = 0; i < 5; i++) {
            // 本地椅子号转服务器椅子号
            var serverChair = (RoomData.myChair + i) % 5;
            if (RoomData.data.chr[serverChair] != null) {
                this.chairs[i].active = true;
            } else {
                this.chairs[i].active = false;
            }
        }

        this.registPomeloOn();
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
    },
    // 有玩家进入房间
    onEnterRoom: function onEnterRoom(data) {
        console.log("onEnterRoom", data);
        RoomData.enter(data.chair, data.uid, data.gold);

        var localChair = (data.chair - RoomData.myChair + 5) % 5;
        this.chairs[localChair].active = true;
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
        console.log("localChair", localChair, this.chairUis[localChair]);
        this.chairUis[localChair].getComponent("GamePlayerUi").prepare();
    },

    // 点击了准备
    onPrepareClick: function onPrepareClick() {
        pomelo.request("connector.entryHandler.prepare", {}, function () {});
    }

});

cc._RF.pop();
},{"../../commSrc/data/RoomData":"RoomData","./GamePlayerUi":"GamePlayerUi"}],"LoginUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'f2bebyF6dFG1rT5fsGJzyCe', 'LoginUi');
// ui/login/LoginUi.js

"use strict";

var Comm = require("../../commSrc/Comm");
cc.Class({
    extends: cc.Component,

    properties: {
        usernameLabel: cc.EditBox
    },

    onLoginClick: function onLoginClick() {
        var self = this;
        pomelo.init({
            host: "192.168.8.103",
            // host:"127.0.0.1",
            port: 3010
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
},{"../../commSrc/Comm":"Comm"}],"MainUi":[function(require,module,exports){
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

},{"buffer":2}]},{},["Comm","RoomData","emitter","pomelo-client","protobuf","protocol","Scene","GamePlayerUi","GameUi","LoginUi","MainUi"])

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFzc2V0cy9jb21tU3JjL0NvbW0uanMiLCJhc3NldHMvdWkvZ2FtZS9HYW1lUGxheWVyVWkuanMiLCJhc3NldHMvdWkvZ2FtZS9HYW1lVWkuanMiLCJhc3NldHMvdWkvbG9naW4vTG9naW5VaS5qcyIsImFzc2V0cy91aS9tYWluL01haW5VaS5qcyIsImFzc2V0cy9jb21tU3JjL2RhdGEvUm9vbURhdGEuanMiLCJhc3NldHMvc2NlbmUvU2NlbmUuanMiLCJhc3NldHMvcG9tZWxvL2VtaXR0ZXIuanMiLCJhc3NldHMvcG9tZWxvL3BvbWVsby1jbGllbnQuanMiLCJhc3NldHMvcG9tZWxvL3Byb3RvYnVmLmpzIiwiYXNzZXRzL3BvbWVsby9wcm90b2NvbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBOzs7Ozs7Ozs7O0FDREE7QUFDSTs7QUFFQTtBQUNJO0FBQ0E7QUFGUTs7QUFLWjtBQUNBOztBQUlBO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFDSDtBQWxCSTs7Ozs7Ozs7OztBQ0FUO0FBQ0E7QUFDQTtBQUNJOztBQUVBO0FBQ0k7QUFDQTtBQUZROztBQUtaO0FBQ0E7QUFDSTtBQUNBO0FBQ0k7QUFDQTtBQUNIOztBQUVEO0FBQ0k7QUFDQTtBQUNBO0FBQ0k7QUFDSDtBQUNHO0FBQ0g7QUFDSjs7QUFFRDtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTtBQUNBO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTs7QUFFQTtBQUNBO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTs7QUFFQTtBQUNBO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDSDs7QUFFRDtBQUNBO0FBQ0k7QUFHSDs7QUFyRUk7Ozs7Ozs7Ozs7QUNGVDtBQUNBO0FBQ0k7O0FBRUE7QUFDSTtBQURROztBQUlaO0FBQ0k7QUFDQTtBQUNJO0FBQ0E7QUFDQTtBQUhRO0FBS1I7QUFDSTtBQUNJO0FBQ0g7QUFDSjtBQUNKO0FBQ0o7QUFwQkk7Ozs7Ozs7Ozs7QUNEVDtBQUNBO0FBQ0E7QUFDSTs7QUFFQTs7QUFHQTtBQUNJO0FBQ0k7QUFDSTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNIO0FBQ0o7QUFDSjtBQWxCSTs7Ozs7Ozs7OztBQ0ZUO0FBQ0k7QUFDQTtBQUNBO0FBQ0k7QUFDSDtBQUNEO0FBQ0E7QUFDSTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0g7QUFDRDtBQUNBO0FBQ0k7QUFDSDtBQUNEO0FBQ0E7QUFDSTtBQUNBO0FBQ0g7O0FBdEJZOzs7Ozs7Ozs7O0FDQWpCO0FBQ0E7QUFDSTs7QUFFQTtBQUNJO0FBQ0E7QUFDQTtBQUhROztBQU1aO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFDSDs7QUFFRDtBQUNBOztBQUVBO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0g7QUFDRDtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSDtBQWpDSTs7Ozs7Ozs7OztBQ0FUOzs7O0FBSUE7O0FBRUE7O0FBRUE7Ozs7OztBQU1BO0FBQ0U7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0U7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OztBQVNBO0FBRUU7QUFDQTtBQUVBO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7QUFVQTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7QUFVQTtBQUlFOztBQUVBO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNFO0FBQ0E7QUFDRDtBQUNGO0FBQ0Q7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0E7QUFBQTs7QUFHQTtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0Q7Ozs7Ozs7Ozs7QUNyS0Q7QUFDRTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0U7QUFDRTtBQUNBO0FBRks7QUFJUDtBQUxvQjs7QUFTdEI7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDRDtBQUNEO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNGO0FBQ0Q7QUFDRTtBQUNBO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDQztBQUNEO0FBQ0Q7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTs7QUFFQTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0M7QUFDRDs7QUFHRDtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRDs7QUFHRDs7QUFFQTtBQUNFO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBOztBQUVBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7QUFDQztBQUNBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRDs7QUFFRDs7QUFFQTtBQUNBO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7O0FBRUE7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNFO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDRjtBQUNDO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNEO0FBQ0Q7QUFDRTtBQUNEO0FBQ0M7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7O0FBRUQ7O0FBRUE7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDQTtBQUNFO0FBQ0U7QUFDRDtBQUNEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7QUFDRjs7QUFFRDtBQUNBO0FBQ0U7QUFDRTtBQUNBO0FBRm1CO0FBSXJCO0FBQ0U7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQ7QUFDRDs7Ozs7Ozs7OztBQy9XRDs7QUFFQTs7Ozs7QUFLQTs7OztBQUlBO0FBQ0U7O0FBRUE7QUFDRTtBQUNBOztBQUVBO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFFRjs7QUFFRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBUGdCO0FBVW5COztBQUVEOzs7QUFHQTs7QUFFRTs7QUFFQTtBQUNFO0FBT0Q7QUFFRjs7QUFFRDs7O0FBR0E7O0FBRUU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0U7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7QUFDRDtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0Q7O0FBRUE7QUFDRDs7QUFFRDtBQUNFOztBQUVBO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNGOztBQUVEO0FBQ0Q7O0FBR0Q7QUFDRTtBQUNBOztBQUVBOztBQUVBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTs7QUFFQTtBQUNFOztBQUVBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7O0FBRUQ7QUFFRDs7QUFFRDtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7OztBQUdBO0FBQ0U7QUFDRTtBQUNEOztBQUVEOztBQUVBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7OztBQUdBO0FBQ0U7QUFDRTtBQUNEO0FBQ0M7QUFDRDtBQUNDO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0U7QUFDRDtBQUNDO0FBQ0Q7QUFDQztBQUNEO0FBQ0Y7QUFDRjs7QUFFRDs7O0FBR0E7O0FBRUU7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7QUFDRjs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNFOztBQUVBO0FBQ0E7QUFDRTtBQUNFO0FBQ0U7QUFDRDtBQUNIO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7QUFDRjtBQUNIO0FBQ0E7QUFDRTtBQUNBO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7QUFDRjtBQUNGO0FBQ0g7QUFyQkY7QUF1QkQ7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDRTtBQUNBO0FBQ0Y7QUFDQTtBQUNFO0FBQ0U7QUFDRDtBQUNIO0FBVkY7QUFZRDtBQUNGOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7QUFDRjtBQUNBO0FBQ0E7QUFDRTtBQUNGO0FBQ0E7QUFDRTtBQUNBO0FBQ0Y7QUFDQTtBQUNFO0FBQ0E7QUFDRjtBQUNBO0FBQ0U7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNGO0FBQ0E7QUFDRTtBQUNFO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7QUFDSDtBQXhDRjs7QUEyQ0E7QUFDRDs7QUFFRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFDRjtBQUNDO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7OztBQUdBO0FBQ0U7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTs7QUFFQTtBQUNBOztBQUVBO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNFO0FBQ0E7QUFDRTtBQUNGO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7QUFDRDtBQUNGO0FBVkY7QUFZRDs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0Q7QUFDRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFGSztBQUlSOztBQUVEOzs7QUFHQTtBQUNFOztBQUVBO0FBQ0U7QUFDQTtBQUZLO0FBSVI7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7QUFDRjtBQUNBO0FBQ0U7QUFDRjtBQUNFO0FBQ0E7QUFDQTtBQUNGO0FBQ0U7QUFDQTtBQUNBO0FBQ0Y7QUFDRTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Y7QUFDRTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7QUFDSDtBQTVCRjtBQThCRDs7QUFFRDtBQUNFO0FBQ0U7O0FBRUE7QUFDRTtBQUNEO0FBQ0Y7QUFDQztBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0Q7QUFDRDtBQUNEOztBQUVEO0FBQ0U7QUFDRDtBQUVGOzs7Ozs7Ozs7OztBQ3RtQkQ7QUFDRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOzs7Ozs7O0FBT0E7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0M7QUFDRDtBQUNDO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDRDtBQUNGO0FBQ0Q7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7Ozs7O0FBS0E7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRTtBQUNFO0FBQ0E7QUFDRDtBQUNDO0FBQ0E7QUFDRDtBQUNDO0FBQ0E7QUFDRDtBQUNEO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0JBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7O0FBT0E7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7Ozs7O0FBVUE7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNFO0FBQ0U7QUFDRDtBQUNEO0FBQ0Q7QUFDQztBQUNBO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7QUFDRDtBQUNEO0FBQ0Y7QUFDRjs7QUFFRDtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7Ozs7OztBQU1BO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7QUFDQztBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0Q7QUFDQztBQUNEO0FBQ0Q7QUFDRDtBQUNGOztBQUVEO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNRO0FBQ1Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDRDtBQUNDO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7QUFDRjs7QUFFRDtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUVEOztBQUVEO0FBQ0U7QUFDQTtBQUNFO0FBQ0E7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUVFO0FBQ0Q7O0FBRUQ7O0FBRUE7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7QUFDRDs7QUFFQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0Q7QUFDQztBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0M7QUFDRDtBQUNGOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNFO0FBQ0Q7QUFDRiIsInNvdXJjZXNDb250ZW50IjpbIi8vIHJlcXVpcmUoJ3BvbWVsby1jb2NvczJkLWpzJyk7XG5tb2R1bGUuZXhwb3J0cz17fTsiLCJjYy5DbGFzcyh7XG4gICAgZXh0ZW5kczogY2MuQ29tcG9uZW50LFxuXG4gICAgcHJvcGVydGllczoge1xuICAgICAgICBzYXlTcHJpdGU6Y2MuU3ByaXRlLFxuICAgICAgICBzYXlQcmVwYXJlOmNjLlNwcml0ZUZyYW1lLFxuICAgIH0sXG5cbiAgICAvLyB1c2UgdGhpcyBmb3IgaW5pdGlhbGl6YXRpb25cbiAgICBvbkxvYWQ6IGZ1bmN0aW9uICgpIHtcblxuICAgIH0sXG5cbiAgICAvLyDlh4blpIdcbiAgICBwcmVwYXJlOmZ1bmN0aW9uKCl7XG4gICAgICAgIHRoaXMuc2F5U3ByaXRlLnNwcml0ZUZyYW1lID0gdGhpcy5zYXlQcmVwYXJlO1xuICAgICAgICB0aGlzLnNheVNwcml0ZS5ub2RlLmFjdGl2ZSA9IHRydWU7XG4gICAgICAgIC8vIHRoaXMuc2F5U3ByaXRlLm5vZGUuXG4gICAgfVxufSk7XG4iLCJ2YXIgUm9vbURhdGEgPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9kYXRhL1Jvb21EYXRhXCIpO1xudmFyIEdhbWVQbGF5ZXJVaSA9IHJlcXVpcmUoXCIuL0dhbWVQbGF5ZXJVaVwiKTtcbmNjLkNsYXNzKHtcbiAgICBleHRlbmRzOiBjYy5Db21wb25lbnQsXG5cbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGNoYWlyczp7ZGVmYXVsdDpbXSx0eXBlOmNjLk5vZGV9LFxuICAgICAgICBHYW1lUGxheWVyUHJlZmFiOmNjLlByZWZhYixcbiAgICB9LFxuXG4gICAgLy8gdXNlIHRoaXMgZm9yIGluaXRpYWxpemF0aW9uXG4gICAgb25Mb2FkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuY2hhaXJVaXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMuY2hhaXJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICB0aGlzLmNoYWlyVWlzW2ldID0gY2MuaW5zdGFudGlhdGUodGhpcy5HYW1lUGxheWVyUHJlZmFiKTtcbiAgICAgICAgICAgIHRoaXMuY2hhaXJVaXNbaV0ucGFyZW50ID0gdGhpcy5jaGFpcnNbaV07XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGk9MDsgaSA8IDU7IGkrKykge1xuICAgICAgICAgICAgLy8g5pys5Zyw5qSF5a2Q5Y+36L2s5pyN5Yqh5Zmo5qSF5a2Q5Y+3XG4gICAgICAgICAgICB2YXIgc2VydmVyQ2hhaXIgPSAoUm9vbURhdGEubXlDaGFpciArIGkpJTU7XG4gICAgICAgICAgICBpZiAoUm9vbURhdGEuZGF0YS5jaHJbc2VydmVyQ2hhaXJdICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYWlyc1tpXS5hY3RpdmUgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYWlyc1tpXS5hY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucmVnaXN0UG9tZWxvT24oKTtcbiAgICB9LFxuICAgIC8vIOW9k+iiq+a2iOavgeeahOaXtuWAmeiwg+eUqFxuICAgIG9uRGVzdHJveTpmdW5jdGlvbigpe1xuICAgICAgICBwb21lbG8ub2ZmKFwib25FbnRlclJvb21cIik7XG4gICAgfSxcbiAgICAvLyDms6jlhoxwb21lbG/nm5HlkKxcbiAgICByZWdpc3RQb21lbG9PbjpmdW5jdGlvbigpe1xuICAgICAgICBwb21lbG8ub24oXCJvbkVudGVyUm9vbVwiLCB0aGlzLm9uRW50ZXJSb29tLmJpbmQodGhpcykpO1xuICAgICAgICBwb21lbG8ub24oXCJvbkV4aXRSb29tXCIsIHRoaXMub25FeGl0Um9vbS5iaW5kKHRoaXMpKTtcbiAgICAgICAgcG9tZWxvLm9uKFwib25QcmVwYXJlXCIsIHRoaXMub25QcmVwYXJlLmJpbmQodGhpcykpO1xuICAgIH0sXG4gICAgLy8g5pyJ546p5a626L+b5YWl5oi/6Ze0XG4gICAgb25FbnRlclJvb206ZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25FbnRlclJvb21cIiwgZGF0YSk7XG4gICAgICAgIFJvb21EYXRhLmVudGVyKGRhdGEuY2hhaXIsIGRhdGEudWlkLCBkYXRhLmdvbGQpO1xuXG4gICAgICAgIHZhciBsb2NhbENoYWlyID0gKGRhdGEuY2hhaXIgLSBSb29tRGF0YS5teUNoYWlyKzUpJTU7XG4gICAgICAgIHRoaXMuY2hhaXJzW2xvY2FsQ2hhaXJdLmFjdGl2ZSA9IHRydWU7XG4gICAgfSxcbiAgICAvLyDmnInnjqnlrrbpgIDlh7rmiL/pl7RcbiAgICBvbkV4aXRSb29tOmZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBjb25zb2xlLmxvZyhcIm9uRXhpdFJvb21cIiwgZGF0YSk7XG4gICAgICAgIFJvb21EYXRhLmV4aXQoZGF0YS5jaGFpcik7XG5cbiAgICAgICAgdmFyIGxvY2FsQ2hhaXIgPSAoZGF0YS5jaGFpciAtIFJvb21EYXRhLm15Q2hhaXIrNSklNTtcbiAgICAgICAgdGhpcy5jaGFpcnNbbG9jYWxDaGFpcl0uYWN0aXZlID0gZmFsc2U7XG4gICAgfSxcbiAgICAvLyDmnInnjqnlrrbpgIDlh7rmiL/pl7RcbiAgICBvblByZXBhcmU6ZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwib25QcmVwYXJlXCIsIGRhdGEpO1xuICAgICAgICBSb29tRGF0YS5wcmVwYXJlKGRhdGEuY2hhaXIpO1xuXG4gICAgICAgIHZhciBsb2NhbENoYWlyID0gKGRhdGEuY2hhaXIgLSBSb29tRGF0YS5teUNoYWlyKzUpJTU7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9jYWxDaGFpclwiLCBsb2NhbENoYWlyLHRoaXMuY2hhaXJVaXNbbG9jYWxDaGFpcl0pO1xuICAgICAgICB0aGlzLmNoYWlyVWlzW2xvY2FsQ2hhaXJdLmdldENvbXBvbmVudChcIkdhbWVQbGF5ZXJVaVwiKS5wcmVwYXJlKCk7XG4gICAgfSxcblxuICAgIC8vIOeCueWHu+S6huWHhuWkh1xuICAgIG9uUHJlcGFyZUNsaWNrOmZ1bmN0aW9uKCl7XG4gICAgICAgIHBvbWVsby5yZXF1ZXN0KFwiY29ubmVjdG9yLmVudHJ5SGFuZGxlci5wcmVwYXJlXCIsIHt9LCBmdW5jdGlvbigpe1xuXG4gICAgICAgIH0pO1xuICAgIH0sXG5cbn0pO1xuIiwidmFyIENvbW0gPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9Db21tXCIpO1xuY2MuQ2xhc3Moe1xuICAgIGV4dGVuZHM6IGNjLkNvbXBvbmVudCxcblxuICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgdXNlcm5hbWVMYWJlbDpjYy5FZGl0Qm94LFxuICAgIH0sXG5cbiAgICBvbkxvZ2luQ2xpY2s6ZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBwb21lbG8uaW5pdCh7XG4gICAgICAgICAgICBob3N0OlwiMTkyLjE2OC44LjEwM1wiLFxuICAgICAgICAgICAgLy8gaG9zdDpcIjEyNy4wLjAuMVwiLFxuICAgICAgICAgICAgcG9ydDozMDEwXG4gICAgICAgIH0sIGZ1bmN0aW9uKGVycil7XG4gICAgICAgICAgICBwb21lbG8ucmVxdWVzdChcImNvbm5lY3Rvci5lbnRyeUhhbmRsZXIubG9naW5cIiwge3VzZXJuYW1lOnNlbGYudXNlcm5hbWVMYWJlbC5zdHJpbmd9LCBmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgICAgICAgICBpZiAoZGF0YS5yZXQgPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBDb21tLnNjZW5lLmxvZ2luKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG59KTtcbiIsInZhciBSb29tRGF0YSA9IHJlcXVpcmUoXCIuLi8uLi9jb21tU3JjL2RhdGEvUm9vbURhdGFcIik7XG52YXIgQ29tbSA9IHJlcXVpcmUoXCIuLi8uLi9jb21tU3JjL0NvbW1cIik7XG5jYy5DbGFzcyh7XG4gICAgZXh0ZW5kczogY2MuQ29tcG9uZW50LFxuXG4gICAgcHJvcGVydGllczoge1xuICAgIH0sXG5cbiAgICBvblJvb20xQ2xpY2s6ZnVuY3Rpb24oKXtcbiAgICAgICAgcG9tZWxvLnJlcXVlc3QoXCJjb25uZWN0b3IuZW50cnlIYW5kbGVyLmVudGVyUm9vbVwiLCB7fSwgZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgICAgICBpZiAoZGF0YS5yZXQgPT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEuZGF0YS5yb29tRGF0YSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YS5kYXRhLmNoYWlyKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhLmRhdGEucm9vbUlkKTtcbiAgICAgICAgICAgICAgICBSb29tRGF0YS5kYXRhID0gZGF0YS5kYXRhLnJvb21EYXRhO1xuICAgICAgICAgICAgICAgIFJvb21EYXRhLm15Q2hhaXIgPSBkYXRhLmRhdGEuY2hhaXI7XG4gICAgICAgICAgICAgICAgUm9vbURhdGEucm9vbUlkID0gZGF0YS5kYXRhLnJvb21JZDtcbiAgICAgICAgICAgICAgICBDb21tLnNjZW5lLmVudGVyUm9vbSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBkYXRhIDoge2NocjpbbnVsbCxudWxsLG51bGwsbnVsbF19LFxuICAgIC8vIOi/m+WFpeaIv+mXtFxuICAgIGVudGVyIDogZnVuY3Rpb24oY2hhaXIsIHVpZCwgZ29sZCl7XG4gICAgICAgIHRoaXMuZGF0YS5jaHJbY2hhaXJdID0ge3VpZDp1aWQsZ29sZDpnb2xkfTtcbiAgICB9LFxuICAgIC8vIOmAgOWHuuaIv+mXtFxuICAgIGV4aXQgOiBmdW5jdGlvbihjaGFpcil7XG4gICAgICAgIHRoaXMuZGF0YS5jaHJbY2hhaXJdID0gbnVsbDtcbiAgICB9LFxuICAgIC8vIOWHhuWkh1xuICAgIHByZXBhcmU6ZnVuY3Rpb24oY2hhaXIpIHtcbiAgICAgICAgdGhpcy5kYXRhLmNocltjaGFpcl0ucHJlID0gdHJ1ZTtcbiAgICB9LFxuICAgIC8vIOWPkeeJjCzlvIDlp4tcbiAgICBzdGFydDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5pbmcgPSB0cnVlO1xuICAgIH0sXG4gICAgLy8g6K6+572u5Y+R6KiA5Lq6XG4gICAgc2V0U3BlYWtlcjpmdW5jdGlvbihzcGVha2VyLCBzcGVha2VyVGltZSkge1xuICAgICAgICB0aGlzLmRhdGEucyA9IHNwZWFrZXI7XG4gICAgICAgIHRoaXMuZGF0YS5zdCA9IHNwZWFrZXJUaW1lO1xuICAgIH0sXG5cbn07XG4iLCJ2YXIgQ29tbSA9IHJlcXVpcmUoXCIuLi9jb21tU3JjL0NvbW1cIik7XG5jYy5DbGFzcyh7XG4gICAgZXh0ZW5kczogY2MuQ29tcG9uZW50LFxuXG4gICAgcHJvcGVydGllczoge1xuICAgICAgICBsb2dpblVpUHJlZmFiOmNjLlByZWZhYixcbiAgICAgICAgbWFpblVpUHJlZmFiOmNjLlByZWZhYixcbiAgICAgICAgZ2FtZVVpUHJlZmFiOmNjLlByZWZhYixcbiAgICB9LFxuXG4gICAgLy8gdXNlIHRoaXMgZm9yIGluaXRpYWxpemF0aW9uXG4gICAgb25Mb2FkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIENvbW0uc2NlbmUgPSB0aGlzO1xuICAgICAgICB0aGlzLmxvZ2luVWkgPSBjYy5pbnN0YW50aWF0ZSh0aGlzLmxvZ2luVWlQcmVmYWIpO1xuICAgICAgICB0aGlzLmxvZ2luVWkucGFyZW50ID0gdGhpcy5ub2RlO1xuICAgIH0sXG5cbiAgICAvLyBjYWxsZWQgZXZlcnkgZnJhbWUsIHVuY29tbWVudCB0aGlzIGZ1bmN0aW9uIHRvIGFjdGl2YXRlIHVwZGF0ZSBjYWxsYmFja1xuICAgIC8vIHVwZGF0ZTogZnVuY3Rpb24gKGR0KSB7XG5cbiAgICAvLyB9LFxuICAgIGxvZ2luOmZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImxvZ2luXCIpO1xuICAgICAgICB0aGlzLmxvZ2luVWkuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmxvZ2luVWkgPSBudWxsO1xuICAgICAgICB0aGlzLm1haW5VaSA9IGNjLmluc3RhbnRpYXRlKHRoaXMubWFpblVpUHJlZmFiKTtcbiAgICAgICAgdGhpcy5tYWluVWkucGFyZW50ID0gdGhpcy5ub2RlO1xuICAgIH0sXG4gICAgZW50ZXJSb29tOmZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImVudGVyUm9vbVwiKTtcbiAgICAgICAgdGhpcy5tYWluVWkuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLm1haW5VaSA9IG51bGw7XG4gICAgICAgIHRoaXMuZ2FtZVVpID0gY2MuaW5zdGFudGlhdGUodGhpcy5nYW1lVWlQcmVmYWIpO1xuICAgICAgICB0aGlzLmdhbWVVaS5wYXJlbnQgPSB0aGlzLm5vZGU7XG4gICAgfSxcbn0pO1xuIiwiXG4vKipcbiAqIEV4cG9zZSBgRW1pdHRlcmAuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBFbWl0dGVyO1xuXG53aW5kb3cuRXZlbnRFbWl0dGVyID0gRW1pdHRlcjtcblxuLyoqXG4gKiBJbml0aWFsaXplIGEgbmV3IGBFbWl0dGVyYC5cbiAqXG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIEVtaXR0ZXIob2JqKSB7XG4gIGlmIChvYmopIHJldHVybiBtaXhpbihvYmopO1xufTtcblxuLyoqXG4gKiBNaXhpbiB0aGUgZW1pdHRlciBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIG1peGluKG9iaikge1xuICBmb3IgKHZhciBrZXkgaW4gRW1pdHRlci5wcm90b3R5cGUpIHtcbiAgICBvYmpba2V5XSA9IEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG4gIH1cbiAgcmV0dXJuIG9iajtcbn1cblxuLyoqXG4gKiBMaXN0ZW4gb24gdGhlIGdpdmVuIGBldmVudGAgd2l0aCBgZm5gLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLm9uID1cbkVtaXR0ZXIucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudCwgZm4pe1xuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG4gICh0aGlzLl9jYWxsYmFja3NbZXZlbnRdID0gdGhpcy5fY2FsbGJhY2tzW2V2ZW50XSB8fCBbXSlcbiAgICAucHVzaChmbik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuLyoqXG4gKiBBZGRzIGFuIGBldmVudGAgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGludm9rZWQgYSBzaW5nbGVcbiAqIHRpbWUgdGhlbiBhdXRvbWF0aWNhbGx5IHJlbW92ZWQuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7RW1pdHRlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuXG4gIGZ1bmN0aW9uIG9uKCkge1xuICAgIHNlbGYub2ZmKGV2ZW50LCBvbik7XG4gICAgZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfVxuXG4gIG9uLmZuID0gZm47XG4gIHRoaXMub24oZXZlbnQsIG9uKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFJlbW92ZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgZm9yIGBldmVudGAgb3IgYWxsXG4gKiByZWdpc3RlcmVkIGNhbGxiYWNrcy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5vZmYgPVxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPVxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID1cbkVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbihldmVudCwgZm4pe1xuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cbiAgLy8gYWxsXG4gIGlmICgwID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICB0aGlzLl9jYWxsYmFja3MgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHNwZWNpZmljIGV2ZW50XG4gIHZhciBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbZXZlbnRdO1xuICBpZiAoIWNhbGxiYWNrcykgcmV0dXJuIHRoaXM7XG5cbiAgLy8gcmVtb3ZlIGFsbCBoYW5kbGVyc1xuICBpZiAoMSA9PSBhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgZGVsZXRlIHRoaXMuX2NhbGxiYWNrc1tldmVudF07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyByZW1vdmUgc3BlY2lmaWMgaGFuZGxlclxuICB2YXIgY2I7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgY2IgPSBjYWxsYmFja3NbaV07XG4gICAgaWYgKGNiID09PSBmbiB8fCBjYi5mbiA9PT0gZm4pIHtcbiAgICAgIGNhbGxiYWNrcy5zcGxpY2UoaSwgMSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEVtaXQgYGV2ZW50YCB3aXRoIHRoZSBnaXZlbiBhcmdzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtNaXhlZH0gLi4uXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbihldmVudCl7XG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcbiAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcbiAgICAsIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1tldmVudF07XG5cbiAgaWYgKGNhbGxiYWNrcykge1xuICAgIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICBjYWxsYmFja3NbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIFJldHVybiBhcnJheSBvZiBjYWxsYmFja3MgZm9yIGBldmVudGAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24oZXZlbnQpe1xuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG4gIHJldHVybiB0aGlzLl9jYWxsYmFja3NbZXZlbnRdIHx8IFtdO1xufTtcblxuLyoqXG4gKiBDaGVjayBpZiB0aGlzIGVtaXR0ZXIgaGFzIGBldmVudGAgaGFuZGxlcnMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5oYXNMaXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XG4gIHJldHVybiAhISB0aGlzLmxpc3RlbmVycyhldmVudCkubGVuZ3RoO1xufTtcbiIsIihmdW5jdGlvbigpIHtcbiAgdmFyIEpTX1dTX0NMSUVOVF9UWVBFID0gJ2pzLXdlYnNvY2tldCc7XG4gIHZhciBKU19XU19DTElFTlRfVkVSU0lPTiA9ICcwLjAuMSc7XG5cbiAgdmFyIFByb2N0b2NvbCA9IHJlcXVpcmUoXCJwcm90b2NvbFwiKTtcbiAgdmFyIFBhY2thZ2UgPSBQcm90b2NvbC5QYWNrYWdlO1xuICB2YXIgTWVzc2FnZSA9IFByb3RvY29sLk1lc3NhZ2U7XG4gIHZhciBFdmVudEVtaXR0ZXIgPSB3aW5kb3cuRXZlbnRFbWl0dGVyO1xuXG4gIGlmKHR5cGVvZih3aW5kb3cpICE9IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mKHN5cykgIT0gJ3VuZGVmaW5lZCcgJiYgc3lzLmxvY2FsU3RvcmFnZSkge1xuICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UgPSBzeXMubG9jYWxTdG9yYWdlO1xuICB9XG5cbiAgdmFyIFJFU19PSyA9IDIwMDtcbiAgdmFyIFJFU19GQUlMID0gNTAwO1xuICB2YXIgUkVTX09MRF9DTElFTlQgPSA1MDE7XG5cbiAgaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgT2JqZWN0LmNyZWF0ZSA9IGZ1bmN0aW9uIChvKSB7XG4gICAgICBmdW5jdGlvbiBGKCkge31cbiAgICAgIEYucHJvdG90eXBlID0gbztcbiAgICAgIHJldHVybiBuZXcgRigpO1xuICAgIH07XG4gIH1cblxuICB2YXIgcm9vdCA9IHdpbmRvdztcbiAgdmFyIHBvbWVsbyA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7IC8vIG9iamVjdCBleHRlbmQgZnJvbSBvYmplY3RcbiAgcm9vdC5wb21lbG8gPSBwb21lbG87XG4gIHZhciBzb2NrZXQgPSBudWxsO1xuICB2YXIgcmVxSWQgPSAwO1xuICB2YXIgY2FsbGJhY2tzID0ge307XG4gIHZhciBoYW5kbGVycyA9IHt9O1xuICAvL01hcCBmcm9tIHJlcXVlc3QgaWQgdG8gcm91dGVcbiAgdmFyIHJvdXRlTWFwID0ge307XG5cbiAgdmFyIGhlYXJ0YmVhdEludGVydmFsID0gMDtcbiAgdmFyIGhlYXJ0YmVhdFRpbWVvdXQgPSAwO1xuICB2YXIgbmV4dEhlYXJ0YmVhdFRpbWVvdXQgPSAwO1xuICB2YXIgZ2FwVGhyZXNob2xkID0gMTAwOyAgIC8vIGhlYXJ0YmVhdCBnYXAgdGhyZWFzaG9sZFxuICB2YXIgaGVhcnRiZWF0SWQgPSBudWxsO1xuICB2YXIgaGVhcnRiZWF0VGltZW91dElkID0gbnVsbDtcblxuICB2YXIgaGFuZHNoYWtlQ2FsbGJhY2sgPSBudWxsO1xuXG4gIHZhciBkZWNvZGUgPSBudWxsO1xuICB2YXIgZW5jb2RlID0gbnVsbDtcblxuICB2YXIgdXNlQ3J5cHRvO1xuXG4gIHZhciBoYW5kc2hha2VCdWZmZXIgPSB7XG4gICAgJ3N5cyc6IHtcbiAgICAgIHR5cGU6IEpTX1dTX0NMSUVOVF9UWVBFLFxuICAgICAgdmVyc2lvbjogSlNfV1NfQ0xJRU5UX1ZFUlNJT05cbiAgICB9LFxuICAgICd1c2VyJzoge1xuICAgIH1cbiAgfTtcblxuICB2YXIgaW5pdENhbGxiYWNrID0gbnVsbDtcblxuICBwb21lbG8uaW5pdCA9IGZ1bmN0aW9uKHBhcmFtcywgY2Ipe1xuICAgIGluaXRDYWxsYmFjayA9IGNiO1xuICAgIHZhciBob3N0ID0gcGFyYW1zLmhvc3Q7XG4gICAgdmFyIHBvcnQgPSBwYXJhbXMucG9ydDtcblxuICAgIHZhciB1cmwgPSAnd3M6Ly8nICsgaG9zdDtcbiAgICBpZihwb3J0KSB7XG4gICAgICB1cmwgKz0gICc6JyArIHBvcnQ7XG4gICAgfVxuXG4gICAgaGFuZHNoYWtlQnVmZmVyLnVzZXIgPSBwYXJhbXMudXNlcjtcbiAgICBoYW5kc2hha2VDYWxsYmFjayA9IHBhcmFtcy5oYW5kc2hha2VDYWxsYmFjaztcbiAgICBpbml0V2ViU29ja2V0KHVybCwgY2IpO1xuICB9O1xuXG4gIHZhciBpbml0V2ViU29ja2V0ID0gZnVuY3Rpb24odXJsLGNiKXtcbiAgICB2YXIgb25vcGVuID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgdmFyIG9iaiA9IFBhY2thZ2UuZW5jb2RlKFBhY2thZ2UuVFlQRV9IQU5EU0hBS0UsIFByb3RvY29sLnN0cmVuY29kZShKU09OLnN0cmluZ2lmeShoYW5kc2hha2VCdWZmZXIpKSk7XG4gICAgICBzZW5kKG9iaik7XG4gICAgfTtcbiAgICB2YXIgb25tZXNzYWdlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHByb2Nlc3NQYWNrYWdlKFBhY2thZ2UuZGVjb2RlKGV2ZW50LmRhdGEpLCBjYik7XG4gICAgICAvLyBuZXcgcGFja2FnZSBhcnJpdmVkLCB1cGRhdGUgdGhlIGhlYXJ0YmVhdCB0aW1lb3V0XG4gICAgICBpZihoZWFydGJlYXRUaW1lb3V0KSB7XG4gICAgICAgIG5leHRIZWFydGJlYXRUaW1lb3V0ID0gRGF0ZS5ub3coKSArIGhlYXJ0YmVhdFRpbWVvdXQ7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgb25lcnJvciA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICBwb21lbG8uZW1pdCgnaW8tZXJyb3InLCBldmVudCk7XG4gICAgICBjYy5lcnJvcignc29ja2V0IGVycm9yOiAnLCBldmVudCk7XG4gICAgfTtcbiAgICB2YXIgb25jbG9zZSA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgIHBvbWVsby5lbWl0KCdjbG9zZScsZXZlbnQpO1xuICAgICAgcG9tZWxvLmVtaXQoJ2Rpc2Nvbm5lY3QnLCBldmVudCk7XG4gICAgICBjYy5lcnJvcignc29ja2V0IGNsb3NlOiAnLCBldmVudCk7XG4gICAgfTtcbiAgICBzb2NrZXQgPSBuZXcgV2ViU29ja2V0KHVybCk7XG4gICAgc29ja2V0LmJpbmFyeVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHNvY2tldC5vbm9wZW4gPSBvbm9wZW47XG4gICAgc29ja2V0Lm9ubWVzc2FnZSA9IG9ubWVzc2FnZTtcbiAgICBzb2NrZXQub25lcnJvciA9IG9uZXJyb3I7XG4gICAgc29ja2V0Lm9uY2xvc2UgPSBvbmNsb3NlO1xuICB9O1xuXG4gIHBvbWVsby5kaXNjb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYoc29ja2V0KSB7XG4gICAgICBpZihzb2NrZXQuZGlzY29ubmVjdCkgc29ja2V0LmRpc2Nvbm5lY3QoKTtcbiAgICAgIGlmKHNvY2tldC5jbG9zZSkgc29ja2V0LmNsb3NlKCk7XG4gICAgICBjYy5sb2coJ2Rpc2Nvbm5lY3QnKTtcbiAgICAgIHNvY2tldCA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYoaGVhcnRiZWF0SWQpIHtcbiAgICAgIGNsZWFyVGltZW91dChoZWFydGJlYXRJZCk7XG4gICAgICBoZWFydGJlYXRJZCA9IG51bGw7XG4gICAgfVxuICAgIGlmKGhlYXJ0YmVhdFRpbWVvdXRJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KGhlYXJ0YmVhdFRpbWVvdXRJZCk7XG4gICAgICBoZWFydGJlYXRUaW1lb3V0SWQgPSBudWxsO1xuICAgIH1cbiAgfTtcblxuICBwb21lbG8ucmVxdWVzdCA9IGZ1bmN0aW9uKHJvdXRlLCBtc2csIGNiKSB7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMiAmJiB0eXBlb2YgbXNnID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYiA9IG1zZztcbiAgICAgIG1zZyA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICBtc2cgPSBtc2cgfHwge307XG4gICAgfVxuICAgIHJvdXRlID0gcm91dGUgfHwgbXNnLnJvdXRlO1xuICAgIGlmKCFyb3V0ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJlcUlkKys7XG4gICAgc2VuZE1lc3NhZ2UocmVxSWQsIHJvdXRlLCBtc2cpO1xuXG4gICAgY2FsbGJhY2tzW3JlcUlkXSA9IGNiO1xuICAgIHJvdXRlTWFwW3JlcUlkXSA9IHJvdXRlO1xuICB9O1xuXG4gIHBvbWVsby5ub3RpZnkgPSBmdW5jdGlvbihyb3V0ZSwgbXNnKSB7XG4gICAgbXNnID0gbXNnIHx8IHt9O1xuICAgIHNlbmRNZXNzYWdlKDAsIHJvdXRlLCBtc2cpO1xuICB9O1xuXG4gIHZhciBzZW5kTWVzc2FnZSA9IGZ1bmN0aW9uKHJlcUlkLCByb3V0ZSwgbXNnKSB7XG4gICAgdmFyIHR5cGUgPSByZXFJZCA/IE1lc3NhZ2UuVFlQRV9SRVFVRVNUIDogTWVzc2FnZS5UWVBFX05PVElGWTtcblxuICAgIC8vY29tcHJlc3MgbWVzc2FnZSBieSBwcm90b2J1ZlxuICAgIHZhciBwcm90b3MgPSAhIXBvbWVsby5kYXRhLnByb3Rvcz9wb21lbG8uZGF0YS5wcm90b3MuY2xpZW50Ont9O1xuICAgIGlmKCEhcHJvdG9zW3JvdXRlXSl7XG4gICAgICBtc2cgPSBwcm90b2J1Zi5lbmNvZGUocm91dGUsIG1zZyk7XG4gICAgfWVsc2V7XG4gICAgICBtc2cgPSBQcm90b2NvbC5zdHJlbmNvZGUoSlNPTi5zdHJpbmdpZnkobXNnKSk7XG4gICAgfVxuXG5cbiAgICB2YXIgY29tcHJlc3NSb3V0ZSA9IDA7XG4gICAgaWYocG9tZWxvLmRpY3QgJiYgcG9tZWxvLmRpY3Rbcm91dGVdKXtcbiAgICAgIHJvdXRlID0gcG9tZWxvLmRpY3Rbcm91dGVdO1xuICAgICAgY29tcHJlc3NSb3V0ZSA9IDE7XG4gICAgfVxuXG4gICAgbXNnID0gTWVzc2FnZS5lbmNvZGUocmVxSWQsIHR5cGUsIGNvbXByZXNzUm91dGUsIHJvdXRlLCBtc2cpO1xuICAgIHZhciBwYWNrZXQgPSBQYWNrYWdlLmVuY29kZShQYWNrYWdlLlRZUEVfREFUQSwgbXNnKTtcbiAgICBzZW5kKHBhY2tldCk7XG4gIH07XG5cbiAgdmFyIHNlbmQgPSBmdW5jdGlvbihwYWNrZXQpe1xuICAgIHNvY2tldC5zZW5kKHBhY2tldC5idWZmZXIpO1xuICB9O1xuXG5cbiAgdmFyIGhhbmRsZXIgPSB7fTtcblxuICB2YXIgaGVhcnRiZWF0ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIGlmKCFoZWFydGJlYXRJbnRlcnZhbCkge1xuICAgICAgLy8gbm8gaGVhcnRiZWF0XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIG9iaiA9IFBhY2thZ2UuZW5jb2RlKFBhY2thZ2UuVFlQRV9IRUFSVEJFQVQpO1xuICAgIGlmKGhlYXJ0YmVhdFRpbWVvdXRJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KGhlYXJ0YmVhdFRpbWVvdXRJZCk7XG4gICAgICBoZWFydGJlYXRUaW1lb3V0SWQgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKGhlYXJ0YmVhdElkKSB7XG4gICAgICAvLyBhbHJlYWR5IGluIGEgaGVhcnRiZWF0IGludGVydmFsXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaGVhcnRiZWF0SWQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgaGVhcnRiZWF0SWQgPSBudWxsO1xuICAgICAgc2VuZChvYmopO1xuXG4gICAgICBuZXh0SGVhcnRiZWF0VGltZW91dCA9IERhdGUubm93KCkgKyBoZWFydGJlYXRUaW1lb3V0O1xuICAgICAgaGVhcnRiZWF0VGltZW91dElkID0gc2V0VGltZW91dChoZWFydGJlYXRUaW1lb3V0Q2IsIGhlYXJ0YmVhdFRpbWVvdXQpO1xuICAgIH0sIGhlYXJ0YmVhdEludGVydmFsKTtcbiAgfTtcblxuICB2YXIgaGVhcnRiZWF0VGltZW91dENiID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGdhcCA9IG5leHRIZWFydGJlYXRUaW1lb3V0IC0gRGF0ZS5ub3coKTtcbiAgICBpZihnYXAgPiBnYXBUaHJlc2hvbGQpIHtcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXRJZCA9IHNldFRpbWVvdXQoaGVhcnRiZWF0VGltZW91dENiLCBnYXApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYy5lcnJvcignc2VydmVyIGhlYXJ0YmVhdCB0aW1lb3V0Jyk7XG4gICAgICBwb21lbG8uZW1pdCgnaGVhcnRiZWF0IHRpbWVvdXQnKTtcbiAgICAgIHBvbWVsby5kaXNjb25uZWN0KCk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBoYW5kc2hha2UgPSBmdW5jdGlvbihkYXRhKXtcbiAgICBkYXRhID0gSlNPTi5wYXJzZShQcm90b2NvbC5zdHJkZWNvZGUoZGF0YSkpO1xuICAgIGlmKGRhdGEuY29kZSA9PT0gUkVTX09MRF9DTElFTlQpIHtcbiAgICAgIHBvbWVsby5lbWl0KCdlcnJvcicsICdjbGllbnQgdmVyc2lvbiBub3QgZnVsbGZpbGwnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZihkYXRhLmNvZGUgIT09IFJFU19PSykge1xuICAgICAgcG9tZWxvLmVtaXQoJ2Vycm9yJywgJ2hhbmRzaGFrZSBmYWlsJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaGFuZHNoYWtlSW5pdChkYXRhKTtcblxuICAgIHZhciBvYmogPSBQYWNrYWdlLmVuY29kZShQYWNrYWdlLlRZUEVfSEFORFNIQUtFX0FDSyk7XG4gICAgc2VuZChvYmopO1xuICAgIGlmKGluaXRDYWxsYmFjaykge1xuICAgICAgaW5pdENhbGxiYWNrKHNvY2tldCk7XG4gICAgICBpbml0Q2FsbGJhY2sgPSBudWxsO1xuICAgIH1cbiAgfTtcblxuICB2YXIgb25EYXRhID0gZnVuY3Rpb24oZGF0YSl7XG4gICAgLy9wcm9idWZmIGRlY29kZVxuICAgIHZhciBtc2cgPSBNZXNzYWdlLmRlY29kZShkYXRhKTtcblxuICAgIGlmKG1zZy5pZCA+IDApe1xuICAgICAgbXNnLnJvdXRlID0gcm91dGVNYXBbbXNnLmlkXTtcbiAgICAgIGRlbGV0ZSByb3V0ZU1hcFttc2cuaWRdO1xuICAgICAgaWYoIW1zZy5yb3V0ZSl7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBtc2cuYm9keSA9IGRlQ29tcG9zZShtc2cpO1xuXG4gICAgcHJvY2Vzc01lc3NhZ2UocG9tZWxvLCBtc2cpO1xuICB9O1xuXG4gIHZhciBvbktpY2sgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgZGF0YSA9IEpTT04ucGFyc2UoUHJvdG9jb2wuc3RyZGVjb2RlKGRhdGEpKTtcbiAgICBwb21lbG8uZW1pdCgnb25LaWNrJywgZGF0YSk7XG4gIH07XG5cbiAgaGFuZGxlcnNbUGFja2FnZS5UWVBFX0hBTkRTSEFLRV0gPSBoYW5kc2hha2U7XG4gIGhhbmRsZXJzW1BhY2thZ2UuVFlQRV9IRUFSVEJFQVRdID0gaGVhcnRiZWF0O1xuICBoYW5kbGVyc1tQYWNrYWdlLlRZUEVfREFUQV0gPSBvbkRhdGE7XG4gIGhhbmRsZXJzW1BhY2thZ2UuVFlQRV9LSUNLXSA9IG9uS2ljaztcblxuICB2YXIgcHJvY2Vzc1BhY2thZ2UgPSBmdW5jdGlvbihtc2dzKSB7XG4gICAgaWYoQXJyYXkuaXNBcnJheShtc2dzKSkge1xuICAgICAgZm9yKHZhciBpPTA7IGk8bXNncy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgbXNnID0gbXNnc1tpXTtcbiAgICAgICAgaGFuZGxlcnNbbXNnLnR5cGVdKG1zZy5ib2R5KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlcnNbbXNncy50eXBlXShtc2dzLmJvZHkpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgcHJvY2Vzc01lc3NhZ2UgPSBmdW5jdGlvbihwb21lbG8sIG1zZykge1xuICAgIGlmKCFtc2cuaWQpIHtcbiAgICAgIC8vIHNlcnZlciBwdXNoIG1lc3NhZ2VcbiAgICAgIHBvbWVsby5lbWl0KG1zZy5yb3V0ZSwgbXNnLmJvZHkpO1xuICAgIH1cblxuICAgIC8vaWYgaGF2ZSBhIGlkIHRoZW4gZmluZCB0aGUgY2FsbGJhY2sgZnVuY3Rpb24gd2l0aCB0aGUgcmVxdWVzdFxuICAgIHZhciBjYiA9IGNhbGxiYWNrc1ttc2cuaWRdO1xuXG4gICAgZGVsZXRlIGNhbGxiYWNrc1ttc2cuaWRdO1xuICAgIGlmKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNiKG1zZy5ib2R5KTtcbiAgICByZXR1cm47XG4gIH07XG5cbiAgdmFyIHByb2Nlc3NNZXNzYWdlQmF0Y2ggPSBmdW5jdGlvbihwb21lbG8sIG1zZ3MpIHtcbiAgICBmb3IodmFyIGk9MCwgbD1tc2dzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHByb2Nlc3NNZXNzYWdlKHBvbWVsbywgbXNnc1tpXSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBkZUNvbXBvc2UgPSBmdW5jdGlvbihtc2cpe1xuICAgIHZhciBwcm90b3MgPSAhIXBvbWVsby5kYXRhLnByb3Rvcz9wb21lbG8uZGF0YS5wcm90b3Muc2VydmVyOnt9O1xuICAgIHZhciBhYmJycyA9IHBvbWVsby5kYXRhLmFiYnJzO1xuICAgIHZhciByb3V0ZSA9IG1zZy5yb3V0ZTtcblxuICAgIC8vRGVjb21wb3NlIHJvdXRlIGZyb20gZGljdFxuICAgIGlmKG1zZy5jb21wcmVzc1JvdXRlKSB7XG4gICAgICBpZighYWJicnNbcm91dGVdKXtcbiAgICAgICAgcmV0dXJuIHt9O1xuICAgICAgfVxuXG4gICAgICByb3V0ZSA9IG1zZy5yb3V0ZSA9IGFiYnJzW3JvdXRlXTtcbiAgICB9XG4gICAgaWYoISFwcm90b3Nbcm91dGVdKXtcbiAgICAgIHJldHVybiBwcm90b2J1Zi5kZWNvZGUocm91dGUsIG1zZy5ib2R5KTtcbiAgICB9ZWxzZXtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKFByb3RvY29sLnN0cmRlY29kZShtc2cuYm9keSkpO1xuICAgIH1cblxuICAgIHJldHVybiBtc2c7XG4gIH07XG5cbiAgdmFyIGhhbmRzaGFrZUluaXQgPSBmdW5jdGlvbihkYXRhKXtcbiAgICBpZihkYXRhLnN5cyAmJiBkYXRhLnN5cy5oZWFydGJlYXQpIHtcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsID0gZGF0YS5zeXMuaGVhcnRiZWF0ICogMTAwMDsgICAvLyBoZWFydGJlYXQgaW50ZXJ2YWxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQgPSBoZWFydGJlYXRJbnRlcnZhbCAqIDI7ICAgICAgICAvLyBtYXggaGVhcnRiZWF0IHRpbWVvdXRcbiAgICB9IGVsc2Uge1xuICAgICAgaGVhcnRiZWF0SW50ZXJ2YWwgPSAwO1xuICAgICAgaGVhcnRiZWF0VGltZW91dCA9IDA7XG4gICAgfVxuXG4gICAgaW5pdERhdGEoZGF0YSk7XG5cbiAgICBpZih0eXBlb2YgaGFuZHNoYWtlQ2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGhhbmRzaGFrZUNhbGxiYWNrKGRhdGEudXNlcik7XG4gICAgfVxuICB9O1xuXG4gIC8vSW5pdGlsaXplIGRhdGEgdXNlZCBpbiBwb21lbG8gY2xpZW50XG4gIHZhciBpbml0RGF0YSA9IGZ1bmN0aW9uKGRhdGEpe1xuICAgIGlmKCFkYXRhIHx8ICFkYXRhLnN5cykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBwb21lbG8uZGF0YSA9IHBvbWVsby5kYXRhIHx8IHt9O1xuICAgIHZhciBkaWN0ID0gZGF0YS5zeXMuZGljdDtcbiAgICB2YXIgcHJvdG9zID0gZGF0YS5zeXMucHJvdG9zO1xuXG4gICAgLy9Jbml0IGNvbXByZXNzIGRpY3RcbiAgICBpZihkaWN0KXtcbiAgICAgIHBvbWVsby5kYXRhLmRpY3QgPSBkaWN0O1xuICAgICAgcG9tZWxvLmRhdGEuYWJicnMgPSB7fTtcblxuICAgICAgZm9yKHZhciByb3V0ZSBpbiBkaWN0KXtcbiAgICAgICAgcG9tZWxvLmRhdGEuYWJicnNbZGljdFtyb3V0ZV1dID0gcm91dGU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy9Jbml0IHByb3RvYnVmIHByb3Rvc1xuICAgIGlmKHByb3Rvcyl7XG4gICAgICBwb21lbG8uZGF0YS5wcm90b3MgPSB7XG4gICAgICAgIHNlcnZlciA6IHByb3Rvcy5zZXJ2ZXIgfHwge30sXG4gICAgICAgIGNsaWVudCA6IHByb3Rvcy5jbGllbnQgfHwge31cbiAgICAgIH07XG4gICAgICBpZighIXByb3RvYnVmKXtcbiAgICAgICAgcHJvdG9idWYuaW5pdCh7ZW5jb2RlclByb3RvczogcHJvdG9zLmNsaWVudCwgZGVjb2RlclByb3RvczogcHJvdG9zLnNlcnZlcn0pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBtb2R1bGUuZXhwb3J0cyA9IHBvbWVsbztcbn0pKCk7XG4iLCIvKiBQcm90b2NvbEJ1ZmZlciBjbGllbnQgMC4xLjAqL1xuXG4vKipcbiAqIHBvbWVsby1wcm90b2J1ZlxuICogQGF1dGhvciA8emhhbmcwOTM1QGdtYWlsLmNvbT5cbiAqL1xuXG4vKipcbiAqIFByb3RvY29sIGJ1ZmZlciByb290XG4gKiBJbiBicm93c2VyLCBpdCB3aWxsIGJlIHdpbmRvdy5wcm90YnVmXG4gKi9cbihmdW5jdGlvbiAoZXhwb3J0cywgZ2xvYmFsKXtcbiAgdmFyIFByb3RvYnVmID0gZXhwb3J0cztcblxuICBQcm90b2J1Zi5pbml0ID0gZnVuY3Rpb24ob3B0cyl7XG4gICAgLy9PbiB0aGUgc2VydmVyc2lkZSwgdXNlIHNlcnZlclByb3RvcyB0byBlbmNvZGUgbWVzc2FnZXMgc2VuZCB0byBjbGllbnRcbiAgICBQcm90b2J1Zi5lbmNvZGVyLmluaXQob3B0cy5lbmNvZGVyUHJvdG9zKTtcblxuICAgIC8vT24gdGhlIHNlcnZlcnNpZGUsIHVzZXIgY2xpZW50UHJvdG9zIHRvIGRlY29kZSBtZXNzYWdlcyByZWNlaXZlIGZyb20gY2xpZW50c1xuICAgIFByb3RvYnVmLmRlY29kZXIuaW5pdChvcHRzLmRlY29kZXJQcm90b3MpO1xuICB9O1xuXG4gIFByb3RvYnVmLmVuY29kZSA9IGZ1bmN0aW9uKGtleSwgbXNnKXtcbiAgICByZXR1cm4gUHJvdG9idWYuZW5jb2Rlci5lbmNvZGUoa2V5LCBtc2cpO1xuICB9O1xuXG4gIFByb3RvYnVmLmRlY29kZSA9IGZ1bmN0aW9uKGtleSwgbXNnKXtcbiAgICByZXR1cm4gUHJvdG9idWYuZGVjb2Rlci5kZWNvZGUoa2V5LCBtc2cpO1xuICB9O1xuXG4gIC8vIGV4cG9ydHMgdG8gc3VwcG9ydCBmb3IgY29tcG9uZW50c1xuICBtb2R1bGUuZXhwb3J0cyA9IFByb3RvYnVmO1xuICBpZih0eXBlb2Yod2luZG93KSAhPSBcInVuZGVmaW5lZFwiKSB7XG4gICAgd2luZG93LnByb3RvYnVmID0gUHJvdG9idWY7XG4gIH1cblxufSkodHlwZW9mKHdpbmRvdykgPT0gXCJ1bmRlZmluZWRcIiA/IG1vZHVsZS5leHBvcnRzIDp7fSwgdGhpcyk7XG5cbi8qKlxuICogY29uc3RhbnRzXG4gKi9cbihmdW5jdGlvbiAoZXhwb3J0cywgZ2xvYmFsKXtcbiAgdmFyIGNvbnN0YW50cyA9IGV4cG9ydHMuY29uc3RhbnRzID0ge307XG5cbiAgY29uc3RhbnRzLlRZUEVTID0ge1xuICAgIHVJbnQzMiA6IDAsXG4gICAgc0ludDMyIDogMCxcbiAgICBpbnQzMiA6IDAsXG4gICAgZG91YmxlIDogMSxcbiAgICBzdHJpbmcgOiAyLFxuICAgIG1lc3NhZ2UgOiAyLFxuICAgIGZsb2F0IDogNVxuICB9O1xuXG59KSgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHByb3RvYnVmID8gcHJvdG9idWYgOiBtb2R1bGUuZXhwb3J0cywgdGhpcyk7XG5cbi8qKlxuICogdXRpbCBtb2R1bGVcbiAqL1xuKGZ1bmN0aW9uIChleHBvcnRzLCBnbG9iYWwpe1xuXG4gIHZhciBVdGlsID0gZXhwb3J0cy51dGlsID0ge307XG5cbiAgVXRpbC5pc1NpbXBsZVR5cGUgPSBmdW5jdGlvbih0eXBlKXtcbiAgICByZXR1cm4gKCB0eXBlID09PSAndUludDMyJyB8fFxuICAgICAgICAgICAgIHR5cGUgPT09ICdzSW50MzInIHx8XG4gICAgICAgICAgICAgdHlwZSA9PT0gJ2ludDMyJyAgfHxcbiAgICAgICAgICAgICB0eXBlID09PSAndUludDY0JyB8fFxuICAgICAgICAgICAgIHR5cGUgPT09ICdzSW50NjQnIHx8XG4gICAgICAgICAgICAgdHlwZSA9PT0gJ2Zsb2F0JyAgfHxcbiAgICAgICAgICAgICB0eXBlID09PSAnZG91YmxlJyApO1xuICB9O1xuXG59KSgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHByb3RvYnVmID8gcHJvdG9idWYgOiBtb2R1bGUuZXhwb3J0cywgdGhpcyk7XG5cbi8qKlxuICogY29kZWMgbW9kdWxlXG4gKi9cbihmdW5jdGlvbiAoZXhwb3J0cywgZ2xvYmFsKXtcblxuICB2YXIgQ29kZWMgPSBleHBvcnRzLmNvZGVjID0ge307XG5cbiAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcig4KTtcbiAgdmFyIGZsb2F0MzJBcnJheSA9IG5ldyBGbG9hdDMyQXJyYXkoYnVmZmVyKTtcbiAgdmFyIGZsb2F0NjRBcnJheSA9IG5ldyBGbG9hdDY0QXJyYXkoYnVmZmVyKTtcbiAgdmFyIHVJbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXIpO1xuXG4gIENvZGVjLmVuY29kZVVJbnQzMiA9IGZ1bmN0aW9uKG4pe1xuICAgIHZhciBuID0gcGFyc2VJbnQobik7XG4gICAgaWYoaXNOYU4obikgfHwgbiA8IDApe1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IFtdO1xuICAgIGRve1xuICAgICAgdmFyIHRtcCA9IG4gJSAxMjg7XG4gICAgICB2YXIgbmV4dCA9IE1hdGguZmxvb3Iobi8xMjgpO1xuXG4gICAgICBpZihuZXh0ICE9PSAwKXtcbiAgICAgICAgdG1wID0gdG1wICsgMTI4O1xuICAgICAgfVxuICAgICAgcmVzdWx0LnB1c2godG1wKTtcbiAgICAgIG4gPSBuZXh0O1xuICAgIH13aGlsZShuICE9PSAwKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgQ29kZWMuZW5jb2RlU0ludDMyID0gZnVuY3Rpb24obil7XG4gICAgdmFyIG4gPSBwYXJzZUludChuKTtcbiAgICBpZihpc05hTihuKSl7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgbiA9IG48MD8oTWF0aC5hYnMobikqMi0xKTpuKjI7XG5cbiAgICByZXR1cm4gQ29kZWMuZW5jb2RlVUludDMyKG4pO1xuICB9O1xuXG4gIENvZGVjLmRlY29kZVVJbnQzMiA9IGZ1bmN0aW9uKGJ5dGVzKXtcbiAgICB2YXIgbiA9IDA7XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpKyspe1xuICAgICAgdmFyIG0gPSBwYXJzZUludChieXRlc1tpXSk7XG4gICAgICBuID0gbiArICgobSAmIDB4N2YpICogTWF0aC5wb3coMiwoNyppKSkpO1xuICAgICAgaWYobSA8IDEyOCl7XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuO1xuICB9O1xuXG5cbiAgQ29kZWMuZGVjb2RlU0ludDMyID0gZnVuY3Rpb24oYnl0ZXMpe1xuICAgIHZhciBuID0gdGhpcy5kZWNvZGVVSW50MzIoYnl0ZXMpO1xuICAgIHZhciBmbGFnID0gKChuJTIpID09PSAxKT8tMToxO1xuXG4gICAgbiA9ICgobiUyICsgbikvMikqZmxhZztcblxuICAgIHJldHVybiBuO1xuICB9O1xuXG4gIENvZGVjLmVuY29kZUZsb2F0ID0gZnVuY3Rpb24oZmxvYXQpe1xuICAgIGZsb2F0MzJBcnJheVswXSA9IGZsb2F0O1xuICAgIHJldHVybiB1SW50OEFycmF5O1xuICB9O1xuXG4gIENvZGVjLmRlY29kZUZsb2F0ID0gZnVuY3Rpb24oYnl0ZXMsIG9mZnNldCl7XG4gICAgaWYoIWJ5dGVzIHx8IGJ5dGVzLmxlbmd0aCA8IChvZmZzZXQgKzQpKXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCA0OyBpKyspe1xuICAgICAgdUludDhBcnJheVtpXSA9IGJ5dGVzW29mZnNldCArIGldO1xuICAgIH1cblxuICAgIHJldHVybiBmbG9hdDMyQXJyYXlbMF07XG4gIH07XG5cbiAgQ29kZWMuZW5jb2RlRG91YmxlID0gZnVuY3Rpb24oZG91YmxlKXtcbiAgICBmbG9hdDY0QXJyYXlbMF0gPSBkb3VibGU7XG4gICAgcmV0dXJuIHVJbnQ4QXJyYXkuc3ViYXJyYXkoMCwgOCk7XG4gIH07XG5cbiAgQ29kZWMuZGVjb2RlRG91YmxlID0gZnVuY3Rpb24oYnl0ZXMsIG9mZnNldCl7XG4gICAgaWYoIWJ5dGVzIHx8IGJ5dGVzLmxlbmd0aCA8ICg4ICsgb2Zmc2V0KSl7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgODsgaSsrKXtcbiAgICAgIHVJbnQ4QXJyYXlbaV0gPSBieXRlc1tvZmZzZXQgKyBpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZmxvYXQ2NEFycmF5WzBdO1xuICB9O1xuXG4gIENvZGVjLmVuY29kZVN0ciA9IGZ1bmN0aW9uKGJ5dGVzLCBvZmZzZXQsIHN0cil7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKyl7XG4gICAgICB2YXIgY29kZSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgdmFyIGNvZGVzID0gZW5jb2RlMlVURjgoY29kZSk7XG5cbiAgICAgIGZvcih2YXIgaiA9IDA7IGogPCBjb2Rlcy5sZW5ndGg7IGorKyl7XG4gICAgICAgIGJ5dGVzW29mZnNldF0gPSBjb2Rlc1tqXTtcbiAgICAgICAgb2Zmc2V0Kys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfTtcblxuICAvKipcbiAgICogRGVjb2RlIHN0cmluZyBmcm9tIHV0ZjggYnl0ZXNcbiAgICovXG4gIENvZGVjLmRlY29kZVN0ciA9IGZ1bmN0aW9uKGJ5dGVzLCBvZmZzZXQsIGxlbmd0aCl7XG4gICAgdmFyIGFycmF5ID0gW107XG4gICAgdmFyIGVuZCA9IG9mZnNldCArIGxlbmd0aDtcblxuICAgIHdoaWxlKG9mZnNldCA8IGVuZCl7XG4gICAgICB2YXIgY29kZSA9IDA7XG5cbiAgICAgIGlmKGJ5dGVzW29mZnNldF0gPCAxMjgpe1xuICAgICAgICBjb2RlID0gYnl0ZXNbb2Zmc2V0XTtcblxuICAgICAgICBvZmZzZXQgKz0gMTtcbiAgICAgIH1lbHNlIGlmKGJ5dGVzW29mZnNldF0gPCAyMjQpe1xuICAgICAgICBjb2RlID0gKChieXRlc1tvZmZzZXRdICYgMHgzZik8PDYpICsgKGJ5dGVzW29mZnNldCsxXSAmIDB4M2YpO1xuICAgICAgICBvZmZzZXQgKz0gMjtcbiAgICAgIH1lbHNle1xuICAgICAgICBjb2RlID0gKChieXRlc1tvZmZzZXRdICYgMHgwZik8PDEyKSArICgoYnl0ZXNbb2Zmc2V0KzFdICYgMHgzZik8PDYpICsgKGJ5dGVzW29mZnNldCsyXSAmIDB4M2YpO1xuICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgIH1cblxuICAgICAgYXJyYXkucHVzaChjb2RlKTtcblxuICAgIH1cblxuICAgIHZhciBzdHIgPSAnJztcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyl7XG4gICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBhcnJheS5zbGljZShpLCBpICsgMTAwMDApKTtcbiAgICAgIGkgKz0gMTAwMDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cjtcbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJuIHRoZSBieXRlIGxlbmd0aCBvZiB0aGUgc3RyIHVzZSB1dGY4XG4gICAqL1xuICBDb2RlYy5ieXRlTGVuZ3RoID0gZnVuY3Rpb24oc3RyKXtcbiAgICBpZih0eXBlb2Yoc3RyKSAhPT0gJ3N0cmluZycpe1xuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cblxuICAgIHZhciBsZW5ndGggPSAwO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKyl7XG4gICAgICB2YXIgY29kZSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgbGVuZ3RoICs9IGNvZGVMZW5ndGgoY29kZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGxlbmd0aDtcbiAgfTtcblxuICAvKipcbiAgICogRW5jb2RlIGEgdW5pY29kZTE2IGNoYXIgY29kZSB0byB1dGY4IGJ5dGVzXG4gICAqL1xuICBmdW5jdGlvbiBlbmNvZGUyVVRGOChjaGFyQ29kZSl7XG4gICAgaWYoY2hhckNvZGUgPD0gMHg3Zil7XG4gICAgICByZXR1cm4gW2NoYXJDb2RlXTtcbiAgICB9ZWxzZSBpZihjaGFyQ29kZSA8PSAweDdmZil7XG4gICAgICByZXR1cm4gWzB4YzB8KGNoYXJDb2RlPj42KSwgMHg4MHwoY2hhckNvZGUgJiAweDNmKV07XG4gICAgfWVsc2V7XG4gICAgICByZXR1cm4gWzB4ZTB8KGNoYXJDb2RlPj4xMiksIDB4ODB8KChjaGFyQ29kZSAmIDB4ZmMwKT4+NiksIDB4ODB8KGNoYXJDb2RlICYgMHgzZildO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGNvZGVMZW5ndGgoY29kZSl7XG4gICAgaWYoY29kZSA8PSAweDdmKXtcbiAgICAgIHJldHVybiAxO1xuICAgIH1lbHNlIGlmKGNvZGUgPD0gMHg3ZmYpe1xuICAgICAgcmV0dXJuIDI7XG4gICAgfWVsc2V7XG4gICAgICByZXR1cm4gMztcbiAgICB9XG4gIH1cbn0pKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcHJvdG9idWYgPyBwcm90b2J1ZiA6IG1vZHVsZS5leHBvcnRzLCB0aGlzKTtcblxuLyoqXG4gKiBlbmNvZGVyIG1vZHVsZVxuICovXG4oZnVuY3Rpb24gKGV4cG9ydHMsIGdsb2JhbCl7XG5cbiAgdmFyIHByb3RvYnVmID0gZXhwb3J0cztcbiAgdmFyIE1zZ0VuY29kZXIgPSBleHBvcnRzLmVuY29kZXIgPSB7fTtcblxuICB2YXIgY29kZWMgPSBwcm90b2J1Zi5jb2RlYztcbiAgdmFyIGNvbnN0YW50ID0gcHJvdG9idWYuY29uc3RhbnRzO1xuICB2YXIgdXRpbCA9IHByb3RvYnVmLnV0aWw7XG5cbiAgTXNnRW5jb2Rlci5pbml0ID0gZnVuY3Rpb24ocHJvdG9zKXtcbiAgICB0aGlzLnByb3RvcyA9IHByb3RvcyB8fCB7fTtcbiAgfTtcblxuICBNc2dFbmNvZGVyLmVuY29kZSA9IGZ1bmN0aW9uKHJvdXRlLCBtc2cpe1xuICAgIC8vR2V0IHByb3RvcyBmcm9tIHByb3RvcyBtYXAgdXNlIHRoZSByb3V0ZSBhcyBrZXlcbiAgICB2YXIgcHJvdG9zID0gdGhpcy5wcm90b3Nbcm91dGVdO1xuXG4gICAgLy9DaGVjayBtc2dcbiAgICBpZighY2hlY2tNc2cobXNnLCBwcm90b3MpKXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vU2V0IHRoZSBsZW5ndGggb2YgdGhlIGJ1ZmZlciAyIHRpbWVzIGJpZ2dlciB0byBwcmV2ZW50IG92ZXJmbG93XG4gICAgdmFyIGxlbmd0aCA9IGNvZGVjLmJ5dGVMZW5ndGgoSlNPTi5zdHJpbmdpZnkobXNnKSk7XG5cbiAgICAvL0luaXQgYnVmZmVyIGFuZCBvZmZzZXRcbiAgICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGxlbmd0aCk7XG4gICAgdmFyIHVJbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgIHZhciBvZmZzZXQgPSAwO1xuXG4gICAgaWYoISFwcm90b3Mpe1xuICAgICAgb2Zmc2V0ID0gZW5jb2RlTXNnKHVJbnQ4QXJyYXksIG9mZnNldCwgcHJvdG9zLCBtc2cpO1xuICAgICAgaWYob2Zmc2V0ID4gMCl7XG4gICAgICAgIHJldHVybiB1SW50OEFycmF5LnN1YmFycmF5KDAsIG9mZnNldCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH07XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoZSBtc2cgZm9sbG93IHRoZSBkZWZpbmF0aW9uIGluIHRoZSBwcm90b3NcbiAgICovXG4gIGZ1bmN0aW9uIGNoZWNrTXNnKG1zZywgcHJvdG9zKXtcbiAgICBpZighcHJvdG9zKXtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IodmFyIG5hbWUgaW4gcHJvdG9zKXtcbiAgICAgIHZhciBwcm90byA9IHByb3Rvc1tuYW1lXTtcblxuICAgICAgLy9BbGwgcmVxdWlyZWQgZWxlbWVudCBtdXN0IGV4aXN0XG4gICAgICBzd2l0Y2gocHJvdG8ub3B0aW9uKXtcbiAgICAgICAgY2FzZSAncmVxdWlyZWQnIDpcbiAgICAgICAgICBpZih0eXBlb2YobXNnW25hbWVdKSA9PT0gJ3VuZGVmaW5lZCcpe1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgY2FzZSAnb3B0aW9uYWwnIDpcbiAgICAgICAgICBpZih0eXBlb2YobXNnW25hbWVdKSAhPT0gJ3VuZGVmaW5lZCcpe1xuICAgICAgICAgICAgaWYoISFwcm90b3MuX19tZXNzYWdlc1twcm90by50eXBlXSl7XG4gICAgICAgICAgICAgIGNoZWNrTXNnKG1zZ1tuYW1lXSwgcHJvdG9zLl9fbWVzc2FnZXNbcHJvdG8udHlwZV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3JlcGVhdGVkJyA6XG4gICAgICAgICAgLy9DaGVjayBuZXN0IG1lc3NhZ2UgaW4gcmVwZWF0ZWQgZWxlbWVudHNcbiAgICAgICAgICBpZighIW1zZ1tuYW1lXSAmJiAhIXByb3Rvcy5fX21lc3NhZ2VzW3Byb3RvLnR5cGVdKXtcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBtc2dbbmFtZV0ubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgICBpZighY2hlY2tNc2cobXNnW25hbWVdW2ldLCBwcm90b3MuX19tZXNzYWdlc1twcm90by50eXBlXSkpe1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVNc2coYnVmZmVyLCBvZmZzZXQsIHByb3RvcywgbXNnKXtcbiAgICBmb3IodmFyIG5hbWUgaW4gbXNnKXtcbiAgICAgIGlmKCEhcHJvdG9zW25hbWVdKXtcbiAgICAgICAgdmFyIHByb3RvID0gcHJvdG9zW25hbWVdO1xuXG4gICAgICAgIHN3aXRjaChwcm90by5vcHRpb24pe1xuICAgICAgICAgIGNhc2UgJ3JlcXVpcmVkJyA6XG4gICAgICAgICAgY2FzZSAnb3B0aW9uYWwnIDpcbiAgICAgICAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGVuY29kZVRhZyhwcm90by50eXBlLCBwcm90by50YWcpKTtcbiAgICAgICAgICAgIG9mZnNldCA9IGVuY29kZVByb3AobXNnW25hbWVdLCBwcm90by50eXBlLCBvZmZzZXQsIGJ1ZmZlciwgcHJvdG9zKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdyZXBlYXRlZCcgOlxuICAgICAgICAgICAgaWYobXNnW25hbWVdLmxlbmd0aCA+IDApe1xuICAgICAgICAgICAgICBvZmZzZXQgPSBlbmNvZGVBcnJheShtc2dbbmFtZV0sIHByb3RvLCBvZmZzZXQsIGJ1ZmZlciwgcHJvdG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICBmdW5jdGlvbiBlbmNvZGVQcm9wKHZhbHVlLCB0eXBlLCBvZmZzZXQsIGJ1ZmZlciwgcHJvdG9zKXtcbiAgICBzd2l0Y2godHlwZSl7XG4gICAgICBjYXNlICd1SW50MzInOlxuICAgICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVVSW50MzIodmFsdWUpKTtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnaW50MzInIDpcbiAgICAgIGNhc2UgJ3NJbnQzMic6XG4gICAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZVNJbnQzMih2YWx1ZSkpO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdmbG9hdCc6XG4gICAgICAgIHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZUZsb2F0KHZhbHVlKSk7XG4gICAgICAgIG9mZnNldCArPSA0O1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkb3VibGUnOlxuICAgICAgICB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVEb3VibGUodmFsdWUpKTtcbiAgICAgICAgb2Zmc2V0ICs9IDg7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIHZhciBsZW5ndGggPSBjb2RlYy5ieXRlTGVuZ3RoKHZhbHVlKTtcblxuICAgICAgICAvL0VuY29kZSBsZW5ndGhcbiAgICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlVUludDMyKGxlbmd0aCkpO1xuICAgICAgICAvL3dyaXRlIHN0cmluZ1xuICAgICAgICBjb2RlYy5lbmNvZGVTdHIoYnVmZmVyLCBvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgb2Zmc2V0ICs9IGxlbmd0aDtcbiAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdCA6XG4gICAgICAgIGlmKCEhcHJvdG9zLl9fbWVzc2FnZXNbdHlwZV0pe1xuICAgICAgICAgIC8vVXNlIGEgdG1wIGJ1ZmZlciB0byBidWlsZCBhbiBpbnRlcm5hbCBtc2dcbiAgICAgICAgICB2YXIgdG1wQnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKGNvZGVjLmJ5dGVMZW5ndGgoSlNPTi5zdHJpbmdpZnkodmFsdWUpKSk7XG4gICAgICAgICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICAgICAgICBsZW5ndGggPSBlbmNvZGVNc2codG1wQnVmZmVyLCBsZW5ndGgsIHByb3Rvcy5fX21lc3NhZ2VzW3R5cGVdLCB2YWx1ZSk7XG4gICAgICAgICAgLy9FbmNvZGUgbGVuZ3RoXG4gICAgICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlVUludDMyKGxlbmd0aCkpO1xuICAgICAgICAgIC8vY29udGFjdCB0aGUgb2JqZWN0XG4gICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGJ1ZmZlcltvZmZzZXRdID0gdG1wQnVmZmVyW2ldO1xuICAgICAgICAgICAgb2Zmc2V0Kys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIEVuY29kZSByZWFwZWF0ZWQgcHJvcGVydGllcywgc2ltcGxlIG1zZyBhbmQgb2JqZWN0IGFyZSBkZWNvZGUgZGlmZmVyZW50ZWRcbiAgICovXG4gIGZ1bmN0aW9uIGVuY29kZUFycmF5KGFycmF5LCBwcm90bywgb2Zmc2V0LCBidWZmZXIsIHByb3Rvcyl7XG4gICAgdmFyIGkgPSAwO1xuXG4gICAgaWYodXRpbC5pc1NpbXBsZVR5cGUocHJvdG8udHlwZSkpe1xuICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgZW5jb2RlVGFnKHByb3RvLnR5cGUsIHByb3RvLnRhZykpO1xuICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlVUludDMyKGFycmF5Lmxlbmd0aCkpO1xuICAgICAgZm9yKGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspe1xuICAgICAgICBvZmZzZXQgPSBlbmNvZGVQcm9wKGFycmF5W2ldLCBwcm90by50eXBlLCBvZmZzZXQsIGJ1ZmZlcik7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKyl7XG4gICAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGVuY29kZVRhZyhwcm90by50eXBlLCBwcm90by50YWcpKTtcbiAgICAgICAgb2Zmc2V0ID0gZW5jb2RlUHJvcChhcnJheVtpXSwgcHJvdG8udHlwZSwgb2Zmc2V0LCBidWZmZXIsIHByb3Rvcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGJ5dGVzKXtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpKyssIG9mZnNldCsrKXtcbiAgICAgIGJ1ZmZlcltvZmZzZXRdID0gYnl0ZXNbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZVRhZyh0eXBlLCB0YWcpe1xuICAgIHZhciB2YWx1ZSA9IGNvbnN0YW50LlRZUEVTW3R5cGVdfHwyO1xuICAgIHJldHVybiBjb2RlYy5lbmNvZGVVSW50MzIoKHRhZzw8Myl8dmFsdWUpO1xuICB9XG59KSgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHByb3RvYnVmID8gcHJvdG9idWYgOiBtb2R1bGUuZXhwb3J0cywgdGhpcyk7XG5cbi8qKlxuICogZGVjb2RlciBtb2R1bGVcbiAqL1xuKGZ1bmN0aW9uIChleHBvcnRzLCBnbG9iYWwpe1xuICB2YXIgcHJvdG9idWYgPSBleHBvcnRzO1xuICB2YXIgTXNnRGVjb2RlciA9IGV4cG9ydHMuZGVjb2RlciA9IHt9O1xuXG4gIHZhciBjb2RlYyA9IHByb3RvYnVmLmNvZGVjO1xuICB2YXIgdXRpbCA9IHByb3RvYnVmLnV0aWw7XG5cbiAgdmFyIGJ1ZmZlcjtcbiAgdmFyIG9mZnNldCA9IDA7XG5cbiAgTXNnRGVjb2Rlci5pbml0ID0gZnVuY3Rpb24ocHJvdG9zKXtcbiAgICB0aGlzLnByb3RvcyA9IHByb3RvcyB8fCB7fTtcbiAgfTtcblxuICBNc2dEZWNvZGVyLnNldFByb3RvcyA9IGZ1bmN0aW9uKHByb3Rvcyl7XG4gICAgaWYoISFwcm90b3Mpe1xuICAgICAgdGhpcy5wcm90b3MgPSBwcm90b3M7XG4gICAgfVxuICB9O1xuXG4gIE1zZ0RlY29kZXIuZGVjb2RlID0gZnVuY3Rpb24ocm91dGUsIGJ1Zil7XG4gICAgdmFyIHByb3RvcyA9IHRoaXMucHJvdG9zW3JvdXRlXTtcblxuICAgIGJ1ZmZlciA9IGJ1ZjtcbiAgICBvZmZzZXQgPSAwO1xuXG4gICAgaWYoISFwcm90b3Mpe1xuICAgICAgcmV0dXJuIGRlY29kZU1zZyh7fSwgcHJvdG9zLCBidWZmZXIubGVuZ3RoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfTtcblxuICBmdW5jdGlvbiBkZWNvZGVNc2cobXNnLCBwcm90b3MsIGxlbmd0aCl7XG4gICAgd2hpbGUob2Zmc2V0PGxlbmd0aCl7XG4gICAgICB2YXIgaGVhZCA9IGdldEhlYWQoKTtcbiAgICAgIHZhciB0eXBlID0gaGVhZC50eXBlO1xuICAgICAgdmFyIHRhZyA9IGhlYWQudGFnO1xuICAgICAgdmFyIG5hbWUgPSBwcm90b3MuX190YWdzW3RhZ107XG5cbiAgICAgIHN3aXRjaChwcm90b3NbbmFtZV0ub3B0aW9uKXtcbiAgICAgICAgY2FzZSAnb3B0aW9uYWwnIDpcbiAgICAgICAgY2FzZSAncmVxdWlyZWQnIDpcbiAgICAgICAgICBtc2dbbmFtZV0gPSBkZWNvZGVQcm9wKHByb3Rvc1tuYW1lXS50eXBlLCBwcm90b3MpO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAncmVwZWF0ZWQnIDpcbiAgICAgICAgICBpZighbXNnW25hbWVdKXtcbiAgICAgICAgICAgIG1zZ1tuYW1lXSA9IFtdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkZWNvZGVBcnJheShtc2dbbmFtZV0sIHByb3Rvc1tuYW1lXS50eXBlLCBwcm90b3MpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbXNnO1xuICB9XG5cbiAgLyoqXG4gICAqIFRlc3QgaWYgdGhlIGdpdmVuIG1zZyBpcyBmaW5pc2hlZFxuICAgKi9cbiAgZnVuY3Rpb24gaXNGaW5pc2gobXNnLCBwcm90b3Mpe1xuICAgIHJldHVybiAoIXByb3Rvcy5fX3RhZ3NbcGVla0hlYWQoKS50YWddKTtcbiAgfVxuICAvKipcbiAgICogR2V0IHByb3BlcnR5IGhlYWQgZnJvbSBwcm90b2J1ZlxuICAgKi9cbiAgZnVuY3Rpb24gZ2V0SGVhZCgpe1xuICAgIHZhciB0YWcgPSBjb2RlYy5kZWNvZGVVSW50MzIoZ2V0Qnl0ZXMoKSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdHlwZSA6IHRhZyYweDcsXG4gICAgICB0YWcgOiB0YWc+PjNcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0YWcgaGVhZCB3aXRob3V0IG1vdmUgdGhlIG9mZnNldFxuICAgKi9cbiAgZnVuY3Rpb24gcGVla0hlYWQoKXtcbiAgICB2YXIgdGFnID0gY29kZWMuZGVjb2RlVUludDMyKHBlZWtCeXRlcygpKTtcblxuICAgIHJldHVybiB7XG4gICAgICB0eXBlIDogdGFnJjB4NyxcbiAgICAgIHRhZyA6IHRhZz4+M1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVQcm9wKHR5cGUsIHByb3Rvcyl7XG4gICAgc3dpdGNoKHR5cGUpe1xuICAgICAgY2FzZSAndUludDMyJzpcbiAgICAgICAgcmV0dXJuIGNvZGVjLmRlY29kZVVJbnQzMihnZXRCeXRlcygpKTtcbiAgICAgIGNhc2UgJ2ludDMyJyA6XG4gICAgICBjYXNlICdzSW50MzInIDpcbiAgICAgICAgcmV0dXJuIGNvZGVjLmRlY29kZVNJbnQzMihnZXRCeXRlcygpKTtcbiAgICAgIGNhc2UgJ2Zsb2F0JyA6XG4gICAgICAgIHZhciBmbG9hdCA9IGNvZGVjLmRlY29kZUZsb2F0KGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IDQ7XG4gICAgICAgIHJldHVybiBmbG9hdDtcbiAgICAgIGNhc2UgJ2RvdWJsZScgOlxuICAgICAgICB2YXIgZG91YmxlID0gY29kZWMuZGVjb2RlRG91YmxlKGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICAgICAgb2Zmc2V0ICs9IDg7XG4gICAgICAgIHJldHVybiBkb3VibGU7XG4gICAgICBjYXNlICdzdHJpbmcnIDpcbiAgICAgICAgdmFyIGxlbmd0aCA9IGNvZGVjLmRlY29kZVVJbnQzMihnZXRCeXRlcygpKTtcblxuICAgICAgICB2YXIgc3RyID0gIGNvZGVjLmRlY29kZVN0cihidWZmZXIsIG9mZnNldCwgbGVuZ3RoKTtcbiAgICAgICAgb2Zmc2V0ICs9IGxlbmd0aDtcblxuICAgICAgICByZXR1cm4gc3RyO1xuICAgICAgZGVmYXVsdCA6XG4gICAgICAgIGlmKCEhcHJvdG9zICYmICEhcHJvdG9zLl9fbWVzc2FnZXNbdHlwZV0pe1xuICAgICAgICAgIHZhciBsZW5ndGggPSBjb2RlYy5kZWNvZGVVSW50MzIoZ2V0Qnl0ZXMoKSk7XG4gICAgICAgICAgdmFyIG1zZyA9IHt9O1xuICAgICAgICAgIGRlY29kZU1zZyhtc2csIHByb3Rvcy5fX21lc3NhZ2VzW3R5cGVdLCBvZmZzZXQrbGVuZ3RoKTtcbiAgICAgICAgICByZXR1cm4gbXNnO1xuICAgICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkZWNvZGVBcnJheShhcnJheSwgdHlwZSwgcHJvdG9zKXtcbiAgICBpZih1dGlsLmlzU2ltcGxlVHlwZSh0eXBlKSl7XG4gICAgICB2YXIgbGVuZ3RoID0gY29kZWMuZGVjb2RlVUludDMyKGdldEJ5dGVzKCkpO1xuXG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgICAgICBhcnJheS5wdXNoKGRlY29kZVByb3AodHlwZSkpO1xuICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgYXJyYXkucHVzaChkZWNvZGVQcm9wKHR5cGUsIHByb3RvcykpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEJ5dGVzKGZsYWcpe1xuICAgIHZhciBieXRlcyA9IFtdO1xuICAgIHZhciBwb3MgPSBvZmZzZXQ7XG4gICAgZmxhZyA9IGZsYWcgfHwgZmFsc2U7XG5cbiAgICB2YXIgYjtcblxuICAgIGRve1xuICAgICAgYiA9IGJ1ZmZlcltwb3NdO1xuICAgICAgYnl0ZXMucHVzaChiKTtcbiAgICAgIHBvcysrO1xuICAgIH13aGlsZShiID49IDEyOCk7XG5cbiAgICBpZighZmxhZyl7XG4gICAgICBvZmZzZXQgPSBwb3M7XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHBlZWtCeXRlcygpe1xuICAgIHJldHVybiBnZXRCeXRlcyh0cnVlKTtcbiAgfVxuXG59KSgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHByb3RvYnVmID8gcHJvdG9idWYgOiBtb2R1bGUuZXhwb3J0cywgdGhpcyk7XG5cbiIsIihmdW5jdGlvbiAoZXhwb3J0cywgQnl0ZUFycmF5LCBnbG9iYWwpIHtcbiAgdmFyIFByb3RvY29sID0gZXhwb3J0cztcblxuICB2YXIgUEtHX0hFQURfQllURVMgPSA0O1xuICB2YXIgTVNHX0ZMQUdfQllURVMgPSAxO1xuICB2YXIgTVNHX1JPVVRFX0NPREVfQllURVMgPSAyO1xuICB2YXIgTVNHX0lEX01BWF9CWVRFUyA9IDU7XG4gIHZhciBNU0dfUk9VVEVfTEVOX0JZVEVTID0gMTtcblxuICB2YXIgTVNHX1JPVVRFX0NPREVfTUFYID0gMHhmZmZmO1xuXG4gIHZhciBNU0dfQ09NUFJFU1NfUk9VVEVfTUFTSyA9IDB4MTtcbiAgdmFyIE1TR19UWVBFX01BU0sgPSAweDc7XG5cbiAgdmFyIFBhY2thZ2UgPSBQcm90b2NvbC5QYWNrYWdlID0ge307XG4gIHZhciBNZXNzYWdlID0gUHJvdG9jb2wuTWVzc2FnZSA9IHt9O1xuXG4gIFBhY2thZ2UuVFlQRV9IQU5EU0hBS0UgPSAxO1xuICBQYWNrYWdlLlRZUEVfSEFORFNIQUtFX0FDSyA9IDI7XG4gIFBhY2thZ2UuVFlQRV9IRUFSVEJFQVQgPSAzO1xuICBQYWNrYWdlLlRZUEVfREFUQSA9IDQ7XG4gIFBhY2thZ2UuVFlQRV9LSUNLID0gNTtcblxuICBNZXNzYWdlLlRZUEVfUkVRVUVTVCA9IDA7XG4gIE1lc3NhZ2UuVFlQRV9OT1RJRlkgPSAxO1xuICBNZXNzYWdlLlRZUEVfUkVTUE9OU0UgPSAyO1xuICBNZXNzYWdlLlRZUEVfUFVTSCA9IDM7XG5cbiAgLyoqXG4gICAqIHBvbWVsZSBjbGllbnQgZW5jb2RlXG4gICAqIGlkIG1lc3NhZ2UgaWQ7XG4gICAqIHJvdXRlIG1lc3NhZ2Ugcm91dGVcbiAgICogbXNnIG1lc3NhZ2UgYm9keVxuICAgKiBzb2NrZXRpbyBjdXJyZW50IHN1cHBvcnQgc3RyaW5nXG4gICAqL1xuICBQcm90b2NvbC5zdHJlbmNvZGUgPSBmdW5jdGlvbihzdHIpIHtcbiAgICB2YXIgYnl0ZUFycmF5ID0gbmV3IEJ5dGVBcnJheShzdHIubGVuZ3RoICogMyk7XG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKyl7XG4gICAgICB2YXIgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgIHZhciBjb2RlcyA9IG51bGw7XG4gICAgICBpZihjaGFyQ29kZSA8PSAweDdmKXtcbiAgICAgICAgY29kZXMgPSBbY2hhckNvZGVdO1xuICAgICAgfWVsc2UgaWYoY2hhckNvZGUgPD0gMHg3ZmYpe1xuICAgICAgICBjb2RlcyA9IFsweGMwfChjaGFyQ29kZT4+NiksIDB4ODB8KGNoYXJDb2RlICYgMHgzZildO1xuICAgICAgfWVsc2V7XG4gICAgICAgIGNvZGVzID0gWzB4ZTB8KGNoYXJDb2RlPj4xMiksIDB4ODB8KChjaGFyQ29kZSAmIDB4ZmMwKT4+NiksIDB4ODB8KGNoYXJDb2RlICYgMHgzZildO1xuICAgICAgfVxuICAgICAgZm9yKHZhciBqID0gMDsgaiA8IGNvZGVzLmxlbmd0aDsgaisrKXtcbiAgICAgICAgYnl0ZUFycmF5W29mZnNldF0gPSBjb2Rlc1tqXTtcbiAgICAgICAgKytvZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBfYnVmZmVyID0gbmV3IEJ5dGVBcnJheShvZmZzZXQpO1xuICAgIGNvcHlBcnJheShfYnVmZmVyLCAwLCBieXRlQXJyYXksIDAsIG9mZnNldCk7XG4gICAgcmV0dXJuIF9idWZmZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIGNsaWVudCBkZWNvZGVcbiAgICogbXNnIFN0cmluZyBkYXRhXG4gICAqIHJldHVybiBNZXNzYWdlIE9iamVjdFxuICAgKi9cbiAgUHJvdG9jb2wuc3RyZGVjb2RlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgdmFyIGJ5dGVzID0gbmV3IEJ5dGVBcnJheShidWZmZXIpO1xuICAgIHZhciBhcnJheSA9IFtdO1xuICAgIHZhciBvZmZzZXQgPSAwO1xuICAgIHZhciBjaGFyQ29kZSA9IDA7XG4gICAgdmFyIGVuZCA9IGJ5dGVzLmxlbmd0aDtcbiAgICB3aGlsZShvZmZzZXQgPCBlbmQpe1xuICAgICAgaWYoYnl0ZXNbb2Zmc2V0XSA8IDEyOCl7XG4gICAgICAgIGNoYXJDb2RlID0gYnl0ZXNbb2Zmc2V0XTtcbiAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICB9ZWxzZSBpZihieXRlc1tvZmZzZXRdIDwgMjI0KXtcbiAgICAgICAgY2hhckNvZGUgPSAoKGJ5dGVzW29mZnNldF0gJiAweDNmKTw8NikgKyAoYnl0ZXNbb2Zmc2V0KzFdICYgMHgzZik7XG4gICAgICAgIG9mZnNldCArPSAyO1xuICAgICAgfWVsc2V7XG4gICAgICAgIGNoYXJDb2RlID0gKChieXRlc1tvZmZzZXRdICYgMHgwZik8PDEyKSArICgoYnl0ZXNbb2Zmc2V0KzFdICYgMHgzZik8PDYpICsgKGJ5dGVzW29mZnNldCsyXSAmIDB4M2YpO1xuICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgIH1cbiAgICAgIGFycmF5LnB1c2goY2hhckNvZGUpO1xuICAgIH1cbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBhcnJheSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhY2thZ2UgcHJvdG9jb2wgZW5jb2RlLlxuICAgKlxuICAgKiBQb21lbG8gcGFja2FnZSBmb3JtYXQ6XG4gICAqICstLS0tLS0rLS0tLS0tLS0tLS0tLSstLS0tLS0tLS0tLS0tLS0tLS0rXG4gICAqIHwgdHlwZSB8IGJvZHkgbGVuZ3RoIHwgICAgICAgYm9keSAgICAgICB8XG4gICAqICstLS0tLS0rLS0tLS0tLS0tLS0tLSstLS0tLS0tLS0tLS0tLS0tLS0rXG4gICAqXG4gICAqIEhlYWQ6IDRieXRlc1xuICAgKiAgIDA6IHBhY2thZ2UgdHlwZSxcbiAgICogICAgICAxIC0gaGFuZHNoYWtlLFxuICAgKiAgICAgIDIgLSBoYW5kc2hha2UgYWNrLFxuICAgKiAgICAgIDMgLSBoZWFydGJlYXQsXG4gICAqICAgICAgNCAtIGRhdGFcbiAgICogICAgICA1IC0ga2lja1xuICAgKiAgIDEgLSAzOiBiaWctZW5kaWFuIGJvZHkgbGVuZ3RoXG4gICAqIEJvZHk6IGJvZHkgbGVuZ3RoIGJ5dGVzXG4gICAqXG4gICAqIEBwYXJhbSAge051bWJlcn0gICAgdHlwZSAgIHBhY2thZ2UgdHlwZVxuICAgKiBAcGFyYW0gIHtCeXRlQXJyYXl9IGJvZHkgICBib2R5IGNvbnRlbnQgaW4gYnl0ZXNcbiAgICogQHJldHVybiB7Qnl0ZUFycmF5fSAgICAgICAgbmV3IGJ5dGUgYXJyYXkgdGhhdCBjb250YWlucyBlbmNvZGUgcmVzdWx0XG4gICAqL1xuICBQYWNrYWdlLmVuY29kZSA9IGZ1bmN0aW9uKHR5cGUsIGJvZHkpe1xuICAgIHZhciBsZW5ndGggPSBib2R5ID8gYm9keS5sZW5ndGggOiAwO1xuICAgIHZhciBidWZmZXIgPSBuZXcgQnl0ZUFycmF5KFBLR19IRUFEX0JZVEVTICsgbGVuZ3RoKTtcbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IHR5cGUgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChsZW5ndGggPj4gMTYpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAobGVuZ3RoID4+IDgpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSBsZW5ndGggJiAweGZmO1xuICAgIGlmKGJvZHkpIHtcbiAgICAgIGNvcHlBcnJheShidWZmZXIsIGluZGV4LCBib2R5LCAwLCBsZW5ndGgpO1xuICAgIH1cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQYWNrYWdlIHByb3RvY29sIGRlY29kZS5cbiAgICogU2VlIGVuY29kZSBmb3IgcGFja2FnZSBmb3JtYXQuXG4gICAqXG4gICAqIEBwYXJhbSAge0J5dGVBcnJheX0gYnVmZmVyIGJ5dGUgYXJyYXkgY29udGFpbmluZyBwYWNrYWdlIGNvbnRlbnRcbiAgICogQHJldHVybiB7T2JqZWN0fSAgICAgICAgICAge3R5cGU6IHBhY2thZ2UgdHlwZSwgYnVmZmVyOiBib2R5IGJ5dGUgYXJyYXl9XG4gICAqL1xuICBQYWNrYWdlLmRlY29kZSA9IGZ1bmN0aW9uKGJ1ZmZlcil7XG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgdmFyIGJ5dGVzID0gbmV3IEJ5dGVBcnJheShidWZmZXIpO1xuICAgIHZhciBsZW5ndGggPSAwO1xuICAgIHZhciBycyA9IFtdO1xuICAgIHdoaWxlKG9mZnNldCA8IGJ5dGVzLmxlbmd0aCkge1xuICAgICAgdmFyIHR5cGUgPSBieXRlc1tvZmZzZXQrK107XG4gICAgICBsZW5ndGggPSAoKGJ5dGVzW29mZnNldCsrXSkgPDwgMTYgfCAoYnl0ZXNbb2Zmc2V0KytdKSA8PCA4IHwgYnl0ZXNbb2Zmc2V0KytdKSA+Pj4gMDtcbiAgICAgIHZhciBib2R5ID0gbGVuZ3RoID8gbmV3IEJ5dGVBcnJheShsZW5ndGgpIDogbnVsbDtcbiAgICAgIGNvcHlBcnJheShib2R5LCAwLCBieXRlcywgb2Zmc2V0LCBsZW5ndGgpO1xuICAgICAgb2Zmc2V0ICs9IGxlbmd0aDtcbiAgICAgIHJzLnB1c2goeyd0eXBlJzogdHlwZSwgJ2JvZHknOiBib2R5fSk7XG4gICAgfVxuICAgIHJldHVybiBycy5sZW5ndGggPT09IDEgPyByc1swXTogcnM7XG4gIH07XG5cbiAgLyoqXG4gICAqIE1lc3NhZ2UgcHJvdG9jb2wgZW5jb2RlLlxuICAgKlxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9IGlkICAgICAgICAgICAgbWVzc2FnZSBpZFxuICAgKiBAcGFyYW0gIHtOdW1iZXJ9IHR5cGUgICAgICAgICAgbWVzc2FnZSB0eXBlXG4gICAqIEBwYXJhbSAge051bWJlcn0gY29tcHJlc3NSb3V0ZSB3aGV0aGVyIGNvbXByZXNzIHJvdXRlXG4gICAqIEBwYXJhbSAge051bWJlcnxTdHJpbmd9IHJvdXRlICByb3V0ZSBjb2RlIG9yIHJvdXRlIHN0cmluZ1xuICAgKiBAcGFyYW0gIHtCdWZmZXJ9IG1zZyAgICAgICAgICAgbWVzc2FnZSBib2R5IGJ5dGVzXG4gICAqIEByZXR1cm4ge0J1ZmZlcn0gICAgICAgICAgICAgICBlbmNvZGUgcmVzdWx0XG4gICAqL1xuICBNZXNzYWdlLmVuY29kZSA9IGZ1bmN0aW9uKGlkLCB0eXBlLCBjb21wcmVzc1JvdXRlLCByb3V0ZSwgbXNnKXtcbiAgICAvLyBjYWN1bGF0ZSBtZXNzYWdlIG1heCBsZW5ndGhcbiAgICB2YXIgaWRCeXRlcyA9IG1zZ0hhc0lkKHR5cGUpID8gY2FjdWxhdGVNc2dJZEJ5dGVzKGlkKSA6IDA7XG4gICAgdmFyIG1zZ0xlbiA9IE1TR19GTEFHX0JZVEVTICsgaWRCeXRlcztcblxuICAgIGlmKG1zZ0hhc1JvdXRlKHR5cGUpKSB7XG4gICAgICBpZihjb21wcmVzc1JvdXRlKSB7XG4gICAgICAgIGlmKHR5cGVvZiByb3V0ZSAhPT0gJ251bWJlcicpe1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZXJyb3IgZmxhZyBmb3IgbnVtYmVyIHJvdXRlIScpO1xuICAgICAgICB9XG4gICAgICAgIG1zZ0xlbiArPSBNU0dfUk9VVEVfQ09ERV9CWVRFUztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1zZ0xlbiArPSBNU0dfUk9VVEVfTEVOX0JZVEVTO1xuICAgICAgICBpZihyb3V0ZSkge1xuICAgICAgICAgIHJvdXRlID0gUHJvdG9jb2wuc3RyZW5jb2RlKHJvdXRlKTtcbiAgICAgICAgICBpZihyb3V0ZS5sZW5ndGg+MjU1KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JvdXRlIG1heGxlbmd0aCBpcyBvdmVyZmxvdycpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBtc2dMZW4gKz0gcm91dGUubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYobXNnKSB7XG4gICAgICBtc2dMZW4gKz0gbXNnLmxlbmd0aDtcbiAgICB9XG5cbiAgICB2YXIgYnVmZmVyID0gbmV3IEJ5dGVBcnJheShtc2dMZW4pO1xuICAgIHZhciBvZmZzZXQgPSAwO1xuXG4gICAgLy8gYWRkIGZsYWdcbiAgICBvZmZzZXQgPSBlbmNvZGVNc2dGbGFnKHR5cGUsIGNvbXByZXNzUm91dGUsIGJ1ZmZlciwgb2Zmc2V0KTtcblxuICAgIC8vIGFkZCBtZXNzYWdlIGlkXG4gICAgaWYobXNnSGFzSWQodHlwZSkpIHtcbiAgICAgIG9mZnNldCA9IGVuY29kZU1zZ0lkKGlkLCBidWZmZXIsIG9mZnNldCk7XG4gICAgfVxuXG4gICAgLy8gYWRkIHJvdXRlXG4gICAgaWYobXNnSGFzUm91dGUodHlwZSkpIHtcbiAgICAgIG9mZnNldCA9IGVuY29kZU1zZ1JvdXRlKGNvbXByZXNzUm91dGUsIHJvdXRlLCBidWZmZXIsIG9mZnNldCk7XG4gICAgfVxuXG4gICAgLy8gYWRkIGJvZHlcbiAgICBpZihtc2cpIHtcbiAgICAgIG9mZnNldCA9IGVuY29kZU1zZ0JvZHkobXNnLCBidWZmZXIsIG9mZnNldCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJ1ZmZlcjtcbiAgfTtcblxuICAvKipcbiAgICogTWVzc2FnZSBwcm90b2NvbCBkZWNvZGUuXG4gICAqXG4gICAqIEBwYXJhbSAge0J1ZmZlcnxVaW50OEFycmF5fSBidWZmZXIgbWVzc2FnZSBieXRlc1xuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICAgbWVzc2FnZSBvYmplY3RcbiAgICovXG4gIE1lc3NhZ2UuZGVjb2RlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gICAgdmFyIGJ5dGVzID0gIG5ldyBCeXRlQXJyYXkoYnVmZmVyKTtcbiAgICB2YXIgYnl0ZXNMZW4gPSBieXRlcy5sZW5ndGggfHwgYnl0ZXMuYnl0ZUxlbmd0aDtcbiAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICB2YXIgaWQgPSAwO1xuICAgIHZhciByb3V0ZSA9IG51bGw7XG5cbiAgICAvLyBwYXJzZSBmbGFnXG4gICAgdmFyIGZsYWcgPSBieXRlc1tvZmZzZXQrK107XG4gICAgdmFyIGNvbXByZXNzUm91dGUgPSBmbGFnICYgTVNHX0NPTVBSRVNTX1JPVVRFX01BU0s7XG4gICAgdmFyIHR5cGUgPSAoZmxhZyA+PiAxKSAmIE1TR19UWVBFX01BU0s7XG5cbiAgICAvLyBwYXJzZSBpZFxuICAgIGlmKG1zZ0hhc0lkKHR5cGUpKSB7XG4gICAgICB2YXIgbSA9IHBhcnNlSW50KGJ5dGVzW29mZnNldF0pO1xuICAgICAgdmFyIGkgPSAwO1xuICAgICAgZG97XG4gICAgICAgIHZhciBtID0gcGFyc2VJbnQoYnl0ZXNbb2Zmc2V0XSk7XG4gICAgICAgIGlkID0gaWQgKyAoKG0gJiAweDdmKSAqIE1hdGgucG93KDIsKDcqaSkpKTtcbiAgICAgICAgb2Zmc2V0Kys7XG4gICAgICAgIGkrKztcbiAgICAgIH13aGlsZShtID49IDEyOCk7XG4gICAgfVxuXG4gICAgLy8gcGFyc2Ugcm91dGVcbiAgICBpZihtc2dIYXNSb3V0ZSh0eXBlKSkge1xuICAgICAgaWYoY29tcHJlc3NSb3V0ZSkge1xuICAgICAgICByb3V0ZSA9IChieXRlc1tvZmZzZXQrK10pIDw8IDggfCBieXRlc1tvZmZzZXQrK107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgcm91dGVMZW4gPSBieXRlc1tvZmZzZXQrK107XG4gICAgICAgIGlmKHJvdXRlTGVuKSB7XG4gICAgICAgICAgcm91dGUgPSBuZXcgQnl0ZUFycmF5KHJvdXRlTGVuKTtcbiAgICAgICAgICBjb3B5QXJyYXkocm91dGUsIDAsIGJ5dGVzLCBvZmZzZXQsIHJvdXRlTGVuKTtcbiAgICAgICAgICByb3V0ZSA9IFByb3RvY29sLnN0cmRlY29kZShyb3V0ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcm91dGUgPSAnJztcbiAgICAgICAgfVxuICAgICAgICBvZmZzZXQgKz0gcm91dGVMZW47XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcGFyc2UgYm9keVxuICAgIHZhciBib2R5TGVuID0gYnl0ZXNMZW4gLSBvZmZzZXQ7XG4gICAgdmFyIGJvZHkgPSBuZXcgQnl0ZUFycmF5KGJvZHlMZW4pO1xuXG4gICAgY29weUFycmF5KGJvZHksIDAsIGJ5dGVzLCBvZmZzZXQsIGJvZHlMZW4pO1xuXG4gICAgcmV0dXJuIHsnaWQnOiBpZCwgJ3R5cGUnOiB0eXBlLCAnY29tcHJlc3NSb3V0ZSc6IGNvbXByZXNzUm91dGUsXG4gICAgICAgICAgICAncm91dGUnOiByb3V0ZSwgJ2JvZHknOiBib2R5fTtcbiAgfTtcblxuICB2YXIgY29weUFycmF5ID0gZnVuY3Rpb24oZGVzdCwgZG9mZnNldCwgc3JjLCBzb2Zmc2V0LCBsZW5ndGgpIHtcbiAgICBpZignZnVuY3Rpb24nID09PSB0eXBlb2Ygc3JjLmNvcHkpIHtcbiAgICAgIC8vIEJ1ZmZlclxuICAgICAgc3JjLmNvcHkoZGVzdCwgZG9mZnNldCwgc29mZnNldCwgc29mZnNldCArIGxlbmd0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVpbnQ4QXJyYXlcbiAgICAgIGZvcih2YXIgaW5kZXg9MDsgaW5kZXg8bGVuZ3RoOyBpbmRleCsrKXtcbiAgICAgICAgZGVzdFtkb2Zmc2V0KytdID0gc3JjW3NvZmZzZXQrK107XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHZhciBtc2dIYXNJZCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICByZXR1cm4gdHlwZSA9PT0gTWVzc2FnZS5UWVBFX1JFUVVFU1QgfHwgdHlwZSA9PT0gTWVzc2FnZS5UWVBFX1JFU1BPTlNFO1xuICB9O1xuXG4gIHZhciBtc2dIYXNSb3V0ZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICByZXR1cm4gdHlwZSA9PT0gTWVzc2FnZS5UWVBFX1JFUVVFU1QgfHwgdHlwZSA9PT0gTWVzc2FnZS5UWVBFX05PVElGWSB8fFxuICAgICAgICAgICB0eXBlID09PSBNZXNzYWdlLlRZUEVfUFVTSDtcbiAgfTtcblxuICB2YXIgY2FjdWxhdGVNc2dJZEJ5dGVzID0gZnVuY3Rpb24oaWQpIHtcbiAgICB2YXIgbGVuID0gMDtcbiAgICBkbyB7XG4gICAgICBsZW4gKz0gMTtcbiAgICAgIGlkID4+PSA3O1xuICAgIH0gd2hpbGUoaWQgPiAwKTtcbiAgICByZXR1cm4gbGVuO1xuICB9O1xuXG4gIHZhciBlbmNvZGVNc2dGbGFnID0gZnVuY3Rpb24odHlwZSwgY29tcHJlc3NSb3V0ZSwgYnVmZmVyLCBvZmZzZXQpIHtcbiAgICBpZih0eXBlICE9PSBNZXNzYWdlLlRZUEVfUkVRVUVTVCAmJiB0eXBlICE9PSBNZXNzYWdlLlRZUEVfTk9USUZZICYmXG4gICAgICAgdHlwZSAhPT0gTWVzc2FnZS5UWVBFX1JFU1BPTlNFICYmIHR5cGUgIT09IE1lc3NhZ2UuVFlQRV9QVVNIKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vua29udyBtZXNzYWdlIHR5cGU6ICcgKyB0eXBlKTtcbiAgICB9XG5cbiAgICBidWZmZXJbb2Zmc2V0XSA9ICh0eXBlIDw8IDEpIHwgKGNvbXByZXNzUm91dGUgPyAxIDogMCk7XG5cbiAgICByZXR1cm4gb2Zmc2V0ICsgTVNHX0ZMQUdfQllURVM7XG4gIH07XG5cbiAgdmFyIGVuY29kZU1zZ0lkID0gZnVuY3Rpb24oaWQsIGJ1ZmZlciwgb2Zmc2V0KSB7XG4gICAgZG97XG4gICAgICB2YXIgdG1wID0gaWQgJSAxMjg7XG4gICAgICB2YXIgbmV4dCA9IE1hdGguZmxvb3IoaWQvMTI4KTtcblxuICAgICAgaWYobmV4dCAhPT0gMCl7XG4gICAgICAgIHRtcCA9IHRtcCArIDEyODtcbiAgICAgIH1cbiAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSB0bXA7XG5cbiAgICAgIGlkID0gbmV4dDtcbiAgICB9IHdoaWxlKGlkICE9PSAwKTtcblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH07XG5cbiAgdmFyIGVuY29kZU1zZ1JvdXRlID0gZnVuY3Rpb24oY29tcHJlc3NSb3V0ZSwgcm91dGUsIGJ1ZmZlciwgb2Zmc2V0KSB7XG4gICAgaWYgKGNvbXByZXNzUm91dGUpIHtcbiAgICAgIGlmKHJvdXRlID4gTVNHX1JPVVRFX0NPREVfTUFYKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyb3V0ZSBudW1iZXIgaXMgb3ZlcmZsb3cnKTtcbiAgICAgIH1cblxuICAgICAgYnVmZmVyW29mZnNldCsrXSA9IChyb3V0ZSA+PiA4KSAmIDB4ZmY7XG4gICAgICBidWZmZXJbb2Zmc2V0KytdID0gcm91dGUgJiAweGZmO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZihyb3V0ZSkge1xuICAgICAgICBidWZmZXJbb2Zmc2V0KytdID0gcm91dGUubGVuZ3RoICYgMHhmZjtcbiAgICAgICAgY29weUFycmF5KGJ1ZmZlciwgb2Zmc2V0LCByb3V0ZSwgMCwgcm91dGUubGVuZ3RoKTtcbiAgICAgICAgb2Zmc2V0ICs9IHJvdXRlLmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSAwO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH07XG5cbiAgdmFyIGVuY29kZU1zZ0JvZHkgPSBmdW5jdGlvbihtc2csIGJ1ZmZlciwgb2Zmc2V0KSB7XG4gICAgY29weUFycmF5KGJ1ZmZlciwgb2Zmc2V0LCBtc2csIDAsIG1zZy5sZW5ndGgpO1xuICAgIHJldHVybiBvZmZzZXQgKyBtc2cubGVuZ3RoO1xuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gUHJvdG9jb2w7XG4gIGlmKHR5cGVvZih3aW5kb3cpICE9IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cuUHJvdG9jb2wgPSBQcm90b2NvbDtcbiAgfVxufSkodHlwZW9mKHdpbmRvdyk9PVwidW5kZWZpbmVkXCIgPyBtb2R1bGUuZXhwb3J0cyA6IHt9LCB0eXBlb2Yod2luZG93KT09XCJ1bmRlZmluZWRcIiA/IEJ1ZmZlciA6IFVpbnQ4QXJyYXksIHRoaXMpO1xuIl0sInNvdXJjZVJvb3QiOiIifQ==