
export function isToday(dateIsoString: string): boolean {
    const date = new Date(dateIsoString);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
}

export function isBefore(input: Date, after: Date): boolean {
    return input.getTime() < after.getTime();
}