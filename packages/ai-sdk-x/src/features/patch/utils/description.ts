import { commandError, defineCliCommand } from "@/utils/command";

const PATCH_ARGS = [
	{
		name: "content",
		multiple: false,
		summary: "Inline patch content. Reads stdin when omitted.",
	},
] as const;

const PATCH_FLAGS = {
	file: {
		type: "string",
		helpValue: "path",
		summary: "Read the patch from a file path.",
	},
	base: {
		type: "string",
		helpValue: "path",
		summary: "Resolve relative patch paths against this base directory.",
	},
} as const;

export const PATCH_DESCRIPTION = `Use the "x-patch" command to edit files. Your patch language is a stripped-down, file-oriented diff format designed to be easy to parse and safe to apply.

Official example:

You can think of it as a high-level envelope:

*** Begin Patch
[ one or more file sections ]
*** End Patch

Within that envelope, you get a sequence of file operations.
You MUST include a header to specify the action you are taking.
Each operation starts with one of three headers:

*** Add File: <path> - create a new file. Every following line is a + line (the initial contents).
*** Delete File: <path> - remove an existing file. Nothing follows.
*** Update File: <path> - patch an existing file in place (optionally with a rename).

Example patch:
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with "+" even when creating a new file`;

export const PATCH_DESCRIPTION_LINES: string[] = PATCH_DESCRIPTION.split("\n");

export function createPatchFeatureDescription(): string {
	return 'The patch feature provides x-patch, the preferred command for structured file edits. Prefer x-patch over ad hoc shell rewriting commands when modifying files. Use x-patch through the bash tool, not as a separate callable tool. Put x-patch in command and pass the patch body via stdin when convenient, for example command="x-patch" with stdin="*** Begin Patch\\n...". Durable edits should target files inside the enabled workspace mount. Run x-patch --help when unsure about the patch format.';
}

export const PATCH_COMMAND = defineCliCommand({
	id: "x-patch",
	type: "command",
	summary: "Apply a structured patch to files.",
	usage: "x-patch [<content>] [--file <path>] [--base <path>]",
	description: PATCH_DESCRIPTION_LINES,
	args: PATCH_ARGS,
	flags: PATCH_FLAGS,
	examples: [
		{ command: 'x-patch "*** Begin Patch\n*** End Patch"' },
		{ command: "x-patch --file change.patch" },
		{ command: "x-patch --file change.patch --base ./packages/app" },
		{ command: "cat workspace/change.patch | x-patch" },
	],
	run: () => commandError("", 0),
});
