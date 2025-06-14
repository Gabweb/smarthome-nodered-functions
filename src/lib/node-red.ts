export interface NodeRed {
    status: (status: { fill?: "red" | "green" | "yellow" | "blue" | "grey", shape?: "ring" | "dot", text: string }) => void;
    send: (msg: any) => void;
    log: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
    done: (msg?: any) => void;
}

export class DummyNodeRed implements NodeRed {
    status(status: { fill?: "red" | "green" | "yellow" | "blue" | "grey", shape?: "ring" | "dot", text: string }): void {
        console.log(`Status: ${status.text}`);
    }
    send(msg: any): void {
        console.log("Message sent:", msg);
    }
    log(msg: string): void {
        console.log("Log:", msg);
    }
    error(msg: string): void {
        console.error("Error:", msg);
    }
    warn(msg: string): void {
        console.warn("Warning:", msg);
    }
    done(msg?: any): void {
        console.log("Done:", msg);
    }
}