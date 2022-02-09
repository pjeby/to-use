"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.use = void 0;
const useMe = Symbol.for("v1.use-this.peak-dev.org");
/** The "current" context, aka `use.this` */
let ctx;
/** The active dependency log: tracks keys used during factory execution  */
let used;
/**
 * The "global defaults" configuration and currrent-context accessor
 */
exports.use = Object.defineProperties((function newCtx(prev) {
    const registry = new Map;
    registry.prev = prev;
    let me = Object.assign(!prev // global context vs. regular context
        ? (key) => exports.use.this(key) // delegate to current
        : (key) => {
            let entry = getEntry(key, registry);
            // simple state machine to resolve parameter state/value
            for (;;)
                switch (entry.s) {
                    case 0 /* wasRead */:
                        if (ctx === me && used)
                            used.push(key);
                        return entry.v;
                    case 1 /* isUnset */:
                        resolve(key, entry, defaultLookup);
                        break;
                    case 2 /* hasValue */:
                        const deps = entry.d;
                        // Validate dependencies are unchanged before inherit
                        if (!deps || exec(() => deps.k.every((k) => me(k) === deps.c(k)))) {
                            // No deps or they all match: just inherit the value
                            entry.s = 0 /* wasRead */;
                            entry.v = entry.v; // Lock current value and deps in case of inheritance
                            entry.d = deps;
                            break;
                        }
                        // Reconfigure as a factory
                        entry.s = 3 /* hasFactory */;
                        entry.v = deps.f;
                        entry.d = null;
                    // fall through to resolve
                    case 3 /* hasFactory */:
                        resolve(key, entry, entry.v);
                        break;
                    case 4 /* isCreating */:
                        setEntry(key, 5 /* hasError */, new Error(`Factory ${String(entry.v)} didn't resolve ${String(key)}`), entry);
                    // fall through to throw
                    case 5 /* hasError */:
                        throw entry.v;
                }
        }, {
        def(key, factory) {
            return setEntry(key, 3 /* hasFactory */, factory);
        },
        set(key, value) {
            return setEntry(key, 2 /* hasValue */, value);
        },
        fork(key) {
            const ctx = newCtx(registry);
            return key != undefined ? ctx(key) : ctx;
        }
    });
    return prev ? me.use = me : me;
    function resolve(key, entry, factory) {
        entry.s = 4 /* isCreating */; // catch dependency cycles
        entry.v = factory;
        const deps = [];
        setEntry(key, 0 /* wasRead */, exec(factory, key, deps), entry);
        // Save dependencies so child contexts can check before inheriting
        if (deps.length)
            entry.d = { c: me, f: factory, k: deps };
    }
    function exec(fn, key, deps) {
        const oldCtx = ctx, oldDeps = used;
        try {
            ctx = me;
            used = deps;
            return fn(me, key);
        }
        finally {
            ctx = oldCtx;
            used = oldDeps;
        }
    }
    function setEntry(key, state, value, entry = getEntry(key, registry)) {
        if (!entry.s)
            throw new Error(`Already read: ${String(key)}`);
        entry.s = state;
        entry.v = value;
        entry.d = null; // once we've been changed, parent deps don't matter
        return me;
    }
    function getEntry(key, reg) {
        let entry = reg.get(key);
        if (!entry) {
            if (reg.prev) {
                entry = Object.create(getEntry(key, reg.prev)); // Inherit the parameter
                if (!entry.s)
                    entry.s = 2 /* hasValue */; // But make it writable if already read
            }
            else {
                entry = { s: 1 /* isUnset */, v: null, d: null };
            }
            registry.set(key, entry);
        }
        return entry;
    }
    /** Default lookup: handles [use.me]() and creating service instances */
    function defaultLookup(ctx, key) {
        if (typeof key[useMe] === "function")
            return key[useMe](ctx, key);
        if (isClass(key))
            return new key();
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
})(), {
    this: {
        get() {
            if (ctx)
                return ctx;
            throw new TypeError("No current context");
        }
    },
    me: { value: useMe }
});
