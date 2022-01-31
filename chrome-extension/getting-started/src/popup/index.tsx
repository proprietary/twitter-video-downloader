// popup.js

(function() {
	const port = chrome.runtime.connect();
	port.postMessage({
		type: 'SETUP_TWITTER_ENVIRONMENT',
	});
	port.onMessage.addListener(function(msg: any, port: chrome.runtime.Port) {
		switch (msg.type) {
			case 'COMPLETE_TWITTER_ENVIRONMENT_SETUP': {
				const request = {
					type: 'REQUEST_TWITTER_VIDEOS',
					payload: {},
				};
				port.postMessage(request);
				break;
			}
			case 'RECEIVE_TWITTER_VIDEOS': {
				const { videos } = msg.payload;
				console.info(videos);
				document.getElementById('root').textContent = JSON.stringify(videos, null, 4);
				break;
			}
			default: {
				console.error(`Unrecognized message passed to popup.js: ${JSON.stringify(msg)}`);
			}
		}
	});
})();