import { Layout } from "@/components/Layout";
import { getVersion } from "@/content";
import { Doc } from "@/pages/Doc";
import { Home } from "@/pages/Home";
import { VersionHome } from "@/pages/VersionHome";
import { useRoute } from "@/router";

export function App() {
	const route = useRoute();
	const version = getVersion(route);

	if (route === "/") {
		return (
			<Layout noSidebar>
				<Home />
			</Layout>
		);
	}

	if (version && route === `/${version}/`) {
		return (
			<Layout version={version ?? undefined}>
				<VersionHome version={version} />
			</Layout>
		);
	}

	return (
		<Layout version={version ?? undefined}>
			<Doc path={route} />
		</Layout>
	);
}
