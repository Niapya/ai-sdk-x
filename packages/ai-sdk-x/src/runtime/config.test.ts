import { describe, expect, it } from "bun:test";
import { resolveBashConfig } from "@/runtime/config";
import { DEFAULT_CWD, DEFAULT_ENV } from "@/runtime/constants";

describe("resolveBashConfig", () => {
	it("applies default cwd and env when no options are provided", () => {
		const config = resolveBashConfig(undefined);
		expect(config.cwd).toBe(DEFAULT_CWD);
		expect(config.env).toEqual(DEFAULT_ENV);
	});

	it("defaults javascript and python to true", () => {
		const config = resolveBashConfig(undefined);
		expect(config.javascript).toBe(true);
		expect(config.python).toBe(true);
	});

	it("always sets network.dangerouslyAllowFullInternetAccess to true", () => {
		const config = resolveBashConfig(undefined);
		if (config.network === false) {
			throw new Error("network should be enabled by default");
		}
		expect(config.network?.dangerouslyAllowFullInternetAccess).toBe(true);
	});

	it("allows disabling network commands", () => {
		const config = resolveBashConfig({ network: false });
		expect(config.network).toBe(false);
	});

	it("overrides cwd with provided value", () => {
		const config = resolveBashConfig({ cwd: "/custom/path" });
		expect(config.cwd).toBe("/custom/path");
	});

	it("merges provided env on top of DEFAULT_ENV", () => {
		const config = resolveBashConfig({ env: { CUSTOM: "value" } });
		expect(config.env.HOME).toBe(DEFAULT_ENV.HOME);
		expect(config.env.CUSTOM).toBe("value");
	});

	it("provided env key overrides the corresponding DEFAULT_ENV key", () => {
		const config = resolveBashConfig({ env: { HOME: "/override" } });
		expect(config.env.HOME).toBe("/override");
	});

	it("overrides javascript and python flags", () => {
		const config = resolveBashConfig({ javascript: false, python: false });
		expect(config.javascript).toBe(false);
		expect(config.python).toBe(false);
	});

	it("passes through unknown bash options unchanged", () => {
		const config = resolveBashConfig({ cwd: "/tmp", env: {} });
		expect(config.cwd).toBe("/tmp");
	});
});

describe("runtime constants", () => {
	it("DEFAULT_CWD is a non-empty string", () => {
		expect(typeof DEFAULT_CWD).toBe("string");
		expect(DEFAULT_CWD.length).toBeGreaterThan(0);
	});

	it("DEFAULT_ENV contains a HOME key", () => {
		expect(typeof DEFAULT_ENV.HOME).toBe("string");
		expect(DEFAULT_ENV.HOME.length).toBeGreaterThan(0);
	});
});
