// content-script.js

function getCsrfToken() {
	return window.cookieStore.get('ct0').then((c) => c.value);
}

function findMainJs() {
	const scriptElement = Array.from(document.getElementsByTagName('script')).find(x => /^https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js$/.test(x.src));
	if (scriptElement == null) {
		throw new Error('Could not find main.xxxxxx.js');
	}
	return scriptElement.src;
}

console.log('content-script.js');

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		switch (request.type) {
		case 'REQUEST_CSRF_TOKEN':
			getCsrfToken().then((csrfToken) => {
				console.log(csrfToken);
				sendResponse({
					error: null,
					payload: csrfToken,
				});
			});
			break;
		case 'FIND_MAIN_JS':
			sendResponse({payload: findMainJs(), error: null});
			break;
		default:
			throw new Error();
		}
		return true;
	}
);
