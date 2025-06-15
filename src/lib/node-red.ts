export interface NodeRed {
    status: (status: { fill?: "red" | "green" | "yellow" | "blue" | "grey", shape?: "ring" | "dot", text: string }) => void;
    send: (msg: any) => void;
    log: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
    done: (msg?: any) => void;
}

export class DummyNodeRed implements NodeRed {
    public lastEmit: any = null;

    constructor(private verbose: boolean = false) {

    }
    status(status: { fill?: "red" | "green" | "yellow" | "blue" | "grey", shape?: "ring" | "dot", text: string }): void {
        if (this.verbose) console.log(`Status: ${status.text}`);
    }
    send(msg: any): void {
        this.lastEmit = msg;
        if (this.verbose) console.log("Message sent:", msg);
    }
    log(msg: string): void {
        if (this.verbose) console.log("Log:", msg);
    }
    error(msg: string): void {
        if (this.verbose) console.error("Error:", msg);
    }
    warn(msg: string): void {
        if (this.verbose) console.warn("Warning:", msg);
    }
    done(msg?: any): void {
        if (this.verbose) console.log("Done:", msg);
    }
}

export type NodeRedMsg<P, T = string> = {
    payload: P;
    topic?: T;
};

export type NodeRedOutput<T> = [{ payload: T } | undefined, { payload: any }] | undefined