import { NodeRed } from "./node-red";

export interface LightStateMsg {
    payload: {
        directOccupancy?: boolean;
        adjacentOccupancy?: boolean;
        luminance?: number;
        button?: "on" | "off" | "toggle"; // TODO
    },
    topic: MsgKeys;
}

type EnvKeys = "luminanceDirectThreshold" | "luminanceAdjacentThreshold" | "keepInDirect";
type MsgKeys = "directOccupancy" | "adjacentOccupancy" | "luminance" | "button";
type ContextKeys = "prevState" | MsgKeys;

// -------------------------------------------------

const stateDirect = 'Direct';
const stateAdjacent = 'Adjacent';
const stateOff = 'Off';
const stateManualOn = 'ManualOn';
const stateManualOff = 'ManualOff';

// -------------------------------------------------

export function lightState(
    msg: LightStateMsg,
    context: Map<ContextKeys, any>,
    env: Map<EnvKeys, any>,
    node: NodeRed,
) {
    // Main -----------------------------------

    parseMsg()
    const prevState = context.get("prevState")
    const state = getNewState(prevState)
    context.set("prevState", state)

    emit(
        { fill: stateToFill(state), text: state },
        state
    )

    // Fun -----------------------------------

    function parseMsg() {
        const validKeys = ["directOccupancy", "adjacentOccupancy", "luminance", "button"]
        if (!validKeys.includes(msg.topic)) {
            emit({ fill: "red", text: "Unknown msg.topic" }, undefined);
            node.error("Unknown msg.topic: " + msg.topic);
            return;
        }
        context.set(msg.topic, msg.payload);
    }

    function getNewState(prevState) {
        // Context
        const directOccupancy = context.get("directOccupancy");
        const adjacentOccupancy = context.get("adjacentOccupancy") || directOccupancy;
        const luminance = context.get("luminance");
        const button = context.get("button");
        // Env
        const directThreshold = env.get("luminanceDirectThreshold")
        const adjacentThreshold = (env.get("luminanceAdjacentThreshold") == -1 ? directThreshold : env.get("luminanceAdjacentThreshold"))
        const envKeepInDirect = env.get("keepInDirect")

        // Manual - Button
        // TODO

        // Direct
        const isDarkDirect = directThreshold > luminance
        // Prevent leaving direct if luminance increases by just a little.
        const keepInDirect = prevState == stateDirect && directThreshold * 1.2 > luminance
        if (directOccupancy && (isDarkDirect || keepInDirect)) {
            return stateDirect
        }

        // Direct (Keep in)
        const keepInDirectWhileAdjacent = envKeepInDirect && prevState == stateDirect && adjacentOccupancy
        if (keepInDirectWhileAdjacent && (isDarkDirect || keepInDirect)) {
            return stateDirect
        }

        // Adjacent
        const isDarkAdjacent = adjacentThreshold > luminance
        // Prevent leaving direct if luminance increases by just a little.
        const keepInAdjacent = prevState == stateAdjacent && adjacentThreshold * 1.2 > luminance
        if (adjacentOccupancy && (isDarkAdjacent || keepInAdjacent)) {
            return stateAdjacent
        }

        return stateOff
    }

    function stateToFill(state) {
        switch (state) {
            case stateDirect: return "green"
            case stateAdjacent: return "yellow"
            case stateOff: return "red"
            case stateManualOff:
            case stateManualOn: return "grey"
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