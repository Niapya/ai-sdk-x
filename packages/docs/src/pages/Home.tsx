import { AiSdkSection } from "@/components/home/AiSdkSection";
import { BashSection } from "@/components/home/BashSection";
import { DeploySection } from "@/components/home/DeploySection";
import { FooterCta } from "@/components/home/FooterCta";
import { HeroSection } from "@/components/home/HeroSection";
import { MountSection } from "@/components/home/MountSection";

export function Home() {
	return (
		<div className="overflow-hidden">
			<HeroSection />
			<BashSection />
			<MountSection />
			<AiSdkSection />
			<DeploySection />
			<FooterCta />
		</div>
	);
}
