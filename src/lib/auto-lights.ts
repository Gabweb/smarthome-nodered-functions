import { NodeRed } from "./node-red";

export interface LightStateMsg {
    payload: Input
}

export interface Input {
    directOccupancy?: boolean;
    adjacentOccupancy?: boolean;
    luminance?: number;
}

export interface Output {
    light: Light;
    reason: "Entering" | "Leaving" | "Luminance";
}

type EnvKeys = "luminanceDirectThreshold" | "luminanceAdjacentThreshold" | "keepInDirect";
type ContextKeys = "prevState";

enum Light {
    Direct = 'Direct',
    Adjacent = 'Adjacent',
    Off = 'Off',
    ManualOn = 'ManualOn',
    ManualOff = 'ManualOff'
}

// -------------------------------------------------

export function lightState(
    msg: LightStateMsg,
    context: Map<ContextKeys, any>,
    env: Map<EnvKeys, any>,
    node: NodeRed,
) {
    // Main -----------------------------------

    const prevState = context.get("prevState") as Light
    const state = stateMachine(prevState)
    context.set("prevState", state.light)

    if (state.light != prevState) {
        emit(
            { fill: stateToFill(state.light), text: state },
            state
        )
    }

    // Fun -----------------------------------

    function stateMachine(curr: Light): Output | undefined {
        // Context
        const directOccupancy = msg.payload.directOccupancy ?? false;
        const adjacentOccupancy = (msg.payload.adjacentOccupancy ?? false) || directOccupancy;
        const luminance = msg.payload.luminance ?? 0;

        // Env
        const directThreshold = env.get("luminanceDirectThreshold")
        const adjacentThreshold = (env.get("luminanceAdjacentThreshold") == -1 ? directThreshold : env.get("luminanceAdjacentThreshold"))
        const envKeepInDirect = env.get("keepInDirect") ?? false;
        const luminanceHysteresis = 1.2;

        const lumBelowDirect = directThreshold > luminance
        const lumBelowDirectHysteresis = luminanceHysteresis * directThreshold > luminance
        const lumBelowAdjacent = adjacentThreshold > luminance
        const lumBelowAdjacentHysteresis = luminanceHysteresis * adjacentThreshold > luminance

        const isDirect = directOccupancy && lumBelowDirect;
        const isAdjacent = adjacentOccupancy && lumBelowAdjacent;

        if (curr == Light.Direct) {
            if (!directOccupancy) {
                if (envKeepInDirect && adjacentOccupancy) {
                    // Do nothing, keep in direct
                } else if (!adjacentOccupancy) {
                    return { light: Light.Off, reason: "Leaving" };
                } else if (isAdjacent) {
                    return { light: Light.Adjacent, reason: "Leaving" };
                }
            }

            if (!lumBelowDirectHysteresis) {
                return { light: Light.Off, reason: "Luminance" };
            }

            return undefined
        }

        if (curr == Light.Adjacent) {
            if (isDirect) {
                return { light: Light.Direct, reason: "Entering" };
            }

            if (!adjacentOccupancy) {
                return { light: Light.Off, reason: "Leaving" };
            }
            if (!lumBelowAdjacentHysteresis) {
                return { light: Light.Off, reason: "Luminance" };
            }

            return undefined
        }

        if (curr == Light.Off) {
            if (isDirect) {
                return { light: Light.Direct, reason: "Entering" };
            }

            if (isAdjacent) {
                return { light: Light.Adjacent, reason: "Entering" };
            }

            return undefined
        }
    }

    function stateToFill(state: Light) {
        switch (state) {
            case Light.Direct: return "green"
            case Light.Adjacent: return "yellow"
            case Light.Off: return "red"
            case Light.ManualOff:
            case Light.ManualOn: return "grey"
        }
    }

    function emit(status, payload) {
        node.send([
            payload ? { payload } : undefined,
            {
                payload: status,
            }
        ]);
    }
}