import { TabNotFoundError, TwitterNotLoggedInError, TwitterWebAppBreakingChangeError } from '../errors';
import { findStructure } from './findStructure';
import { VideoItem, RequestTwitterVideosPayload, Message, ReceiveErrorMessagePayload, ReceiveInfoMessagePayload, AspectRatio} from '../abi';

function parseOutVideos(tweetDetailPayload: any): VideoItem[] {
	let videos = [];
	try {
		let results = findStructure(tweetDetailPayload, (obj) => typeof obj['type'] !== 'undefined' && obj['type'] === 'video');
		if (results == null) {
			throw new TwitterWebAppBreakingChangeError('failure to parse video details propertly anymore');
		}
		console.info(results);
		for (let mediaItem of results) {
			if (!mediaItem.hasOwnProperty('video_info')) { continue; }
			const aspectRatio: AspectRatio = {
				x: mediaItem['video_info']['aspect_ratio'][0],
				y: mediaItem['video_info']['aspect_ratio'][1],
			};
			for (const variant of mediaItem['video_info']['variants']) {
				if (variant['content_type'] === 'video/mp4') {
					videos.push({
						bitrate: variant['bitrate'],
						contentType: variant['content_type'],
						url: variant['url'],
						posterUrl: variant['media_url_https'],
						aspectRatio,
					});
				}
			}
		}
		// sort by bitrate, descending
		videos = videos.sort((a, b) => b.bitrate - a.bitrate);
		return videos;
	} catch (e) {
		if (e instanceof TypeError) {
			console.error(e);
			throw new TwitterWebAppBreakingChangeError(`Failure to parse out videos from TweetDetail payload: ${tweetDetailPayload}`);
		}
		throw e;
	}
}

function activeTwitterTab(): Promise<chrome.tabs.Tab> {
	return new Promise((resolve, reject) => {
		try {
			chrome.tabs.query({
				active: true,
				currentWindow: true,
				url: "https://*.twitter.com/*",
			}, (tabs) => {
				if (tabs.length === 0) {
					const e = new TabNotFoundError('activeTwitterTab');
					reject(e);
					return;
				}
				resolve(tabs[0]);
			});
		} catch(e) {
			reject(e);
		}
	});
}

