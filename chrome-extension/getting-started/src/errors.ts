export class TabNotFoundError extends Error {
	private __proto__: any;
	constructor(message?: string) {
		super(message);
		
		// restore prototype chain
		if (Object.setPrototypeOf) {
			Object.setPrototypeOf(this, new.target.prototype);
		} else {
			this.__proto__ = new.target.prototype;
		}
	}
}

export class StorageNotFoundError extends Error {
	private __proto__: any;

	constructor(message?: string) {
		super(message);
		
		// restore prototype chain
		if (Object.setPrototypeOf) {
			Object.setPrototypeOf(this, new.target.prototype);
		} else {
			this.__proto__ = new.target.prototype;
		}
	}
}