// TODO: store `TwitterEnvironment` in persistent storage
// TODO: handle the case where user switches between accounts and the stored cookies are invalidated; identify the user ID logged in

import { StorageNotFoundError, TabNotFoundError } from '../errors';

import { VideoItem, RequestTwitterVideosPayload, RequestTwitterVideosType, SetupTwitterEnvironmentPayload, SetupTwitterEnvironmentType, CompleteTwitterEnvironmentSetupPayload, CompleteTwitterEnvironmentSetupType, ReceiveTwitterVideosPayload, Message} from '../abi';

const RE_GRAPHQL = /https:\/\/twitter\.com\/i\/api\/graphql\/\w+\/TweetDetail\?.*/g;

function parseOutVideos(tweetDetailPayload): VideoItem[] {
	let videos = [];
	const entries = tweetDetailPayload.data.threaded_conversation_with_injections.instructions
		  .filter((instruction) => instruction.type === 'TimelineAddEntries')
		  .reduce((entries, instruction) => [...entries, ...instruction.entries], []);
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
					videos.push({
						bitrate: variant.bitrate,
						contentType: variant['content_type'],
						url: variant.url,
						posterUrl: mediaItem['media_url_https'],
					});
				}
			}
		}
		// sort video list so that the highest quality one is first in the list
		videos.sort((a, b) => b.bitrate - a.bitrate);
	}
	return videos;
}

// chrome.webRequest.onCompleted.addListener((details) => {
// 	if (RE_GRAPHQL.test(details.url)) {
// 		console.log('found: ' + details.url);
// 	}
// }, {urls: ["*://*.twitter.com/*"]});

function activeTwitterTab(): Promise<chrome.tabs.Tab> {
	return new Promise((resolve, reject) => {
		try {
			chrome.tabs.query({
				active: true,
				currentWindow: true,
				url: "https://*.twitter.com/*",
			}, (tabs) => {
				if (tabs.length === 0) {
					reject(new TabNotFoundError('activeTwitterTab'));
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

/// Retrieve a user ID from cookies.
async function getTwid() {
	const twid = await chrome.cookies.get({'url': 'https://twitter.com', name: 'twid'});
	if (twid == null) {
		throw new Error('Log in to Twitter first');
	}
	return twid.value;	
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
	const re = /e.exports=\{queryId:"([a-zA-Z0-9\-_]+)",operationName:"(\w+)"/g;
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
		const twitterTab = await activeTwitterTab();
		const r = await chrome.scripting.executeScript({
			target: { tabId: twitterTab.id  },
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
		const c = await chrome.cookies.getAll({
			domain: 'twitter.com',
		});
		let s = '';
		let i = 0;
		while (i < c.length) {
			s += c[i].name + '=' + c[i].value;
			if (++i >= c.length) {
				break;
			}
			s += '; ';
		}
		return s;
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

function tweetDetail(twtrEnv, tweetId): Promise<VideoItem[]> {
	let variables: any = {
		"focalTweetId": tweetId.toString(),
		"with_rux_injections":false,
		"includePromotedContent":true,
		"withCommunity":true,
		"withQuickPromoteEligibilityTweetFields":true,
		"withTweetQuoteCount":true,
		"withBirdwatchNotes":false,
		"withSuperFollowsUserFields":true,
		"withBirdwatchPivots":false,
		"withDownvotePerspective":false,
		"withReactionsMetadata":false,
		"withReactionsPerspective":false,
		"withSuperFollowsTweetFields":true,
		"withVoice":true,
		"withV2Timeline":false,
		"__fs_dont_mention_me_view_api_enabled":false
	};
	variables = encodeURIComponent(JSON.stringify(variables));
	const graphQlId = twtrEnv.graphQlQueryIds['TweetDetail'];
	return fetch(`https://twitter.com/i/api/graphql/${graphQlId}/TweetDetail?variables=${variables}`, {
		"headers": {
			"accept": "*/*",
			"accept-language": "en-US,en;q=0.9",
			"authorization": "Bearer " + twtrEnv.authToken,
			"cache-control": "no-cache",
			"content-type": "application/json",
			"pragma": "no-cache",
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin",
			"sec-gpc": "1",
			"x-csrf-token": twtrEnv.csrfToken,
			"x-twitter-active-user": "yes",
			"x-twitter-auth-type": "OAuth2Session",
			"x-twitter-client-language": "en",
			"cookie": twtrEnv.allCookies,
			"user-agent": navigator.userAgent,
			// TODO: add referrer
			// TODO: add referral policy
		},
		"method": "GET"
	}).then((r) => r.json()).then((r) => {
		console.log(r);
		const videos = parseOutVideos(r);		
		console.log(videos);
		return videos;
	});
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
	const td = await tweetDetail(te, tweetId);
	console.info(td);
});

async function retrieveTwitterEnvironment(twid: string): Promise<TwitterEnvironment> {
	const stored: any = await (new Promise((resolve) => {
		const key = 'TWITTER_ENVIRONMENT' + twid;
		chrome.storage.local.get(key, (result) => {
			resolve(result[key]);
		});
	}));
	if (typeof stored === 'undefined') {
		throw new StorageNotFoundError();
	}
	return TwitterEnvironment.fromJson(JSON.parse(stored));
}

async function storeTwitterEnvironment(twid: string, twtrEnv: TwitterEnvironment): Promise<void> {
	const key = 'TWITTER_ENVIRONMENT' + twid;
	const storeTask = new Promise((resolve) => {
		chrome.storage.local.set({
			[key]: JSON.stringify(twtrEnv.json),
		}, () => {
			resolve(undefined);
		});
	});
	await storeTask;
}

chrome.runtime.onConnect.addListener(function(port: chrome.runtime.Port) {
	port.onMessage.addListener(async function(message: Message, port) {
		switch (message.type) {
		case 'SETUP_TWITTER_ENVIRONMENT': {
			const te = await TwitterEnvironment.build();
			console.info(te.json);
			// Store twitter environment with a key based on user ID
			await storeTwitterEnvironment(await getTwid(), te);
			const response: Message = {
				type: 'COMPLETE_TWITTER_ENVIRONMENT_SETUP',
				payload: {},
			};
			port.postMessage(response);
			break;
		}
		case 'REQUEST_TWITTER_VIDEOS': {
			const twitterTab = await activeTwitterTab();
			if (typeof twitterTab.url !== 'string' || twitterTab.url.length === 0) {
				throw new Error();
			}
			const statusRegex = RE_TWITTER_STATUS.exec(twitterTab.url);
			if (statusRegex == null || statusRegex.length < 2) {
				return;
			}
			const tweetId = statusRegex[1];
			console.log(tweetId);

			const twid = await getTwid();
			let twtrEnv: TwitterEnvironment | null = null;
			try {
				twtrEnv = await retrieveTwitterEnvironment(twid);
			} catch (e) {
				if (e instanceof StorageNotFoundError) {
					twtrEnv = await TwitterEnvironment.build();
				} else {
					console.warn(`Lookup for stored Twitter Environment failed: ${e.message}`);
					throw e;
				}
			}
			const videos: VideoItem[] = await tweetDetail(twtrEnv, tweetId);
			console.info(videos);
			let response: Message = {
				type: 'RECEIVE_TWITTER_VIDEOS',
				payload: {
					videos,
				},
			};
			port.postMessage(response);
			break;
		}
		default: {
			console.error(`Unrecognized message passed to background: ${message}`);
		}
	}
	});
});