export function findStructure(json: any, pred: (x: any) => boolean): any {
	if (json == null || typeof json === 'undefined') {
		return null;
	}
	if (pred(json) === true) {
		return [json];
	}
	let results = [];
	if (Array.isArray(json)) {
		for (let i = 0; i < json.length; ++i) {
			let found = findStructure(json[i], pred);
			if (found != null) {
				results = results.concat(found);
			}
		}
	} else if (typeof json === 'string') {
		return null;
	} else if (typeof json === 'object') {
		for (let k of Object.keys(json)) {
			let found = findStructure(json[k], pred);
			if (found != null) {
				results = results.concat(found);
			}
		}
	} else {
		// number or something else
		return null;
	}
	return results.length > 0 ? results : null;
}
