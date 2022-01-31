// popup.js

(function() {
	const port = chrome.runtime.connect();
	port.postMessage({
		type: 'SETUP_TWITTER_ENVIRONMENT',
	});
	port.onMessage.addListener(function(msg: any, port: chrome.runtime.Port) {
		switch (msg.type) {
			case 'SAY_HELLO': {
				console.info(msg.payload);
			}
			default: {
				console.error(`Unrecognized message passed to popup.js: ${JSON.stringify(msg)}`);
			}
		}
	});
})();