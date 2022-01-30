const RE_GRAPHQL = /https:\/\/twitter\.com\/i\/api\/graphql\/\w+\/TweetDetail\?.*/g;

function parseOutVideos(tweetDetailPayload) {
	let videos = [];
	const entries = tweetDetailPayload.data.threaded_conversation_with_injections.instructions
		  .filter((instruction) => instruction.type === 'TimelineAddEntries')
		  .reduce((entries, instruction) => [...entries, ...instruction.entries]);
	for (const entry of entries) {
		if (entry.content.entryType !== 'TimelineTimelineItem') {
			continue;
		}
		const itemContent = entry.content.itemContent;
		if (itemContent.itemType !== 'TimelineTweet') {
			continue;
		}
		if (itemContent.tweet_results == null || itemContent.tweet_results.result == null) throw new Error();
		if (itemContent.tweet_results.result.__typename !== 'Tweet') {
			continue;
		}
		if (itemContent.tweet_results.result.legacy.hasOwnProperty('extended_entities') === false) {
			continue;
		}
		const media = itemContent.tweet_results.result.legacy['extended_entities'].media;
		for (const mediaItem of media) {
			if (!mediaItem.hasOwnProperty('video_info')) { continue; }
			for (const variant of mediaItem['video_info'].variants) {
				if (variant['content_type'] === 'video/mp4') {
					videos.push(variant.url);
				}
			}
		}
	}
	return videos;
}

// chrome.webRequest.onCompleted.addListener((details) => {
// 	if (RE_GRAPHQL.test(details.url)) {
// 		console.log('found: ' + details.url);
// 	}
// }, {urls: ["*://*.twitter.com/*"]});

function activeTwitterTab() {
	return new Promise((resolve, reject) => {
		try {
			chrome.tabs.query({
				active: true,
				currentWindow: true,
				url: "https://*.twitter.com/*",
			}, (tabs) => {
				if (tabs.length === 0) {
					reject(new Error(`No active Twitter tabs found`));
					return;
				}
				resolve(tabs[0]);
			});
		} catch(e) {
			reject(e);
		}
	});
}

async function getCsrfToken() {
	const csrfToken = await chrome.cookies.get({url: 'https://twitter.com', name: 'ct0'});
	if (csrfToken == null) {
		throw new Error('log into Twitter first');
	}
	return csrfToken;
}

async function fetchMainJsContents(mainJsUrl) {
	return fetch(mainJsUrl, {
		"referrer": "https://twitter.com/",
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": null,
		"method": "GET",
		"mode": "cors",
		"credentials": "omit"
	}).then((r) => {
		if (Math.floor(r.status / 100) !== 2) {
			throw new Error(`Fetch of main.js fails with status ${r.status}: ${r.statusText}`);
		}
		return r.text();
	});
}

function parseOutAuthToken(mainJsContents) {
	const re = /"Web-12",s="([a-zA-Z0-9%]+)"/g;
	const r = re.exec(mainJsContents);
	if (r == null || r.length < 2) {
		throw new Error('failure to find auth token in main.xxxxx.js');
	}
	return r[1];
}

function findGraphQlQueryIds(mainJsContents) {
	const re = /e.exports=\{queryId:"([a-zA-Z0-9\-]+)",operationName:"(\w+)"/g;
	const r = mainJsContents.matchAll(re);
	let queryIds = {};
	for (const m of r) {
		queryIds[m[2]] = m[1];
	}
	return queryIds;
}

class TwitterEnvironment {
	csrfToken;
	authToken;
	mainJsUrl;
	allCookies;
	graphQlQueryIds = {};

	constructor({csrfToken, mainJsUrl, authToken, allCookies, graphQlQueryIds}) {
		this.csrfToken = csrfToken;
		this.mainJsUrl = mainJsUrl;
		this.authToken = authToken;
		this.allCookies = allCookies;
		this.graphQlQueryIds = graphQlQueryIds;
	}

	static async getMainJsUrl() {
		const r = await chrome.scripting.executeScript({
			target: { tabId: (await activeTwitterTab()).id  },
			func: () => {
				try {
					const scriptElement = Array.from(document.getElementsByTagName('script')).find(x => /^https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js$/.test(x.src));
					if (scriptElement == null) {
						return {
							error: 'Failure to locate the DOM script element anchoring the "main.xxxxxxx.js"',
							payload: null,
						};
					}
					return { error: null, payload: scriptElement.src };
				} catch (e) {
					return { error: e.message, payload: null };
				}
			},
		});
		if (r.length < 1 || r[0].result == null) {
			throw new Error();
		}
		const t = r[0].result;
		if (t.error != null) {
			throw new Error(t.error);
		}
		return t.payload;
	}

	static async getAllCookies() {
		const r = await chrome.scripting.executeScript({
			target: { tabId: (await activeTwitterTab()).id },
			func: () => {
				return document.cookie;
			}
		});
		if (r.length < 1 || r[0].result == null) {
			throw new Error();
		}
		return r[0].result;
	}

	static async build() {
		const csrfToken = (await getCsrfToken()).value;
		const mainJsUrl = await TwitterEnvironment.getMainJsUrl();
		const mainJsContents = await fetchMainJsContents(mainJsUrl);
		const authToken = parseOutAuthToken(mainJsContents);
		const graphQlQueryIds = findGraphQlQueryIds(mainJsContents);
		const allCookies = await TwitterEnvironment.getAllCookies();
		return new TwitterEnvironment({csrfToken, mainJsUrl, authToken, allCookies, graphQlQueryIds});
	}

	get mainJsVersion() {
		const m = /^https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.([0-9a-z]+)\.js$/.exec(this.mainJsUrl);
		if (m.length < 2) {
			console.warn(`failure to parse out version number from main.js url "${this.mainJsUrl}"`);
			return '';
		}
		return m[1];
	}

	static fromJson({csrfToken, mainJsUrl, authToken, allCookies, graphQlQueryIds}) {
		return new TwitterEnvironment({csrfToken, mainJsUrl, authToken, allCookies, graphQlQueryIds});
	}

	get json() {
		return {
			csrfToken: this.csrfToken,
			mainJsUrl: this.mainJsUrl,
			authToken: this.authToken,
			allCookies: this.allCookies,
			graphQlQueryIds: this.graphQlQueryIds,
		};
	}
}

const RE_TWITTER_STATUS = /^https:\/\/twitter\.com\/\w+\/status\/(\d+).*/;

chrome.action.onClicked.addListener(async (tab) => {
	console.log('clicked while on url: ' + tab.url);
	const statusRegex = RE_TWITTER_STATUS.exec(tab.url);
	if (statusRegex == null || statusRegex.length < 2) {
		return;
	}
	const tweetId = statusRegex[1];
	console.log(tweetId);
	console.log(JSON.stringify(tweetId));

	const te = await TwitterEnvironment.build();
	console.info(te.json);
});
