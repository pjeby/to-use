## `use-this`: A Tiny, Read-Consistent, Type-Safe DI Container

`use-this` is a tiny library with a huge goal: to make building configurable systems from small, overrideable components just as easy -- or *easier*! -- than hard-wiring them.

In other words, it's not just trying to be easier to use than literally *every other DI container*, it's also trying to be easier to use than *not* using one to begin with.  Defining dependencies can be as easy as this:

```typescript
import { use } from "use-this";

class HelloService {
    greet() { console.log("'sup?"); }
}

class AnotherService {
    hello = use(HelloService);  // <- this is all you do! (TypeScript even infers the type)

    doAthing() { this.hello.greet(); }
}

// create a service in a new container, and do something with it
use.fork(AnotherService).doAthing()
```

In other words you can `use-this` *without typing any more characters* than you would to `new HelloService()`, and without breaking your IDE or TypeScript's type inference and type checking.  It doesn't require you to add parameters everywhere, but still avoids shared global state, and even supports scoped services and other advanced DI scenarios.

So, even if it's a small project, you probably can (and maybe should!) `use-this` as your next project's configuration system or DI framework.  It:

- Easily integrates with both new and legacy/third-party components
- Doesn't require adding extra arguments everywhere to pass context around
- Has an API that's decorator-and-reflection free, type-inference friendly, and read-consistent
- Lets libraries define global defaults for factories or values, and declare types for keys
- Supports using arbitrary objects (like classes!) as service identifiers or property keys
- Can fully isolate contexts, or explicitly share services via a common parent
- Has "smart scoping" that recreates components in child contexts if their dependencies are configured differently
- Has a tiny API surface (1 export with 2 properties and 4 methods)
- Is ultra-light (<1k min+gzip, no dependencies)

But you should not `use-this` if:

- You need your code to run in an environment older than ES2016 (specifically, you lack a real ES6 runtime environment with `Symbol.for` and `Map`)
- You want something that handles loading or parsing configuration (e.g. from files or CLI), not just injection
- You don't want to use an early release whose API *might* change a bit in the future.

Either way, keep reading if you'd like to learn more about *how* to `use-this`.  (Or if you just enjoy JavaScript puns involving "use" and `this`!)



## Developer's Guide

### Why Inject Dependencies?

(If you're already familiar with dependency injection and were just shoppping for a good implementation, you can skip this bit about why DI is good, and get right on to the next section about why `use-this` is even better.)

When you're building software, it's often a good idea to do it by combining smaller, reusable pieces.  But when you do that, each piece needs to know how to get or make the *other* pieces it needs to do its job.

There are two obvious ways to do this: a piece can either create what it needs itself, or it can accept parameters so it can be told which pieces to use.  Both ways have some problems, though.

If a piece creates the other pieces that it needs, it becomes harder to share common pieces, and the pieces themselves become less reusable, because you can't say, "well, now I need piece X to use a different piece Y than the one it creates", so you end up needing to fiddle with how your pieces create other pieces (like having methods to create them that you can override in subclasses).  This all creates bloat and inconvenience for implementation.

On the other hand, if pieces have to take parameters to tell them what pieces to use, this creates bloat and inconvenience in the *API*, because then every piece needs to know about not just what pieces *it* needs, but also all the pieces needed by all the pieces it needs!

The idea behind dependency injection (originally called IoC or Inversion of Control), is that you set aside one piece of software whose whole purpose is to solve the "who needs what" problem without the individual pieces needing to do anything except say what kinds of things they individually need, and without having to change the pieces' code or subclass them in order to get them to use different pieces than the ones they use by default.

Dependency injection delegates this "who needs what" problem to something called a DI container.  Different DI implementations may call it something else, like a context, registry, configuration, or environment.  But whatever you call it, the basic idea of the DI container is that it converts some form of specification saying "I need a piece that does X", into an actual *object* that does X, using some kind of application-level configuration to map from one to the other.

The details, of course, vary tremendously from container to container, language to language.  The "I need a piece that does X" part might be implemented using compiler information, decorators, strings, classes, interfaces -- just about anything, really.

(And the "creating an actual object that does X" part also varies tremendously, but most DI containers will allow you to both say, "here's an object to use when somebody needs X", and "here's a *factory* to use when somebody needs X", where a "factory" is instructions on how to *create* an "object that does X".)

But conceptually, most DI containers act like a kind of map or dictionary, with some way to put these factories and instances into it (keyed by some *value* representing "I need an X", like a string or symbol), and some way to get them back out.  Most container implementations will also *cache* the objects created by factories, so that if more than one part of your program needs an X, they can share it instead of making new ones every time.  (Such shared, cached objects are commonly referred to as "services".)

Unfortunately, while most DI containers can solve the original problem, they often add new troubles of their own.  In dynamic languages like JavaScript, using a DI container often adds overhead like needing to come up with keys or register default factories for every class you use.  Some DI container implementations introduce global state and interfere with testing, or aren't compatible with minified code or TypeScript, or require you to add lots of explicit type declaratons.

These are the problems that `use-this` is meant to solve, so you can build robust systems from tiny pieces *without* lots of invasive changes to the pieces themselves, and less work than most DI containers require.

### Why `use-this`?

`use-this` is a DI framework built around the idea of *contexts*.  As with other DI frameworks, a context is a bit like a smart `Map`, with the ability to define values or factories for turning "I need X" requests into values or services that are then cached for sharing.  These contexts can inherit from each other, allowing the services in them to either have their own instances of specific dependencies, or share the ones being used in a parent context.

`use-this` contexts, however, also have a few key differences in how they work, that make them a lot easier to integrate with your project than the average DI framework for JavaScript and TypeScript.

First, **enforced consistency** via lazy immutability and "smart sharing".  Lazy immutability means values stored in contexts can be changed at any time, right up until they're actually used.  This allows considerable flexibility in loading and overriding configuration (e.g. for testing), while still making it impossible for different lookups of the same key in the same context to return different results (thereby preventing race conditions).  It also makes it easier to "scope" services (decide which ones to share with which contexts), as only the services actually *used* by a parent context will be shared with their nested contexts -- and even then, smart sharing means services are only shared if all their construction-time dependencies (services and configuration settings) are identical in the nested context.

Second, **default factories for classes** means you can use service classes themselves as configuration keys, literally using a class `X` to mean, "I need an X".  If the class's constructor can work without arguments, you don't need to define an explicit factory for it: `use-this` will simply create an instance of that class when needed.

This means that you don't have to go to the trouble of defining string keys for every kind of service in your app (especially since the majority of the time you'll be using default implementations), nor do you have to explicitly register factories for every kind of thing you might want to `use()`.  In addition, it powers type inference for TypeScript and your IDE, so you don't need to declare as many explicit types, keeping your code clean and free of framework-filler.

