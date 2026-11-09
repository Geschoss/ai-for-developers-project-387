const hasNote = (note: string | null): note is string => note !== null && note !== "";

export { hasNote };
