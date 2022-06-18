export interface RequestTwitterVideosPayload {
	twtrEnv: any;
}

export interface SetupTwitterEnvironmentPayload {}

export interface CompleteTwitterEnvironmentSetupPayload {
	twtrEnv: any;
}

export interface ReceiveErrorMessagePayload {
	errorName?: string;
	errorMessage?: string;
}

export interface ReceiveInfoMessagePayload {
	name: string;
	message?: string;
}

export interface VideoItem {
	bitrate: number;
	url: string;
	contentType: string;
	posterUrl: string;
	aspectRatio: AspectRatio;
}

export interface AspectRatio {
	x: number,
	y: number,
}

export interface ReceiveTwitterVideosPayload {
	videos: VideoItem[];
}

export type RequestTwitterVideosType = 'REQUEST_TWITTER_VIDEOS';
export type SetupTwitterEnvironmentType = 'SETUP_TWITTER_ENVIRONMENT';
export type ReceiveTwitterVideosType = 'RECEIVE_TWITTER_VIDEOS';
export type CompleteTwitterEnvironmentSetupType = 'COMPLETE_TWITTER_ENVIRONMENT_SETUP';
export type ReceiveErrorMessageType = 'RECEIVE_ERROR_MESSAGE';
export type ReceiveInfoMessageType = 'RECEIVE_INFO_MESSAGE';

export interface Message {
	type: ReceiveTwitterVideosType | SetupTwitterEnvironmentType | RequestTwitterVideosType | CompleteTwitterEnvironmentSetupType | ReceiveErrorMessageType | ReceiveInfoMessageType;
	payload: RequestTwitterVideosPayload | SetupTwitterEnvironmentPayload | CompleteTwitterEnvironmentSetupPayload | ReceiveTwitterVideosPayload | ReceiveErrorMessagePayload | ReceiveInfoMessagePayload;
}