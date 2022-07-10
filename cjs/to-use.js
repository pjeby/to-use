"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.use = void 0;
const useMe = Symbol.for("v1.to-use.peak-dev.org"), useFactory = Symbol.for("v1.factory.to-use.peak-dev.org");
/** The "current" context, aka `use.this` */
let ctx;
/** The active dependency log: tracks keys used during factory execution  */
let used;
/**
 * The "global defaults" configuration and currrent-context accessor
 */
exports.use = (function () {
    return Object.defineProperties(newCtx(), {
        this: {
            get() {
                if (ctx)
                    return ctx;
                throw new TypeError("No current context");
            }
        },
        me: { value: useMe },
        factory: { value: useFactory },
    });
    function newCtx(prev) {
        const registry = new Map;
        registry.prev = prev;
        let me = Object.assign(!prev // global context vs. regular context
            ? (key) => exports.use.this(key) // delegate to current
            : (key) => {
                let entry = registry.get(key);
                if (!entry) {
                    for (let r = registry.prev; r; r = r.prev) {
                        if (entry = r.get(key)) {
                            entry = Object.assign(Object.assign({}, entry), { s: entry.s || 1 /* hasValue */ });
                            break;
                        }
                    }
                    entry = entry || { s: 2 /* hasFactory */, v: defaultLookup };
                    registry.set(key, entry);
                }
                let deps, factory, keys;
                // simple state machine to resolve parameter state/value
                for (;;)
                    switch (entry.s) {
                        case 0 /* wasRead */:
                            if (ctx === me && used)
                                used.push(key);
                            return entry.v;
                        case 1 /* hasValue */:
                            deps = entry.d;
                            // Validate dependencies are unchanged before inherit
                            if (!deps || exec(() => deps.k.every((k) => me(k) === deps.c(k)))) {
                                // No deps or they all match: just inherit the value
                                entry.s = 0 /* wasRead */;
                                break;
                            }
                            // Reconfigure as a factory and fall through
                            entry.v = deps.f;
                        case 2 /* hasFactory */:
                            entry.s = 4 /* isCreating */; // catch dependency cycles
                            try {
                                setEntry(registry, key, 0 /* wasRead */, exec(factory = entry.v, key, keys = []));
                                // Save dependencies so child contexts can check before inheriting
                                if (keys.length)
                                    entry.d = { c: me, f: factory, k: keys };
                                break;
                            }
                            catch (e) {
                                entry.s = 3 /* hasError */;
                                entry.v = e;
                                entry.d = null;
                                // fall through to error
                            }
                        case 3 /* hasError */:
                            throw entry.v;
                        case 4 /* isCreating */:
                            throw new Error(`Factory ${String(entry.v)} didn't resolve ${String(key)}`);
                    }
            }, {
            def(key, factory) {
                return setEntry(registry, key, 2 /* hasFactory */, factory), me;
            },
            set(key, value) {
                return setEntry(registry, key, 1 /* hasValue */, value), me;
            },
            fork(key) {
                const ctx = newCtx(registry);
                return key != undefined ? ctx(key) : ctx;
            }
        });
        return prev ? me.use = me : me;
        function exec(fn, key, deps) {
            const oldCtx = ctx, oldDeps = used;
            try {
                ctx = me;
                used = deps;
                return fn(key);
            }
            finally {
                ctx = oldCtx;
                used = oldDeps;
            }
        }
    }
    function setEntry(reg, key, s, v) {
        if (reg.has(key)) {
            const entry = reg.get(key);
            if (!entry.s)
                throw new Error(`Already read: ${String(key)}`);
            entry.s = s;
            entry.v = v;
            entry.d = null;
        }
        else {
            reg.set(key, { s, v });
        }
    }
    /** Default lookup: handles [use.me]() and creating service instances */
    function defaultLookup(key) {
        if (typeof key[useMe] === "function")
            return key[useMe](key);
        if (isClass(key)) {
            return (typeof key.prototype[useFactory] === "function") ? key.prototype[useFactory]() : new key();
        }
        throw new ReferenceError(`No config for ${String(key)}`);
    }
    /**
     * Fast class vs function checker: detects native classes, subclasses, and base
     * classes with public instance methods on their prototype. It has NO false positives:
     * if it returns true, the thing is definitely a class. But it *can* return a false
     * negative for emulated or "old style" classes implemented using just a constructor
     * function with no base class and no prototype methods.  (If you're using this library,
     * though, you probably want to not be using emulated classes as your keys, since you
     * need an environment that supports native classes anyway.)
     */
    function isClass(f) {
        return typeof f === "function" && f.prototype !== void 0 && (
        // Classes must be functions with a prototype, and also:
        Object.getPrototypeOf(f.prototype) !== Object.prototype || // be a subclass of something,
            Object.getOwnPropertyNames(f.prototype).length > 1 || // have public methods,
            f.toString().startsWith("class") // or be a native class
        );
    }
}());