And finally, **ambient context** means that, while factories are running, there is a notion of the "current" context, allowing constructors (and property initializers) to look things up without needing to be passed an explicit container.  This means that many services can have zero-argument constructors or even no explicit constructor at all!

When these features are combined with type inference and a fluent interface, the result is a DI container that doesn't take over your service classes, as can be seen below:

```typescript
import { use } from "use-this";

class MyService {
    doSomething() {}
}

class AnotherService {
    myService = use(MyService);  // <- this is all you add! (TypeScript even infers the type)

    doAthing() {
        this.myService.doSomething();
    }
}
```

Because of the ambient context, services do not need any special base classes nor do they need any special properties, methods or interfaces.  Type inference plus classes as keys means property declarations can be kept to simple shorthand, as shown above.

### Configuring Factories and Values

Of course, sometimes, it may be useful to be more explicit.  For example, let's say that `AnotherService` was an existing class with a constructor taking a `MyService` argument:

```typescript
class AnotherService {
    constructor(public myService: MyService) {}

    doAthing() {
        this.myService.doSomething();
    }
}
```

Then we could use another feature of `use-this` (global defaults) to set up an explicit default factory:

```typescript
// Register a factory in the global context
use.def(AnotherService, use => new AnotherService(use(MyService)));
```

This way, we get the best of both worlds: easy integration with existing classes, and easy-to-write new ones.

In addition to services keyed by class, you can also define typed configuration properties, keyed by strings or symbols:

```typescript
// You can use strings instead of symbols, but unique strings are awkward
// to define and use...  and if they're long enough to be unique you'll
// want to use constants to keep them straight anyway!
//
export const
    numWorkers = Symbol(),
    maxWorkers = Symbol()
;
use .set(numWorkers, 3)  // Register default value in the global context
    .def(maxWorkers, use => use(numWorkers) * 2); // (.set and .def calls are chainable)

// TypeScript support: as long as you do this somewhere in your project for
// each of your keys, TypeScript will see the right types for your
// .set()/.def()/.use() calls.  You can declare them anywhere, but it's
// simplest to put them in the same module that defines the constants and
// default values or factories.
//
declare module "use-this" {
    interface Types {
        // Define the types of your string or symbol keys here
        [numWorkers]: number;
        [maxWorkers]: number;
    }
}
```

If you're using Javascript, declaring your key types is optional.  But if you're using TypeScript, it's required, as otherwise any string/symbol keys passed to `use-this` will generate type errors.  (Having the typings also lets you use hinting and autocompletion in IDEs like VSCode.)

The `.set()` method of contexts registers a value or service instance to be used in that context, and any contexts inheriting from it.  (The global `use.set()` registers it in the global default context, which is inherited by all other contexts.)

