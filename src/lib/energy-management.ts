import { NodeRed } from "./node-red";

export interface DeviceConfig {
    readonly id: number, // output
    readonly name: string,
    readonly power: number,
    readonly dynamic: boolean,
}

export type DeviceState = {
    active: boolean,
    setPower: number,
    enabled?: boolean,
    actualPower?: number
} & DeviceConfig;

export interface EmsMessage {
    payload: {
        [key: `device${number}`]: boolean | undefined;
        [key: `device${number}power`]: number | undefined;
        [key: `device${number}enabled`]: boolean | undefined;
        availenergy?: number;
    }
}

const devicesFoo: DeviceConfig[] = [
    // Fußbodenheizung
    { name: "Fußbodenheizung", power: 230, dynamic: false, id: 1 },
    // Heizstab
    { name: "Heizstab", power: 3500, dynamic: true, id: 2 },
    // Heizlüfter
    { name: "Heizlüfter", power: 1800, dynamic: false, id: 0 },
]


export function ems(
    msg: EmsMessage,
    context: Map<string, any>,
    node: NodeRed,
    devices: DeviceConfig[]
) {
    const prevState: DeviceState[] = context.get("prev") ?? devices.map(device => ({ ...device, active: false, actualPower: 0 }));

    // Update device from msg
    prevState.forEach(device => {
        const active = msg.payload[`device${device.id}`]
        const enabled = msg.payload[`device${device.id}enabled`] ?? true
        device.active = enabled === false ? false :
            active != null ? active : device.active;
        device.setPower = device.active ? device.setPower : 0;
        device.actualPower = msg.payload[`device${device.id}power`];
        device.enabled = enabled;
    })

    // Filter out disabled devices
    const enabledDevices = prevState
        .filter(device => device.enabled !== false);

    let availEnergy = msg.payload.availenergy ?? 0
    let dynamicEnergy = 0

    // More energy available -> Can we turn on devices?
    if (availEnergy > 0) {
        // Add device actual power to available energy
        prevState.forEach(device => {
            if (device.active && device.actualPower != null && device.actualPower > 0) {
                availEnergy += device.actualPower;
                device.active = false;
                device.setPower = 0;
            }
        })

        enabledDevices
            .filter(device => device.active == false)
            .forEach(device => {
                if (availEnergy <= 0) {
                    return;
                }

                if (device.dynamic == true) {
                    availEnergy -= device.power
                    dynamicEnergy += device.power
                    device.active = true
                } else if (device.power <= availEnergy) {
                    availEnergy -= device.power
                    device.active = true
                }
            })
    }
    // Less energy available -> Turn off!
    else if (availEnergy < 0) {
        enabledDevices
            .filter(device => device.active == true)
            .reverse()
            .forEach(device => {
                if (availEnergy > 0) {
                    return;
                }

                if (device.dynamic == true) {
                    dynamicEnergy -= device.power
                }
                availEnergy += device.power
                device.active = false
            })
    }

    // Update dynamic
    let availEnergyDynamic = availEnergy + dynamicEnergy
    enabledDevices
        .filter(device => device.dynamic == true)
        .forEach(device => {
            availEnergyDynamic -= updateDynamicDevice(device, availEnergyDynamic)
        })

    context.set("prev", prevState)

    const output = prevState.toSorted((a, b) => a.id - b.id).map(device => deviceOutput(device))
    node.status({ text: output.join(", ") });
    return output.map(out => ({ payload: out }))


    // -----------------------------

    function updateDynamicDevice(device: DeviceState, availEnergy: number) {
        const currPower = device.setPower
        const power = Math.min(Math.max(currPower + availEnergy, 0), device.power)
        device.setPower = power
        device.active = power > 0
        return power - currPower
    }

    function deviceOutput(device: DeviceState) {
        return device.dynamic == true ? device.setPower : device.active ? "on" : "off"
    }
}
