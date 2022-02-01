export interface RequestTwitterVideosPayload {}

export interface SetupTwitterEnvironmentPayload {}

export interface CompleteTwitterEnvironmentSetupPayload {}

export interface VideoItem {
	bitrate: number;
	url: string;
	contentType: string;
	posterUrl: string;
}

export interface ReceiveTwitterVideosPayload {
	videos: VideoItem[];
}

export type RequestTwitterVideosType = 'REQUEST_TWITTER_VIDEOS';
export type SetupTwitterEnvironmentType = 'SETUP_TWITTER_ENVIRONMENT';
export type ReceiveTwitterVideosType = 'RECEIVE_TWITTER_VIDEOS';
export type CompleteTwitterEnvironmentSetupType = 'COMPLETE_TWITTER_ENVIRONMENT_SETUP';

export interface Message {
	type: ReceiveTwitterVideosType | SetupTwitterEnvironmentType | RequestTwitterVideosType | CompleteTwitterEnvironmentSetupType;
	payload: RequestTwitterVideosPayload | SetupTwitterEnvironmentPayload | CompleteTwitterEnvironmentSetupPayload | ReceiveTwitterVideosPayload;
}