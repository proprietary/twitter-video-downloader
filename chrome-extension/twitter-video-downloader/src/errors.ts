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

		// capture stack trace
		const captureStackTrace: Function = (Error as any).captureStackTrace;
		captureStackTrace && captureStackTrace(this, this.constructor);
	}
}

export class TwitterNotLoggedInError extends Error {
	private __proto__: any;

	constructor(message?: string) {
		super(message);

		// restore prototype chain
		if (Object.setPrototypeOf) {
			Object.setPrototypeOf(this, new.target.prototype);
		} else {
			this.__proto__ = new.target.prototype;
		}

		// capture stack trace
		const captureStackTrace: Function = (Error as any).captureStackTrace;
		captureStackTrace && captureStackTrace(this, this.constructor);
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

		// capture stack trace
		const captureStackTrace: Function = (Error as any).captureStackTrace;
		captureStackTrace && captureStackTrace(this, this.constructor);
	}
}

export class TwitterWebAppBreakingChangeError extends Error {
	private __proto__: any;

	constructor(message?: string) {
		super(message);

		// restore prototype chain
		if (Object.setPrototypeOf) {
			Object.setPrototypeOf(this, new.target.prototype);
		} else {
			this.__proto__ = new.target.prototype;
		}

		// capture stack trace
		const captureStackTrace: Function = (Error as any).captureStackTrace;
		captureStackTrace && captureStackTrace(this, this.constructor);
	}
}