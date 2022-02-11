/** Add declarations to this interface to get type inference for keys */
export interface Types {}

type Key = TypedKey | UntypedKey
type TypedKey = keyof Types | Constructor<any> | StaticFactory<any>
type UntypedKey = Function | object
type Constructor<T> = (new (...args: any[]) => T) | (abstract new (...args: any[]) => T);
type Factory<T> = (ctx: Context, key: Key) => T;

type Provides<K> =
    K extends Constructor<infer T> ? T :
    K extends StaticFactory<infer T> ? T :
    K extends keyof Types ? Types[K] :
    K extends UntypedKey ? unknown :
    never
;

 /**
  * A callable that looks up lazy-immutable cached values
  */
 export interface Use {
     /**
     * Look up a value by key
     */
     <K extends Key>(key: K): Provides<K>;
 }

/**
 * An object that can be configured, and create child Contexts that inherit from it
 */
export interface Configurable extends Use {

    /** Define a factory for a key (error if the key's already been read) */
    def<K extends Key>(key: K, factory: Factory<Provides<K>>): this;

    /** Set a value or instance for a key (error if the key's already been read) */
    set<K extends Key>(key: K, value: Provides<K>): this;

    /** Create and return a new child context */
    fork(): Context

    /** Return a requested service from a new child context */
    fork<K extends Key>(key: K): Provides<K>
}

/**
 * The global "context" can be configured and called, but you can't
 * run or execute anything in it.  Its `.this` property represents the
 * current context, and calling the global context is just shorthand
 * for calling `use.this()`.  Its `.me` property is a symbol you can
 * use to define a custom factory method for classes that can't be
 * constructed without arguments.
 */
 export interface GlobalContext extends Configurable {
    /** Obtain the current active context, or throw an error if there isn't one */
    get this(): Context;

    /** Define a method with this symbol to allow a key object or class to be its own default factory */
    readonly me: typeof useMe
}

/**
 * An object that shares its context as a public `use` property
 *
 * (This is a separate interface so libraries can accept either a Context or
 * an object that exposes one.)
 *
 */
 export interface Useful { use: Context; }

/**
 * A Useful Configurable that can be called to look things up
 *
 * A context can also run code with itself as the "current" context
 * (accessible via `use.this()`.)
 */
export interface Context extends Configurable, Useful {}

/**
 * An object that can be used as a key and provides a default factory.
 * (Typically implemented as a class with a static method, hence the name.)
 */
 export interface StaticFactory<T> {
    [useMe]: Factory<T>
}


const useMe = Symbol.for("v1.use-this.peak-dev.org");

/** The "current" context, aka `use.this` */
let ctx: Context;

/** The active dependency log: tracks keys used during factory execution  */
let used: Key[];

/**
 * The "global defaults" configuration and currrent-context accessor
 */
export const use = <GlobalContext> (function () {
    return Object.defineProperties(<unknown> newCtx(), {
        this: {
            get(){
                if (ctx) return ctx;
                throw new TypeError("No current context");
            }
        },
        me: { value: useMe }
    });

    /** The actual configuration store: a map w/optional parent */
    type Registry = Map<Key, Entry<any>> & {prev?: Registry}

    /** Entries track a state and value or factory for each key, and optionally how the value was arrived at */
    type Entry<T> = {s: State, v: T | Factory<T>, d?: Deps<T>}

    /** The state of a specific key: has it been read, is it a factory, etc. */
    const enum State { wasRead = 0, hasValue, hasFactory, hasError, isCreating }

    /** When a value is inherited, we track the factory, context, and depended-on keys that made it */
    type Deps<T> = {c: Context, k: Key[], f: Factory<T>}

    function newCtx(prev?: Registry): Context {
        const registry: Registry = new Map;
        registry.prev = prev;

        let me = <Context> Object.assign(
            !prev // global context vs. regular context
            ?   <K extends Key>(key: K): Provides<K> => use.this(key) // delegate to current
            :   <K extends Key>(key: K): Provides<K> => {
                    let entry = registry.get(key);
                    if (!entry) {
                        for(let r = registry.prev; r; r = r.prev) {
                            if (entry = r.get(key)) {
                                entry = {...entry, s: entry.s || State.hasValue}
                                break
                            }
                        }
                        entry = entry || {s: State.hasFactory, v: defaultLookup}
                        registry.set(key, entry);
                    }

                    let deps: Deps<any>, factory: Factory<any>, keys: Key[];

                    // simple state machine to resolve parameter state/value
                    for(;;) switch (entry.s) {
                        case State.wasRead:
                            if (ctx === me && used) used.push(key);
                            return entry.v;
                        case State.hasValue:
                            deps = entry.d;
                            // Validate dependencies are unchanged before inherit
                            if (!deps || exec(() => deps.k.every((k: Key) => me(k) === deps.c(k)))) {
                                // No deps or they all match: just inherit the value
                                entry.s = State.wasRead;
                                break;
                            }
                            // Reconfigure as a factory and fall through
                            entry.v = deps.f;
                        case State.hasFactory:
                            entry.s = State.isCreating; // catch dependency cycles
                            try {
                                setEntry(registry, key, State.wasRead, exec(factory = entry.v, key, keys = []));
                                // Save dependencies so child contexts can check before inheriting
                                if (keys.length) entry.d = {c: me, f: factory, k: keys};
                                break;
                            } catch (e) {
                                entry.s = State.hasError;
                                entry.v = e;
                                entry.d = null;
                                // fall through to error
                            }
                        case State.hasError:
                            throw entry.v;
                        case State.isCreating:
                            throw new Error(
                                `Factory ${String(entry.v)} didn't resolve ${String(key)}`
                            );
                    }
                },
            {
                def(key: Key, factory: (use: Context) => any){
                    return setEntry(registry, key, State.hasFactory, factory), me;
                },
                set(key: Key, value: any)  {
                    return setEntry(registry, key, State.hasValue, value), me;
                },
                fork<K extends Key>(key?: K): Provides<K> | Context {
                    const ctx = newCtx(registry);
                    return key != undefined ? ctx(key) : ctx;
                }
            }
        );
        return prev ? me.use = me : me;

        function exec(fn: Factory<any>, key?: Key, deps?: Key[]) {
            const oldCtx = ctx, oldDeps = used;
            try {
                ctx = me; used = deps; return fn(me, key);
            } finally {
                ctx = oldCtx; used = oldDeps;
            }
        }
    }

    function setEntry(reg: Registry, key: Key, s: State, v: any) {
        if (reg.has(key)) {
            const entry = reg.get(key);
            if (!entry.s) throw new Error(`Already read: ${String(key)}`);
            entry.s = s;
            entry.v = v;
            entry.d = null;
        } else {
            reg.set(key, {s, v});
        }
    }

    /** Default lookup: handles [use.me]() and creating service instances */
    function defaultLookup<K extends Key>(ctx: Context, key: K): Provides<K> {
        if (typeof key[useMe] === "function") return (key as StaticFactory<Provides<K>>)[useMe](ctx, key);
        if (isClass<Provides<K>>(key)) return new key();
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
    function isClass<T>(f: any): f is new (...args: any[]) => T {
        return typeof f === "function" && f.prototype !== void 0 && (
            // Classes must be functions with a prototype, and also:
            Object.getPrototypeOf(f.prototype) !== Object.prototype || // be a subclass of something,
            Object.getOwnPropertyNames(f.prototype).length > 1 ||      // have public methods,
            f.toString().startsWith("class")                           // or be a native class
        )
    }
}());
