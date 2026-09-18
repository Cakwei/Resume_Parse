import Axios from "axios";
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const axios = Axios.create({
	baseURL: "http://localhost:3001",
	...(typeof window === "undefined"
		? {
				headers: {
					cookie: null,
				},
			}
		: { withCredentials: true }),
});
