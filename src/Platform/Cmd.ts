export abstract class Cmd<T> {
    public static of<T>(promise: Promise<T>): Single<T> {
        return new Single(promise);
    }

    public static butch<T>(cmds: Array<Cmd<T>>): Batch<T> {
        return new Batch(cmds);
    }

    public static none<T>(): None<T> {
        return new None();
    }

    public abstract map<R>(f: (a: T) => R): Cmd<R>;

    public abstract execute<R>(f: (a: T) => R): Promise<R>;

    public abstract concat(cmd: Cmd<T>): Cmd<T>;
}

class Single<T> implements Cmd<T> {
    constructor(private readonly promise: Promise<T>) {}

    public map<R>(f: (a: T) => R): Cmd<R> {
        return Cmd.of(this.execute(f));
    }

    public concat(cmd: Cmd<T>): Batch<T> {
        return Cmd.butch([ this, cmd ]);
    }

    public execute<R>(f: (a: T) => R): Promise<R> {
        return this.promise.then(f);
    }
}

class None<T> implements Cmd<T> {
    public map(): None<T> {
        return this;
    }

    public concat(cmd: Cmd<T>): Cmd<T> {
        return cmd;
    }

    public execute(): Promise<any> {
        return Promise.resolve();
    }
}

class Batch<T> implements Cmd<T> {
    constructor(private readonly cmds: Array<Cmd<T>>) {}

    public map<R>(f: (a: T) => R): Batch<R> {
        return new Batch(
            this.cmds.map((cmd) => cmd.map(f))
        );
    }

    public concat(cmd: Cmd<T>): Batch<T> {
        return new Batch([ ...this.cmds, cmd ]);
    }

    public execute<R>(f: (a: T) => R): Promise<R[]> {
        return Promise.all(
            this.cmds.map((cmd) => cmd.execute(f))
        );
    }
}
