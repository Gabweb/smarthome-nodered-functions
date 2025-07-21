export interface State<T> {
    entity_id: string;
    state: string;
    attributes: T;
    last_changed: string;
    last_reported: string;
    last_updated: string;
}

export interface SunModel {
    next_dawn: string;
    next_dusk: string;
    next_midnight: string;
    next_noon: string;
    next_rising: string;
    next_setting: string;
    elevation: number;
    azimuth: number;
    rising: boolean;
    friendly_name: string;
}