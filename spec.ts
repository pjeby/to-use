import {Recipe, Context, use} from "./to-use";
import {strict as assert} from 'assert';

declare module "./to-use" {
    interface Types {
        [something]: any
        [aNumber]: number
    }
}

const something = Symbol("something"), aNumber = Symbol("aNumber");

describe("GlobalContext", ()=> {
    describe(".use()", () => {
        it("accesses the active context during construction", () => {
            const ctx = use.fork();
            ctx.set(aNumber, 42);
            ctx.def(something, () => use(aNumber))
            assert.equal(ctx.use(something), 42);
        });

        it("throws a TypeError if accessed outside construction", () => {
            assert.throws(
                () => use(aNumber),
                (e: any) => {
                    assert.equal(e.message, "No current context")
                    return e instanceof TypeError;
                }
            )
        });
    });

    describe(".me", () => {
        it("is an interoperable symbol", () => {
            assert.equal(use.me, Symbol.for("v1.to-use.peak-dev.org"))
        });
    });

    describe(".this", () => {
        it("accesses the active context during construction", () => {
            const ctx = use.fork();
            ctx.def(something, () => use.this)
            assert.equal(ctx.use(something), ctx);
        });

        it("throws a TypeError if accessed outside construction", () => {
            assert.throws(
                () => use.this,
                (e: any) => {
                    assert.equal(e.message, "No current context")
                    return e instanceof TypeError;
                }
            )
        });
    })
})

