#!/usr/bin/env bun

/**
 * Release script for ai-sdk-x monorepo
 *
 * Usage:
 *   bun run release <version>              # Build and publish all packages
 *   bun run release <version> --dry-run    # Build and dry-run publish
 *   bun run release:build                  # Build only (no version bump, no publish)
 */

import * as fs from "node:fs";
import * as path from "node:path";

const $ = Bun.$;

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const PACKAGES_DIR = path.join(ROOT_DIR, "packages");

// Publish order: dependencies first, umbrella package last
const PACKAGE_DIRS = ["execute", "memo", "memory", "skill", "ai-sdk-x"] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface PackageJson {
	name: string;
	version: string;
	dependencies?: Record<string, string>;
	[key: string]: unknown;
}

function log(msg: string) {
	console.log(msg);
}

function logStep(msg: string) {
	console.log(`\n${"─".repeat(60)}\n${msg}\n${"─".repeat(60)}`);
}

async function readPkg(pkgDir: string): Promise<PackageJson> {
	return Bun.file(path.join(pkgDir, "package.json")).json();
}

async function writePkg(pkgDir: string, pkg: PackageJson) {
	await Bun.write(path.join(pkgDir, "package.json"), `${JSON.stringify(pkg, null, "\t")}\n`);
}

// ─── Parse CLI args ─────────────────────────────────────────────────────────

function parseArgs() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const buildOnly = args.includes("--build-only");
	const version = args.find((a) => !a.startsWith("--"));

	if (!version && !buildOnly) {
		console.error("Usage:");
		console.error("  bun run release <version>              # Build + publish");
		console.error("  bun run release <version> --dry-run    # Build + dry-run publish");
		console.error("  bun run release:build                  # Build only");
		process.exit(1);
	}

	return { version, dryRun, buildOnly };
}

// ─── Version bump ───────────────────────────────────────────────────────────

async function bumpVersions(version: string) {
	logStep(`Bumping all packages to ${version}`);

	for (const dir of PACKAGE_DIRS) {
		const pkgDir = path.join(PACKAGES_DIR, dir);
		const pkg = await readPkg(pkgDir);
		pkg.version = version;
		await writePkg(pkgDir, pkg);
		log(`  ✓ ${pkg.name} → ${version}`);
	}
}

// ─── Build ──────────────────────────────────────────────────────────────────

async function buildPackage(pkgDir: string) {
	const pkg = await readPkg(pkgDir);
	const distDir = path.join(pkgDir, "dist");

	log(`\n📦 Building ${pkg.name} ...`);

	// Clean dist
	if (fs.existsSync(distDir)) {
		fs.rmSync(distDir, { recursive: true });
	}

	// Temp tsconfig for ESM (+ declarations)
	const tsconfigEsm = {
		extends: "../../tsconfig.json",
		compilerOptions: {
			rootDir: "src",
			outDir: "dist/esm",
			module: "ESNext",
			moduleResolution: "bundler",
			declaration: true,
			declarationMap: true,
			sourceMap: true,
		},
		include: ["src"],
		exclude: ["src/tests", "src/examples"],
	};

	// Temp tsconfig for CJS
	const tsconfigCjs = {
		extends: "../../tsconfig.json",
		compilerOptions: {
			rootDir: "src",
			outDir: "dist/cjs",
			module: "CommonJS",
			moduleResolution: "node",
			declaration: false,
			declarationMap: false,
			sourceMap: false,
			verbatimModuleSyntax: false,
		},
		include: ["src"],
		exclude: ["src/tests", "src/examples"],
	};

	const esmCfgPath = path.join(pkgDir, "tsconfig.esm.json");
	const cjsCfgPath = path.join(pkgDir, "tsconfig.cjs.json");

	try {
		await Bun.write(esmCfgPath, JSON.stringify(tsconfigEsm, null, "\t"));
		await Bun.write(cjsCfgPath, JSON.stringify(tsconfigCjs, null, "\t"));

		// ESM build
		log("  → ESM + declarations");
		await $`cd ${pkgDir} && npx tsc -p tsconfig.esm.json`.quiet();

		// CJS build
		log("  → CJS");
		await $`cd ${pkgDir} && npx tsc -p tsconfig.cjs.json`.quiet();

		// Mark CJS output so Node treats .js as CommonJS
		await Bun.write(
			path.join(distDir, "cjs", "package.json"),
			`${JSON.stringify({ type: "commonjs" }, null, "\t")}\n`,
		);

		log(`  ✅ ${pkg.name} built`);
	} finally {
		// Clean up temp configs
		for (const p of [esmCfgPath, cjsCfgPath]) {
			if (fs.existsSync(p)) fs.unlinkSync(p);
		}
	}
}

async function buildAll() {
	logStep("Building packages");

	for (const dir of PACKAGE_DIRS) {
		await buildPackage(path.join(PACKAGES_DIR, dir));
	}
}

// ─── Publish ────────────────────────────────────────────────────────────────

async function publishPackage(pkgDir: string, dryRun: boolean) {
	const pkg = await readPkg(pkgDir);
	const isScoped = pkg.name.startsWith("@");

	if (dryRun) {
		log(`  🏃 dry-run: ${pkg.name}@${pkg.version}`);
		await $`cd ${pkgDir} && bun publish --dry-run ${isScoped ? "--access public" : ""}`;
	} else {
		log(`  🚀 publishing ${pkg.name}@${pkg.version}`);
		await $`cd ${pkgDir} && bun publish ${isScoped ? "--access public" : ""}`;
	}
}

async function publishAll(dryRun: boolean) {
	logStep(dryRun ? "Publishing (dry-run)" : "Publishing");

	for (const dir of PACKAGE_DIRS) {
		await publishPackage(path.join(PACKAGES_DIR, dir), dryRun);
	}
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
	const { version, dryRun, buildOnly } = parseArgs();

	log("═".repeat(60));
	log(" ai-sdk-x monorepo release");
	log("═".repeat(60));
	if (version) log(` version : ${version}`);
	if (dryRun) log(" mode    : DRY RUN");
	if (buildOnly) log(" mode    : BUILD ONLY");

	// 1. Bump versions
	if (version) {
		await bumpVersions(version);
	}

	// 2. Build
	await buildAll();

	// 3. Publish
	if (!buildOnly) {
		await publishAll(dryRun ?? false);
	}

	log(`\n${"═".repeat(60)}`);
	log(" ✅  All done!");
	log("═".repeat(60));
}

main().catch((err) => {
	console.error("\n❌ Release failed:\n", err);
	process.exit(1);
});
