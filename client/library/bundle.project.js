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
},{}],"GameUi":[function(require,module,exports){
"use strict";
cc._RF.push(module, 'cf61eIb0DlAuI0AYfm5hxFj', 'GameUi');
// ui/game/GameUi.js

"use strict";

var RoomData = require("../../commSrc/data/RoomData");
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
            if (RoomData.data[RoomData.roomId].chr[serverChair] != null) {
                this.chairs[i].active = true;
            } else {
                this.chairs[i].active = false;
            }
        }
    }

});

cc._RF.pop();
},{"../../commSrc/data/RoomData":"RoomData"}],"LoginUi":[function(require,module,exports){
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

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
                RoomData.data = _defineProperty({}, data.data.roomId, data.data.roomData);
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
    data: {
        someRoomId: {
            // 所有座位信息
            chr: [{
                // uid
                uid: "1",
                // 身上的金币
                og: 100000,
                // 当前花费了的金币
                cg: 1000,
                // 是否已经准备，对于准备阶段，代表是否已经点了准备
                // 对于游戏进行阶段，代表是否参与了游戏
                pre: true,
                // 牌
                card: [[1, 2], [1, 2], [1, 2]],
                // 是否已看牌
                look: true,
                // 是否已弃牌
                gu: false
            }, null, null, null, null],
            // 当前发言人
            s: 0,
            // 当前发言人开始发言时间
            st: 14501274324,
            // 池子总金币
            tg: 10000,
            // 当前单注
            sg: 1000,
            // 当前是否正在进行游戏（true为正在进行游戏false为正在准备）
            ing: true
        }
    },
    // 进入房间
    enter: function enter(roomId, uid, gold) {
        if (!this.data[roomId]) {
            this.data[roomId] = {
                chr: [null, null, null, null, null],
                // 池子总金币
                tg: 0,
                // 当前单注
                sg: 1000,
                // 当前是否正在进行游戏（true为正在进行游戏false为正在准备）
                ing: false
            };
        }
        // 找座
        var chairs = this.data[roomId].chr;
        var index = 0;
        for (var i = 0; i < 5; i++) {
            if (chairs[i] == null) {
                index = i;
                break;
            }
        }
        chairs[index] = {
            uid: uid,
            g: gold
        };
        return index;
    },
    // 准备
    prepare: function prepare(roomId, chair) {
        this.data[roomId].chr[chair].pre = true;
    },
    // 检测一个房间是不是可以开始了
    checkCanStart: function checkCanStart(roomId) {
        // 玩家数量
        var playerCount = 0;
        // 已准备的玩家数量
        var preparedCount = 0;
        var chairs = this.data[roomId].chr;
        for (var i = 0; i < 5; i++) {
            if (chairs[i] != null) {
                playerCount++;
                if (chairs[i].pre == true) {
                    preparedCount++;
                }
            }
        }
        if (preparedCount == playerCount && playerCount >= 2) {
            return true;
        } else {
            return false;
        }
    },
    // 得到正在玩的玩家数量
    getPlayingCount: function getPlayingCount(roomId) {
        // 已准备的玩家数量
        var preparedCount = 0;
        var chairs = this.data[roomId].chr;
        for (var i = 0; i < 5; i++) {
            if (chairs[i] != null) {
                if (chairs[i].pre == true) {
                    preparedCount++;
                }
            }
        }
        return preparedCount;
    },
    // 发牌
    dispatchCard: function dispatchCard(roomId, cards) {
        var chairs = this.data[roomId].chr;
        // 已准备的玩家数量
        var preparedCount = 0;
        // 发言人
        var speaker = -1;
        for (var i = 0; i < 5; i++) {
            if (chairs[i] != null) {
                if (chairs[i].pre == true) {
                    if (speaker == -1) {
                        speaker = i;
                    }
                    preparedCount++;
                    chairs[i].card = cards[preparedCount - 1];
                }
            }
        }
        // 设置为正在进行游戏
        this.data[roomId].ing = true;
        // 设置发言人
        this.data[roomId].s = speaker;
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

},{"buffer":2}]},{},["Comm","RoomData","emitter","pomelo-client","protobuf","protocol","Scene","GameUi","LoginUi","MainUi"])

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFzc2V0cy9jb21tU3JjL0NvbW0uanMiLCJhc3NldHMvdWkvZ2FtZS9HYW1lVWkuanMiLCJhc3NldHMvdWkvbG9naW4vTG9naW5VaS5qcyIsImFzc2V0cy91aS9tYWluL01haW5VaS5qcyIsImFzc2V0cy9jb21tU3JjL2RhdGEvUm9vbURhdGEuanMiLCJhc3NldHMvc2NlbmUvU2NlbmUuanMiLCJhc3NldHMvcG9tZWxvL2VtaXR0ZXIuanMiLCJhc3NldHMvcG9tZWxvL3BvbWVsby1jbGllbnQuanMiLCJhc3NldHMvcG9tZWxvL3Byb3RvYnVmLmpzIiwiYXNzZXRzL3BvbWVsby9wcm90b2NvbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBOzs7Ozs7Ozs7O0FDREE7QUFDQTtBQUNJOztBQUVBO0FBQ0k7QUFDQTtBQUZROztBQUtaO0FBQ0E7QUFDSTtBQUNBO0FBQ0k7QUFDQTtBQUNIOztBQUVEO0FBQ0k7QUFDQTtBQUNBO0FBQ0k7QUFDSDtBQUNHO0FBQ0g7QUFDSjtBQUNKOztBQXpCSTs7Ozs7Ozs7OztBQ0RUO0FBQ0E7QUFDSTs7QUFFQTtBQUNJO0FBRFE7O0FBSVo7QUFDSTtBQUNBO0FBQ0k7QUFDQTtBQUNBO0FBSFE7QUFLUjtBQUNJO0FBQ0k7QUFDSDtBQUNKO0FBQ0o7QUFDSjtBQXBCSTs7Ozs7Ozs7Ozs7O0FDRFQ7QUFDQTtBQUNBO0FBQ0k7O0FBRUE7O0FBR0E7QUFDSTtBQUNJO0FBQ0k7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSDtBQUNKO0FBQ0o7QUFsQkk7Ozs7Ozs7Ozs7QUNGVDtBQUNJO0FBQ0k7QUFDSTtBQUNBO0FBRVE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBZko7QUFzQko7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFsQ087QUFEUjtBQXNDUDtBQUNBO0FBQ0k7QUFDSTtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBUGdCO0FBU3ZCO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDSTtBQUNJO0FBQ0E7QUFDSDtBQUNKO0FBQ0Q7QUFDSTtBQUNBO0FBRlk7QUFJaEI7QUFDSDtBQUNEO0FBQ0E7QUFDSTtBQUNIO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJO0FBQ0k7QUFDQTtBQUNJO0FBQ0g7QUFDSjtBQUNKO0FBQ0Q7QUFDSTtBQUNIO0FBQ0c7QUFDSDtBQUNKO0FBQ0Q7QUFDQTtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0k7QUFDSTtBQUNJO0FBQ0g7QUFDSjtBQUNKO0FBQ0Q7QUFDSDtBQUNEO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTtBQUNJO0FBQ0k7QUFDSTtBQUNIO0FBQ0Q7QUFDQTtBQUNIO0FBQ0o7QUFDSjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0g7O0FBaElZOzs7Ozs7Ozs7O0FDQWpCO0FBQ0E7QUFDSTs7QUFFQTtBQUNJO0FBQ0E7QUFDQTtBQUhROztBQU1aO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFDSDs7QUFFRDtBQUNBOztBQUVBO0FBQ0E7QUFDSTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0g7QUFDRDtBQUNJO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSDtBQWpDSTs7Ozs7Ozs7OztBQ0FUOzs7O0FBSUE7O0FBRUE7O0FBRUE7Ozs7OztBQU1BO0FBQ0U7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0U7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQ7Ozs7Ozs7OztBQVNBO0FBRUU7QUFDQTtBQUVBO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7QUFVQTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7Ozs7Ozs7Ozs7QUFVQTtBQUlFOztBQUVBO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNFO0FBQ0E7QUFDRDtBQUNGO0FBQ0Q7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0E7QUFBQTs7QUFHQTtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDs7Ozs7Ozs7QUFRQTtBQUNFO0FBQ0Q7Ozs7Ozs7Ozs7QUNyS0Q7QUFDRTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBOztBQUVBOztBQUVBO0FBQ0U7QUFDRTtBQUNBO0FBRks7QUFJUDtBQUxvQjs7QUFTdEI7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDRDtBQUNEO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNGO0FBQ0Q7QUFDRTtBQUNBO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDQztBQUNEO0FBQ0Q7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTs7QUFFQTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTs7QUFFQTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0M7QUFDRDs7QUFHRDtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRDs7QUFHRDs7QUFFQTtBQUNFO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBOztBQUVBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7QUFDQztBQUNBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0U7QUFDQTtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRDs7QUFFRDs7QUFFQTtBQUNBO0FBQ0E7QUFDRTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7O0FBRUE7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRDs7QUFFRDtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNFO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDRjtBQUNDO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNEO0FBQ0Q7QUFDRTtBQUNEO0FBQ0M7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7O0FBRUQ7O0FBRUE7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDQTtBQUNFO0FBQ0U7QUFDRDtBQUNEO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7QUFDRjs7QUFFRDtBQUNBO0FBQ0U7QUFDRTtBQUNBO0FBRm1CO0FBSXJCO0FBQ0U7QUFDRDtBQUNGO0FBQ0Y7O0FBRUQ7QUFDRDs7Ozs7Ozs7OztBQy9XRDs7QUFFQTs7Ozs7QUFLQTs7OztBQUlBO0FBQ0U7O0FBRUE7QUFDRTtBQUNBOztBQUVBO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFFRjs7QUFFRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBUGdCO0FBVW5COztBQUVEOzs7QUFHQTs7QUFFRTs7QUFFQTtBQUNFO0FBT0Q7QUFFRjs7QUFFRDs7O0FBR0E7O0FBRUU7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0U7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7QUFDRDtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0E7QUFDRTtBQUNEO0FBQ0Q7O0FBRUE7QUFDRDs7QUFFRDtBQUNFOztBQUVBO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDRDtBQUNGOztBQUVEO0FBQ0Q7O0FBR0Q7QUFDRTtBQUNBOztBQUVBOztBQUVBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTtBQUNBO0FBQ0Q7QUFDRjs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0E7O0FBRUE7QUFDRTs7QUFFQTtBQUNFOztBQUVBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7QUFDQztBQUNBO0FBQ0Q7O0FBRUQ7QUFFRDs7QUFFRDtBQUNBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7OztBQUdBO0FBQ0U7QUFDRTtBQUNEOztBQUVEOztBQUVBO0FBQ0U7QUFDQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7OztBQUdBO0FBQ0U7QUFDRTtBQUNEO0FBQ0M7QUFDRDtBQUNDO0FBQ0Q7QUFDRjs7QUFFRDtBQUNFO0FBQ0U7QUFDRDtBQUNDO0FBQ0Q7QUFDQztBQUNEO0FBQ0Y7QUFDRjs7QUFFRDs7O0FBR0E7O0FBRUU7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDRDs7QUFFRDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7QUFDRjs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNFOztBQUVBO0FBQ0E7QUFDRTtBQUNFO0FBQ0U7QUFDRDtBQUNIO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7QUFDRjtBQUNIO0FBQ0E7QUFDRTtBQUNBO0FBQ0U7QUFDRTtBQUNFO0FBQ0Q7QUFDRjtBQUNGO0FBQ0g7QUFyQkY7QUF1QkQ7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDRTtBQUNBO0FBQ0Y7QUFDQTtBQUNFO0FBQ0U7QUFDRDtBQUNIO0FBVkY7QUFZRDtBQUNGOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7QUFDRjtBQUNBO0FBQ0E7QUFDRTtBQUNGO0FBQ0E7QUFDRTtBQUNBO0FBQ0Y7QUFDQTtBQUNFO0FBQ0E7QUFDRjtBQUNBO0FBQ0U7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNGO0FBQ0E7QUFDRTtBQUNFO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7QUFDSDtBQXhDRjs7QUEyQ0E7QUFDRDs7QUFFRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFDRjtBQUNDO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDQTtBQUNEO0FBQ0Y7O0FBRUQ7OztBQUdBO0FBQ0U7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDRTtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTs7QUFFQTtBQUNBOztBQUVBO0FBQ0U7QUFDRDs7QUFFRDtBQUNEOztBQUVEO0FBQ0U7QUFDRTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNFO0FBQ0E7QUFDRTtBQUNGO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7QUFDRDtBQUNGO0FBVkY7QUFZRDs7QUFFRDtBQUNEOztBQUVEOzs7QUFHQTtBQUNFO0FBQ0Q7QUFDRDs7O0FBR0E7QUFDRTs7QUFFQTtBQUNFO0FBQ0E7QUFGSztBQUlSOztBQUVEOzs7QUFHQTtBQUNFOztBQUVBO0FBQ0U7QUFDQTtBQUZLO0FBSVI7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7QUFDRjtBQUNBO0FBQ0U7QUFDRjtBQUNFO0FBQ0E7QUFDQTtBQUNGO0FBQ0U7QUFDQTtBQUNBO0FBQ0Y7QUFDRTs7QUFFQTtBQUNBOztBQUVBO0FBQ0Y7QUFDRTtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7QUFDSDtBQTVCRjtBQThCRDs7QUFFRDtBQUNFO0FBQ0U7O0FBRUE7QUFDRTtBQUNEO0FBQ0Y7QUFDQztBQUNEO0FBQ0Y7O0FBRUQ7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDRTtBQUNBO0FBQ0E7QUFDRDs7QUFFRDtBQUNFO0FBQ0Q7QUFDRDtBQUNEOztBQUVEO0FBQ0U7QUFDRDtBQUVGOzs7Ozs7Ozs7OztBQ3RtQkQ7QUFDRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOzs7Ozs7O0FBT0E7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNBO0FBQ0E7QUFDRTtBQUNEO0FBQ0M7QUFDRDtBQUNDO0FBQ0Q7QUFDRDtBQUNFO0FBQ0E7QUFDRDtBQUNGO0FBQ0Q7QUFDQTtBQUNBO0FBQ0Q7O0FBRUQ7Ozs7O0FBS0E7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRTtBQUNFO0FBQ0E7QUFDRDtBQUNDO0FBQ0E7QUFDRDtBQUNDO0FBQ0E7QUFDRDtBQUNEO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0JBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7O0FBT0E7QUFDRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Q7QUFDRDtBQUNEOztBQUVEOzs7Ozs7Ozs7O0FBVUE7QUFDRTtBQUNBO0FBQ0E7O0FBRUE7QUFDRTtBQUNFO0FBQ0U7QUFDRDtBQUNEO0FBQ0Q7QUFDQztBQUNBO0FBQ0U7QUFDQTtBQUNFO0FBQ0Q7QUFDRDtBQUNEO0FBQ0Y7QUFDRjs7QUFFRDtBQUNFO0FBQ0Q7O0FBRUQ7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0E7QUFDRTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7Ozs7OztBQU1BO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0E7QUFDRDtBQUNGOztBQUVEO0FBQ0E7QUFDRTtBQUNFO0FBQ0Q7QUFDQztBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0Q7QUFDQztBQUNEO0FBQ0Q7QUFDRDtBQUNGOztBQUVEO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNRO0FBQ1Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0E7QUFDRDtBQUNDO0FBQ0E7QUFDRTtBQUNEO0FBQ0Y7QUFDRjs7QUFFRDtBQUNFO0FBQ0Q7O0FBRUQ7QUFDRTtBQUVEOztBQUVEO0FBQ0U7QUFDQTtBQUNFO0FBQ0E7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUVFO0FBQ0Q7O0FBRUQ7O0FBRUE7QUFDRDs7QUFFRDtBQUNFO0FBQ0U7QUFDQTs7QUFFQTtBQUNFO0FBQ0Q7QUFDRDs7QUFFQTtBQUNEOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNFO0FBQ0U7QUFDRDs7QUFFRDtBQUNBO0FBQ0Q7QUFDQztBQUNFO0FBQ0E7QUFDQTtBQUNEO0FBQ0M7QUFDRDtBQUNGOztBQUVEO0FBQ0Q7O0FBRUQ7QUFDRTtBQUNBO0FBQ0Q7O0FBRUQ7QUFDQTtBQUNFO0FBQ0Q7QUFDRiIsInNvdXJjZXNDb250ZW50IjpbIi8vIHJlcXVpcmUoJ3BvbWVsby1jb2NvczJkLWpzJyk7XG5tb2R1bGUuZXhwb3J0cz17fTsiLCJ2YXIgUm9vbURhdGEgPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9kYXRhL1Jvb21EYXRhXCIpO1xuY2MuQ2xhc3Moe1xuICAgIGV4dGVuZHM6IGNjLkNvbXBvbmVudCxcblxuICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgY2hhaXJzOntkZWZhdWx0OltdLHR5cGU6Y2MuTm9kZX0sXG4gICAgICAgIEdhbWVQbGF5ZXJQcmVmYWI6Y2MuUHJlZmFiLFxuICAgIH0sXG5cbiAgICAvLyB1c2UgdGhpcyBmb3IgaW5pdGlhbGl6YXRpb25cbiAgICBvbkxvYWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5jaGFpclVpcyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5jaGFpcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIHRoaXMuY2hhaXJVaXNbaV0gPSBjYy5pbnN0YW50aWF0ZSh0aGlzLkdhbWVQbGF5ZXJQcmVmYWIpO1xuICAgICAgICAgICAgdGhpcy5jaGFpclVpc1tpXS5wYXJlbnQgPSB0aGlzLmNoYWlyc1tpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcih2YXIgaT0wOyBpIDwgNTsgaSsrKSB7XG4gICAgICAgICAgICAvLyDmnKzlnLDmpIXlrZDlj7fovazmnI3liqHlmajmpIXlrZDlj7dcbiAgICAgICAgICAgIHZhciBzZXJ2ZXJDaGFpciA9IChSb29tRGF0YS5teUNoYWlyICsgaSklNTtcbiAgICAgICAgICAgIGlmIChSb29tRGF0YS5kYXRhW1Jvb21EYXRhLnJvb21JZF0uY2hyW3NlcnZlckNoYWlyXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGFpcnNbaV0uYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGFpcnNbaV0uYWN0aXZlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG59KTtcbiIsInZhciBDb21tID0gcmVxdWlyZShcIi4uLy4uL2NvbW1TcmMvQ29tbVwiKTtcbmNjLkNsYXNzKHtcbiAgICBleHRlbmRzOiBjYy5Db21wb25lbnQsXG5cbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIHVzZXJuYW1lTGFiZWw6Y2MuRWRpdEJveCxcbiAgICB9LFxuXG4gICAgb25Mb2dpbkNsaWNrOmZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgcG9tZWxvLmluaXQoe1xuICAgICAgICAgICAgaG9zdDpcIjE5Mi4xNjguOC4xMDNcIixcbiAgICAgICAgICAgIC8vIGhvc3Q6XCIxMjcuMC4wLjFcIixcbiAgICAgICAgICAgIHBvcnQ6MzAxMFxuICAgICAgICB9LCBmdW5jdGlvbihlcnIpe1xuICAgICAgICAgICAgcG9tZWxvLnJlcXVlc3QoXCJjb25uZWN0b3IuZW50cnlIYW5kbGVyLmxvZ2luXCIsIHt1c2VybmFtZTpzZWxmLnVzZXJuYW1lTGFiZWwuc3RyaW5nfSwgZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGEucmV0ID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgQ29tbS5zY2VuZS5sb2dpbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9LFxufSk7XG4iLCJ2YXIgUm9vbURhdGEgPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9kYXRhL1Jvb21EYXRhXCIpO1xudmFyIENvbW0gPSByZXF1aXJlKFwiLi4vLi4vY29tbVNyYy9Db21tXCIpO1xuY2MuQ2xhc3Moe1xuICAgIGV4dGVuZHM6IGNjLkNvbXBvbmVudCxcblxuICAgIHByb3BlcnRpZXM6IHtcbiAgICB9LFxuXG4gICAgb25Sb29tMUNsaWNrOmZ1bmN0aW9uKCl7XG4gICAgICAgIHBvbWVsby5yZXF1ZXN0KFwiY29ubmVjdG9yLmVudHJ5SGFuZGxlci5lbnRlclJvb21cIiwge30sIGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICAgICAgaWYgKGRhdGEucmV0ID09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhLmRhdGEucm9vbURhdGEpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEuZGF0YS5jaGFpcik7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZGF0YS5kYXRhLnJvb21JZCk7XG4gICAgICAgICAgICAgICAgUm9vbURhdGEuZGF0YSA9IHtbZGF0YS5kYXRhLnJvb21JZF06ZGF0YS5kYXRhLnJvb21EYXRhfTtcbiAgICAgICAgICAgICAgICBSb29tRGF0YS5teUNoYWlyID0gZGF0YS5kYXRhLmNoYWlyO1xuICAgICAgICAgICAgICAgIFJvb21EYXRhLnJvb21JZCA9IGRhdGEuZGF0YS5yb29tSWQ7XG4gICAgICAgICAgICAgICAgQ29tbS5zY2VuZS5lbnRlclJvb20oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgZGF0YSA6IHtcbiAgICAgICAgc29tZVJvb21JZDp7XG4gICAgICAgICAgICAvLyDmiYDmnInluqfkvY3kv6Hmga9cbiAgICAgICAgICAgIGNocjpbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAvLyB1aWRcbiAgICAgICAgICAgICAgICAgICAgdWlkOlwiMVwiLFxuICAgICAgICAgICAgICAgICAgICAvLyDouqvkuIrnmoTph5HluIFcbiAgICAgICAgICAgICAgICAgICAgb2c6MTAwMDAwLFxuICAgICAgICAgICAgICAgICAgICAvLyDlvZPliY3oirHotLnkuobnmoTph5HluIFcbiAgICAgICAgICAgICAgICAgICAgY2c6MTAwMCxcbiAgICAgICAgICAgICAgICAgICAgLy8g5piv5ZCm5bey57uP5YeG5aSH77yM5a+55LqO5YeG5aSH6Zi25q6177yM5Luj6KGo5piv5ZCm5bey57uP54K55LqG5YeG5aSHXG4gICAgICAgICAgICAgICAgICAgIC8vIOWvueS6jua4uOaIj+i/m+ihjOmYtuaute+8jOS7o+ihqOaYr+WQpuWPguS4juS6hua4uOaIj1xuICAgICAgICAgICAgICAgICAgICBwcmU6dHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgLy8g54mMXG4gICAgICAgICAgICAgICAgICAgIGNhcmQ6W1sxLDJdLFsxLDJdLFsxLDJdXSxcbiAgICAgICAgICAgICAgICAgICAgLy8g5piv5ZCm5bey55yL54mMXG4gICAgICAgICAgICAgICAgICAgIGxvb2s6dHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgLy8g5piv5ZCm5bey5byD54mMXG4gICAgICAgICAgICAgICAgICAgIGd1OmZhbHNlLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgICAgICBudWxsLFxuICAgICAgICAgICAgICAgIG51bGwsXG4gICAgICAgICAgICAgICAgbnVsbFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIC8vIOW9k+WJjeWPkeiogOS6ulxuICAgICAgICAgICAgczowLFxuICAgICAgICAgICAgLy8g5b2T5YmN5Y+R6KiA5Lq65byA5aeL5Y+R6KiA5pe26Ze0XG4gICAgICAgICAgICBzdDoxNDUwMTI3NDMyNCxcbiAgICAgICAgICAgIC8vIOaxoOWtkOaAu+mHkeW4gVxuICAgICAgICAgICAgdGc6MTAwMDAsXG4gICAgICAgICAgICAvLyDlvZPliY3ljZXms6hcbiAgICAgICAgICAgIHNnOjEwMDAsXG4gICAgICAgICAgICAvLyDlvZPliY3mmK/lkKbmraPlnKjov5vooYzmuLjmiI/vvIh0cnVl5Li65q2j5Zyo6L+b6KGM5ri45oiPZmFsc2XkuLrmraPlnKjlh4blpIfvvIlcbiAgICAgICAgICAgIGluZzp0cnVlLFxuICAgICAgICB9XG4gICAgfSxcbiAgICAvLyDov5vlhaXmiL/pl7RcbiAgICBlbnRlciA6IGZ1bmN0aW9uKHJvb21JZCwgdWlkLCBnb2xkKXtcbiAgICAgICAgaWYgKCEgdGhpcy5kYXRhW3Jvb21JZF0pIHtcbiAgICAgICAgICAgIHRoaXMuZGF0YVtyb29tSWRdID0ge1xuICAgICAgICAgICAgICAgIGNocjpbbnVsbCxudWxsLG51bGwsbnVsbCxudWxsXSxcbiAgICAgICAgICAgICAgICAvLyDmsaDlrZDmgLvph5HluIFcbiAgICAgICAgICAgICAgICB0ZzowLFxuICAgICAgICAgICAgICAgIC8vIOW9k+WJjeWNleazqFxuICAgICAgICAgICAgICAgIHNnOjEwMDAsXG4gICAgICAgICAgICAgICAgLy8g5b2T5YmN5piv5ZCm5q2j5Zyo6L+b6KGM5ri45oiP77yIdHJ1ZeS4uuato+WcqOi/m+ihjOa4uOaIj2ZhbHNl5Li65q2j5Zyo5YeG5aSH77yJXG4gICAgICAgICAgICAgICAgaW5nOmZhbHNlLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICAvLyDmib7luqdcbiAgICAgICAgdmFyIGNoYWlycyA9IHRoaXMuZGF0YVtyb29tSWRdLmNocjtcbiAgICAgICAgdmFyIGluZGV4ID0gMDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7aSA8IDU7IGkrKyl7XG4gICAgICAgICAgICBpZiAoY2hhaXJzW2ldID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2hhaXJzW2luZGV4XSA9IHtcbiAgICAgICAgICAgIHVpZDp1aWQsXG4gICAgICAgICAgICBnOmdvbGQsXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBpbmRleDtcbiAgICB9LFxuICAgIC8vIOWHhuWkh1xuICAgIHByZXBhcmU6ZnVuY3Rpb24ocm9vbUlkLGNoYWlyKSB7XG4gICAgICAgIHRoaXMuZGF0YVtyb29tSWRdLmNocltjaGFpcl0ucHJlID0gdHJ1ZTtcbiAgICB9LFxuICAgIC8vIOajgOa1i+S4gOS4quaIv+mXtOaYr+S4jeaYr+WPr+S7peW8gOWni+S6hlxuICAgIGNoZWNrQ2FuU3RhcnQ6ZnVuY3Rpb24ocm9vbUlkKSB7XG4gICAgICAgIC8vIOeOqeWutuaVsOmHj1xuICAgICAgICB2YXIgcGxheWVyQ291bnQgPSAwO1xuICAgICAgICAvLyDlt7Llh4blpIfnmoTnjqnlrrbmlbDph49cbiAgICAgICAgdmFyIHByZXBhcmVkQ291bnQgPSAwO1xuICAgICAgICB2YXIgY2hhaXJzID0gdGhpcy5kYXRhW3Jvb21JZF0uY2hyO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgNTsgaSArKykge1xuICAgICAgICAgICAgaWYgKGNoYWlyc1tpXSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcGxheWVyQ291bnQgKys7XG4gICAgICAgICAgICAgICAgaWYgKGNoYWlyc1tpXS5wcmUgPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBwcmVwYXJlZENvdW50ICsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocHJlcGFyZWRDb3VudCA9PSBwbGF5ZXJDb3VudCAmJiBwbGF5ZXJDb3VudCA+PSAyKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLy8g5b6X5Yiw5q2j5Zyo546p55qE546p5a625pWw6YePXG4gICAgZ2V0UGxheWluZ0NvdW50OmZ1bmN0aW9uIChyb29tSWQpIHtcbiAgICAgICAgLy8g5bey5YeG5aSH55qE546p5a625pWw6YePXG4gICAgICAgIHZhciBwcmVwYXJlZENvdW50ID0gMDtcbiAgICAgICAgdmFyIGNoYWlycyA9IHRoaXMuZGF0YVtyb29tSWRdLmNocjtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IDU7IGkgKyspIHtcbiAgICAgICAgICAgIGlmIChjaGFpcnNbaV0gIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmIChjaGFpcnNbaV0ucHJlID09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlcGFyZWRDb3VudCArKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByZXBhcmVkQ291bnQ7XG4gICAgfSxcbiAgICAvLyDlj5HniYxcbiAgICBkaXNwYXRjaENhcmQ6ZnVuY3Rpb24gKHJvb21JZCwgY2FyZHMpIHtcbiAgICAgICAgdmFyIGNoYWlycyA9IHRoaXMuZGF0YVtyb29tSWRdLmNocjtcbiAgICAgICAgLy8g5bey5YeG5aSH55qE546p5a625pWw6YePXG4gICAgICAgIHZhciBwcmVwYXJlZENvdW50ID0gMDtcbiAgICAgICAgLy8g5Y+R6KiA5Lq6XG4gICAgICAgIHZhciBzcGVha2VyID0gLTE7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCA1OyBpICsrKSB7XG4gICAgICAgICAgICBpZiAoY2hhaXJzW2ldICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hhaXJzW2ldLnByZSA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzcGVha2VyID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzcGVha2VyID0gaTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwcmVwYXJlZENvdW50ICsrO1xuICAgICAgICAgICAgICAgICAgICBjaGFpcnNbaV0uY2FyZCA9IGNhcmRzW3ByZXBhcmVkQ291bnQtMV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIOiuvue9ruS4uuato+WcqOi/m+ihjOa4uOaIj1xuICAgICAgICB0aGlzLmRhdGFbcm9vbUlkXS5pbmcgPSB0cnVlO1xuICAgICAgICAvLyDorr7nva7lj5HoqIDkurpcbiAgICAgICAgdGhpcy5kYXRhW3Jvb21JZF0ucyA9IHNwZWFrZXI7XG4gICAgfSxcblxufTtcbiIsInZhciBDb21tID0gcmVxdWlyZShcIi4uL2NvbW1TcmMvQ29tbVwiKTtcbmNjLkNsYXNzKHtcbiAgICBleHRlbmRzOiBjYy5Db21wb25lbnQsXG5cbiAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIGxvZ2luVWlQcmVmYWI6Y2MuUHJlZmFiLFxuICAgICAgICBtYWluVWlQcmVmYWI6Y2MuUHJlZmFiLFxuICAgICAgICBnYW1lVWlQcmVmYWI6Y2MuUHJlZmFiLFxuICAgIH0sXG5cbiAgICAvLyB1c2UgdGhpcyBmb3IgaW5pdGlhbGl6YXRpb25cbiAgICBvbkxvYWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgQ29tbS5zY2VuZSA9IHRoaXM7XG4gICAgICAgIHRoaXMubG9naW5VaSA9IGNjLmluc3RhbnRpYXRlKHRoaXMubG9naW5VaVByZWZhYik7XG4gICAgICAgIHRoaXMubG9naW5VaS5wYXJlbnQgPSB0aGlzLm5vZGU7XG4gICAgfSxcblxuICAgIC8vIGNhbGxlZCBldmVyeSBmcmFtZSwgdW5jb21tZW50IHRoaXMgZnVuY3Rpb24gdG8gYWN0aXZhdGUgdXBkYXRlIGNhbGxiYWNrXG4gICAgLy8gdXBkYXRlOiBmdW5jdGlvbiAoZHQpIHtcblxuICAgIC8vIH0sXG4gICAgbG9naW46ZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9naW5cIik7XG4gICAgICAgIHRoaXMubG9naW5VaS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubG9naW5VaSA9IG51bGw7XG4gICAgICAgIHRoaXMubWFpblVpID0gY2MuaW5zdGFudGlhdGUodGhpcy5tYWluVWlQcmVmYWIpO1xuICAgICAgICB0aGlzLm1haW5VaS5wYXJlbnQgPSB0aGlzLm5vZGU7XG4gICAgfSxcbiAgICBlbnRlclJvb206ZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZW50ZXJSb29tXCIpO1xuICAgICAgICB0aGlzLm1haW5VaS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubWFpblVpID0gbnVsbDtcbiAgICAgICAgdGhpcy5nYW1lVWkgPSBjYy5pbnN0YW50aWF0ZSh0aGlzLmdhbWVVaVByZWZhYik7XG4gICAgICAgIHRoaXMuZ2FtZVVpLnBhcmVudCA9IHRoaXMubm9kZTtcbiAgICB9LFxufSk7XG4iLCJcbi8qKlxuICogRXhwb3NlIGBFbWl0dGVyYC5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVtaXR0ZXI7XG5cbndpbmRvdy5FdmVudEVtaXR0ZXIgPSBFbWl0dGVyO1xuXG4vKipcbiAqIEluaXRpYWxpemUgYSBuZXcgYEVtaXR0ZXJgLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gRW1pdHRlcihvYmopIHtcbiAgaWYgKG9iaikgcmV0dXJuIG1peGluKG9iaik7XG59O1xuXG4vKipcbiAqIE1peGluIHRoZSBlbWl0dGVyIHByb3BlcnRpZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7T2JqZWN0fVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gbWl4aW4ob2JqKSB7XG4gIGZvciAodmFyIGtleSBpbiBFbWl0dGVyLnByb3RvdHlwZSkge1xuICAgIG9ialtrZXldID0gRW1pdHRlci5wcm90b3R5cGVba2V5XTtcbiAgfVxuICByZXR1cm4gb2JqO1xufVxuXG4vKipcbiAqIExpc3RlbiBvbiB0aGUgZ2l2ZW4gYGV2ZW50YCB3aXRoIGBmbmAuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7RW1pdHRlcn1cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUub24gPVxuRW1pdHRlci5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcbiAgKHRoaXMuX2NhbGxiYWNrc1tldmVudF0gPSB0aGlzLl9jYWxsYmFja3NbZXZlbnRdIHx8IFtdKVxuICAgIC5wdXNoKGZuKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEFkZHMgYW4gYGV2ZW50YCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBhIHNpbmdsZVxuICogdGltZSB0aGVuIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcmV0dXJuIHtFbWl0dGVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24oZXZlbnQsIGZuKXtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLl9jYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3MgfHwge307XG5cbiAgZnVuY3Rpb24gb24oKSB7XG4gICAgc2VsZi5vZmYoZXZlbnQsIG9uKTtcbiAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9XG5cbiAgb24uZm4gPSBmbjtcbiAgdGhpcy5vbihldmVudCwgb24pO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUmVtb3ZlIHRoZSBnaXZlbiBjYWxsYmFjayBmb3IgYGV2ZW50YCBvciBhbGxcbiAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBldmVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLm9mZiA9XG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9XG5FbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPVxuRW1pdHRlci5wcm90b3R5cGUucmVtb3ZlRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uKGV2ZW50LCBmbil7XG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcblxuICAvLyBhbGxcbiAgaWYgKDAgPT0gYXJndW1lbnRzLmxlbmd0aCkge1xuICAgIHRoaXMuX2NhbGxiYWNrcyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gc3BlY2lmaWMgZXZlbnRcbiAgdmFyIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1tldmVudF07XG4gIGlmICghY2FsbGJhY2tzKSByZXR1cm4gdGhpcztcblxuICAvLyByZW1vdmUgYWxsIGhhbmRsZXJzXG4gIGlmICgxID09IGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICBkZWxldGUgdGhpcy5fY2FsbGJhY2tzW2V2ZW50XTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHJlbW92ZSBzcGVjaWZpYyBoYW5kbGVyXG4gIHZhciBjYjtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyBpKyspIHtcbiAgICBjYiA9IGNhbGxiYWNrc1tpXTtcbiAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xuICAgICAgY2FsbGJhY2tzLnNwbGljZShpLCAxKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogRW1pdCBgZXZlbnRgIHdpdGggdGhlIGdpdmVuIGFyZ3MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge01peGVkfSAuLi5cbiAqIEByZXR1cm4ge0VtaXR0ZXJ9XG4gKi9cblxuRW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgdGhpcy5fY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzIHx8IHt9O1xuICB2YXIgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKVxuICAgICwgY2FsbGJhY2tzID0gdGhpcy5fY2FsbGJhY2tzW2V2ZW50XTtcblxuICBpZiAoY2FsbGJhY2tzKSB7XG4gICAgY2FsbGJhY2tzID0gY2FsbGJhY2tzLnNsaWNlKDApO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjYWxsYmFja3MubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIGNhbGxiYWNrc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogUmV0dXJuIGFycmF5IG9mIGNhbGxiYWNrcyBmb3IgYGV2ZW50YC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEByZXR1cm4ge0FycmF5fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5FbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbihldmVudCl7XG4gIHRoaXMuX2NhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrcyB8fCB7fTtcbiAgcmV0dXJuIHRoaXMuX2NhbGxiYWNrc1tldmVudF0gfHwgW107XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIHRoaXMgZW1pdHRlciBoYXMgYGV2ZW50YCBoYW5kbGVycy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbkVtaXR0ZXIucHJvdG90eXBlLmhhc0xpc3RlbmVycyA9IGZ1bmN0aW9uKGV2ZW50KXtcbiAgcmV0dXJuICEhIHRoaXMubGlzdGVuZXJzKGV2ZW50KS5sZW5ndGg7XG59O1xuIiwiKGZ1bmN0aW9uKCkge1xuICB2YXIgSlNfV1NfQ0xJRU5UX1RZUEUgPSAnanMtd2Vic29ja2V0JztcbiAgdmFyIEpTX1dTX0NMSUVOVF9WRVJTSU9OID0gJzAuMC4xJztcblxuICB2YXIgUHJvY3RvY29sID0gcmVxdWlyZShcInByb3RvY29sXCIpO1xuICB2YXIgUGFja2FnZSA9IFByb3RvY29sLlBhY2thZ2U7XG4gIHZhciBNZXNzYWdlID0gUHJvdG9jb2wuTWVzc2FnZTtcbiAgdmFyIEV2ZW50RW1pdHRlciA9IHdpbmRvdy5FdmVudEVtaXR0ZXI7XG5cbiAgaWYodHlwZW9mKHdpbmRvdykgIT0gXCJ1bmRlZmluZWRcIiAmJiB0eXBlb2Yoc3lzKSAhPSAndW5kZWZpbmVkJyAmJiBzeXMubG9jYWxTdG9yYWdlKSB7XG4gICAgd2luZG93LmxvY2FsU3RvcmFnZSA9IHN5cy5sb2NhbFN0b3JhZ2U7XG4gIH1cblxuICB2YXIgUkVTX09LID0gMjAwO1xuICB2YXIgUkVTX0ZBSUwgPSA1MDA7XG4gIHZhciBSRVNfT0xEX0NMSUVOVCA9IDUwMTtcblxuICBpZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICBPYmplY3QuY3JlYXRlID0gZnVuY3Rpb24gKG8pIHtcbiAgICAgIGZ1bmN0aW9uIEYoKSB7fVxuICAgICAgRi5wcm90b3R5cGUgPSBvO1xuICAgICAgcmV0dXJuIG5ldyBGKCk7XG4gICAgfTtcbiAgfVxuXG4gIHZhciByb290ID0gd2luZG93O1xuICB2YXIgcG9tZWxvID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTsgLy8gb2JqZWN0IGV4dGVuZCBmcm9tIG9iamVjdFxuICByb290LnBvbWVsbyA9IHBvbWVsbztcbiAgdmFyIHNvY2tldCA9IG51bGw7XG4gIHZhciByZXFJZCA9IDA7XG4gIHZhciBjYWxsYmFja3MgPSB7fTtcbiAgdmFyIGhhbmRsZXJzID0ge307XG4gIC8vTWFwIGZyb20gcmVxdWVzdCBpZCB0byByb3V0ZVxuICB2YXIgcm91dGVNYXAgPSB7fTtcblxuICB2YXIgaGVhcnRiZWF0SW50ZXJ2YWwgPSAwO1xuICB2YXIgaGVhcnRiZWF0VGltZW91dCA9IDA7XG4gIHZhciBuZXh0SGVhcnRiZWF0VGltZW91dCA9IDA7XG4gIHZhciBnYXBUaHJlc2hvbGQgPSAxMDA7ICAgLy8gaGVhcnRiZWF0IGdhcCB0aHJlYXNob2xkXG4gIHZhciBoZWFydGJlYXRJZCA9IG51bGw7XG4gIHZhciBoZWFydGJlYXRUaW1lb3V0SWQgPSBudWxsO1xuXG4gIHZhciBoYW5kc2hha2VDYWxsYmFjayA9IG51bGw7XG5cbiAgdmFyIGRlY29kZSA9IG51bGw7XG4gIHZhciBlbmNvZGUgPSBudWxsO1xuXG4gIHZhciB1c2VDcnlwdG87XG5cbiAgdmFyIGhhbmRzaGFrZUJ1ZmZlciA9IHtcbiAgICAnc3lzJzoge1xuICAgICAgdHlwZTogSlNfV1NfQ0xJRU5UX1RZUEUsXG4gICAgICB2ZXJzaW9uOiBKU19XU19DTElFTlRfVkVSU0lPTlxuICAgIH0sXG4gICAgJ3VzZXInOiB7XG4gICAgfVxuICB9O1xuXG4gIHZhciBpbml0Q2FsbGJhY2sgPSBudWxsO1xuXG4gIHBvbWVsby5pbml0ID0gZnVuY3Rpb24ocGFyYW1zLCBjYil7XG4gICAgaW5pdENhbGxiYWNrID0gY2I7XG4gICAgdmFyIGhvc3QgPSBwYXJhbXMuaG9zdDtcbiAgICB2YXIgcG9ydCA9IHBhcmFtcy5wb3J0O1xuXG4gICAgdmFyIHVybCA9ICd3czovLycgKyBob3N0O1xuICAgIGlmKHBvcnQpIHtcbiAgICAgIHVybCArPSAgJzonICsgcG9ydDtcbiAgICB9XG5cbiAgICBoYW5kc2hha2VCdWZmZXIudXNlciA9IHBhcmFtcy51c2VyO1xuICAgIGhhbmRzaGFrZUNhbGxiYWNrID0gcGFyYW1zLmhhbmRzaGFrZUNhbGxiYWNrO1xuICAgIGluaXRXZWJTb2NrZXQodXJsLCBjYik7XG4gIH07XG5cbiAgdmFyIGluaXRXZWJTb2NrZXQgPSBmdW5jdGlvbih1cmwsY2Ipe1xuICAgIHZhciBvbm9wZW4gPSBmdW5jdGlvbihldmVudCl7XG4gICAgICB2YXIgb2JqID0gUGFja2FnZS5lbmNvZGUoUGFja2FnZS5UWVBFX0hBTkRTSEFLRSwgUHJvdG9jb2wuc3RyZW5jb2RlKEpTT04uc3RyaW5naWZ5KGhhbmRzaGFrZUJ1ZmZlcikpKTtcbiAgICAgIHNlbmQob2JqKTtcbiAgICB9O1xuICAgIHZhciBvbm1lc3NhZ2UgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgcHJvY2Vzc1BhY2thZ2UoUGFja2FnZS5kZWNvZGUoZXZlbnQuZGF0YSksIGNiKTtcbiAgICAgIC8vIG5ldyBwYWNrYWdlIGFycml2ZWQsIHVwZGF0ZSB0aGUgaGVhcnRiZWF0IHRpbWVvdXRcbiAgICAgIGlmKGhlYXJ0YmVhdFRpbWVvdXQpIHtcbiAgICAgICAgbmV4dEhlYXJ0YmVhdFRpbWVvdXQgPSBEYXRlLm5vdygpICsgaGVhcnRiZWF0VGltZW91dDtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBvbmVycm9yID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHBvbWVsby5lbWl0KCdpby1lcnJvcicsIGV2ZW50KTtcbiAgICAgIGNjLmVycm9yKCdzb2NrZXQgZXJyb3I6ICcsIGV2ZW50KTtcbiAgICB9O1xuICAgIHZhciBvbmNsb3NlID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgcG9tZWxvLmVtaXQoJ2Nsb3NlJyxldmVudCk7XG4gICAgICBwb21lbG8uZW1pdCgnZGlzY29ubmVjdCcsIGV2ZW50KTtcbiAgICAgIGNjLmVycm9yKCdzb2NrZXQgY2xvc2U6ICcsIGV2ZW50KTtcbiAgICB9O1xuICAgIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQodXJsKTtcbiAgICBzb2NrZXQuYmluYXJ5VHlwZSA9ICdhcnJheWJ1ZmZlcic7XG4gICAgc29ja2V0Lm9ub3BlbiA9IG9ub3BlbjtcbiAgICBzb2NrZXQub25tZXNzYWdlID0gb25tZXNzYWdlO1xuICAgIHNvY2tldC5vbmVycm9yID0gb25lcnJvcjtcbiAgICBzb2NrZXQub25jbG9zZSA9IG9uY2xvc2U7XG4gIH07XG5cbiAgcG9tZWxvLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgICBpZihzb2NrZXQpIHtcbiAgICAgIGlmKHNvY2tldC5kaXNjb25uZWN0KSBzb2NrZXQuZGlzY29ubmVjdCgpO1xuICAgICAgaWYoc29ja2V0LmNsb3NlKSBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIGNjLmxvZygnZGlzY29ubmVjdCcpO1xuICAgICAgc29ja2V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZihoZWFydGJlYXRJZCkge1xuICAgICAgY2xlYXJUaW1lb3V0KGhlYXJ0YmVhdElkKTtcbiAgICAgIGhlYXJ0YmVhdElkID0gbnVsbDtcbiAgICB9XG4gICAgaWYoaGVhcnRiZWF0VGltZW91dElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQoaGVhcnRiZWF0VGltZW91dElkKTtcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXRJZCA9IG51bGw7XG4gICAgfVxuICB9O1xuXG4gIHBvbWVsby5yZXF1ZXN0ID0gZnVuY3Rpb24ocm91dGUsIG1zZywgY2IpIHtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyICYmIHR5cGVvZiBtc2cgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNiID0gbXNnO1xuICAgICAgbXNnID0ge307XG4gICAgfSBlbHNlIHtcbiAgICAgIG1zZyA9IG1zZyB8fCB7fTtcbiAgICB9XG4gICAgcm91dGUgPSByb3V0ZSB8fCBtc2cucm91dGU7XG4gICAgaWYoIXJvdXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmVxSWQrKztcbiAgICBzZW5kTWVzc2FnZShyZXFJZCwgcm91dGUsIG1zZyk7XG5cbiAgICBjYWxsYmFja3NbcmVxSWRdID0gY2I7XG4gICAgcm91dGVNYXBbcmVxSWRdID0gcm91dGU7XG4gIH07XG5cbiAgcG9tZWxvLm5vdGlmeSA9IGZ1bmN0aW9uKHJvdXRlLCBtc2cpIHtcbiAgICBtc2cgPSBtc2cgfHwge307XG4gICAgc2VuZE1lc3NhZ2UoMCwgcm91dGUsIG1zZyk7XG4gIH07XG5cbiAgdmFyIHNlbmRNZXNzYWdlID0gZnVuY3Rpb24ocmVxSWQsIHJvdXRlLCBtc2cpIHtcbiAgICB2YXIgdHlwZSA9IHJlcUlkID8gTWVzc2FnZS5UWVBFX1JFUVVFU1QgOiBNZXNzYWdlLlRZUEVfTk9USUZZO1xuXG4gICAgLy9jb21wcmVzcyBtZXNzYWdlIGJ5IHByb3RvYnVmXG4gICAgdmFyIHByb3RvcyA9ICEhcG9tZWxvLmRhdGEucHJvdG9zP3BvbWVsby5kYXRhLnByb3Rvcy5jbGllbnQ6e307XG4gICAgaWYoISFwcm90b3Nbcm91dGVdKXtcbiAgICAgIG1zZyA9IHByb3RvYnVmLmVuY29kZShyb3V0ZSwgbXNnKTtcbiAgICB9ZWxzZXtcbiAgICAgIG1zZyA9IFByb3RvY29sLnN0cmVuY29kZShKU09OLnN0cmluZ2lmeShtc2cpKTtcbiAgICB9XG5cblxuICAgIHZhciBjb21wcmVzc1JvdXRlID0gMDtcbiAgICBpZihwb21lbG8uZGljdCAmJiBwb21lbG8uZGljdFtyb3V0ZV0pe1xuICAgICAgcm91dGUgPSBwb21lbG8uZGljdFtyb3V0ZV07XG4gICAgICBjb21wcmVzc1JvdXRlID0gMTtcbiAgICB9XG5cbiAgICBtc2cgPSBNZXNzYWdlLmVuY29kZShyZXFJZCwgdHlwZSwgY29tcHJlc3NSb3V0ZSwgcm91dGUsIG1zZyk7XG4gICAgdmFyIHBhY2tldCA9IFBhY2thZ2UuZW5jb2RlKFBhY2thZ2UuVFlQRV9EQVRBLCBtc2cpO1xuICAgIHNlbmQocGFja2V0KTtcbiAgfTtcblxuICB2YXIgc2VuZCA9IGZ1bmN0aW9uKHBhY2tldCl7XG4gICAgc29ja2V0LnNlbmQocGFja2V0LmJ1ZmZlcik7XG4gIH07XG5cblxuICB2YXIgaGFuZGxlciA9IHt9O1xuXG4gIHZhciBoZWFydGJlYXQgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgaWYoIWhlYXJ0YmVhdEludGVydmFsKSB7XG4gICAgICAvLyBubyBoZWFydGJlYXRcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgb2JqID0gUGFja2FnZS5lbmNvZGUoUGFja2FnZS5UWVBFX0hFQVJUQkVBVCk7XG4gICAgaWYoaGVhcnRiZWF0VGltZW91dElkKSB7XG4gICAgICBjbGVhclRpbWVvdXQoaGVhcnRiZWF0VGltZW91dElkKTtcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXRJZCA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYoaGVhcnRiZWF0SWQpIHtcbiAgICAgIC8vIGFscmVhZHkgaW4gYSBoZWFydGJlYXQgaW50ZXJ2YWxcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBoZWFydGJlYXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBoZWFydGJlYXRJZCA9IG51bGw7XG4gICAgICBzZW5kKG9iaik7XG5cbiAgICAgIG5leHRIZWFydGJlYXRUaW1lb3V0ID0gRGF0ZS5ub3coKSArIGhlYXJ0YmVhdFRpbWVvdXQ7XG4gICAgICBoZWFydGJlYXRUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KGhlYXJ0YmVhdFRpbWVvdXRDYiwgaGVhcnRiZWF0VGltZW91dCk7XG4gICAgfSwgaGVhcnRiZWF0SW50ZXJ2YWwpO1xuICB9O1xuXG4gIHZhciBoZWFydGJlYXRUaW1lb3V0Q2IgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZ2FwID0gbmV4dEhlYXJ0YmVhdFRpbWVvdXQgLSBEYXRlLm5vdygpO1xuICAgIGlmKGdhcCA+IGdhcFRocmVzaG9sZCkge1xuICAgICAgaGVhcnRiZWF0VGltZW91dElkID0gc2V0VGltZW91dChoZWFydGJlYXRUaW1lb3V0Q2IsIGdhcCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNjLmVycm9yKCdzZXJ2ZXIgaGVhcnRiZWF0IHRpbWVvdXQnKTtcbiAgICAgIHBvbWVsby5lbWl0KCdoZWFydGJlYXQgdGltZW91dCcpO1xuICAgICAgcG9tZWxvLmRpc2Nvbm5lY3QoKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGhhbmRzaGFrZSA9IGZ1bmN0aW9uKGRhdGEpe1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKFByb3RvY29sLnN0cmRlY29kZShkYXRhKSk7XG4gICAgaWYoZGF0YS5jb2RlID09PSBSRVNfT0xEX0NMSUVOVCkge1xuICAgICAgcG9tZWxvLmVtaXQoJ2Vycm9yJywgJ2NsaWVudCB2ZXJzaW9uIG5vdCBmdWxsZmlsbCcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKGRhdGEuY29kZSAhPT0gUkVTX09LKSB7XG4gICAgICBwb21lbG8uZW1pdCgnZXJyb3InLCAnaGFuZHNoYWtlIGZhaWwnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBoYW5kc2hha2VJbml0KGRhdGEpO1xuXG4gICAgdmFyIG9iaiA9IFBhY2thZ2UuZW5jb2RlKFBhY2thZ2UuVFlQRV9IQU5EU0hBS0VfQUNLKTtcbiAgICBzZW5kKG9iaik7XG4gICAgaWYoaW5pdENhbGxiYWNrKSB7XG4gICAgICBpbml0Q2FsbGJhY2soc29ja2V0KTtcbiAgICAgIGluaXRDYWxsYmFjayA9IG51bGw7XG4gICAgfVxuICB9O1xuXG4gIHZhciBvbkRhdGEgPSBmdW5jdGlvbihkYXRhKXtcbiAgICAvL3Byb2J1ZmYgZGVjb2RlXG4gICAgdmFyIG1zZyA9IE1lc3NhZ2UuZGVjb2RlKGRhdGEpO1xuXG4gICAgaWYobXNnLmlkID4gMCl7XG4gICAgICBtc2cucm91dGUgPSByb3V0ZU1hcFttc2cuaWRdO1xuICAgICAgZGVsZXRlIHJvdXRlTWFwW21zZy5pZF07XG4gICAgICBpZighbXNnLnJvdXRlKXtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIG1zZy5ib2R5ID0gZGVDb21wb3NlKG1zZyk7XG5cbiAgICBwcm9jZXNzTWVzc2FnZShwb21lbG8sIG1zZyk7XG4gIH07XG5cbiAgdmFyIG9uS2ljayA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICBkYXRhID0gSlNPTi5wYXJzZShQcm90b2NvbC5zdHJkZWNvZGUoZGF0YSkpO1xuICAgIHBvbWVsby5lbWl0KCdvbktpY2snLCBkYXRhKTtcbiAgfTtcblxuICBoYW5kbGVyc1tQYWNrYWdlLlRZUEVfSEFORFNIQUtFXSA9IGhhbmRzaGFrZTtcbiAgaGFuZGxlcnNbUGFja2FnZS5UWVBFX0hFQVJUQkVBVF0gPSBoZWFydGJlYXQ7XG4gIGhhbmRsZXJzW1BhY2thZ2UuVFlQRV9EQVRBXSA9IG9uRGF0YTtcbiAgaGFuZGxlcnNbUGFja2FnZS5UWVBFX0tJQ0tdID0gb25LaWNrO1xuXG4gIHZhciBwcm9jZXNzUGFja2FnZSA9IGZ1bmN0aW9uKG1zZ3MpIHtcbiAgICBpZihBcnJheS5pc0FycmF5KG1zZ3MpKSB7XG4gICAgICBmb3IodmFyIGk9MDsgaTxtc2dzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBtc2cgPSBtc2dzW2ldO1xuICAgICAgICBoYW5kbGVyc1ttc2cudHlwZV0obXNnLmJvZHkpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGVyc1ttc2dzLnR5cGVdKG1zZ3MuYm9keSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBwcm9jZXNzTWVzc2FnZSA9IGZ1bmN0aW9uKHBvbWVsbywgbXNnKSB7XG4gICAgaWYoIW1zZy5pZCkge1xuICAgICAgLy8gc2VydmVyIHB1c2ggbWVzc2FnZVxuICAgICAgcG9tZWxvLmVtaXQobXNnLnJvdXRlLCBtc2cuYm9keSk7XG4gICAgfVxuXG4gICAgLy9pZiBoYXZlIGEgaWQgdGhlbiBmaW5kIHRoZSBjYWxsYmFjayBmdW5jdGlvbiB3aXRoIHRoZSByZXF1ZXN0XG4gICAgdmFyIGNiID0gY2FsbGJhY2tzW21zZy5pZF07XG5cbiAgICBkZWxldGUgY2FsbGJhY2tzW21zZy5pZF07XG4gICAgaWYodHlwZW9mIGNiICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2IobXNnLmJvZHkpO1xuICAgIHJldHVybjtcbiAgfTtcblxuICB2YXIgcHJvY2Vzc01lc3NhZ2VCYXRjaCA9IGZ1bmN0aW9uKHBvbWVsbywgbXNncykge1xuICAgIGZvcih2YXIgaT0wLCBsPW1zZ3MubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgcHJvY2Vzc01lc3NhZ2UocG9tZWxvLCBtc2dzW2ldKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGRlQ29tcG9zZSA9IGZ1bmN0aW9uKG1zZyl7XG4gICAgdmFyIHByb3RvcyA9ICEhcG9tZWxvLmRhdGEucHJvdG9zP3BvbWVsby5kYXRhLnByb3Rvcy5zZXJ2ZXI6e307XG4gICAgdmFyIGFiYnJzID0gcG9tZWxvLmRhdGEuYWJicnM7XG4gICAgdmFyIHJvdXRlID0gbXNnLnJvdXRlO1xuXG4gICAgLy9EZWNvbXBvc2Ugcm91dGUgZnJvbSBkaWN0XG4gICAgaWYobXNnLmNvbXByZXNzUm91dGUpIHtcbiAgICAgIGlmKCFhYmJyc1tyb3V0ZV0pe1xuICAgICAgICByZXR1cm4ge307XG4gICAgICB9XG5cbiAgICAgIHJvdXRlID0gbXNnLnJvdXRlID0gYWJicnNbcm91dGVdO1xuICAgIH1cbiAgICBpZighIXByb3Rvc1tyb3V0ZV0pe1xuICAgICAgcmV0dXJuIHByb3RvYnVmLmRlY29kZShyb3V0ZSwgbXNnLmJvZHkpO1xuICAgIH1lbHNle1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UoUHJvdG9jb2wuc3RyZGVjb2RlKG1zZy5ib2R5KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1zZztcbiAgfTtcblxuICB2YXIgaGFuZHNoYWtlSW5pdCA9IGZ1bmN0aW9uKGRhdGEpe1xuICAgIGlmKGRhdGEuc3lzICYmIGRhdGEuc3lzLmhlYXJ0YmVhdCkge1xuICAgICAgaGVhcnRiZWF0SW50ZXJ2YWwgPSBkYXRhLnN5cy5oZWFydGJlYXQgKiAxMDAwOyAgIC8vIGhlYXJ0YmVhdCBpbnRlcnZhbFxuICAgICAgaGVhcnRiZWF0VGltZW91dCA9IGhlYXJ0YmVhdEludGVydmFsICogMjsgICAgICAgIC8vIG1heCBoZWFydGJlYXQgdGltZW91dFxuICAgIH0gZWxzZSB7XG4gICAgICBoZWFydGJlYXRJbnRlcnZhbCA9IDA7XG4gICAgICBoZWFydGJlYXRUaW1lb3V0ID0gMDtcbiAgICB9XG5cbiAgICBpbml0RGF0YShkYXRhKTtcblxuICAgIGlmKHR5cGVvZiBoYW5kc2hha2VDYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaGFuZHNoYWtlQ2FsbGJhY2soZGF0YS51c2VyKTtcbiAgICB9XG4gIH07XG5cbiAgLy9Jbml0aWxpemUgZGF0YSB1c2VkIGluIHBvbWVsbyBjbGllbnRcbiAgdmFyIGluaXREYXRhID0gZnVuY3Rpb24oZGF0YSl7XG4gICAgaWYoIWRhdGEgfHwgIWRhdGEuc3lzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHBvbWVsby5kYXRhID0gcG9tZWxvLmRhdGEgfHwge307XG4gICAgdmFyIGRpY3QgPSBkYXRhLnN5cy5kaWN0O1xuICAgIHZhciBwcm90b3MgPSBkYXRhLnN5cy5wcm90b3M7XG5cbiAgICAvL0luaXQgY29tcHJlc3MgZGljdFxuICAgIGlmKGRpY3Qpe1xuICAgICAgcG9tZWxvLmRhdGEuZGljdCA9IGRpY3Q7XG4gICAgICBwb21lbG8uZGF0YS5hYmJycyA9IHt9O1xuXG4gICAgICBmb3IodmFyIHJvdXRlIGluIGRpY3Qpe1xuICAgICAgICBwb21lbG8uZGF0YS5hYmJyc1tkaWN0W3JvdXRlXV0gPSByb3V0ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvL0luaXQgcHJvdG9idWYgcHJvdG9zXG4gICAgaWYocHJvdG9zKXtcbiAgICAgIHBvbWVsby5kYXRhLnByb3RvcyA9IHtcbiAgICAgICAgc2VydmVyIDogcHJvdG9zLnNlcnZlciB8fCB7fSxcbiAgICAgICAgY2xpZW50IDogcHJvdG9zLmNsaWVudCB8fCB7fVxuICAgICAgfTtcbiAgICAgIGlmKCEhcHJvdG9idWYpe1xuICAgICAgICBwcm90b2J1Zi5pbml0KHtlbmNvZGVyUHJvdG9zOiBwcm90b3MuY2xpZW50LCBkZWNvZGVyUHJvdG9zOiBwcm90b3Muc2VydmVyfSk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIG1vZHVsZS5leHBvcnRzID0gcG9tZWxvO1xufSkoKTtcbiIsIi8qIFByb3RvY29sQnVmZmVyIGNsaWVudCAwLjEuMCovXG5cbi8qKlxuICogcG9tZWxvLXByb3RvYnVmXG4gKiBAYXV0aG9yIDx6aGFuZzA5MzVAZ21haWwuY29tPlxuICovXG5cbi8qKlxuICogUHJvdG9jb2wgYnVmZmVyIHJvb3RcbiAqIEluIGJyb3dzZXIsIGl0IHdpbGwgYmUgd2luZG93LnByb3RidWZcbiAqL1xuKGZ1bmN0aW9uIChleHBvcnRzLCBnbG9iYWwpe1xuICB2YXIgUHJvdG9idWYgPSBleHBvcnRzO1xuXG4gIFByb3RvYnVmLmluaXQgPSBmdW5jdGlvbihvcHRzKXtcbiAgICAvL09uIHRoZSBzZXJ2ZXJzaWRlLCB1c2Ugc2VydmVyUHJvdG9zIHRvIGVuY29kZSBtZXNzYWdlcyBzZW5kIHRvIGNsaWVudFxuICAgIFByb3RvYnVmLmVuY29kZXIuaW5pdChvcHRzLmVuY29kZXJQcm90b3MpO1xuXG4gICAgLy9PbiB0aGUgc2VydmVyc2lkZSwgdXNlciBjbGllbnRQcm90b3MgdG8gZGVjb2RlIG1lc3NhZ2VzIHJlY2VpdmUgZnJvbSBjbGllbnRzXG4gICAgUHJvdG9idWYuZGVjb2Rlci5pbml0KG9wdHMuZGVjb2RlclByb3Rvcyk7XG4gIH07XG5cbiAgUHJvdG9idWYuZW5jb2RlID0gZnVuY3Rpb24oa2V5LCBtc2cpe1xuICAgIHJldHVybiBQcm90b2J1Zi5lbmNvZGVyLmVuY29kZShrZXksIG1zZyk7XG4gIH07XG5cbiAgUHJvdG9idWYuZGVjb2RlID0gZnVuY3Rpb24oa2V5LCBtc2cpe1xuICAgIHJldHVybiBQcm90b2J1Zi5kZWNvZGVyLmRlY29kZShrZXksIG1zZyk7XG4gIH07XG5cbiAgLy8gZXhwb3J0cyB0byBzdXBwb3J0IGZvciBjb21wb25lbnRzXG4gIG1vZHVsZS5leHBvcnRzID0gUHJvdG9idWY7XG4gIGlmKHR5cGVvZih3aW5kb3cpICE9IFwidW5kZWZpbmVkXCIpIHtcbiAgICB3aW5kb3cucHJvdG9idWYgPSBQcm90b2J1ZjtcbiAgfVxuXG59KSh0eXBlb2Yod2luZG93KSA9PSBcInVuZGVmaW5lZFwiID8gbW9kdWxlLmV4cG9ydHMgOnt9LCB0aGlzKTtcblxuLyoqXG4gKiBjb25zdGFudHNcbiAqL1xuKGZ1bmN0aW9uIChleHBvcnRzLCBnbG9iYWwpe1xuICB2YXIgY29uc3RhbnRzID0gZXhwb3J0cy5jb25zdGFudHMgPSB7fTtcblxuICBjb25zdGFudHMuVFlQRVMgPSB7XG4gICAgdUludDMyIDogMCxcbiAgICBzSW50MzIgOiAwLFxuICAgIGludDMyIDogMCxcbiAgICBkb3VibGUgOiAxLFxuICAgIHN0cmluZyA6IDIsXG4gICAgbWVzc2FnZSA6IDIsXG4gICAgZmxvYXQgOiA1XG4gIH07XG5cbn0pKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcHJvdG9idWYgPyBwcm90b2J1ZiA6IG1vZHVsZS5leHBvcnRzLCB0aGlzKTtcblxuLyoqXG4gKiB1dGlsIG1vZHVsZVxuICovXG4oZnVuY3Rpb24gKGV4cG9ydHMsIGdsb2JhbCl7XG5cbiAgdmFyIFV0aWwgPSBleHBvcnRzLnV0aWwgPSB7fTtcblxuICBVdGlsLmlzU2ltcGxlVHlwZSA9IGZ1bmN0aW9uKHR5cGUpe1xuICAgIHJldHVybiAoIHR5cGUgPT09ICd1SW50MzInIHx8XG4gICAgICAgICAgICAgdHlwZSA9PT0gJ3NJbnQzMicgfHxcbiAgICAgICAgICAgICB0eXBlID09PSAnaW50MzInICB8fFxuICAgICAgICAgICAgIHR5cGUgPT09ICd1SW50NjQnIHx8XG4gICAgICAgICAgICAgdHlwZSA9PT0gJ3NJbnQ2NCcgfHxcbiAgICAgICAgICAgICB0eXBlID09PSAnZmxvYXQnICB8fFxuICAgICAgICAgICAgIHR5cGUgPT09ICdkb3VibGUnICk7XG4gIH07XG5cbn0pKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcHJvdG9idWYgPyBwcm90b2J1ZiA6IG1vZHVsZS5leHBvcnRzLCB0aGlzKTtcblxuLyoqXG4gKiBjb2RlYyBtb2R1bGVcbiAqL1xuKGZ1bmN0aW9uIChleHBvcnRzLCBnbG9iYWwpe1xuXG4gIHZhciBDb2RlYyA9IGV4cG9ydHMuY29kZWMgPSB7fTtcblxuICB2YXIgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKDgpO1xuICB2YXIgZmxvYXQzMkFycmF5ID0gbmV3IEZsb2F0MzJBcnJheShidWZmZXIpO1xuICB2YXIgZmxvYXQ2NEFycmF5ID0gbmV3IEZsb2F0NjRBcnJheShidWZmZXIpO1xuICB2YXIgdUludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG5cbiAgQ29kZWMuZW5jb2RlVUludDMyID0gZnVuY3Rpb24obil7XG4gICAgdmFyIG4gPSBwYXJzZUludChuKTtcbiAgICBpZihpc05hTihuKSB8fCBuIDwgMCl7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgZG97XG4gICAgICB2YXIgdG1wID0gbiAlIDEyODtcbiAgICAgIHZhciBuZXh0ID0gTWF0aC5mbG9vcihuLzEyOCk7XG5cbiAgICAgIGlmKG5leHQgIT09IDApe1xuICAgICAgICB0bXAgPSB0bXAgKyAxMjg7XG4gICAgICB9XG4gICAgICByZXN1bHQucHVzaCh0bXApO1xuICAgICAgbiA9IG5leHQ7XG4gICAgfXdoaWxlKG4gIT09IDApO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICBDb2RlYy5lbmNvZGVTSW50MzIgPSBmdW5jdGlvbihuKXtcbiAgICB2YXIgbiA9IHBhcnNlSW50KG4pO1xuICAgIGlmKGlzTmFOKG4pKXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBuID0gbjwwPyhNYXRoLmFicyhuKSoyLTEpOm4qMjtcblxuICAgIHJldHVybiBDb2RlYy5lbmNvZGVVSW50MzIobik7XG4gIH07XG5cbiAgQ29kZWMuZGVjb2RlVUludDMyID0gZnVuY3Rpb24oYnl0ZXMpe1xuICAgIHZhciBuID0gMDtcblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkrKyl7XG4gICAgICB2YXIgbSA9IHBhcnNlSW50KGJ5dGVzW2ldKTtcbiAgICAgIG4gPSBuICsgKChtICYgMHg3ZikgKiBNYXRoLnBvdygyLCg3KmkpKSk7XG4gICAgICBpZihtIDwgMTI4KXtcbiAgICAgICAgcmV0dXJuIG47XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG47XG4gIH07XG5cblxuICBDb2RlYy5kZWNvZGVTSW50MzIgPSBmdW5jdGlvbihieXRlcyl7XG4gICAgdmFyIG4gPSB0aGlzLmRlY29kZVVJbnQzMihieXRlcyk7XG4gICAgdmFyIGZsYWcgPSAoKG4lMikgPT09IDEpPy0xOjE7XG5cbiAgICBuID0gKChuJTIgKyBuKS8yKSpmbGFnO1xuXG4gICAgcmV0dXJuIG47XG4gIH07XG5cbiAgQ29kZWMuZW5jb2RlRmxvYXQgPSBmdW5jdGlvbihmbG9hdCl7XG4gICAgZmxvYXQzMkFycmF5WzBdID0gZmxvYXQ7XG4gICAgcmV0dXJuIHVJbnQ4QXJyYXk7XG4gIH07XG5cbiAgQ29kZWMuZGVjb2RlRmxvYXQgPSBmdW5jdGlvbihieXRlcywgb2Zmc2V0KXtcbiAgICBpZighYnl0ZXMgfHwgYnl0ZXMubGVuZ3RoIDwgKG9mZnNldCArNCkpe1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IDQ7IGkrKyl7XG4gICAgICB1SW50OEFycmF5W2ldID0gYnl0ZXNbb2Zmc2V0ICsgaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZsb2F0MzJBcnJheVswXTtcbiAgfTtcblxuICBDb2RlYy5lbmNvZGVEb3VibGUgPSBmdW5jdGlvbihkb3VibGUpe1xuICAgIGZsb2F0NjRBcnJheVswXSA9IGRvdWJsZTtcbiAgICByZXR1cm4gdUludDhBcnJheS5zdWJhcnJheSgwLCA4KTtcbiAgfTtcblxuICBDb2RlYy5kZWNvZGVEb3VibGUgPSBmdW5jdGlvbihieXRlcywgb2Zmc2V0KXtcbiAgICBpZighYnl0ZXMgfHwgYnl0ZXMubGVuZ3RoIDwgKDggKyBvZmZzZXQpKXtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCA4OyBpKyspe1xuICAgICAgdUludDhBcnJheVtpXSA9IGJ5dGVzW29mZnNldCArIGldO1xuICAgIH1cblxuICAgIHJldHVybiBmbG9hdDY0QXJyYXlbMF07XG4gIH07XG5cbiAgQ29kZWMuZW5jb2RlU3RyID0gZnVuY3Rpb24oYnl0ZXMsIG9mZnNldCwgc3RyKXtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKXtcbiAgICAgIHZhciBjb2RlID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICB2YXIgY29kZXMgPSBlbmNvZGUyVVRGOChjb2RlKTtcblxuICAgICAgZm9yKHZhciBqID0gMDsgaiA8IGNvZGVzLmxlbmd0aDsgaisrKXtcbiAgICAgICAgYnl0ZXNbb2Zmc2V0XSA9IGNvZGVzW2pdO1xuICAgICAgICBvZmZzZXQrKztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9O1xuXG4gIC8qKlxuICAgKiBEZWNvZGUgc3RyaW5nIGZyb20gdXRmOCBieXRlc1xuICAgKi9cbiAgQ29kZWMuZGVjb2RlU3RyID0gZnVuY3Rpb24oYnl0ZXMsIG9mZnNldCwgbGVuZ3RoKXtcbiAgICB2YXIgYXJyYXkgPSBbXTtcbiAgICB2YXIgZW5kID0gb2Zmc2V0ICsgbGVuZ3RoO1xuXG4gICAgd2hpbGUob2Zmc2V0IDwgZW5kKXtcbiAgICAgIHZhciBjb2RlID0gMDtcblxuICAgICAgaWYoYnl0ZXNbb2Zmc2V0XSA8IDEyOCl7XG4gICAgICAgIGNvZGUgPSBieXRlc1tvZmZzZXRdO1xuXG4gICAgICAgIG9mZnNldCArPSAxO1xuICAgICAgfWVsc2UgaWYoYnl0ZXNbb2Zmc2V0XSA8IDIyNCl7XG4gICAgICAgIGNvZGUgPSAoKGJ5dGVzW29mZnNldF0gJiAweDNmKTw8NikgKyAoYnl0ZXNbb2Zmc2V0KzFdICYgMHgzZik7XG4gICAgICAgIG9mZnNldCArPSAyO1xuICAgICAgfWVsc2V7XG4gICAgICAgIGNvZGUgPSAoKGJ5dGVzW29mZnNldF0gJiAweDBmKTw8MTIpICsgKChieXRlc1tvZmZzZXQrMV0gJiAweDNmKTw8NikgKyAoYnl0ZXNbb2Zmc2V0KzJdICYgMHgzZik7XG4gICAgICAgIG9mZnNldCArPSAzO1xuICAgICAgfVxuXG4gICAgICBhcnJheS5wdXNoKGNvZGUpO1xuXG4gICAgfVxuXG4gICAgdmFyIHN0ciA9ICcnO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7KXtcbiAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGFycmF5LnNsaWNlKGksIGkgKyAxMDAwMCkpO1xuICAgICAgaSArPSAxMDAwMDtcbiAgICB9XG5cbiAgICByZXR1cm4gc3RyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGJ5dGUgbGVuZ3RoIG9mIHRoZSBzdHIgdXNlIHV0ZjhcbiAgICovXG4gIENvZGVjLmJ5dGVMZW5ndGggPSBmdW5jdGlvbihzdHIpe1xuICAgIGlmKHR5cGVvZihzdHIpICE9PSAnc3RyaW5nJyl7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfVxuXG4gICAgdmFyIGxlbmd0aCA9IDA7XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKXtcbiAgICAgIHZhciBjb2RlID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICBsZW5ndGggKz0gY29kZUxlbmd0aChjb2RlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbGVuZ3RoO1xuICB9O1xuXG4gIC8qKlxuICAgKiBFbmNvZGUgYSB1bmljb2RlMTYgY2hhciBjb2RlIHRvIHV0ZjggYnl0ZXNcbiAgICovXG4gIGZ1bmN0aW9uIGVuY29kZTJVVEY4KGNoYXJDb2RlKXtcbiAgICBpZihjaGFyQ29kZSA8PSAweDdmKXtcbiAgICAgIHJldHVybiBbY2hhckNvZGVdO1xuICAgIH1lbHNlIGlmKGNoYXJDb2RlIDw9IDB4N2ZmKXtcbiAgICAgIHJldHVybiBbMHhjMHwoY2hhckNvZGU+PjYpLCAweDgwfChjaGFyQ29kZSAmIDB4M2YpXTtcbiAgICB9ZWxzZXtcbiAgICAgIHJldHVybiBbMHhlMHwoY2hhckNvZGU+PjEyKSwgMHg4MHwoKGNoYXJDb2RlICYgMHhmYzApPj42KSwgMHg4MHwoY2hhckNvZGUgJiAweDNmKV07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY29kZUxlbmd0aChjb2RlKXtcbiAgICBpZihjb2RlIDw9IDB4N2Ype1xuICAgICAgcmV0dXJuIDE7XG4gICAgfWVsc2UgaWYoY29kZSA8PSAweDdmZil7XG4gICAgICByZXR1cm4gMjtcbiAgICB9ZWxzZXtcbiAgICAgIHJldHVybiAzO1xuICAgIH1cbiAgfVxufSkoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBwcm90b2J1ZiA/IHByb3RvYnVmIDogbW9kdWxlLmV4cG9ydHMsIHRoaXMpO1xuXG4vKipcbiAqIGVuY29kZXIgbW9kdWxlXG4gKi9cbihmdW5jdGlvbiAoZXhwb3J0cywgZ2xvYmFsKXtcblxuICB2YXIgcHJvdG9idWYgPSBleHBvcnRzO1xuICB2YXIgTXNnRW5jb2RlciA9IGV4cG9ydHMuZW5jb2RlciA9IHt9O1xuXG4gIHZhciBjb2RlYyA9IHByb3RvYnVmLmNvZGVjO1xuICB2YXIgY29uc3RhbnQgPSBwcm90b2J1Zi5jb25zdGFudHM7XG4gIHZhciB1dGlsID0gcHJvdG9idWYudXRpbDtcblxuICBNc2dFbmNvZGVyLmluaXQgPSBmdW5jdGlvbihwcm90b3Mpe1xuICAgIHRoaXMucHJvdG9zID0gcHJvdG9zIHx8IHt9O1xuICB9O1xuXG4gIE1zZ0VuY29kZXIuZW5jb2RlID0gZnVuY3Rpb24ocm91dGUsIG1zZyl7XG4gICAgLy9HZXQgcHJvdG9zIGZyb20gcHJvdG9zIG1hcCB1c2UgdGhlIHJvdXRlIGFzIGtleVxuICAgIHZhciBwcm90b3MgPSB0aGlzLnByb3Rvc1tyb3V0ZV07XG5cbiAgICAvL0NoZWNrIG1zZ1xuICAgIGlmKCFjaGVja01zZyhtc2csIHByb3Rvcykpe1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy9TZXQgdGhlIGxlbmd0aCBvZiB0aGUgYnVmZmVyIDIgdGltZXMgYmlnZ2VyIHRvIHByZXZlbnQgb3ZlcmZsb3dcbiAgICB2YXIgbGVuZ3RoID0gY29kZWMuYnl0ZUxlbmd0aChKU09OLnN0cmluZ2lmeShtc2cpKTtcblxuICAgIC8vSW5pdCBidWZmZXIgYW5kIG9mZnNldFxuICAgIHZhciBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIobGVuZ3RoKTtcbiAgICB2YXIgdUludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gICAgdmFyIG9mZnNldCA9IDA7XG5cbiAgICBpZighIXByb3Rvcyl7XG4gICAgICBvZmZzZXQgPSBlbmNvZGVNc2codUludDhBcnJheSwgb2Zmc2V0LCBwcm90b3MsIG1zZyk7XG4gICAgICBpZihvZmZzZXQgPiAwKXtcbiAgICAgICAgcmV0dXJuIHVJbnQ4QXJyYXkuc3ViYXJyYXkoMCwgb2Zmc2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfTtcblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhlIG1zZyBmb2xsb3cgdGhlIGRlZmluYXRpb24gaW4gdGhlIHByb3Rvc1xuICAgKi9cbiAgZnVuY3Rpb24gY2hlY2tNc2cobXNnLCBwcm90b3Mpe1xuICAgIGlmKCFwcm90b3Mpe1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGZvcih2YXIgbmFtZSBpbiBwcm90b3Mpe1xuICAgICAgdmFyIHByb3RvID0gcHJvdG9zW25hbWVdO1xuXG4gICAgICAvL0FsbCByZXF1aXJlZCBlbGVtZW50IG11c3QgZXhpc3RcbiAgICAgIHN3aXRjaChwcm90by5vcHRpb24pe1xuICAgICAgICBjYXNlICdyZXF1aXJlZCcgOlxuICAgICAgICAgIGlmKHR5cGVvZihtc2dbbmFtZV0pID09PSAndW5kZWZpbmVkJyl7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICBjYXNlICdvcHRpb25hbCcgOlxuICAgICAgICAgIGlmKHR5cGVvZihtc2dbbmFtZV0pICE9PSAndW5kZWZpbmVkJyl7XG4gICAgICAgICAgICBpZighIXByb3Rvcy5fX21lc3NhZ2VzW3Byb3RvLnR5cGVdKXtcbiAgICAgICAgICAgICAgY2hlY2tNc2cobXNnW25hbWVdLCBwcm90b3MuX19tZXNzYWdlc1twcm90by50eXBlXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAncmVwZWF0ZWQnIDpcbiAgICAgICAgICAvL0NoZWNrIG5lc3QgbWVzc2FnZSBpbiByZXBlYXRlZCBlbGVtZW50c1xuICAgICAgICAgIGlmKCEhbXNnW25hbWVdICYmICEhcHJvdG9zLl9fbWVzc2FnZXNbcHJvdG8udHlwZV0pe1xuICAgICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG1zZ1tuYW1lXS5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICAgIGlmKCFjaGVja01zZyhtc2dbbmFtZV1baV0sIHByb3Rvcy5fX21lc3NhZ2VzW3Byb3RvLnR5cGVdKSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZU1zZyhidWZmZXIsIG9mZnNldCwgcHJvdG9zLCBtc2cpe1xuICAgIGZvcih2YXIgbmFtZSBpbiBtc2cpe1xuICAgICAgaWYoISFwcm90b3NbbmFtZV0pe1xuICAgICAgICB2YXIgcHJvdG8gPSBwcm90b3NbbmFtZV07XG5cbiAgICAgICAgc3dpdGNoKHByb3RvLm9wdGlvbil7XG4gICAgICAgICAgY2FzZSAncmVxdWlyZWQnIDpcbiAgICAgICAgICBjYXNlICdvcHRpb25hbCcgOlxuICAgICAgICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgZW5jb2RlVGFnKHByb3RvLnR5cGUsIHByb3RvLnRhZykpO1xuICAgICAgICAgICAgb2Zmc2V0ID0gZW5jb2RlUHJvcChtc2dbbmFtZV0sIHByb3RvLnR5cGUsIG9mZnNldCwgYnVmZmVyLCBwcm90b3MpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ3JlcGVhdGVkJyA6XG4gICAgICAgICAgICBpZihtc2dbbmFtZV0ubGVuZ3RoID4gMCl7XG4gICAgICAgICAgICAgIG9mZnNldCA9IGVuY29kZUFycmF5KG1zZ1tuYW1lXSwgcHJvdG8sIG9mZnNldCwgYnVmZmVyLCBwcm90b3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuY29kZVByb3AodmFsdWUsIHR5cGUsIG9mZnNldCwgYnVmZmVyLCBwcm90b3Mpe1xuICAgIHN3aXRjaCh0eXBlKXtcbiAgICAgIGNhc2UgJ3VJbnQzMic6XG4gICAgICAgIG9mZnNldCA9IHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZVVJbnQzMih2YWx1ZSkpO1xuICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdpbnQzMicgOlxuICAgICAgY2FzZSAnc0ludDMyJzpcbiAgICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlU0ludDMyKHZhbHVlKSk7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgY29kZWMuZW5jb2RlRmxvYXQodmFsdWUpKTtcbiAgICAgICAgb2Zmc2V0ICs9IDQ7XG4gICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RvdWJsZSc6XG4gICAgICAgIHdyaXRlQnl0ZXMoYnVmZmVyLCBvZmZzZXQsIGNvZGVjLmVuY29kZURvdWJsZSh2YWx1ZSkpO1xuICAgICAgICBvZmZzZXQgKz0gODtcbiAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgdmFyIGxlbmd0aCA9IGNvZGVjLmJ5dGVMZW5ndGgodmFsdWUpO1xuXG4gICAgICAgIC8vRW5jb2RlIGxlbmd0aFxuICAgICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVVSW50MzIobGVuZ3RoKSk7XG4gICAgICAgIC8vd3JpdGUgc3RyaW5nXG4gICAgICAgIGNvZGVjLmVuY29kZVN0cihidWZmZXIsIG9mZnNldCwgdmFsdWUpO1xuICAgICAgICBvZmZzZXQgKz0gbGVuZ3RoO1xuICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0IDpcbiAgICAgICAgaWYoISFwcm90b3MuX19tZXNzYWdlc1t0eXBlXSl7XG4gICAgICAgICAgLy9Vc2UgYSB0bXAgYnVmZmVyIHRvIGJ1aWxkIGFuIGludGVybmFsIG1zZ1xuICAgICAgICAgIHZhciB0bXBCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoY29kZWMuYnl0ZUxlbmd0aChKU09OLnN0cmluZ2lmeSh2YWx1ZSkpKTtcbiAgICAgICAgICB2YXIgbGVuZ3RoID0gMDtcblxuICAgICAgICAgIGxlbmd0aCA9IGVuY29kZU1zZyh0bXBCdWZmZXIsIGxlbmd0aCwgcHJvdG9zLl9fbWVzc2FnZXNbdHlwZV0sIHZhbHVlKTtcbiAgICAgICAgICAvL0VuY29kZSBsZW5ndGhcbiAgICAgICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVVSW50MzIobGVuZ3RoKSk7XG4gICAgICAgICAgLy9jb250YWN0IHRoZSBvYmplY3RcbiAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgYnVmZmVyW29mZnNldF0gPSB0bXBCdWZmZXJbaV07XG4gICAgICAgICAgICBvZmZzZXQrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHJldHVybiBvZmZzZXQ7XG4gIH1cblxuICAvKipcbiAgICogRW5jb2RlIHJlYXBlYXRlZCBwcm9wZXJ0aWVzLCBzaW1wbGUgbXNnIGFuZCBvYmplY3QgYXJlIGRlY29kZSBkaWZmZXJlbnRlZFxuICAgKi9cbiAgZnVuY3Rpb24gZW5jb2RlQXJyYXkoYXJyYXksIHByb3RvLCBvZmZzZXQsIGJ1ZmZlciwgcHJvdG9zKXtcbiAgICB2YXIgaSA9IDA7XG5cbiAgICBpZih1dGlsLmlzU2ltcGxlVHlwZShwcm90by50eXBlKSl7XG4gICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBlbmNvZGVUYWcocHJvdG8udHlwZSwgcHJvdG8udGFnKSk7XG4gICAgICBvZmZzZXQgPSB3cml0ZUJ5dGVzKGJ1ZmZlciwgb2Zmc2V0LCBjb2RlYy5lbmNvZGVVSW50MzIoYXJyYXkubGVuZ3RoKSk7XG4gICAgICBmb3IoaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKyl7XG4gICAgICAgIG9mZnNldCA9IGVuY29kZVByb3AoYXJyYXlbaV0sIHByb3RvLnR5cGUsIG9mZnNldCwgYnVmZmVyKTtcbiAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgIGZvcihpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKXtcbiAgICAgICAgb2Zmc2V0ID0gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgZW5jb2RlVGFnKHByb3RvLnR5cGUsIHByb3RvLnRhZykpO1xuICAgICAgICBvZmZzZXQgPSBlbmNvZGVQcm9wKGFycmF5W2ldLCBwcm90by50eXBlLCBvZmZzZXQsIGJ1ZmZlciwgcHJvdG9zKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVCeXRlcyhidWZmZXIsIG9mZnNldCwgYnl0ZXMpe1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkrKywgb2Zmc2V0Kyspe1xuICAgICAgYnVmZmVyW29mZnNldF0gPSBieXRlc1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gb2Zmc2V0O1xuICB9XG5cbiAgZnVuY3Rpb24gZW5jb2RlVGFnKHR5cGUsIHRhZyl7XG4gICAgdmFyIHZhbHVlID0gY29uc3RhbnQuVFlQRVNbdHlwZV18fDI7XG4gICAgcmV0dXJuIGNvZGVjLmVuY29kZVVJbnQzMigodGFnPDwzKXx2YWx1ZSk7XG4gIH1cbn0pKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcHJvdG9idWYgPyBwcm90b2J1ZiA6IG1vZHVsZS5leHBvcnRzLCB0aGlzKTtcblxuLyoqXG4gKiBkZWNvZGVyIG1vZHVsZVxuICovXG4oZnVuY3Rpb24gKGV4cG9ydHMsIGdsb2JhbCl7XG4gIHZhciBwcm90b2J1ZiA9IGV4cG9ydHM7XG4gIHZhciBNc2dEZWNvZGVyID0gZXhwb3J0cy5kZWNvZGVyID0ge307XG5cbiAgdmFyIGNvZGVjID0gcHJvdG9idWYuY29kZWM7XG4gIHZhciB1dGlsID0gcHJvdG9idWYudXRpbDtcblxuICB2YXIgYnVmZmVyO1xuICB2YXIgb2Zmc2V0ID0gMDtcblxuICBNc2dEZWNvZGVyLmluaXQgPSBmdW5jdGlvbihwcm90b3Mpe1xuICAgIHRoaXMucHJvdG9zID0gcHJvdG9zIHx8IHt9O1xuICB9O1xuXG4gIE1zZ0RlY29kZXIuc2V0UHJvdG9zID0gZnVuY3Rpb24ocHJvdG9zKXtcbiAgICBpZighIXByb3Rvcyl7XG4gICAgICB0aGlzLnByb3RvcyA9IHByb3RvcztcbiAgICB9XG4gIH07XG5cbiAgTXNnRGVjb2Rlci5kZWNvZGUgPSBmdW5jdGlvbihyb3V0ZSwgYnVmKXtcbiAgICB2YXIgcHJvdG9zID0gdGhpcy5wcm90b3Nbcm91dGVdO1xuXG4gICAgYnVmZmVyID0gYnVmO1xuICAgIG9mZnNldCA9IDA7XG5cbiAgICBpZighIXByb3Rvcyl7XG4gICAgICByZXR1cm4gZGVjb2RlTXNnKHt9LCBwcm90b3MsIGJ1ZmZlci5sZW5ndGgpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRlY29kZU1zZyhtc2csIHByb3RvcywgbGVuZ3RoKXtcbiAgICB3aGlsZShvZmZzZXQ8bGVuZ3RoKXtcbiAgICAgIHZhciBoZWFkID0gZ2V0SGVhZCgpO1xuICAgICAgdmFyIHR5cGUgPSBoZWFkLnR5cGU7XG4gICAgICB2YXIgdGFnID0gaGVhZC50YWc7XG4gICAgICB2YXIgbmFtZSA9IHByb3Rvcy5fX3RhZ3NbdGFnXTtcblxuICAgICAgc3dpdGNoKHByb3Rvc1tuYW1lXS5vcHRpb24pe1xuICAgICAgICBjYXNlICdvcHRpb25hbCcgOlxuICAgICAgICBjYXNlICdyZXF1aXJlZCcgOlxuICAgICAgICAgIG1zZ1tuYW1lXSA9IGRlY29kZVByb3AocHJvdG9zW25hbWVdLnR5cGUsIHByb3Rvcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyZXBlYXRlZCcgOlxuICAgICAgICAgIGlmKCFtc2dbbmFtZV0pe1xuICAgICAgICAgICAgbXNnW25hbWVdID0gW107XG4gICAgICAgICAgfVxuICAgICAgICAgIGRlY29kZUFycmF5KG1zZ1tuYW1lXSwgcHJvdG9zW25hbWVdLnR5cGUsIHByb3Rvcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtc2c7XG4gIH1cblxuICAvKipcbiAgICogVGVzdCBpZiB0aGUgZ2l2ZW4gbXNnIGlzIGZpbmlzaGVkXG4gICAqL1xuICBmdW5jdGlvbiBpc0ZpbmlzaChtc2csIHByb3Rvcyl7XG4gICAgcmV0dXJuICghcHJvdG9zLl9fdGFnc1twZWVrSGVhZCgpLnRhZ10pO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgcHJvcGVydHkgaGVhZCBmcm9tIHByb3RvYnVmXG4gICAqL1xuICBmdW5jdGlvbiBnZXRIZWFkKCl7XG4gICAgdmFyIHRhZyA9IGNvZGVjLmRlY29kZVVJbnQzMihnZXRCeXRlcygpKTtcblxuICAgIHJldHVybiB7XG4gICAgICB0eXBlIDogdGFnJjB4NyxcbiAgICAgIHRhZyA6IHRhZz4+M1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRhZyBoZWFkIHdpdGhvdXQgbW92ZSB0aGUgb2Zmc2V0XG4gICAqL1xuICBmdW5jdGlvbiBwZWVrSGVhZCgpe1xuICAgIHZhciB0YWcgPSBjb2RlYy5kZWNvZGVVSW50MzIocGVla0J5dGVzKCkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGUgOiB0YWcmMHg3LFxuICAgICAgdGFnIDogdGFnPj4zXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlY29kZVByb3AodHlwZSwgcHJvdG9zKXtcbiAgICBzd2l0Y2godHlwZSl7XG4gICAgICBjYXNlICd1SW50MzInOlxuICAgICAgICByZXR1cm4gY29kZWMuZGVjb2RlVUludDMyKGdldEJ5dGVzKCkpO1xuICAgICAgY2FzZSAnaW50MzInIDpcbiAgICAgIGNhc2UgJ3NJbnQzMicgOlxuICAgICAgICByZXR1cm4gY29kZWMuZGVjb2RlU0ludDMyKGdldEJ5dGVzKCkpO1xuICAgICAgY2FzZSAnZmxvYXQnIDpcbiAgICAgICAgdmFyIGZsb2F0ID0gY29kZWMuZGVjb2RlRmxvYXQoYnVmZmVyLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gNDtcbiAgICAgICAgcmV0dXJuIGZsb2F0O1xuICAgICAgY2FzZSAnZG91YmxlJyA6XG4gICAgICAgIHZhciBkb3VibGUgPSBjb2RlYy5kZWNvZGVEb3VibGUoYnVmZmVyLCBvZmZzZXQpO1xuICAgICAgICBvZmZzZXQgKz0gODtcbiAgICAgICAgcmV0dXJuIGRvdWJsZTtcbiAgICAgIGNhc2UgJ3N0cmluZycgOlxuICAgICAgICB2YXIgbGVuZ3RoID0gY29kZWMuZGVjb2RlVUludDMyKGdldEJ5dGVzKCkpO1xuXG4gICAgICAgIHZhciBzdHIgPSAgY29kZWMuZGVjb2RlU3RyKGJ1ZmZlciwgb2Zmc2V0LCBsZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gbGVuZ3RoO1xuXG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgICBkZWZhdWx0IDpcbiAgICAgICAgaWYoISFwcm90b3MgJiYgISFwcm90b3MuX19tZXNzYWdlc1t0eXBlXSl7XG4gICAgICAgICAgdmFyIGxlbmd0aCA9IGNvZGVjLmRlY29kZVVJbnQzMihnZXRCeXRlcygpKTtcbiAgICAgICAgICB2YXIgbXNnID0ge307XG4gICAgICAgICAgZGVjb2RlTXNnKG1zZywgcHJvdG9zLl9fbWVzc2FnZXNbdHlwZV0sIG9mZnNldCtsZW5ndGgpO1xuICAgICAgICAgIHJldHVybiBtc2c7XG4gICAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRlY29kZUFycmF5KGFycmF5LCB0eXBlLCBwcm90b3Mpe1xuICAgIGlmKHV0aWwuaXNTaW1wbGVUeXBlKHR5cGUpKXtcbiAgICAgIHZhciBsZW5ndGggPSBjb2RlYy5kZWNvZGVVSW50MzIoZ2V0Qnl0ZXMoKSk7XG5cbiAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKyl7XG4gICAgICAgIGFycmF5LnB1c2goZGVjb2RlUHJvcCh0eXBlKSk7XG4gICAgICB9XG4gICAgfWVsc2V7XG4gICAgICBhcnJheS5wdXNoKGRlY29kZVByb3AodHlwZSwgcHJvdG9zKSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0Qnl0ZXMoZmxhZyl7XG4gICAgdmFyIGJ5dGVzID0gW107XG4gICAgdmFyIHBvcyA9IG9mZnNldDtcbiAgICBmbGFnID0gZmxhZyB8fCBmYWxzZTtcblxuICAgIHZhciBiO1xuXG4gICAgZG97XG4gICAgICBiID0gYnVmZmVyW3Bvc107XG4gICAgICBieXRlcy5wdXNoKGIpO1xuICAgICAgcG9zKys7XG4gICAgfXdoaWxlKGIgPj0gMTI4KTtcblxuICAgIGlmKCFmbGFnKXtcbiAgICAgIG9mZnNldCA9IHBvcztcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVzO1xuICB9XG5cbiAgZnVuY3Rpb24gcGVla0J5dGVzKCl7XG4gICAgcmV0dXJuIGdldEJ5dGVzKHRydWUpO1xuICB9XG5cbn0pKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgcHJvdG9idWYgPyBwcm90b2J1ZiA6IG1vZHVsZS5leHBvcnRzLCB0aGlzKTtcblxuIiwiKGZ1bmN0aW9uIChleHBvcnRzLCBCeXRlQXJyYXksIGdsb2JhbCkge1xuICB2YXIgUHJvdG9jb2wgPSBleHBvcnRzO1xuXG4gIHZhciBQS0dfSEVBRF9CWVRFUyA9IDQ7XG4gIHZhciBNU0dfRkxBR19CWVRFUyA9IDE7XG4gIHZhciBNU0dfUk9VVEVfQ09ERV9CWVRFUyA9IDI7XG4gIHZhciBNU0dfSURfTUFYX0JZVEVTID0gNTtcbiAgdmFyIE1TR19ST1VURV9MRU5fQllURVMgPSAxO1xuXG4gIHZhciBNU0dfUk9VVEVfQ09ERV9NQVggPSAweGZmZmY7XG5cbiAgdmFyIE1TR19DT01QUkVTU19ST1VURV9NQVNLID0gMHgxO1xuICB2YXIgTVNHX1RZUEVfTUFTSyA9IDB4NztcblxuICB2YXIgUGFja2FnZSA9IFByb3RvY29sLlBhY2thZ2UgPSB7fTtcbiAgdmFyIE1lc3NhZ2UgPSBQcm90b2NvbC5NZXNzYWdlID0ge307XG5cbiAgUGFja2FnZS5UWVBFX0hBTkRTSEFLRSA9IDE7XG4gIFBhY2thZ2UuVFlQRV9IQU5EU0hBS0VfQUNLID0gMjtcbiAgUGFja2FnZS5UWVBFX0hFQVJUQkVBVCA9IDM7XG4gIFBhY2thZ2UuVFlQRV9EQVRBID0gNDtcbiAgUGFja2FnZS5UWVBFX0tJQ0sgPSA1O1xuXG4gIE1lc3NhZ2UuVFlQRV9SRVFVRVNUID0gMDtcbiAgTWVzc2FnZS5UWVBFX05PVElGWSA9IDE7XG4gIE1lc3NhZ2UuVFlQRV9SRVNQT05TRSA9IDI7XG4gIE1lc3NhZ2UuVFlQRV9QVVNIID0gMztcblxuICAvKipcbiAgICogcG9tZWxlIGNsaWVudCBlbmNvZGVcbiAgICogaWQgbWVzc2FnZSBpZDtcbiAgICogcm91dGUgbWVzc2FnZSByb3V0ZVxuICAgKiBtc2cgbWVzc2FnZSBib2R5XG4gICAqIHNvY2tldGlvIGN1cnJlbnQgc3VwcG9ydCBzdHJpbmdcbiAgICovXG4gIFByb3RvY29sLnN0cmVuY29kZSA9IGZ1bmN0aW9uKHN0cikge1xuICAgIHZhciBieXRlQXJyYXkgPSBuZXcgQnl0ZUFycmF5KHN0ci5sZW5ndGggKiAzKTtcbiAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKXtcbiAgICAgIHZhciBjaGFyQ29kZSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgdmFyIGNvZGVzID0gbnVsbDtcbiAgICAgIGlmKGNoYXJDb2RlIDw9IDB4N2Ype1xuICAgICAgICBjb2RlcyA9IFtjaGFyQ29kZV07XG4gICAgICB9ZWxzZSBpZihjaGFyQ29kZSA8PSAweDdmZil7XG4gICAgICAgIGNvZGVzID0gWzB4YzB8KGNoYXJDb2RlPj42KSwgMHg4MHwoY2hhckNvZGUgJiAweDNmKV07XG4gICAgICB9ZWxzZXtcbiAgICAgICAgY29kZXMgPSBbMHhlMHwoY2hhckNvZGU+PjEyKSwgMHg4MHwoKGNoYXJDb2RlICYgMHhmYzApPj42KSwgMHg4MHwoY2hhckNvZGUgJiAweDNmKV07XG4gICAgICB9XG4gICAgICBmb3IodmFyIGogPSAwOyBqIDwgY29kZXMubGVuZ3RoOyBqKyspe1xuICAgICAgICBieXRlQXJyYXlbb2Zmc2V0XSA9IGNvZGVzW2pdO1xuICAgICAgICArK29mZnNldDtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIF9idWZmZXIgPSBuZXcgQnl0ZUFycmF5KG9mZnNldCk7XG4gICAgY29weUFycmF5KF9idWZmZXIsIDAsIGJ5dGVBcnJheSwgMCwgb2Zmc2V0KTtcbiAgICByZXR1cm4gX2J1ZmZlcjtcbiAgfTtcblxuICAvKipcbiAgICogY2xpZW50IGRlY29kZVxuICAgKiBtc2cgU3RyaW5nIGRhdGFcbiAgICogcmV0dXJuIE1lc3NhZ2UgT2JqZWN0XG4gICAqL1xuICBQcm90b2NvbC5zdHJkZWNvZGUgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgICB2YXIgYnl0ZXMgPSBuZXcgQnl0ZUFycmF5KGJ1ZmZlcik7XG4gICAgdmFyIGFycmF5ID0gW107XG4gICAgdmFyIG9mZnNldCA9IDA7XG4gICAgdmFyIGNoYXJDb2RlID0gMDtcbiAgICB2YXIgZW5kID0gYnl0ZXMubGVuZ3RoO1xuICAgIHdoaWxlKG9mZnNldCA8IGVuZCl7XG4gICAgICBpZihieXRlc1tvZmZzZXRdIDwgMTI4KXtcbiAgICAgICAgY2hhckNvZGUgPSBieXRlc1tvZmZzZXRdO1xuICAgICAgICBvZmZzZXQgKz0gMTtcbiAgICAgIH1lbHNlIGlmKGJ5dGVzW29mZnNldF0gPCAyMjQpe1xuICAgICAgICBjaGFyQ29kZSA9ICgoYnl0ZXNbb2Zmc2V0XSAmIDB4M2YpPDw2KSArIChieXRlc1tvZmZzZXQrMV0gJiAweDNmKTtcbiAgICAgICAgb2Zmc2V0ICs9IDI7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgY2hhckNvZGUgPSAoKGJ5dGVzW29mZnNldF0gJiAweDBmKTw8MTIpICsgKChieXRlc1tvZmZzZXQrMV0gJiAweDNmKTw8NikgKyAoYnl0ZXNbb2Zmc2V0KzJdICYgMHgzZik7XG4gICAgICAgIG9mZnNldCArPSAzO1xuICAgICAgfVxuICAgICAgYXJyYXkucHVzaChjaGFyQ29kZSk7XG4gICAgfVxuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGFycmF5KTtcbiAgfTtcblxuICAvKipcbiAgICogUGFja2FnZSBwcm90b2NvbCBlbmNvZGUuXG4gICAqXG4gICAqIFBvbWVsbyBwYWNrYWdlIGZvcm1hdDpcbiAgICogKy0tLS0tLSstLS0tLS0tLS0tLS0tKy0tLS0tLS0tLS0tLS0tLS0tLStcbiAgICogfCB0eXBlIHwgYm9keSBsZW5ndGggfCAgICAgICBib2R5ICAgICAgIHxcbiAgICogKy0tLS0tLSstLS0tLS0tLS0tLS0tKy0tLS0tLS0tLS0tLS0tLS0tLStcbiAgICpcbiAgICogSGVhZDogNGJ5dGVzXG4gICAqICAgMDogcGFja2FnZSB0eXBlLFxuICAgKiAgICAgIDEgLSBoYW5kc2hha2UsXG4gICAqICAgICAgMiAtIGhhbmRzaGFrZSBhY2ssXG4gICAqICAgICAgMyAtIGhlYXJ0YmVhdCxcbiAgICogICAgICA0IC0gZGF0YVxuICAgKiAgICAgIDUgLSBraWNrXG4gICAqICAgMSAtIDM6IGJpZy1lbmRpYW4gYm9keSBsZW5ndGhcbiAgICogQm9keTogYm9keSBsZW5ndGggYnl0ZXNcbiAgICpcbiAgICogQHBhcmFtICB7TnVtYmVyfSAgICB0eXBlICAgcGFja2FnZSB0eXBlXG4gICAqIEBwYXJhbSAge0J5dGVBcnJheX0gYm9keSAgIGJvZHkgY29udGVudCBpbiBieXRlc1xuICAgKiBAcmV0dXJuIHtCeXRlQXJyYXl9ICAgICAgICBuZXcgYnl0ZSBhcnJheSB0aGF0IGNvbnRhaW5zIGVuY29kZSByZXN1bHRcbiAgICovXG4gIFBhY2thZ2UuZW5jb2RlID0gZnVuY3Rpb24odHlwZSwgYm9keSl7XG4gICAgdmFyIGxlbmd0aCA9IGJvZHkgPyBib2R5Lmxlbmd0aCA6IDA7XG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBCeXRlQXJyYXkoUEtHX0hFQURfQllURVMgKyBsZW5ndGgpO1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgYnVmZmVyW2luZGV4KytdID0gdHlwZSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKGxlbmd0aCA+PiAxNikgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChsZW5ndGggPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IGxlbmd0aCAmIDB4ZmY7XG4gICAgaWYoYm9keSkge1xuICAgICAgY29weUFycmF5KGJ1ZmZlciwgaW5kZXgsIGJvZHksIDAsIGxlbmd0aCk7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXI7XG4gIH07XG5cbiAgLyoqXG4gICAqIFBhY2thZ2UgcHJvdG9jb2wgZGVjb2RlLlxuICAgKiBTZWUgZW5jb2RlIGZvciBwYWNrYWdlIGZvcm1hdC5cbiAgICpcbiAgICogQHBhcmFtICB7Qnl0ZUFycmF5fSBidWZmZXIgYnl0ZSBhcnJheSBjb250YWluaW5nIHBhY2thZ2UgY29udGVudFxuICAgKiBAcmV0dXJuIHtPYmplY3R9ICAgICAgICAgICB7dHlwZTogcGFja2FnZSB0eXBlLCBidWZmZXI6IGJvZHkgYnl0ZSBhcnJheX1cbiAgICovXG4gIFBhY2thZ2UuZGVjb2RlID0gZnVuY3Rpb24oYnVmZmVyKXtcbiAgICB2YXIgb2Zmc2V0ID0gMDtcbiAgICB2YXIgYnl0ZXMgPSBuZXcgQnl0ZUFycmF5KGJ1ZmZlcik7XG4gICAgdmFyIGxlbmd0aCA9IDA7XG4gICAgdmFyIHJzID0gW107XG4gICAgd2hpbGUob2Zmc2V0IDwgYnl0ZXMubGVuZ3RoKSB7XG4gICAgICB2YXIgdHlwZSA9IGJ5dGVzW29mZnNldCsrXTtcbiAgICAgIGxlbmd0aCA9ICgoYnl0ZXNbb2Zmc2V0KytdKSA8PCAxNiB8IChieXRlc1tvZmZzZXQrK10pIDw8IDggfCBieXRlc1tvZmZzZXQrK10pID4+PiAwO1xuICAgICAgdmFyIGJvZHkgPSBsZW5ndGggPyBuZXcgQnl0ZUFycmF5KGxlbmd0aCkgOiBudWxsO1xuICAgICAgY29weUFycmF5KGJvZHksIDAsIGJ5dGVzLCBvZmZzZXQsIGxlbmd0aCk7XG4gICAgICBvZmZzZXQgKz0gbGVuZ3RoO1xuICAgICAgcnMucHVzaCh7J3R5cGUnOiB0eXBlLCAnYm9keSc6IGJvZHl9KTtcbiAgICB9XG4gICAgcmV0dXJuIHJzLmxlbmd0aCA9PT0gMSA/IHJzWzBdOiBycztcbiAgfTtcblxuICAvKipcbiAgICogTWVzc2FnZSBwcm90b2NvbCBlbmNvZGUuXG4gICAqXG4gICAqIEBwYXJhbSAge051bWJlcn0gaWQgICAgICAgICAgICBtZXNzYWdlIGlkXG4gICAqIEBwYXJhbSAge051bWJlcn0gdHlwZSAgICAgICAgICBtZXNzYWdlIHR5cGVcbiAgICogQHBhcmFtICB7TnVtYmVyfSBjb21wcmVzc1JvdXRlIHdoZXRoZXIgY29tcHJlc3Mgcm91dGVcbiAgICogQHBhcmFtICB7TnVtYmVyfFN0cmluZ30gcm91dGUgIHJvdXRlIGNvZGUgb3Igcm91dGUgc3RyaW5nXG4gICAqIEBwYXJhbSAge0J1ZmZlcn0gbXNnICAgICAgICAgICBtZXNzYWdlIGJvZHkgYnl0ZXNcbiAgICogQHJldHVybiB7QnVmZmVyfSAgICAgICAgICAgICAgIGVuY29kZSByZXN1bHRcbiAgICovXG4gIE1lc3NhZ2UuZW5jb2RlID0gZnVuY3Rpb24oaWQsIHR5cGUsIGNvbXByZXNzUm91dGUsIHJvdXRlLCBtc2cpe1xuICAgIC8vIGNhY3VsYXRlIG1lc3NhZ2UgbWF4IGxlbmd0aFxuICAgIHZhciBpZEJ5dGVzID0gbXNnSGFzSWQodHlwZSkgPyBjYWN1bGF0ZU1zZ0lkQnl0ZXMoaWQpIDogMDtcbiAgICB2YXIgbXNnTGVuID0gTVNHX0ZMQUdfQllURVMgKyBpZEJ5dGVzO1xuXG4gICAgaWYobXNnSGFzUm91dGUodHlwZSkpIHtcbiAgICAgIGlmKGNvbXByZXNzUm91dGUpIHtcbiAgICAgICAgaWYodHlwZW9mIHJvdXRlICE9PSAnbnVtYmVyJyl7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdlcnJvciBmbGFnIGZvciBudW1iZXIgcm91dGUhJyk7XG4gICAgICAgIH1cbiAgICAgICAgbXNnTGVuICs9IE1TR19ST1VURV9DT0RFX0JZVEVTO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbXNnTGVuICs9IE1TR19ST1VURV9MRU5fQllURVM7XG4gICAgICAgIGlmKHJvdXRlKSB7XG4gICAgICAgICAgcm91dGUgPSBQcm90b2NvbC5zdHJlbmNvZGUocm91dGUpO1xuICAgICAgICAgIGlmKHJvdXRlLmxlbmd0aD4yNTUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncm91dGUgbWF4bGVuZ3RoIGlzIG92ZXJmbG93Jyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG1zZ0xlbiArPSByb3V0ZS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihtc2cpIHtcbiAgICAgIG1zZ0xlbiArPSBtc2cubGVuZ3RoO1xuICAgIH1cblxuICAgIHZhciBidWZmZXIgPSBuZXcgQnl0ZUFycmF5KG1zZ0xlbik7XG4gICAgdmFyIG9mZnNldCA9IDA7XG5cbiAgICAvLyBhZGQgZmxhZ1xuICAgIG9mZnNldCA9IGVuY29kZU1zZ0ZsYWcodHlwZSwgY29tcHJlc3NSb3V0ZSwgYnVmZmVyLCBvZmZzZXQpO1xuXG4gICAgLy8gYWRkIG1lc3NhZ2UgaWRcbiAgICBpZihtc2dIYXNJZCh0eXBlKSkge1xuICAgICAgb2Zmc2V0ID0gZW5jb2RlTXNnSWQoaWQsIGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICAvLyBhZGQgcm91dGVcbiAgICBpZihtc2dIYXNSb3V0ZSh0eXBlKSkge1xuICAgICAgb2Zmc2V0ID0gZW5jb2RlTXNnUm91dGUoY29tcHJlc3NSb3V0ZSwgcm91dGUsIGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICAvLyBhZGQgYm9keVxuICAgIGlmKG1zZykge1xuICAgICAgb2Zmc2V0ID0gZW5jb2RlTXNnQm9keShtc2csIGJ1ZmZlciwgb2Zmc2V0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYnVmZmVyO1xuICB9O1xuXG4gIC8qKlxuICAgKiBNZXNzYWdlIHByb3RvY29sIGRlY29kZS5cbiAgICpcbiAgICogQHBhcmFtICB7QnVmZmVyfFVpbnQ4QXJyYXl9IGJ1ZmZlciBtZXNzYWdlIGJ5dGVzXG4gICAqIEByZXR1cm4ge09iamVjdH0gICAgICAgICAgICBtZXNzYWdlIG9iamVjdFxuICAgKi9cbiAgTWVzc2FnZS5kZWNvZGUgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgICB2YXIgYnl0ZXMgPSAgbmV3IEJ5dGVBcnJheShidWZmZXIpO1xuICAgIHZhciBieXRlc0xlbiA9IGJ5dGVzLmxlbmd0aCB8fCBieXRlcy5ieXRlTGVuZ3RoO1xuICAgIHZhciBvZmZzZXQgPSAwO1xuICAgIHZhciBpZCA9IDA7XG4gICAgdmFyIHJvdXRlID0gbnVsbDtcblxuICAgIC8vIHBhcnNlIGZsYWdcbiAgICB2YXIgZmxhZyA9IGJ5dGVzW29mZnNldCsrXTtcbiAgICB2YXIgY29tcHJlc3NSb3V0ZSA9IGZsYWcgJiBNU0dfQ09NUFJFU1NfUk9VVEVfTUFTSztcbiAgICB2YXIgdHlwZSA9IChmbGFnID4+IDEpICYgTVNHX1RZUEVfTUFTSztcblxuICAgIC8vIHBhcnNlIGlkXG4gICAgaWYobXNnSGFzSWQodHlwZSkpIHtcbiAgICAgIHZhciBtID0gcGFyc2VJbnQoYnl0ZXNbb2Zmc2V0XSk7XG4gICAgICB2YXIgaSA9IDA7XG4gICAgICBkb3tcbiAgICAgICAgdmFyIG0gPSBwYXJzZUludChieXRlc1tvZmZzZXRdKTtcbiAgICAgICAgaWQgPSBpZCArICgobSAmIDB4N2YpICogTWF0aC5wb3coMiwoNyppKSkpO1xuICAgICAgICBvZmZzZXQrKztcbiAgICAgICAgaSsrO1xuICAgICAgfXdoaWxlKG0gPj0gMTI4KTtcbiAgICB9XG5cbiAgICAvLyBwYXJzZSByb3V0ZVxuICAgIGlmKG1zZ0hhc1JvdXRlKHR5cGUpKSB7XG4gICAgICBpZihjb21wcmVzc1JvdXRlKSB7XG4gICAgICAgIHJvdXRlID0gKGJ5dGVzW29mZnNldCsrXSkgPDwgOCB8IGJ5dGVzW29mZnNldCsrXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciByb3V0ZUxlbiA9IGJ5dGVzW29mZnNldCsrXTtcbiAgICAgICAgaWYocm91dGVMZW4pIHtcbiAgICAgICAgICByb3V0ZSA9IG5ldyBCeXRlQXJyYXkocm91dGVMZW4pO1xuICAgICAgICAgIGNvcHlBcnJheShyb3V0ZSwgMCwgYnl0ZXMsIG9mZnNldCwgcm91dGVMZW4pO1xuICAgICAgICAgIHJvdXRlID0gUHJvdG9jb2wuc3RyZGVjb2RlKHJvdXRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByb3V0ZSA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIG9mZnNldCArPSByb3V0ZUxlbjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBwYXJzZSBib2R5XG4gICAgdmFyIGJvZHlMZW4gPSBieXRlc0xlbiAtIG9mZnNldDtcbiAgICB2YXIgYm9keSA9IG5ldyBCeXRlQXJyYXkoYm9keUxlbik7XG5cbiAgICBjb3B5QXJyYXkoYm9keSwgMCwgYnl0ZXMsIG9mZnNldCwgYm9keUxlbik7XG5cbiAgICByZXR1cm4geydpZCc6IGlkLCAndHlwZSc6IHR5cGUsICdjb21wcmVzc1JvdXRlJzogY29tcHJlc3NSb3V0ZSxcbiAgICAgICAgICAgICdyb3V0ZSc6IHJvdXRlLCAnYm9keSc6IGJvZHl9O1xuICB9O1xuXG4gIHZhciBjb3B5QXJyYXkgPSBmdW5jdGlvbihkZXN0LCBkb2Zmc2V0LCBzcmMsIHNvZmZzZXQsIGxlbmd0aCkge1xuICAgIGlmKCdmdW5jdGlvbicgPT09IHR5cGVvZiBzcmMuY29weSkge1xuICAgICAgLy8gQnVmZmVyXG4gICAgICBzcmMuY29weShkZXN0LCBkb2Zmc2V0LCBzb2Zmc2V0LCBzb2Zmc2V0ICsgbGVuZ3RoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVWludDhBcnJheVxuICAgICAgZm9yKHZhciBpbmRleD0wOyBpbmRleDxsZW5ndGg7IGluZGV4Kyspe1xuICAgICAgICBkZXN0W2RvZmZzZXQrK10gPSBzcmNbc29mZnNldCsrXTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgdmFyIG1zZ0hhc0lkID0gZnVuY3Rpb24odHlwZSkge1xuICAgIHJldHVybiB0eXBlID09PSBNZXNzYWdlLlRZUEVfUkVRVUVTVCB8fCB0eXBlID09PSBNZXNzYWdlLlRZUEVfUkVTUE9OU0U7XG4gIH07XG5cbiAgdmFyIG1zZ0hhc1JvdXRlID0gZnVuY3Rpb24odHlwZSkge1xuICAgIHJldHVybiB0eXBlID09PSBNZXNzYWdlLlRZUEVfUkVRVUVTVCB8fCB0eXBlID09PSBNZXNzYWdlLlRZUEVfTk9USUZZIHx8XG4gICAgICAgICAgIHR5cGUgPT09IE1lc3NhZ2UuVFlQRV9QVVNIO1xuICB9O1xuXG4gIHZhciBjYWN1bGF0ZU1zZ0lkQnl0ZXMgPSBmdW5jdGlvbihpZCkge1xuICAgIHZhciBsZW4gPSAwO1xuICAgIGRvIHtcbiAgICAgIGxlbiArPSAxO1xuICAgICAgaWQgPj49IDc7XG4gICAgfSB3aGlsZShpZCA+IDApO1xuICAgIHJldHVybiBsZW47XG4gIH07XG5cbiAgdmFyIGVuY29kZU1zZ0ZsYWcgPSBmdW5jdGlvbih0eXBlLCBjb21wcmVzc1JvdXRlLCBidWZmZXIsIG9mZnNldCkge1xuICAgIGlmKHR5cGUgIT09IE1lc3NhZ2UuVFlQRV9SRVFVRVNUICYmIHR5cGUgIT09IE1lc3NhZ2UuVFlQRV9OT1RJRlkgJiZcbiAgICAgICB0eXBlICE9PSBNZXNzYWdlLlRZUEVfUkVTUE9OU0UgJiYgdHlwZSAhPT0gTWVzc2FnZS5UWVBFX1BVU0gpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5rb253IG1lc3NhZ2UgdHlwZTogJyArIHR5cGUpO1xuICAgIH1cblxuICAgIGJ1ZmZlcltvZmZzZXRdID0gKHR5cGUgPDwgMSkgfCAoY29tcHJlc3NSb3V0ZSA/IDEgOiAwKTtcblxuICAgIHJldHVybiBvZmZzZXQgKyBNU0dfRkxBR19CWVRFUztcbiAgfTtcblxuICB2YXIgZW5jb2RlTXNnSWQgPSBmdW5jdGlvbihpZCwgYnVmZmVyLCBvZmZzZXQpIHtcbiAgICBkb3tcbiAgICAgIHZhciB0bXAgPSBpZCAlIDEyODtcbiAgICAgIHZhciBuZXh0ID0gTWF0aC5mbG9vcihpZC8xMjgpO1xuXG4gICAgICBpZihuZXh0ICE9PSAwKXtcbiAgICAgICAgdG1wID0gdG1wICsgMTI4O1xuICAgICAgfVxuICAgICAgYnVmZmVyW29mZnNldCsrXSA9IHRtcDtcblxuICAgICAgaWQgPSBuZXh0O1xuICAgIH0gd2hpbGUoaWQgIT09IDApO1xuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfTtcblxuICB2YXIgZW5jb2RlTXNnUm91dGUgPSBmdW5jdGlvbihjb21wcmVzc1JvdXRlLCByb3V0ZSwgYnVmZmVyLCBvZmZzZXQpIHtcbiAgICBpZiAoY29tcHJlc3NSb3V0ZSkge1xuICAgICAgaWYocm91dGUgPiBNU0dfUk9VVEVfQ09ERV9NQVgpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JvdXRlIG51bWJlciBpcyBvdmVyZmxvdycpO1xuICAgICAgfVxuXG4gICAgICBidWZmZXJbb2Zmc2V0KytdID0gKHJvdXRlID4+IDgpICYgMHhmZjtcbiAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSByb3V0ZSAmIDB4ZmY7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKHJvdXRlKSB7XG4gICAgICAgIGJ1ZmZlcltvZmZzZXQrK10gPSByb3V0ZS5sZW5ndGggJiAweGZmO1xuICAgICAgICBjb3B5QXJyYXkoYnVmZmVyLCBvZmZzZXQsIHJvdXRlLCAwLCByb3V0ZS5sZW5ndGgpO1xuICAgICAgICBvZmZzZXQgKz0gcm91dGUubGVuZ3RoO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnVmZmVyW29mZnNldCsrXSA9IDA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9mZnNldDtcbiAgfTtcblxuICB2YXIgZW5jb2RlTXNnQm9keSA9IGZ1bmN0aW9uKG1zZywgYnVmZmVyLCBvZmZzZXQpIHtcbiAgICBjb3B5QXJyYXkoYnVmZmVyLCBvZmZzZXQsIG1zZywgMCwgbXNnLmxlbmd0aCk7XG4gICAgcmV0dXJuIG9mZnNldCArIG1zZy5sZW5ndGg7XG4gIH07XG5cbiAgbW9kdWxlLmV4cG9ydHMgPSBQcm90b2NvbDtcbiAgaWYodHlwZW9mKHdpbmRvdykgIT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHdpbmRvdy5Qcm90b2NvbCA9IFByb3RvY29sO1xuICB9XG59KSh0eXBlb2Yod2luZG93KT09XCJ1bmRlZmluZWRcIiA/IG1vZHVsZS5leHBvcnRzIDoge30sIHR5cGVvZih3aW5kb3cpPT1cInVuZGVmaW5lZFwiID8gQnVmZmVyIDogVWludDhBcnJheSwgdGhpcyk7XG4iXSwic291cmNlUm9vdCI6IiJ9