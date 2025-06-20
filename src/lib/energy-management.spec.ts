import { DeviceConfig, DeviceState, ems, EmsMessage } from './energy-management';
import { DummyNodeRed } from './node-red';

type TestDevice = Readonly<Omit<DeviceState, 'id' | 'name'>> & Partial<Pick<DeviceState, 'id' | 'name'>>;

describe('general', () => {
    test('should consider device active', () => {
        const msg: EmsMessage["payload"] = { availenergy: 0, device0: true }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 0, "off"]);
    });

    test('should consider device id', () => {
        const msg: EmsMessage["payload"] = { availenergy: 100 }
        const devices: TestDevice[] = [
            { id: 2, power: 100, dynamic: false, active: false, setPower: 0 },
            { id: 0, power: 200, dynamic: true, active: false, setPower: 0 },
            { id: 1, power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual([0, "off", "on"]);
    });
});

describe('static', () => {
    test('should turn on single device', () => {
        const msg: EmsMessage["payload"] = { availenergy: 100 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 0, "off"]);
    });

    test('should ignore disabled device', () => {
        const msg: EmsMessage["payload"] = { availenergy: 100, device0enabled: false }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 100 },
            { power: 100, dynamic: false, active: false, setPower: 200 },
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["off", "on"]);
    });

    test('should turn off disabled device', () => {
        const msg: EmsMessage["payload"] = { availenergy: 0, device0enabled: false }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: true, setPower: 100 },
            { power: 100, dynamic: false, active: true, setPower: 100 },
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["off", "on"]);
    });

    test('should turn on first device which is in the budget', () => {
        const msg: EmsMessage["payload"] = { availenergy: 400 }
        const devices: TestDevice[] = [
            { power: 500, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["off", "on", "on"]);
    });

    test('should turn on higher prio devices, if there is enough power', () => {
        const msg: EmsMessage["payload"] = { availenergy: 300, device1power: 200, device2power: 200 }
        const devies: TestDevice[] = [
            { power: 500, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: false, active: true, setPower: 200 },
            { power: 200, dynamic: false, active: true, setPower: 200 }
        ];
        const result = setupEms(msg, devies)
        expect(result).toEqual(["on", "on", "off"]);
    });

    test('should turn multiple devices', () => {
        const msg: EmsMessage["payload"] = { availenergy: 1000 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 200, "on"]);
    });

    test('should turn off single device', () => {
        const msg: EmsMessage["payload"] = { availenergy: -50 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: true, setPower: 100 },
            { power: 200, dynamic: true, active: true, setPower: 200 },
            { power: 300, dynamic: false, active: true, setPower: 300 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 200, "off"]);
    });
});
describe('dynamic', () => {
    test('should turn on dynamic device with exessive power', () => {
        const msg: EmsMessage["payload"] = { availenergy: 200 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 100, "off"]);
    });

    test('should turn on dynamic device with exessive power even if previous device is not active', () => {
        const msg: EmsMessage["payload"] = { availenergy: 50 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["off", 50, "off"]);
    });

    // needs actual power consumption
    test('should turn on higher prio device if there is enough power', () => {
        const msg: EmsMessage["payload"] = { availenergy: 70, device1power: 50 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: true, setPower: 50 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 20, "off"]);
    });

    test('should turn off lowest prio device if there is enough power - even if devicepower is known', () => {
        const msg: EmsMessage["payload"] = { availenergy: -100, device1power: 1000 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: true, setPower: 100 },
            { power: 1000, dynamic: true, active: true, setPower: 1000 },
            { power: 300, dynamic: false, active: true, setPower: 300 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 1000, "off"]);
    });

    test('should ??', () => {
        const msg: EmsMessage["payload"] = { availenergy: 3440, device1power: 90 }
        const devices: TestDevice[] = [
            { power: 200, dynamic: false, active: false, setPower: 0 },
            { power: 3500, dynamic: true, active: true, setPower: 90 },
            { power: 1800, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 3330, "off"]);
    });

    // Without power info, we do not know if the device is actually running.
    // Therefore, we cannot be certain if we have power available for the higher prio device.
    test('should not turn on higher prio device if there is no power info', () => {
        const msg: EmsMessage["payload"] = { availenergy: 70 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: true, setPower: 50 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["off", 120, "off"]);
    });

    test('should turn on multiple dynamic device with exessive power', () => {
        const msg: EmsMessage["payload"] = { availenergy: 500 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: true, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 200, 200]);
    });

    test('should turn on multiple dynamic device with exessive power II', () => {
        const msg: EmsMessage["payload"] = { availenergy: 400 }
        const devices: TestDevice[] = [
            { power: 700, dynamic: false, active: false, setPower: 0 },
            { power: 200, dynamic: true, active: false, setPower: 0 },
            { power: 300, dynamic: true, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["off", 200, 200]);
    });

    test('should increase device power', () => {
        const msg: EmsMessage["payload"] = { availenergy: 100 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: true, setPower: 100 },
            { power: 200, dynamic: true, active: true, setPower: 100 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 200, "off"]);
    });

    test('should reduce device power', () => {
        const msg: EmsMessage["payload"] = { availenergy: -50 }
        const devices: TestDevice[] = [
            { power: 100, dynamic: false, active: true, setPower: 100 },
            { power: 200, dynamic: true, active: true, setPower: 100 },
            { power: 300, dynamic: false, active: false, setPower: 0 }
        ];
        const result = setupEms(msg, devices)
        expect(result).toEqual(["on", 50, "off"]);
    });
});

function setupEms(msg: EmsMessage["payload"], prevState: TestDevice[]) {
    const context = new Map<string, any>();
    if (prevState) {
        context.set("prev", wrap(prevState));
    }
    return ems({ payload: msg }, context, new DummyNodeRed(), wrap(prevState)).map(result => result.payload);
}

function wrap(device: TestDevice[]): DeviceState[] {
    return device.map((d, i) => ({
        id: i,
        name: `Device ${i}`,
        ...d
    }));
}