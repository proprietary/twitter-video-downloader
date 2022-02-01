// popup.js

import {h, render} from 'preact';
import { StateUpdater, useEffect, useState } from 'preact/hooks';
import {VideoItem, Message, RequestTwitterVideosPayload, RequestTwitterVideosType} from '../abi';

render((<App/>), document.getElementById('root'));

function App(props: any) {
	const [videoList, updateVideoList]: [VideoItem[], StateUpdater<VideoItem[]>] = useState([]);
	useEffect(() => {
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
					updateVideoList(videos);
					break;
				}
				default: {
					console.error(`Unrecognized message passed to popup.js: ${JSON.stringify(msg)}`);
				}
			}
		});
	}, [])
	return (
		<div style={{
			margin: '1rem',
		}}>
			<h1>Twitter Video Downloader</h1>
			<div>
				<VideoList videos={videoList} />
			</div>
		</div>
	);
}

function VideoList({videos}: VideoListProps) {
	return (
		<>
			<ul style={{
				'padding': '0',
				'margin': '0',
			}}>
				{videos.map((value: VideoItem, idx: number) => (
					<li key={"video_card_" + idx} style={{
						padding: '0 0 1em 0',
						margin: '0',
						listStyle: 'none',
					}}>
						<VideoCard key={"video_card_" + idx} video={value} />
					</li>
				))}
			</ul>
		</>
	);
}

function VideoCard({video}: VideoCardProps) {
	const kbps = video.bitrate / 1000;
	const mbps = video.bitrate / 1_000_000;
	let bitrateBlock: h.JSX.Element | null = null;
	if (mbps < 1) {
		bitrateBlock = (<>{kbps} kb/s</>);
	} else {
		bitrateBlock = (<>{mbps} mb/s</>);
	}
	return (
		<div style={{
			display: 'flex',
			flexFlow: 'row wrap',
			justifyContent: 'flex-start',
			alignItems: 'stretch',
			columnGap: '10px',
			rowGap: '20px',
		}}>
			<div>
				<video
					autoPlay={false}
					controls={true}
					preload="metadata"
					loop={true}
					poster={video.posterUrl}
					style={{
						borderRadius: '1em',
						maxWidth: '50vw',
					}}
				>
					<source src={video.url} type={video.contentType} />
				</video>
			</div>
			<div style={{
				display: 'flex',
				flexFlow: 'column wrap',
				justifyContent: 'space-evenly',
			}}>
				{video.bitrate > 0 && (<div>Quality: {bitrateBlock}</div>)}
				<div>
					<a
					style={{
						color: 'white',
					}}
					href={video.url}
					target="_blank"
					title="Open in  new tab">
						Open in new tab <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: auto; height: 0.8rem;"><path fill="currentColor" d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM488,0h-128c-21.37,0-32.05,25.91-17,41l35.73,35.73L135,320.37a24,24,0,0,0,0,34L157.67,377a24,24,0,0,0,34,0L435.28,133.32,471,169c15,15,41,4.5,41-17V24A24,24,0,0,0,488,0Z"></path></svg>
					</a>
				</div>
				<div>
					<a
					href={video.url}
					style={{color: 'white', textDecoration: 'none'}}
					title="Download video"
					onClick={async (e) => {
						e.preventDefault();
						fetch(video.url).then((r) => r.blob()).then((blob) => {
							// force browser to give a download prompt
							const fr = new FileReader();
							fr.addEventListener('load', () => {
								const a = document.createElement('a');
								if (typeof fr.result !== 'string') {
									throw new Error();
								}
								a.href = fr.result as string;
								a.download = video.url.split('/').pop().split('?')[0];
								document.body.appendChild(a);
								a.click();
								document.body.removeChild(a);
							});
							fr.readAsDataURL(blob);
						});
					}}
				>
						<svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M216 0h80c13.3 0 24 10.7 24 24v168h87.7c17.8 0 26.7 21.5 14.1 34.1L269.7 378.3c-7.5 7.5-19.8 7.5-27.3 0L90.1 226.1c-12.6-12.6-3.7-34.1 14.1-34.1H192V24c0-13.3 10.7-24 24-24zm296 376v112c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V376c0-13.3 10.7-24 24-24h146.7l49 49c20.1 20.1 52.5 20.1 72.6 0l49-49H488c13.3 0 24 10.7 24 24zm-124 88c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20zm64 0c0-11-9-20-20-20s-20 9-20 20 9 20 20 20 20-9 20-20z"></path></svg>
					</a>
				</div> 
			</div>
		</div>
	);
}

interface VideoCardProps {
	video: VideoItem;
}

interface VideoListProps {
	videos: VideoItem[];
}

function initMessages() {
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
}