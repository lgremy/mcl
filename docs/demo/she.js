(function(return_she) {
	if (typeof exports === 'object') {
		module.exports = return_she()
	} else {
		window.she = return_she()
	}
})(function() {
	const MCLBN_CURVE_FP254BNB = 0
	const MCLBN_FP_UNIT_SIZE = 4
	const MCLBN_FP_SIZE = MCLBN_FP_UNIT_SIZE * 8
	const MCLBN_G1_SIZE = MCLBN_FP_SIZE * 3
	const MCLBN_G2_SIZE = MCLBN_FP_SIZE * 6
	const MCLBN_GT_SIZE = MCLBN_FP_SIZE * 12

	const SHE_SECRETKEY_SIZE = MCLBN_FP_SIZE * 2
	const SHE_PUBLICKEY_SIZE = MCLBN_G1_SIZE + MCLBN_G2_SIZE
	const SHE_CIPHERTEXT_G1_SIZE = MCLBN_G1_SIZE * 2
	const SHE_CIPHERTEXT_G2_SIZE = MCLBN_G2_SIZE * 2
	const SHE_CIPHERTEXT_GT_SIZE = MCLBN_GT_SIZE * 4

	let she = {}
	let mod = {}

	const setupWasm = function(fileName, nameSpace, setupFct) {
		console.log('setupWasm ' + fileName)
		fetch(fileName)
			.then(response => response.arrayBuffer())
			.then(buffer => new Uint8Array(buffer))
			.then(binary => {
				mod['wasmBinary'] = binary
				mod['onRuntimeInitialized'] = function() {
					setupFct(mod, nameSpace)
					console.log('setupWasm end')
				}
				Module(mod)
			})
		return mod
	}
	const define_she_extra_functions = function(mod) {
		const ptrToStr = function(pos, n) {
			let s = ''
				for (let i = 0; i < n; i++) {
				s += String.fromCharCode(mod.HEAP8[pos + i])
			}
			return s
		}
		const Uint8ArrayToMem = function(pos, buf) {
			for (let i = 0; i < buf.length; i++) {
				mod.HEAP8[pos + i] = buf[i]
			}
		}
		const AsciiStrToMem = function(pos, s) {
			for (let i = 0; i < s.length; i++) {
				mod.HEAP8[pos + i] = s.charCodeAt(i)
			}
		}
		const wrap_outputString = function(func, doesReturnString = true) {
			return function(x, ioMode = 0) {
				let maxBufSize = 2048
				let stack = mod.Runtime.stackSave()
				let pos = mod.Runtime.stackAlloc(maxBufSize)
				let n = func(pos, maxBufSize, x, ioMode)
				if (n < 0) {
					throw('err gen_str:' + x)
				}
				if (doesReturnString) {
					let s = ptrToStr(pos, n)
					mod.Runtime.stackRestore(stack)
					return s
				} else {
					let a = new Uint8Array(n)
					for (let i = 0; i < n; i++) {
						a[i] = mod.HEAP8[pos + i]
					}
					mod.Runtime.stackRestore(stack)
					return a
				}
			}
		}
		const wrap_outputArray = function(func) {
			return wrap_outputString(func, false)
		}
		const wrap_input0 = function(func, returnValue = false) {
			return function(buf, ioMode = 0) {
				let stack = mod.Runtime.stackSave()
				let pos = mod.Runtime.stackAlloc(buf.length)
				if (typeof(buf) == "string") {
					AsciiStrToMem(pos, buf)
				} else {
					Uint8ArrayToMem(pos, buf)
				}
				let r = func(pos, buf.length, ioMode)
				mod.Runtime.stackRestore(stack)
				if (returnValue) return r
				if (r) throw('err wrap_input0 ' + buf)
			}
		}
		const wrap_input1 = function(func, returnValue = false) {
			return function(x1, buf, ioMode = 0) {
				let stack = mod.Runtime.stackSave()
				let pos = mod.Runtime.stackAlloc(buf.length)
				if (typeof(buf) == "string") {
					AsciiStrToMem(pos, buf)
				} else {
					Uint8ArrayToMem(pos, buf)
				}
				let r = func(x1, pos, buf.length, ioMode)
				mod.Runtime.stackRestore(stack)
				if (returnValue) return r
				if (r) throw('err wrap_input1 ' + buf)
			}
		}
		const wrap_input2 = function(func, returnValue = false) {
			return function(x1, x2, buf, ioMode = 0) {
				let stack = mod.Runtime.stackSave()
				let pos = mod.Runtime.stackAlloc(buf.length)
				if (typeof(buf) == "string") {
					AsciiStrToMem(pos, buf)
				} else {
					Uint8ArrayToMem(pos, buf)
				}
				let r = func(x1, x2, pos, buf.length, ioMode)
				mod.Runtime.stackRestore(stack)
				if (returnValue) return r
				if (r) throw('err wrap_input2 ' + buf)
			}
		}
		const wrap_dec = function(func) {
			return function(sec, c) {
				let stack = mod.Runtime.stackSave()
				let pos = mod.Runtime.stackAlloc(8)
				let r = func(pos, sec, c)
				mod.Runtime.stackRestore(stack)
				if (r != 0) throw('sheDec')
				let v = mod.HEAP32[pos / 4]
				return v
			}
		}
		const crypto = window.crypto || window.msCrypto

		let copyToUint32Array = function(a, pos) {
			for (let i = 0; i < a.length; i++) {
				a[i] = mod.HEAP32[pos / 4 + i]
			}
		}
		let copyFromUint32Array = function(pos, a) {
			for (let i = 0; i < a.length; i++) {
				mod.HEAP32[pos / 4 + i] = a[i]
			}
		}
		she.callSetter = function(func, a, p1, p2) {
			let pos = mod._malloc(a.length * 4)
			func(pos, p1, p2) // p1, p2 may be undefined
			copyToUint32Array(a, pos)
			mod._free(pos)
		}
		she.callGetter = function(func, a, p1, p2) {
			let pos = mod._malloc(a.length * 4)
			mod.HEAP32.set(a, pos / 4)
			let s = func(pos, p1, p2)
			mod._free(pos)
			return s
		}
		she.callModifier = function(func, a, p1, p2) {
			let pos = mod._malloc(a.length * 4)
			mod.HEAP32.set(a, pos / 4)
			func(pos, p1, p2) // p1, p2 may be undefined
			copyToUint32Array(a, pos)
			mod._free(pos)
		}
		she.callEnc = function(func, cstr, pub, m) {
			let c = new cstr()
			let stack = mod.Runtime.stackSave()
			let cPos = mod.Runtime.stackAlloc(c.length * 4)
			let pubPos = mod.Runtime.stackAlloc(pub.length * 4)
			copyFromUint32Array(pubPos, pub);
			func(cPos, pubPos, m)
			copyToUint32Array(c.a_, cPos)
			mod.Runtime.stackRestore(stack)
			return c
		}
		she.callDec = function(func, sec, c) {
			let stack = mod.Runtime.stackSave()
			let secPos = mod.Runtime.stackAlloc(sec.length * 4)
			let cPos = mod.Runtime.stackAlloc(c.length * 4)
			copyFromUint32Array(secPos, sec);
			copyFromUint32Array(cPos, c);
			let r = func(secPos, cPos)
			mod.Runtime.stackRestore(stack)
			return r
		}
		she.callSetByCSPRNG = function(sec) {
			let stack = mod.Runtime.stackSave()
			let secPos = mod.Runtime.stackAlloc(sec.length * 4)
			sheSecretKeySetByCSPRNG(secPos)
			copyToUint32Array(sec, secPos)
			mod.Runtime.stackRestore(stack)
		}
		she.callGetPublicKey = function(pub, sec) {
			let stack = mod.Runtime.stackSave()
			let secPos = mod.Runtime.stackAlloc(sec.length * 4)
			let pubPos = mod.Runtime.stackAlloc(pub.length * 4)
			copyFromUint32Array(secPos, sec)
			sheGetPublicKey(pubPos, secPos)
			copyToUint32Array(pub, pubPos)
			mod.Runtime.stackRestore(stack)
		}
		///////////////////////////////////////////////////////////////
		she_free = function(p) {
			mod._free(p)
		}
		///////////////////////////////////////////////////////////////
		sheSecretKey_malloc = function() {
			return mod._malloc(SHE_SECRETKEY_SIZE)
		}
		sheSecretKeySerialize = wrap_outputArray(_sheSecretKeySerialize)
		sheSecretKeyDeserialize = wrap_input1(_sheSecretKeyDeserialize)
		///////////////////////////////////////////////////////////////
		shePublicKey_malloc = function() {
			return mod._malloc(SHE_PUBLICKEY_SIZE)
		}
		shePublicKeySerialize = wrap_outputArray(_shePublicKeySerialize)
		shePublicKeyDeserialize = wrap_input1(_shePublicKeyDeserialize)
		///////////////////////////////////////////////////////////////
		sheCipherTextG1_malloc = function() {
			return mod._malloc(SHE_CIPHERTEXT_G1_SIZE)
		}
		sheCipherTextG1Serialize = wrap_outputArray(_sheCipherTextG1Serialize)
		sheCipherTextG1Deserialize = wrap_input1(_sheCipherTextG1Deserialize)
		sheDecG1 = wrap_dec(_sheDecG1)
		///////////////////////////////////////////////////////////////
		sheCipherTextG2_malloc = function() {
			return mod._malloc(SHE_CIPHERTEXT_G2_SIZE)
		}
		sheCipherTextG2Serialize = wrap_outputArray(_sheCipherTextG2Serialize)
		sheCipherTextG2Deserialize = wrap_input1(_sheCipherTextG2Deserialize)
		///////////////////////////////////////////////////////////////
		sheCipherTextGT_malloc = function() {
			return mod._malloc(SHE_CIPHERTEXT_GT_SIZE)
		}
		sheCipherTextGTSerialize = wrap_outputArray(_sheCipherTextGTSerialize)
		sheCipherTextGTDeserialize = wrap_input1(_sheCipherTextGTDeserialize)
		sheDecGT = wrap_dec(_sheDecGT)

		sheInit = function(curveType = MCLBN_CURVE_FP254BNB) {
			let r = _sheInit(curveType, MCLBN_FP_UNIT_SIZE)
			console.log('sheInit ' + r)
			if (r) throw('sheInit')
	//		r = sheSetRangeForGTDLP(128, 1024)
		}
	}

	she.init = function(callback = null) {
		setupWasm('mclshe.wasm', null, function(mod, ns) {
			define_exported_she(mod)
			define_she_extra_functions(mod)
			sheInit()
			console.log('initializing sheSetRangeForDLP')
			let r = sheSetRangeForDLP(256, 2048)
			console.log('finished ' + r)
			if (callback) callback()
		})
	}
	she.SecretKey = function() {
		this.a_ = new Uint32Array(SHE_SECRETKEY_SIZE / 4)
	}
	she.SecretKey.prototype.serialize = function() {
		return she.callGetter(sheSecretKeySerialize, this.a_)
	}
	she.SecretKey.prototype.deserialize = function(s) {
		return she.callSetter(sheSecretKeyDeserialize, this.a_, s)
	}
	she.PublicKey = function() {
		this.a_ = new Uint32Array(SHE_PUBLICKEY_SIZE / 4)
	}
	she.PublicKey.prototype.serialize = function() {
		return she.callGetter(shePublicKeySerialize, this.a_)
	}
	she.PublicKey.prototype.deserialize = function(s) {
		return she.callSetter(shePublicKeyDeserialize, this.a_, s)
	}
	she.CipherTextG1 = function() {
		this.a_ = new Uint32Array(SHE_CIPHERTEXT_G1_SIZE / 4)
	}
	she.CipherTextG1.prototype.serialize = function() {
		return she.callGetter(sheCipherTextG1Serialize, this.a_)
	}
	she.CipherTextG1.prototype.deserialize = function(s) {
		return she.callSetter(sheCipherTextG1Deserialize, this.a_, s)
	}
	she.SecretKey.prototype.setByCSPRNG = function() {
		she.callSetByCSPRNG(this.a_)
	}
	she.SecretKey.prototype.getPublicKey = function() {
		let pub = new she.PublicKey()
		she.callGetPublicKey(pub.a_, this.a_)
		return pub
/*
		let pub = new she.PublicKey()
		let stack = mod.Runtime.stackSave()
		let secPos = mod.Runtime.stackAlloc(this.a_.length * 4)
		let pubPos = mod.Runtime.stackAlloc(pub.a_.length * 4)
		copyFromUint32Array(secPos, this.a_)
		sheGetPublicKey(pubPos, secPos)
		copyToUint32Array(pub.a_, pubPos)
		mod.Runtime.stackRestore(stack)
		return pub
*/
	}
	she.PublicKey.prototype.enc = function(m) {
		return she.callEnc(sheEnc32G1, she.CipherTextG1, this.a_, m)
	}
	she.SecretKey.prototype.dec = function(c) {
		if (she.CipherTextG1.prototype.isPrototypeOf(c)) {
			return she.callDec(sheDecG1, this.a_, c)
		}
		throw('she.SecretKey.dec is not supported')
	}
	return she
})