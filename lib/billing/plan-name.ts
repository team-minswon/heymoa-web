const NAMES: Record<string, string> = { FREE: "Free", PRO: "Pro" };

export const planName = (planCode: string) => NAMES[planCode] ?? planCode;