describe("Context", () => {
    describe(".set()", () => {
        it("throws an error if key already use()d in context", () => {
            const ctx = use.fork().set(aNumber, 42);
            assert.throws(
                () => {
                    ctx.use(aNumber);
                    ctx.set(aNumber, 99);
                }, /^Error: Already read: Symbol\(aNumber\)$/
            )
        });

        it("doesn't affect already-read values in forked contexts", () =>{
            const ctx = use.fork();
            ctx.set(aNumber, 23);
            const ctx2 = ctx.fork();
            assert.equal(ctx2.use(aNumber), 23);
            ctx.set(aNumber, 42);
            assert.equal(ctx2.use(aNumber), 23);
        });
    });

    describe(".def()", () => {
        it("throws an error if key already use()d in context", () => {
            const ctx = use.fork().def(aNumber, () => 42);
            assert.throws(
                () => {
                    ctx.use(aNumber);
                    ctx.def(aNumber, () => 99);
                }, /^Error: Already read: Symbol\(aNumber\)$/
            )
        });

        it("doesn't affect already-read values in forked contexts", () => {
            const bottom = use.fork(), middle = bottom.fork(), top = middle.fork();
            bottom.set(aNumber, 42).def(something, () => use(aNumber)*2 );
            assert.equal(bottom.use(something), 84);
            assert.equal(top.use(something), 84);
            middle.def(something, use => 99);
            const next = top.fork();
            next.set(aNumber, 16);
            assert.equal(next.use(something), 32);
        });
    });

    describe(".use()", () => {
        it("throws an error for a cyclical factory", () => {
            const ctx = use.fork().def(aNumber, () => use(aNumber));
            assert.throws(
                () => ctx.use(aNumber),
                /^Error: Factory \(\) => .*use.*\(aNumber\) didn't resolve Symbol\(aNumber\)$/
            );
        });

        it("only calls a factory once", () => {
            const ctx = use.fork();
            let num = 776;
            ctx.def(aNumber, () => ++num);
            assert.equal(ctx.use(aNumber), 777);
            assert.equal(ctx.use(aNumber), 777);  // no change proves the factory
            assert.equal(ctx.use(aNumber), 777);  // was only called once
        });

        it("rethrows the same error for a factory that errored", () => {
            const ctx = use.fork();
            let num = 1;
            ctx.def(aNumber, () => {throw new Error(`num: ${num++}`)});
            assert.throws(() => ctx(aNumber), (e1: Error) => {
                assert.equal(e1.message, "num: 1");
                assert.throws(() => ctx(aNumber), (e2: Error) => (e1 === e2));
                return true;
            })
        })

        describe("in a child context", () => {
            it("uses result of parent's factory if already used in parent", () => {
                const ctx = use.fork();
                let num = 665;
                ctx.def(aNumber, () => ++num);
                assert.equal(ctx.use(aNumber), 666);
                assert.equal(ctx.fork().use(aNumber), 666);  // no change proves the factory
                assert.equal(ctx.fork().use(aNumber), 666);  // was only called once, in ctx
            });

            describe("runs parent factory in child ctx ", () => {
                it("if unused in parent + not overridden)", () => {
                    const ctx = use.fork();
                    ctx.def(aNumber, () => {
                        return use.this === ctx ? 555 : 444;
                    });
                    assert.equal(ctx.fork().use(aNumber), 444);
                    assert.equal(ctx.use(aNumber), 555);
                });

                it("if used in parent but parameters changed", () => {
                    class S1 {}
                    class S2 { s1 = use(S1); }
                    const c1 = use.fork(), c2 = c1.fork();
                    const s21 = c1.use(S2);
                    c2.set(S1, new S1);
                    const s22 = c2.use(S2);
                    assert.notEqual(s21, s22);
                });
            })

            it("uses parent value if not overridden", () => {
                const ctx = use.fork();
                ctx.set(aNumber, 9999)
                assert.equal(ctx.fork().use(aNumber), 9999);
            });
        });

        describe("provides a default factory that", () => {
            it("instantiates classes used as keys", () => {
                class X { x() { return "x"; } }  // native class
                assert.equal(use.fork().use(X).x(), "x");
                function Y() {}; Y.prototype.y = function() { return "y"; }
                assert.equal((use.fork().use(Y) as any).y(), "y");
            });

            it("invokes [use.me] method, even if a class", () => {
                const ctx = use.fork();
                class X {
                    static [use.me](){
                        assert.equal(this, X);
                        assert.equal(use.this, ctx);
                        return "X";
                    }
                }
                const Y: Recipe<string> = {
                    [use.me]() {
                        assert.equal(this, Y);
                        assert.equal(use.this, ctx);
                        return "Y";
                    }
                }
                assert.equal(ctx.use(X), "X");
                assert.equal(ctx.use(Y), "Y");
            });

            it("throws ReferenceError otherwise", () => {
                function Y() {};
                assert.throws(
                    () => console.log(use.fork().use(Y)),
                    /^ReferenceError: No config for function Y\(\) { }$/
                )
                assert.throws(
                    () => console.log(use.fork().use(aNumber)),
                    /^ReferenceError: No config for Symbol\(aNumber\)$/
                )
            });
        });
    });

    describe(".fork() returns a new context that", () => {
        it("inherits its parents' set()s and def()s, made after forking", () => {
            const c1 = use.fork(), c2 = c1.fork();
            c1.def(aNumber, () => 29);
            c1.set(something, "this");
            assert.equal(c2.use(aNumber), 29);
            assert.equal(c2.use(something), "this");
        });

        it("allows overriding already-use()d keys in the parent", () => {
            const c1 = use.fork(), c2 = c1.fork();
            c1.def(aNumber, () => 29);
            c1.set(something, "this");
            assert.equal(c1.use(aNumber), 29);
            assert.equal(c1.use(something), "this");
            c2.def(something, () => "else");
            c2.set(aNumber, 1);
            assert.equal(c2.use(aNumber), 1);
            assert.equal(c2.use(something), "else");
        });
    });

    describe(".fork(key)", () => {
        it("looks up key in a new context", () => {
            class Dummy { use = use.this; aNumber = use(aNumber); }
            const c1 = use.fork();
            c1.set(aNumber, 5)
            const d1 = c1.fork(Dummy);
            const d2 = c1.use(Dummy);
            assert.notEqual(c1, d1.use);
            assert.equal(c1, d2.use);
            assert.equal(d1.aNumber, 5);
            assert.equal(d2.aNumber, 5);
        })
    });
});
