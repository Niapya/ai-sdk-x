import { useEffect, useState } from "react";

export function useRoute() {
	const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");

	useEffect(() => {
		const handler = () => setRoute(window.location.hash.slice(1) || "/");
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}, []);

	return route;
}

export function navigate(path: string) {
	window.location.hash = path;
}
