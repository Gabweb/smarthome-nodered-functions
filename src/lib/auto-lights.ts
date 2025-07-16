import { Light } from "./lights";
import { NodeRed, NodeRedMsg, NodeRedOutput } from "./node-red";

// NodeRed Msg -----------------------------------
export type LightStateMsg = NodeRedMsg<LightInput | ButtonMsg>

export interface LightInput {
    directOccupancy?: boolean;
    adjacentOccupancy?: boolean;
    luminance?: number;
}

export interface ButtonMsg {
    new_state: {
        attributes: {
            event_type: "btn_down" | "btn_up" | "single_push" | "double_push" | "long_push" | "triple_push";
        }
    }
}

// Env Settings -----------------------------------
export interface LightSettings {
    luminanceDirectThreshold: number;
    luminanceAdjacentThreshold: number;
    hysteresis: number;
    keepInDirect: boolean;
}

// Output Types -----------------------------------
export interface LightOutput {
    light: Light;
    reason: "Entering" | "Leaving" | "Luminance" | "Manual" | "Init";
}

// Misc Types -----------------------------------
export type ContextKeys = "prevMsg" | "prevState" | "timoeut";

// Shared
function stateToFill(output: LightOutput) {
    switch (output.light) {
        case Light.Direct: return "green"
        case Light.Adjacent: return "yellow"
        case Light.Off: return "red"
    }
}

function wrapOutput(output: LightOutput): [{ payload: LightOutput }, { payload: any }] {
    return [
        {
            payload: output
        },
        {
            payload: { fill: stateToFill(output), text: output.light + " (" + output.reason + ")" },
        }
    ];
}


// On Start ---------------------------------
function onStart(node: NodeRed) {
    node.send(wrapOutput({ light: Light.Off, reason: "Init" }));
}

// On Msg -----------------------------------
export function lightState(
    msg: LightStateMsg,
    context: Map<ContextKeys, any>,
    env: Map<keyof LightSettings, any>,
    node: NodeRed,
): NodeRedOutput<LightOutput> {
    // Main -----------------------------------
    return main();

    // Fun -----------------------------------
    function main() {
        const manualTimeout = 10 * 60 * 1000; // 10 minutes

        const currMsg = msg.payload
        const prevMsg: LightInput | undefined = context.get("prevMsg");
        if (!isButtonPress(currMsg)) {
            context.set("prevMsg", currMsg);
        }

        const prevState: LightOutput = context.get("prevState") ?? { light: Light.Off, reason: "Init" };

        let newState: LightOutput | undefined;

        if (isButtonPress(currMsg)) {
            if (currMsg.new_state.attributes.event_type === "single_push") {
                newState = {
                    light: prevState.light == Light.Off ? Light.Direct : Light.Off,
                    reason: "Manual"
                };
                clearTimeout(context.get("timoeut"));

                const timeout = setTimeout(() => {
                    resetManual(newState!, prevMsg);
                }, manualTimeout)

                context.set("timoeut", timeout);
            }
        } else if (prevState.reason !== "Manual") {
            newState = stateMachine(prevMsg, currMsg, prevState);
        }

        if (newState && newState.light != prevState.light) {
            context.set("prevState", newState)
            return wrapOutput(newState);
        }
    }


    function resetManual(prevState: LightOutput, prevMsg: LightInput | undefined) {
        const input = prevMsg ?? { luminance: 0, directOccupancy: false, adjacentOccupancy: false };
        if (!prevMsg) {
            node.error("No previous message found, cannot reset state after manual timeout.");
        }
        const newOutput = stateMachine(prevMsg, input, prevState);
        if (!newOutput) {
            node.warn("No new state after manual timeout, keeping current state.");
        } else {
            context.set("prevState", newOutput)
            node.send(wrapOutput(newOutput));
        }
    }

    function stateMachine(prevInput: LightInput | undefined, currInput: LightInput, prevState: LightOutput): LightOutput | undefined {
        // Context
        const directOccupancy = currInput.directOccupancy ?? false;
        const adjacentOccupancy = (currInput.adjacentOccupancy ?? false) || directOccupancy;
        const luminance = currInput.luminance ?? 0;

        // Env
        const directThreshold: number = env.get("luminanceDirectThreshold")
        const envLuminanceAdjacentThreshold: number = env.get("luminanceAdjacentThreshold")
        const adjacentThreshold = (envLuminanceAdjacentThreshold == -1 ? directThreshold : envLuminanceAdjacentThreshold)
        const envKeepInDirect: boolean = env.get("keepInDirect") ?? false;
        const luminanceHysteresis: number = env.get("hysteresis") ?? 1.2;

        const lumBelowDirect = directThreshold > luminance
        const lumBelowDirectHysteresis = luminanceHysteresis * directThreshold > luminance
        const lumBelowAdjacent = adjacentThreshold > luminance
        const lumBelowAdjacentHysteresis = luminanceHysteresis * adjacentThreshold > luminance

        const isDirect = directOccupancy && lumBelowDirect;
        const isAdjacent = adjacentOccupancy && lumBelowAdjacent;

        if (prevState.light == Light.Direct) {
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

        if (prevState.light == Light.Adjacent) {
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

        if (prevState.light == Light.Off) {
            const currLum = prevInput?.luminance ?? 0;
            if (isDirect) {
                return {
                    light: Light.Direct,
                    reason: directThreshold > currLum ? "Entering" : "Luminance"
                };
            }

            if (isAdjacent) {
                return {
                    light: Light.Adjacent,
                    reason: adjacentThreshold > currLum ? "Entering" : "Luminance"
                };
            }

            return undefined
        }
    }

    function isButtonPress(input: LightInput | ButtonMsg): input is ButtonMsg {
        return (input as ButtonMsg).new_state !== undefined;
    }
}