Please note that you should only globally `.set()` **immutable** values (numbers, strings, read-only record types, etc.), unless you explicitly intend them to be global shared state and have taken into consideration the potential problems of doing so.  For objects that might be changed, registering a factory is usually a better choice when setting up global defaults.  (Among other things, it prevents tests that modify the object from affecting later tests!)

### Working With Contexts

So we've seen how to define service dependencies and default values and factories, but how do we actually start *using* an instance of `AnotherService`?  Do we just `use(AnotherService)` in our initialization code?

Almost!  The `use` export of `use-this` is actually a special context: the *global defaults* context.  It accepts `.set()` and `.def()` to create defaults, but only lets us look things up when it's called *during the synchronous execution* of a factory function or service constructor.  That means we can't just call it directly in our initialization code, or we'll get an error.  (This restriction ensures there's never any truly global *state* in our apps, which helps make them more testable and less fragile.)

So, since the global context is write-only, we have to create a new, read-write context using the `.fork()` method:

```typescript
// Get an `AnotherService` instance from a new context
use.fork(AnotherService).doAthing();
```

The `.fork()` method of a context does two things.  First, it creates a new, child context that inherits factories and values from it.  Second, if it's passed a key, it looks the key up in the new context and returns the result instead of the context.

Each time the line of code above runs, it creates a *new* child context, and executes whatever factory is defined for `AnotherService` with that new context as the *ambient* or "current" context.  So when `use()` is called inside any of the constructors, initializers, or factories used to create our service instance, it will look things up in the new child context created by `fork()`, instead of the global defaults context.

Thus, if we `fork()` five different `AnotherService` instances, each will have its own `MyService` instance as well, not to mention any other service(s) they use.)

But wait, what if we want to *share* `MyService` instances across those contexts?  After all, we might want to have a global `App` service that's shared between request-scoped services (in a server app) or window/pane-scoped services (in a client app).

### Inheritance, Sharing, and the Active Context

Here's a sketch of a server-side app creating request-scoped services, using `use.this` and `this.use`:

```typescript
// Just mocks for the example
class User {
    name: string;
}

class RequestService {
    user = use(User);
    POST(data){
        console.log(`got POST for user ${this.user.name}`)
    };
}

class App {
    use = use.this;

    run() { /* ... */ }

    processRequest(user: User, data) {
        this.use
            .fork()                 // create a new context
            .set(User, user)        // add some local info to it
            .use(RequestService)    // get a service from the context
            .POST(data);            // and call a method on it
    }
}

// Create an app in its own context and run it
use.fork(App).run();
```

So what's going on here?  Well, first, `use.this` is an accessor for the *currently active context*.  Remember how we said that the global `use()` function looks things up in the "active" context for the current factory or service constructor call?  Well, this is how you can get access to that context, from inside the factory or constructor, and then save it for later use.

In the above example, the  `App` class saves `use.this` as `this.use`, so it can fork new children off of it to run requests in.  Each child context will spawn its own `RequestService`, along with any other services used by the `RequestService` that haven't already been used in the `App` instance's context.

The way this inheritance works is that when we set up factories and values using `.def()` and `.set()`, we aren't really "setting" the values, we're just defining how to *get* them.  In this state, you could say that the values are "pending", like an unresolved promise.  But when we look them up with `use()`, they are then "resolved" to an actual value (or error).

