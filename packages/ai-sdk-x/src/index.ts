import { Bash } from "just-bash/";

export default class BashTool {
	storage: Storage | {};
	prompt: string = "";

	constructor(storage: Storage) {
		this.storage = storage;
	}

}