/// Retrieve a user ID from cookies.
async function getTwid() {
	const twid = await chrome.cookies.get({'url': 'https://twitter.com', name: 'twid'});
	if (twid == null) {
		throw new TwitterNotLoggedInError();
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
	const re = /"Bearer (AAAAAAA[\w%]+)"/g;
	const r = re.exec(mainJsContents);
	if (r == null || r.length < 2) {
		throw new TwitterWebAppBreakingChangeError('failure to find auth token in main.xxxxx.js');
	}
	return r[1];
}

function findGraphQlQueryIds(endpointScript): GraphQlQueryIdMapping {
	const re = /queryId:"([a-zA-Z0-9\-_]+)",operationName:"(\w+)"/g;
	const r = endpointScript.matchAll(re);
	let queryIds: GraphQlQueryIdMapping = {};
	for (const m of r) {
		queryIds[m[2]] = m[1];
	}
	return queryIds;
}

function parseOutMainJsVersion(mainJsUrl: string): string {
	const m = /^https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.([0-9a-z]+)\.js$/.exec(mainJsUrl);
	if (m.length < 2) {
		console.warn(`failure to parse out version number from main.js url "${mainJsUrl}"`);
		throw new TwitterWebAppBreakingChangeError(`Regex to parse out version from main.(xxxxxxx).js fails.`);
	}
	return m[1];
}

interface GraphQlQueryIdMapping {
	[queryId: string]: string;
}

interface TwitterEnvironmentStorageForm {
	mainJsUrl: string;
	authToken: string;
	graphQlQueryIds: GraphQlQueryIdMapping;
}

interface TwitterEnvironmentProps {
	csrfToken: string;
	authToken: string;
	mainJsUrl: string;
	allCookies: string;
	graphQlQueryIds: GraphQlQueryIdMapping;
}

/// Contains all the necessary information to process API requests on Twitter.
class TwitterEnvironment {
	private csrfToken_: string;
	public authToken: string;
	public mainJsUrl: string;
	private allCookies_: string;
	public graphQlQueryIds: GraphQlQueryIdMapping;

	private constructor({mainJsUrl, authToken, graphQlQueryIds, csrfToken, allCookies}: TwitterEnvironmentProps) {
		this.mainJsUrl = mainJsUrl;
		this.authToken = authToken;
		this.graphQlQueryIds = graphQlQueryIds;
		this.csrfToken_ = csrfToken;
		this.allCookies_ = allCookies;
	}

	/// Use this to load a serialized `TwitterEnvironment` from storage.
	static async init({mainJsUrl, authToken, graphQlQueryIds}: TwitterEnvironmentStorageForm): Promise<TwitterEnvironment> {
		const csrfToken = await TwitterEnvironment.getCsrfToken();
		const allCookies = await TwitterEnvironment.getAllCookies();
		return new TwitterEnvironment({mainJsUrl, authToken, graphQlQueryIds, csrfToken, allCookies});
	}

	/// Use this to create a fresh `TwitterEnvironment`.
	static async build(): Promise<TwitterEnvironment> {
		const mainJsUrl = await TwitterEnvironment.getMainJsUrl();
		const mainJsContents = await fetchMainJsContents(mainJsUrl);
		const authToken = parseOutAuthToken(mainJsContents);
		const graphQlQueryIds = await TwitterEnvironment.getGraphQlQueryIds(mainJsContents);
		const csrfToken = await TwitterEnvironment.getCsrfToken();
		const allCookies = await TwitterEnvironment.getAllCookies();
		return new TwitterEnvironment({mainJsUrl, authToken, graphQlQueryIds, allCookies, csrfToken});
	}

	static async getGraphQlQueryIds(mainJsContents: string): Promise<GraphQlQueryIdMapping> {
		return findGraphQlQueryIds(mainJsContents);
	}

	static async getMainJsUrl(): Promise<string> {
		try {
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
				throw new TwitterWebAppBreakingChangeError(`Fails to locate <script> tag containing "...responsive-web/client/main.xxxxxxx.js"`);
			}
			const t = r[0].result;
			if (t.error != null) {
				throw new TwitterWebAppBreakingChangeError(t.error);
			}
			return t.payload;
		} catch (e) {
			throw e;
		}
	}

	static async getAllCookies() {
		const c = await chrome.cookies.getAll({
			domain: 'twitter.com',
		});
		// format cookies as a semicolon-separated list on one line, as needed by the HTTP request
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

	/// Determine whether this `TwitterEnvironment` still reflects the latest version of the Twitter app.
	async notStale() {
		const actualMainJsUrl = (await TwitterEnvironment.getMainJsUrl());
		if (actualMainJsUrl !== this.mainJsUrl) {
			return false;
		}
		return true;
	}

	static async getCsrfToken() {
		const csrfToken = await chrome.cookies.get({url: 'https://twitter.com', name: 'ct0'});
		if (csrfToken == null) {
			throw new Error('Log in to Twitter first');
		}
		console.assert(typeof csrfToken.value === 'string');
		if (typeof csrfToken.value !== 'string') {
			throw new Error();
		}
		return csrfToken.value;
	}

	get csrfToken(): string {
		if (this.csrfToken_.length === 0) {
			throw new Error('Uninitialized `csrfToken` in `TwitterEnviroment`; make sure `TwitterEnvironment` was instantiated properly.');
		}
		return this.csrfToken_;
	}

	get allCookies(): string {
		if (this.allCookies_.length === 0) {
			throw new Error('Uninitialized `allCookies` in `TwitterEnvironment`; make sure `TwitterEnvironment` was instantiated propertly');
		}
		return this.allCookies_;
	} 

	get mainJsVersion(): string {
		return parseOutMainJsVersion(this.mainJsUrl);
	}

	get json(): TwitterEnvironmentStorageForm {
		return {
			mainJsUrl: this.mainJsUrl,
			authToken: this.authToken,
			graphQlQueryIds: this.graphQlQueryIds,
		};
	}
}

function tweetDetail(twtrEnv: TwitterEnvironment, tweetId, tweetUsername: string): Promise<VideoItem[]> {
        let rawVariables: any = {"focalTweetId":tweetId.toString(),"with_rux_injections":false,"includePromotedContent":true,"withCommunity":true,"withQuickPromoteEligibilityTweetFields":true,"withBirdwatchNotes":true,"withVoice":true,"withV2Timeline":true};
        let rawFeatures: any = {"responsive_web_graphql_exclude_directive_enabled":true,"verified_phone_label_enabled":false,"responsive_web_home_pinned_timelines_enabled":true,"creator_subscriptions_tweet_preview_api_enabled":true,"responsive_web_graphql_timeline_navigation_enabled":true,"responsive_web_graphql_skip_user_profile_image_extensions_enabled":false,"c9s_tweet_anatomy_moderator_badge_enabled":true,"tweetypie_unmention_optimization_enabled":true,"responsive_web_edit_tweet_api_enabled":true,"graphql_is_translatable_rweb_tweet_is_translatable_enabled":true,"view_counts_everywhere_api_enabled":true,"longform_notetweets_consumption_enabled":true,"responsive_web_twitter_article_tweet_consumption_enabled":false,"tweet_awards_web_tipping_enabled":false,"freedom_of_speech_not_reach_fetch_enabled":true,"standardized_nudges_misinfo":true,"tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled":true,"longform_notetweets_rich_text_read_enabled":true,"longform_notetweets_inline_media_enabled":true,"responsive_web_media_download_video_enabled":false,"responsive_web_enhance_cards_enabled":false};
	let features: any = encodeURIComponent(JSON.stringify(rawFeatures));
	let variables: any = encodeURIComponent(JSON.stringify(rawVariables));
	const graphQlId = twtrEnv.graphQlQueryIds['TweetDetail'];
	if (typeof graphQlId === 'undefined') {
		throw new TwitterWebAppBreakingChangeError(`Unable to find "TweetDetail" in Graph QL query list.`);
	}
	return fetch(`https://twitter.com/i/api/graphql/${graphQlId}/TweetDetail?variables=${variables}&features=${features}`, {
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
			"referer": `https://twitter.com/${tweetUsername}/status/${tweetId}`,
			"referrer-policy": "strict-origin-when-cross-origin",
		},
		"method": "GET"
	}).then((r) => {
		if (Math.floor(r.status / 100) !== 2) {
			throw new TwitterWebAppBreakingChangeError(`TwitterDetail request fails with ${r.status}`);
		}
		return r.json();
	}).then((r) => {
		const videos = parseOutVideos(r);		
		return videos;
	});
}

