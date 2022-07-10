/** Add declarations to this interface to get type inference for keys */
export interface Types {
}
declare type Key = TypedKey | UntypedKey;
declare type TypedKey = keyof Types | Constructor<any> | Recipe<any>;
declare type UntypedKey = Function | object;
declare type Constructor<T> = (new (...args: any[]) => T) | (abstract new (...args: any[]) => T);
export declare type Factory<T> = (key: Key) => T;
declare type Provides<K> = K extends Constructor<{
    [useFactory]: Factory<infer T>;
}> ? T : K extends Recipe<infer T> ? T : K extends Constructor<infer T> ? T : K extends keyof Types ? Types[K] : K extends UntypedKey ? unknown : never;
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
    fork(): Context;
    /** Return a requested service from a new child context */
    fork<K extends Key>(key: K): Provides<K>;
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
    readonly me: typeof useMe;
    /** Define a method with this symbol to allow its class to be its own default factory */
    readonly factory: typeof useFactory;
}
/**
 * An object that shares its context as a public `use` property
 *
 * (This is a separate interface so libraries can accept either a Context or
 * an object that exposes one.)
 *
 */
export interface Useful {
    use: Context;
}
/**
 * A Useful Configurable that can be called to look things up
 *
 * A context can also run code with itself as the "current" context
 * (accessible via `use.this()`.)
 */
export interface Context extends Configurable, Useful {
}
/**
 * An object that can be used as a key and provides an in-built default factory
 * via its `[use.me]` method. (Typically implemented as a class's static method.)
 */
export interface Recipe<T> {
    [useMe]: Factory<T>;
}
declare const useMe: unique symbol, useFactory: unique symbol;
/**
 * The "global defaults" configuration and currrent-context accessor
 */
export declare const use: GlobalContext;
export {};