When we `fork()` a child context, any lookups that happen in it will look up either the pending definition or resolved value from the parent context (unless they're overridden by a definition in the child).  If it's a pending definition, the factory will be called with the *child* context active, creating a new instance in the child instead of sharing that service with the parent!  But if the parent context already `use()`d the definition, then it's a resolved value, and ends up shared by the child.

Thus, in our example above, any services that `App` or its dependencies used prior to a given `processRequest()` will be shared by the request context for every future request.  Any other services will be created fresh, on a per request basis.  This is a powerful tool for building applications from loosely-coupled, on-demand components.

### Managing Scoped Components

XXX scope and owner, scoping keys

### Creating "Smart Key" objects
### Error Handling
### Creating a Component Framework
### Managing Configuration Files


## API Reference

### Context Objects

Context objects are callables that look up a key and return a value, following these consistency rules for a given key and context:

- Every call with the same key to the same context returns the exact same result or throws the same error instance
- After the first lookup of a key in a context, no calls to `.set()` or `.def()` can change the result of future calls, no matter what context or key they're called on.  (And `.set()` or `.def()` on the same context will produce an error.)
- If no value or factory is defined in the target context, the nearest parent (searching upward in the context tree) with a value or factory is used to generate the return value
    - If the found value was created by a factory, the arguments used by that factory are **looked up in the target context** to see if they're identical: if not, the factory is called instead of inheriting its result.  (Note that this means those other keys will now be resolved -- and thus unchangeable -- as a side effect.)

In addition to being callable, Contexts have the following methods:

#### `.use(key)`

`.use(key)` does the same thing as just calling the context object directly.  This is intended as a convenience for writing code that can work with either a context or an object with a `.use` property that's a context.  (Such objects are said to implement the `Useful` interface; see the interfaces section below for more detail.)

#### `.fork(key?)`

Create a new subcontext and return it, or if `key` is given, return the result of looking `key` up in the subcontext.  The subcontext will inherit values and factories from its parent, but will not implicitly resolve anything in it.  (That is, you can continue changing things in a parent context even if they've been looked up in a child context.  It is only direct lookups that are required to be consistent.)

#### `.set(key, value)`

`.set(key, value)` sets the value the key will have in the context, unless `.use(key)` has already been called for the context (in which case an error will occur).  Forked sub-contexts of the context will inherit the new value, unless `.set()`, `.def()`, or `.use()` have already been called for that key in that context or an intermediate context between it and the context where `.set()` was called.

#### `.def(key, factory: (ctx, key) => result)`

`.def(key, factory)` assigns a factory for computing the value of `key` in the context, unless `.use(key)` has already been called for the context (in which case an error will occur).  Upon `.use()` of the key, the factory will be called with two arguments: the context it's being looked up in, and the key.  It should return a value of the appropriate type for the given key.

Forked sub-contexts will inherit either the factory or its result, depending on the circumstances:

- If `.set()`, `.def()`, or `.use()` have already been called for that key in that context or an intermediate context, nothing will be inherited
- If `.use()` is called in the subcontext before it is called in any context(s) between it and the context where `.def()` is called, the factory is inherited and invoked *in that subcontext*, leaving the origin context unaffected
- If `.use()` is called in the subcontext *after* it has been called in a parent, the *result* of the factory call in the parent will be inherited, so long as every key that was `use()`d by the factory has the same value in the relevant subcontext.  (In effect, you can think of it as the result being memoized on the factory's dependencies.)  If any of the values are different in the subcontext, the factory is called again in the subcontext, rather than keeping the same result value.  This "smart sharing" rule ensures a self-consistent configuration is always seen by each subcontext.

### The Global Context

The global context is similar to a regular context object, in that when it is called, it performs a lookup of a key.  Unlike other contexts, however, it does this in the *currently-active* context, or throws an error if there is no currently-active context.  It also lacks a `use` property or method (and thus does not implement the `Useful` or `Context` interfaces, as it's not really suitable for use outside of constructors and factories).

The global context also has two extra properties:

#### `use.this`

The `.this` property of the global context is an accessor for the "currently active" context: the context that is currently running a factory to create a service or compute a configuration value.  If no context is currently active, an error is thrown.

The global `use(key)` function is actually shorthand for `use.this(key)`.  (That is, it looks up the key in the currently active context, or throws an error if there isn't one.)

#### `use.me`

A symbol that can be used to define a static method that will be used in place of a class' constructor to create a service.  This can be helpful when your service constructor needs non-default arguments, or when there is some additional side-effect required.

### Interfaces

(Note: this is just an overview of the primary interfaces `use-this` provides and uses, that you'd most likely want to use or implement in your own code.  If you want to see the full typings, see the [use-this.d.ts](mjs/use-this.d.ts) file.)

#### `Types`

An interface whose sole purpose is to support type inference and checking on string keys passed to the other API functions.  By declaring appropriately-named members of this interface with a relevant type, TypeScript will be able to infer the types returned by `.use()` and `.fork()` (or required by `.set()` and `.def()`), e.g.:

```typescript
declare module "use-this" {
    interface Types {
        "some-key": number
    }
}
```

The above declaration ensures that `.set("some-key")` will expect a `number` value, and `.def("some-key")` will expect a `Factory<number>` throughout your code.

#### `Useful`

The `Useful` interface is implemented by any object with a `.use` property that's a `Context`.  It's useful (no pun intended) for making it easy to implement APIs that accept either a `Context`, or an object that *owns* a context.  If all the API needs is to look keys up, it can simply call `.use()` on the `Useful` object, and if it needs other context methods it can simply do `ctx = aUsefulObject.use` to obtain a `Context`.

#### `Factory<T>`

A factory for type T is a function that takes `(ctx: Context, key: any)` as arguments and returns `T`.  Context

#### `Recipe<T>`

A "recipe" is an object with a `[use.me](ctx: Context, key: any): T` method (or class with such a *static* method).  When a Recipe is looked up as a key and no value or factory is found in a context or its parents, the method is called with the target context and key, and the return value is used as the result.