const RE_TWITTER_STATUS = /^https:\/\/twitter\.com\/(\w+)\/status\/(\d+).*/;

chrome.action.onClicked.addListener(async (tab) => {
	console.log('clicked while on url: ' + tab.url);
	const statusRegex = RE_TWITTER_STATUS.exec(tab.url);
	if (statusRegex == null || statusRegex.length < 2) {
		return;
	}
	const tweetUsername = statusRegex[1];
	const tweetId = statusRegex[2];
	console.log(tweetId);
	console.log(JSON.stringify(tweetId));

	const te = await TwitterEnvironment.build();
	console.info(te.json);
	const td = await tweetDetail(te, tweetId, tweetUsername);
	console.info(td);
});

async function retrieveTwitterEnvironment(twid: string): Promise<TwitterEnvironment | null> {
	const stored: any = await (new Promise((resolve) => {
		const key = 'TWITTER_ENVIRONMENT' + twid;
		chrome.storage.local.get(key, (result) => {
			resolve(result[key]);
		});
	}));
	if (typeof stored === 'undefined') {
		return null;
	}
	return TwitterEnvironment.init(JSON.parse(stored));
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
	port.onMessage.addListener(async function(message: Message, port: chrome.runtime.Port) {
		switch (message.type) {
		case 'SETUP_TWITTER_ENVIRONMENT': {
			const twid = await getTwid();
			// Lookup stored `TwitterEnvironment`
			let twtrEnv: TwitterEnvironment | null = null;
			try {
				twtrEnv = await retrieveTwitterEnvironment(twid);
				if (twtrEnv == null) {
					console.info(`\`TwitterEnvironment\` under user ID "${twid}" not found; creating new \`TwitterEnvironment\`...`);
					twtrEnv = await TwitterEnvironment.build();
					console.assert(twtrEnv != null);
					if (twtrEnv == null) {
						throw new Error(`Unable to create new \`TwitterEnvironment\``);
					}
					// store `TwitterEnvironment` under a key based on user ID
					await storeTwitterEnvironment(twid, twtrEnv);
				}
				if (!(await twtrEnv.notStale())) {
					// stored `TwitterEnvrionment` reflects an old version of the web app
					console.info(`\`TwitterEnvironment\` is stale; new version of Twitter frontend app was found.`);
					// create a new `TwitterEnvironment`
					twtrEnv = await TwitterEnvironment.build();
					// store `TwitterEnvironment` under a key based on user ID
					await storeTwitterEnvironment(twid, twtrEnv);
				}
				// send off message to popup
				console.assert(twtrEnv != null);
				const response: Message = {
					type: 'COMPLETE_TWITTER_ENVIRONMENT_SETUP',
					payload: {
						twtrEnv: twtrEnv.json,
					},
				};
				port.postMessage(response);
			} catch (e) {
				if (e instanceof TabNotFoundError) {
					const payload: ReceiveInfoMessagePayload = {
						name: 'TabNotFoundError',
					};
					const message: Message = {
						type: 'RECEIVE_INFO_MESSAGE',
						payload,
					};
					port.postMessage(message);
				} else {
					console.error(`Lookup for Twitter Environment fails: ${e.message}`);
					const payload: ReceiveErrorMessagePayload = {
						errorName: undefined,
						errorMessage: e.message,
					};
					const message: Message = {
						type: 'RECEIVE_ERROR_MESSAGE',
						payload,
					};
					port.postMessage(message);
				}
			}
			break;
		}
		case 'REQUEST_TWITTER_VIDEOS': {
			try {
				const twitterTab = await activeTwitterTab();
				if (typeof twitterTab.url !== 'string' || twitterTab.url.length === 0) {
					throw new TabNotFoundError();
				}
				const statusRegex = RE_TWITTER_STATUS.exec(twitterTab.url);
				if (statusRegex == null || statusRegex.length < 3) {
					throw new TabNotFoundError();
				}
				const tweetUsername = statusRegex[1];
				const tweetId = statusRegex[2];

				const {twtrEnv} = message.payload as RequestTwitterVideosPayload;
				const te: TwitterEnvironment = await TwitterEnvironment.init(twtrEnv);
				const videos: VideoItem[] = await tweetDetail(te, tweetId, tweetUsername);
				if (videos.length === 0) {
					const payload: ReceiveInfoMessagePayload = {
						name: 'VideosNotFound',
						message: 'No videos found on this post',
					};
					const response: Message = {
						type: 'RECEIVE_INFO_MESSAGE',
						payload,
					};
					port.postMessage(response);
				} else {
					let response: Message = {
						type: 'RECEIVE_TWITTER_VIDEOS',
						payload: {
							videos,
						},
					};
					port.postMessage(response);
				}
			} catch (e) {
				if (e instanceof TwitterWebAppBreakingChangeError) {
					const response: Message = {
						type: 'RECEIVE_ERROR_MESSAGE',
						payload: {
							errorName: e.name,
							errorMessage: e.message,
						},
					};
					port.postMessage(response);
				} else if (e instanceof TwitterNotLoggedInError) {
					const response: Message = {
						type: 'RECEIVE_INFO_MESSAGE',
						payload: {
							name: 'TwitterNotLoggedInError',
						},
					};
					port.postMessage(response);
				} else if (e instanceof TabNotFoundError) {
					const response: Message = {
						type: 'RECEIVE_INFO_MESSAGE',
						payload: {
							name: 'TabNotFoundError',
						},
					};
					port.postMessage(response);
				} else {
					console.error(e);
					const payload: ReceiveErrorMessagePayload = {
						errorName: null,
						errorMessage: e.message,
					};
					const response: Message = {
						type: 'RECEIVE_ERROR_MESSAGE',
						payload,
					};
					port.postMessage(response);
				}
			}
			break;
		}
		default: {
			console.error(`Unrecognized message passed to background: ${message}`);
		}
	}
	});
});

chrome.runtime.onInstalled.addListener(async function(details) {
	if (details.reason === 'update') {
		await chrome.storage.local.clear();
	}
});
