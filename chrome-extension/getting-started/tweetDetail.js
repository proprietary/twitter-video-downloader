function parseOutVideos(tweetDetailPayload) {
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
					videos.push(variant.url);
				}
			}
		}
	}
	return videos;
}

function tweetDetail(tweetId, graphQlId, authToken, csrfToken) {
	let variables = {
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
	fetch(`https://twitter.com/i/api/graphql/${graphQlId}/TweetDetail?variables=${variables}`, {
		"headers": {
			"accept": "*/*",
			"accept-language": "en-US,en;q=0.9",
			"authorization": "Bearer " + authToken,
			"cache-control": "no-cache",
			"content-type": "application/json",
			"pragma": "no-cache",
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin",
			"sec-gpc": "1",
			"x-csrf-token": csrfToken,
			"x-twitter-active-user": "yes",
			"x-twitter-auth-type": "OAuth2Session",
			"x-twitter-client-language": "en"
		},
		"method": "GET",
		"credentials": "include"
	}).then((r) => r.json()).then((r) => {
		console.log(r);
		const videos = parseOutVideos(r);
		console.log(videos);
	});
}

function findMainJs() {
	const scriptElement = Array.from(document.getElementsByTagName('script')).find(x => /^https:\/\/abs\.twimg\.com\/responsive-web\/client-web\/main\.[a-z0-9]+\.js$/.test(x.src));
	if (scriptElement == null) {
		throw new Error('Could not find main.xxxxxx.js');
	}
	return scriptElement.src;
}

function getMainJs() {
	const mainJsUrl = findMainJs();
	return fetch(mainJs, {
		"referrer": "https://twitter.com/",
		"referrerPolicy": "strict-origin-when-cross-origin",
		"body": null,
		"method": "GET",
		"mode": "cors",
		"credentials": "omit"
	});
}

function getAuthToken() {
	getMainJs().then((r) => r.text()).then((js) => {
		const re = /"Web-12",s="([a-zA-Z0-9%]+)"/g;
		const r = re.exec(js);
		if (r == null || r.length < 2) {
			throw new Error('failed to find auth token in main.xxxxx.js');
		}
		return r[1];
	});
}

function getGraphQlQueryIds() {
	getMainJs().then((r) => r.text()).then((js) => {
		const re = /e.exports=\{queryId:"([a-zA-Z0-9\-]+)",operationName:"(\w+)"/g;
		const r = js.exec(re);
		let queryIds = {};
		for (const m of r) {
			queryIds[m[2]] = m[1];
		}
		return queryIds;
	});
}

function getCsrfToken() {
	return window.cookieStore.get('ct0').then((c) => c.value);
}
