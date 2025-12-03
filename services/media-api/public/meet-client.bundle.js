/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./sdk/internal/channel_handlers/channel_logger.ts":
/*!*********************************************************!*\
  !*** ./sdk/internal/channel_handlers/channel_logger.ts ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ChannelLogger: () => (/* binding */ ChannelLogger)
/* harmony export */ });
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Helper class that helps log channel resources, updates or errors.
 */
class ChannelLogger {
    constructor(logSourceType, 
    // @ts-ignore
    callback = (logEvent) => { }) {
        this.logSourceType = logSourceType;
        this.callback = callback;
    }
    log(level, logString, relevantObject) {
        this.callback({
            sourceType: this.logSourceType,
            level,
            logString,
            relevantObject,
        });
    }
}


/***/ }),

/***/ "./sdk/internal/channel_handlers/media_entries_channel_handler.ts":
/*!************************************************************************!*\
  !*** ./sdk/internal/channel_handlers/media_entries_channel_handler.ts ***!
  \************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MediaEntriesChannelHandler: () => (/* binding */ MediaEntriesChannelHandler)
/* harmony export */ });
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../types/enums */ "./sdk/types/enums.ts");
/* harmony import */ var _subscribable_impl__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../subscribable_impl */ "./sdk/internal/subscribable_impl.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../utils */ "./sdk/internal/utils.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */



/**
 * Helper class to handle the media entries channel.
 */
class MediaEntriesChannelHandler {
    constructor(channel, mediaEntriesDelegate, idMediaEntryMap, internalMediaEntryMap = new Map(), internalMeetStreamTrackMap = new Map(), internalMediaLayoutMap = new Map(), participantsDelegate, nameParticipantMap, idParticipantMap, internalParticipantMap, presenterDelegate, screenshareDelegate, channelLogger) {
        this.channel = channel;
        this.mediaEntriesDelegate = mediaEntriesDelegate;
        this.idMediaEntryMap = idMediaEntryMap;
        this.internalMediaEntryMap = internalMediaEntryMap;
        this.internalMeetStreamTrackMap = internalMeetStreamTrackMap;
        this.internalMediaLayoutMap = internalMediaLayoutMap;
        this.participantsDelegate = participantsDelegate;
        this.nameParticipantMap = nameParticipantMap;
        this.idParticipantMap = idParticipantMap;
        this.internalParticipantMap = internalParticipantMap;
        this.presenterDelegate = presenterDelegate;
        this.screenshareDelegate = screenshareDelegate;
        this.channelLogger = channelLogger;
        this.channel.onmessage = (event) => {
            this.onMediaEntriesMessage(event);
        };
        this.channel.onopen = () => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media entries channel: opened');
        };
        this.channel.onclose = () => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media entries channel: closed');
        };
    }
    onMediaEntriesMessage(message) {
        var _a, _b;
        const data = JSON.parse(message.data);
        let mediaEntryArray = this.mediaEntriesDelegate.get();
        // Delete media entries.
        (_a = data.deletedResources) === null || _a === void 0 ? void 0 : _a.forEach((deletedResource) => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Media entries channel: resource deleted', deletedResource);
            const deletedMediaEntry = this.idMediaEntryMap.get(deletedResource.id);
            if (deletedMediaEntry) {
                mediaEntryArray = mediaEntryArray.filter((mediaEntry) => mediaEntry !== deletedMediaEntry);
                // If we find the media entry in the id map, it should exist in the
                // internal map.
                const internalMediaEntry = this.internalMediaEntryMap.get(deletedMediaEntry);
                // Remove relationship between media entry and media layout.
                const mediaLayout = internalMediaEntry.mediaLayout.get();
                if (mediaLayout) {
                    const internalMediaLayout = this.internalMediaLayoutMap.get(mediaLayout);
                    if (internalMediaLayout) {
                        internalMediaLayout.mediaEntry.set(undefined);
                    }
                }
                // Remove relationship between media entry and meet stream tracks.
                const videoMeetStreamTrack = internalMediaEntry.videoMeetStreamTrack.get();
                if (videoMeetStreamTrack) {
                    const internalVideoStreamTrack = this.internalMeetStreamTrackMap.get(videoMeetStreamTrack);
                    internalVideoStreamTrack.mediaEntry.set(undefined);
                }
                const audioMeetStreamTrack = internalMediaEntry.audioMeetStreamTrack.get();
                if (audioMeetStreamTrack) {
                    const internalAudioStreamTrack = this.internalMeetStreamTrackMap.get(audioMeetStreamTrack);
                    internalAudioStreamTrack.mediaEntry.set(undefined);
                }
                // Remove relationship between media entry and participant.
                const participant = internalMediaEntry.participant.get();
                if (participant) {
                    const internalParticipant = this.internalParticipantMap.get(participant);
                    const newMediaEntries = internalParticipant.mediaEntries
                        .get()
                        .filter((mediaEntry) => mediaEntry !== deletedMediaEntry);
                    internalParticipant.mediaEntries.set(newMediaEntries);
                    internalMediaEntry.participant.set(undefined);
                }
                // Remove from maps
                this.idMediaEntryMap.delete(deletedResource.id);
                this.internalMediaEntryMap.delete(deletedMediaEntry);
                if (this.screenshareDelegate.get() === deletedMediaEntry) {
                    this.screenshareDelegate.set(undefined);
                }
                if (this.presenterDelegate.get() === deletedMediaEntry) {
                    this.presenterDelegate.set(undefined);
                }
            }
        });
        // Update or add media entries.
        const addedMediaEntries = [];
        (_b = data.resources) === null || _b === void 0 ? void 0 : _b.forEach((resource) => {
            var _a, _b, _c, _d, _e;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Media entries channel: resource added', resource);
            let internalMediaEntry;
            let mediaEntry;
            let videoCsrc = 0;
            if (resource.mediaEntry.videoCsrcs &&
                resource.mediaEntry.videoCsrcs.length > 0) {
                // We expect there to only be one video Csrcs. There is possibility
                // for this to be more than value in WebRTC but unlikely in Meet.
                // TODO : Explore making video csrcs field singluar.
                videoCsrc = resource.mediaEntry.videoCsrcs[0];
            }
            else {
                (_b = this.channelLogger) === null || _b === void 0 ? void 0 : _b.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Media entries channel: more than one video Csrc in media entry', resource);
            }
            if (this.idMediaEntryMap.has(resource.id)) {
                // Update media entry if it already exists.
                mediaEntry = this.idMediaEntryMap.get(resource.id);
                mediaEntry.sessionName = resource.mediaEntry.sessionName;
                mediaEntry.session = resource.mediaEntry.session;
                internalMediaEntry = this.internalMediaEntryMap.get(mediaEntry);
                internalMediaEntry.audioMuted.set(resource.mediaEntry.audioMuted);
                internalMediaEntry.videoMuted.set(resource.mediaEntry.videoMuted);
                internalMediaEntry.screenShare.set(resource.mediaEntry.screenshare);
                internalMediaEntry.isPresenter.set(resource.mediaEntry.presenter);
                internalMediaEntry.audioCsrc = resource.mediaEntry.audioCsrc;
                internalMediaEntry.videoCsrc = videoCsrc;
            }
            else {
                // Create new media entry if it does not exist.
                const mediaEntryElement = (0,_utils__WEBPACK_IMPORTED_MODULE_2__.createMediaEntry)({
                    audioMuted: resource.mediaEntry.audioMuted,
                    videoMuted: resource.mediaEntry.videoMuted,
                    screenShare: resource.mediaEntry.screenshare,
                    isPresenter: resource.mediaEntry.presenter,
                    id: resource.id,
                    audioCsrc: resource.mediaEntry.audioCsrc,
                    videoCsrc,
                    sessionName: resource.mediaEntry.sessionName,
                    session: resource.mediaEntry.session,
                });
                internalMediaEntry = mediaEntryElement.internalMediaEntry;
                mediaEntry = mediaEntryElement.mediaEntry;
                this.internalMediaEntryMap.set(mediaEntry, internalMediaEntry);
                this.idMediaEntryMap.set(internalMediaEntry.id, mediaEntry);
                addedMediaEntries.push(mediaEntry);
            }
            // Assign meet streams to media entry if they are not already assigned
            // correctly.
            if (!mediaEntry.audioMuted.get() &&
                internalMediaEntry.audioCsrc &&
                !this.isMediaEntryAssignedToMeetStreamTrack(internalMediaEntry)) {
                this.assignAudioMeetStreamTrack(mediaEntry, internalMediaEntry);
            }
            // Assign participant to media entry
            let existingParticipant;
            if (resource.mediaEntry.participant) {
                existingParticipant = this.nameParticipantMap.get(resource.mediaEntry.participant);
            }
            else if (resource.mediaEntry.participantKey) {
                existingParticipant = (_c = Array.from(this.internalParticipantMap.entries()).find(([participant, _]) => participant.participant.participantKey ===
                    resource.mediaEntry.participantKey)) === null || _c === void 0 ? void 0 : _c[0];
            }
            if (existingParticipant) {
                const internalParticipant = this.internalParticipantMap.get(existingParticipant);
                if (internalParticipant) {
                    const newMediaEntries = [
                        ...internalParticipant.mediaEntries.get(),
                        mediaEntry,
                    ];
                    internalParticipant.mediaEntries.set(newMediaEntries);
                }
                internalMediaEntry.participant.set(existingParticipant);
            }
            else if (resource.mediaEntry.participant ||
                resource.mediaEntry.participantKey) {
                // This is unexpected behavior, but technically possible. We expect
                // that the participants are received from the participants channel
                // before the media entries channel but this is not guaranteed.
                (_d = this.channelLogger) === null || _d === void 0 ? void 0 : _d.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Media entries channel: participant not found in name participant map' +
                    ' creating participant');
                const subscribableDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_1__.SubscribableDelegate([
                    mediaEntry,
                ]);
                const newParticipant = {
                    participant: {
                        name: resource.mediaEntry.participant,
                        anonymousUser: {},
                        participantKey: resource.mediaEntry.participantKey,
                    },
                    mediaEntries: subscribableDelegate.getSubscribable(),
                };
                // TODO: Use participant resource name instead of id.
                // tslint:disable-next-line:deprecation
                const ids = resource.mediaEntry.participantId
                    ? // tslint:disable-next-line:deprecation
                        new Set([resource.mediaEntry.participantId])
                    : new Set();
                const internalParticipant = {
                    name: (_e = resource.mediaEntry.participant) !== null && _e !== void 0 ? _e : '',
                    ids,
                    mediaEntries: subscribableDelegate,
                };
                if (resource.mediaEntry.participant) {
                    this.nameParticipantMap.set(resource.mediaEntry.participant, newParticipant);
                }
                this.internalParticipantMap.set(newParticipant, internalParticipant);
                // TODO: Use participant resource name instead of id.
                // tslint:disable-next-line:deprecation
                if (resource.mediaEntry.participantId) {
                    this.idParticipantMap.set(
                    // TODO: Use participant resource name instead of id.
                    // tslint:disable-next-line:deprecation
                    resource.mediaEntry.participantId, newParticipant);
                }
                const participantArray = this.participantsDelegate.get();
                this.participantsDelegate.set([...participantArray, newParticipant]);
                internalMediaEntry.participant.set(newParticipant);
            }
            if (resource.mediaEntry.presenter) {
                this.presenterDelegate.set(mediaEntry);
            }
            else if (!resource.mediaEntry.presenter &&
                this.presenterDelegate.get() === mediaEntry) {
                this.presenterDelegate.set(undefined);
            }
            if (resource.mediaEntry.screenshare) {
                this.screenshareDelegate.set(mediaEntry);
            }
            else if (!resource.mediaEntry.screenshare &&
                this.screenshareDelegate.get() === mediaEntry) {
                this.screenshareDelegate.set(undefined);
            }
        });
        // Update media entry collection.
        if ((data.resources && data.resources.length > 0) ||
            (data.deletedResources && data.deletedResources.length > 0)) {
            const newMediaEntryArray = [...mediaEntryArray, ...addedMediaEntries];
            this.mediaEntriesDelegate.set(newMediaEntryArray);
        }
    }
    isMediaEntryAssignedToMeetStreamTrack(internalMediaEntry) {
        const audioStreamTrack = internalMediaEntry.audioMeetStreamTrack.get();
        if (!audioStreamTrack)
            return false;
        const internalAudioMeetStreamTrack = this.internalMeetStreamTrackMap.get(audioStreamTrack);
        // This is not expected. Map should be comprehensive of all meet stream
        // tracks.
        if (!internalAudioMeetStreamTrack)
            return false;
        // The Audio CRSCs changed and therefore need to be checked if the current
        // audio csrc is in the contributing sources.
        const contributingSources = internalAudioMeetStreamTrack.receiver.getContributingSources();
        for (const contributingSource of contributingSources) {
            if (contributingSource.source === internalMediaEntry.audioCsrc) {
                // Audio Csrc found in contributing sources.
                return true;
            }
        }
        // Audio Csrc not found in contributing sources, unassign audio meet stream
        // track.
        internalMediaEntry.audioMeetStreamTrack.set(undefined);
        return false;
    }
    assignAudioMeetStreamTrack(mediaEntry, internalMediaEntry) {
        for (const [meetStreamTrack, internalMeetStreamTrack,] of this.internalMeetStreamTrackMap.entries()) {
            // Only audio tracks are assigned here.
            if (meetStreamTrack.mediaStreamTrack.kind !== 'audio')
                continue;
            const receiver = internalMeetStreamTrack.receiver;
            const contributingSources = receiver.getContributingSources();
            for (const contributingSource of contributingSources) {
                if (contributingSource.source === internalMediaEntry.audioCsrc) {
                    internalMediaEntry.audioMeetStreamTrack.set(meetStreamTrack);
                    internalMeetStreamTrack.mediaEntry.set(mediaEntry);
                    return;
                }
            }
            // If Audio Csrc is not found in contributing sources, fall back to
            // polling frames for assignment.
            internalMeetStreamTrack.maybeAssignMediaEntryOnFrame(mediaEntry, 'audio');
        }
    }
}


/***/ }),

/***/ "./sdk/internal/channel_handlers/media_stats_channel_handler.ts":
/*!**********************************************************************!*\
  !*** ./sdk/internal/channel_handlers/media_stats_channel_handler.ts ***!
  \**********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MediaStatsChannelHandler: () => (/* binding */ MediaStatsChannelHandler)
/* harmony export */ });
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../types/enums */ "./sdk/types/enums.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

const STATS_TYPE_CONVERTER = {
    'codec': 'codec',
    'candidate-pair': 'candidate_pair',
    'media-playout': 'media_playout',
    'transport': 'transport',
    'local-candidate': 'local_candidate',
    'remote-candidate': 'remote_candidate',
    'inbound-rtp': 'inbound_rtp',
};
/**
 * Helper class to handle the media stats channel. This class is responsible
 * for sending media stats to the backend and receiving configuration updates
 * from the backend. For realtime metrics when debugging manually, use
 * chrome://webrtc-internals.
 */
class MediaStatsChannelHandler {
    constructor(channel, peerConnection, channelLogger) {
        this.channel = channel;
        this.peerConnection = peerConnection;
        this.channelLogger = channelLogger;
        /**
         * A map of allowlisted sections. The key is the section type, and the value
         * is the keys that are allowlisted for that section.
         */
        this.allowlist = new Map();
        this.requestId = 1;
        this.pendingRequestResolveMap = new Map();
        /** Id for the interval to send media stats. */
        this.intervalId = 0;
        this.channel.onmessage = (event) => {
            this.onMediaStatsMessage(event);
        };
        this.channel.onclose = () => {
            var _a;
            clearInterval(this.intervalId);
            this.intervalId = 0;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media stats channel: closed');
            // Resolve all pending requests with an error.
            for (const [, resolve] of this.pendingRequestResolveMap) {
                resolve({ code: 400, message: 'Channel closed', details: [] });
            }
            this.pendingRequestResolveMap.clear();
        };
        this.channel.onopen = () => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media stats channel: opened');
        };
    }
    onMediaStatsMessage(message) {
        const data = JSON.parse(message.data);
        if (data.response) {
            this.onMediaStatsResponse(data.response);
        }
        if (data.resources) {
            this.onMediaStatsResources(data.resources);
        }
    }
    onMediaStatsResponse(response) {
        var _a;
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media stats channel: response received', response);
        const resolve = this.pendingRequestResolveMap.get(response.requestId);
        if (resolve) {
            resolve(response.status);
            this.pendingRequestResolveMap.delete(response.requestId);
        }
    }
    onMediaStatsResources(resources) {
        var _a, _b;
        // We expect only one resource to be sent.
        if (resources.length > 1) {
            resources.forEach((resource) => {
                var _a;
                (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Media stats channel: more than one resource received', resource);
            });
        }
        const resource = resources[0];
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media stats channel: resource received', resource);
        if (resource.configuration) {
            for (const [key, value] of Object.entries(resource.configuration.allowlist)) {
                this.allowlist.set(key, value.keys);
            }
            // We want to stop the interval if the upload interval is zero
            if (this.intervalId &&
                resource.configuration.uploadIntervalSeconds === 0) {
                clearInterval(this.intervalId);
                this.intervalId = 0;
            }
            // We want to start the interval if the upload interval is not zero.
            if (resource.configuration.uploadIntervalSeconds) {
                // We want to reset the interval if the upload interval has changed.
                if (this.intervalId) {
                    clearInterval(this.intervalId);
                }
                this.intervalId = setInterval(this.sendMediaStats.bind(this), resource.configuration.uploadIntervalSeconds * 1000);
            }
        }
        else {
            (_b = this.channelLogger) === null || _b === void 0 ? void 0 : _b.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Media stats channel: resource received without configuration');
        }
    }
    sendMediaStats() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const stats = yield this.peerConnection.getStats();
            const requestStats = [];
            stats.forEach((report) => {
                const statsType = report.type;
                if (statsType && this.allowlist.has(report.type)) {
                    const filteredMediaStats = {};
                    Object.entries(report).forEach((entry) => {
                        var _a;
                        // id is not accepted with other stats. It is populated in the top
                        // level section.
                        if (((_a = this.allowlist.get(report.type)) === null || _a === void 0 ? void 0 : _a.includes(entry[0])) &&
                            entry[0] !== 'id') {
                            // We want to convert the camel case to underscore.
                            filteredMediaStats[this.camelToUnderscore(entry[0])] = entry[1];
                        }
                    });
                    const filteredMediaStatsDictionary = {
                        'id': report.id,
                        [STATS_TYPE_CONVERTER[report.type]]: filteredMediaStats,
                    };
                    const filteredStatsSectionData = filteredMediaStatsDictionary;
                    requestStats.push(filteredStatsSectionData);
                }
            });
            if (!requestStats.length) {
                (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Media stats channel: no media stats to send');
                return { code: 400, message: 'No media stats to send', details: [] };
            }
            if (this.channel.readyState === 'open') {
                const mediaStatsRequest = {
                    requestId: this.requestId,
                    uploadMediaStats: { sections: requestStats },
                };
                const request = {
                    request: mediaStatsRequest,
                };
                (_b = this.channelLogger) === null || _b === void 0 ? void 0 : _b.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Media stats channel: sending request', mediaStatsRequest);
                try {
                    this.channel.send(JSON.stringify(request));
                }
                catch (e) {
                    (_c = this.channelLogger) === null || _c === void 0 ? void 0 : _c.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Media stats channel: Failed to send request with error', e);
                    throw e;
                }
                this.requestId++;
                const requestPromise = new Promise((resolve) => {
                    this.pendingRequestResolveMap.set(mediaStatsRequest.requestId, resolve);
                });
                return requestPromise;
            }
            else {
                clearInterval(this.intervalId);
                this.intervalId = 0;
                (_d = this.channelLogger) === null || _d === void 0 ? void 0 : _d.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Media stats channel: handler tried to send message when channel was closed');
                return { code: 400, message: 'Channel is not open', details: [] };
            }
        });
    }
    camelToUnderscore(text) {
        return text.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
}


/***/ }),

/***/ "./sdk/internal/channel_handlers/participants_channel_handler.ts":
/*!***********************************************************************!*\
  !*** ./sdk/internal/channel_handlers/participants_channel_handler.ts ***!
  \***********************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ParticipantsChannelHandler: () => (/* binding */ ParticipantsChannelHandler)
/* harmony export */ });
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../types/enums */ "./sdk/types/enums.ts");
/* harmony import */ var _subscribable_impl__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../subscribable_impl */ "./sdk/internal/subscribable_impl.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * Handler for participants channel
 */
class ParticipantsChannelHandler {
    constructor(channel, participantsDelegate, idParticipantMap = new Map(), nameParticipantMap = new Map(), internalParticipantMap = new Map(), internalMediaEntryMap = new Map(), channelLogger) {
        this.channel = channel;
        this.participantsDelegate = participantsDelegate;
        this.idParticipantMap = idParticipantMap;
        this.nameParticipantMap = nameParticipantMap;
        this.internalParticipantMap = internalParticipantMap;
        this.internalMediaEntryMap = internalMediaEntryMap;
        this.channelLogger = channelLogger;
        this.channel.onmessage = (event) => {
            this.onParticipantsMessage(event);
        };
        this.channel.onopen = () => {
            this.onParticipantsOpened();
        };
        this.channel.onclose = () => {
            this.onParticipantsClosed();
        };
    }
    onParticipantsOpened() {
        var _a;
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Participants channel: opened');
    }
    onParticipantsMessage(event) {
        var _a, _b, _c, _d;
        const data = JSON.parse(event.data);
        let participants = this.participantsDelegate.get();
        (_a = data.deletedResources) === null || _a === void 0 ? void 0 : _a.forEach((deletedResource) => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Participants channel: deleted resource', deletedResource);
            const participant = this.idParticipantMap.get(deletedResource.id);
            if (!participant) {
                return;
            }
            this.idParticipantMap.delete(deletedResource.id);
            const deletedParticipant = this.internalParticipantMap.get(participant);
            if (!deletedParticipant) {
                return;
            }
            deletedParticipant.ids.delete(deletedResource.id);
            if (deletedParticipant.ids.size !== 0) {
                return;
            }
            if (participant.participant.name) {
                this.nameParticipantMap.delete(participant.participant.name);
            }
            participants = participants.filter((p) => p !== participant);
            this.internalParticipantMap.delete(participant);
            deletedParticipant.mediaEntries.get().forEach((mediaEntry) => {
                const internalMediaEntry = this.internalMediaEntryMap.get(mediaEntry);
                if (internalMediaEntry) {
                    internalMediaEntry.participant.set(undefined);
                }
            });
        });
        const addedParticipants = [];
        (_b = data.resources) === null || _b === void 0 ? void 0 : _b.forEach((resource) => {
            var _a, _b, _c, _d;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Participants channel: added resource', resource);
            if (!resource.id) {
                // We expect all participants to have an id. If not, we log an error
                // and ignore the participant.
                (_b = this.channelLogger) === null || _b === void 0 ? void 0 : _b.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Participants channel: participant resource has no id', resource);
                return;
            }
            // We do not expect that the participant resource already exists.
            // However, it is possible that the media entries channel references it
            // before we receive the participant resource. In this case, we update
            // the participant resource with the type and maintain the media entry
            // relationship.
            let existingMediaEntriesDelegate;
            let existingParticipant;
            let existingIds;
            if (this.idParticipantMap.has(resource.id)) {
                existingParticipant = this.idParticipantMap.get(resource.id);
            }
            else if (resource.participant.name &&
                this.nameParticipantMap.has(resource.participant.name)) {
                existingParticipant = this.nameParticipantMap.get(resource.participant.name);
            }
            else if (resource.participant.participantKey) {
                existingParticipant = (_c = Array.from(this.internalParticipantMap.entries()).find(([participant, _]) => participant.participant.participantKey ===
                    resource.participant.participantKey)) === null || _c === void 0 ? void 0 : _c[0];
            }
            if (existingParticipant) {
                const internalParticipant = this.internalParticipantMap.get(existingParticipant);
                if (internalParticipant) {
                    existingMediaEntriesDelegate = internalParticipant.mediaEntries;
                    // (TODO: Remove this once we are using participant
                    // names as identifiers. Right now, it is possible for a participant to
                    // have multiple ids due to updates being treated as new resources.
                    existingIds = internalParticipant.ids;
                    existingIds.forEach((id) => {
                        this.idParticipantMap.delete(id);
                    });
                }
                if (existingParticipant.participant.name) {
                    this.nameParticipantMap.delete(existingParticipant.participant.name);
                }
                this.internalParticipantMap.delete(existingParticipant);
                participants = participants.filter((p) => p !== existingParticipant);
                (_d = this.channelLogger) === null || _d === void 0 ? void 0 : _d.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Participants channel: participant resource already exists', resource);
            }
            const participantElement = createParticipant(resource, existingMediaEntriesDelegate, existingIds);
            const participant = participantElement.participant;
            const internalParticipant = participantElement.internalParticipant;
            participantElement.internalParticipant.ids.forEach((id) => {
                this.idParticipantMap.set(id, participant);
            });
            if (resource.participant.name) {
                this.nameParticipantMap.set(resource.participant.name, participant);
            }
            this.internalParticipantMap.set(participant, internalParticipant);
            addedParticipants.push(participant);
        });
        // Update participant collection.
        if (((_c = data.resources) === null || _c === void 0 ? void 0 : _c.length) || ((_d = data.deletedResources) === null || _d === void 0 ? void 0 : _d.length)) {
            const newParticipants = [...participants, ...addedParticipants];
            this.participantsDelegate.set(newParticipants);
        }
    }
    onParticipantsClosed() {
        var _a;
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Participants channel: closed');
    }
}
/**
 * Creates a new participant.
 * @return The new participant and its internal representation.
 */
function createParticipant(resource, mediaEntriesDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_1__.SubscribableDelegate([]), existingIds = new Set()) {
    var _a;
    if (!resource.id) {
        throw new Error('Participant resource must have an id');
    }
    const participant = {
        participant: resource.participant,
        mediaEntries: mediaEntriesDelegate.getSubscribable(),
    };
    existingIds.add(resource.id);
    const internalParticipant = {
        name: (_a = resource.participant.name) !== null && _a !== void 0 ? _a : '',
        ids: existingIds,
        mediaEntries: mediaEntriesDelegate,
    };
    return {
        participant,
        internalParticipant,
    };
}


/***/ }),

/***/ "./sdk/internal/channel_handlers/session_control_channel_handler.ts":
/*!**************************************************************************!*\
  !*** ./sdk/internal/channel_handlers/session_control_channel_handler.ts ***!
  \**************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SessionControlChannelHandler: () => (/* binding */ SessionControlChannelHandler)
/* harmony export */ });
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../types/enums */ "./sdk/types/enums.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const DISCONNECT_REASON_MAP = new Map([
    ['REASON_CLIENT_LEFT', _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetDisconnectReason.CLIENT_LEFT],
    ['REASON_USER_STOPPED', _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetDisconnectReason.USER_STOPPED],
    ['REASON_CONFERENCE_ENDED', _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetDisconnectReason.CONFERENCE_ENDED],
    ['REASON_SESSION_UNHEALTHY', _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetDisconnectReason.SESSION_UNHEALTHY],
]);
/**
 * Helper class to handles the session control channel.
 */
class SessionControlChannelHandler {
    constructor(channel, sessionStatusDelegate, channelLogger) {
        this.channel = channel;
        this.sessionStatusDelegate = sessionStatusDelegate;
        this.channelLogger = channelLogger;
        this.requestId = 1;
        this.channel.onmessage = (event) => {
            this.onSessionControlMessage(event);
        };
        this.channel.onopen = () => {
            this.onSessionControlOpened();
        };
        this.channel.onclose = () => {
            this.onSessionControlClosed();
        };
    }
    onSessionControlOpened() {
        var _a;
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Session control channel: opened');
        this.sessionStatusDelegate.set({
            connectionState: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.WAITING,
        });
    }
    onSessionControlMessage(event) {
        var _a, _b, _c, _d;
        const message = event.data;
        const json = JSON.parse(message);
        if (json === null || json === void 0 ? void 0 : json.response) {
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Session control channel: response recieved', json.response);
            (_b = this.leaveSessionPromise) === null || _b === void 0 ? void 0 : _b.call(this);
        }
        if ((json === null || json === void 0 ? void 0 : json.resources) && json.resources.length > 0) {
            const sessionStatus = json.resources[0].sessionStatus;
            (_c = this.channelLogger) === null || _c === void 0 ? void 0 : _c.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Session control channel: resource recieved', json.resources[0]);
            if (sessionStatus.connectionState === 'STATE_WAITING') {
                this.sessionStatusDelegate.set({
                    connectionState: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.WAITING,
                });
            }
            else if (sessionStatus.connectionState === 'STATE_JOINED') {
                this.sessionStatusDelegate.set({
                    connectionState: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.JOINED,
                });
            }
            else if (sessionStatus.connectionState === 'STATE_DISCONNECTED') {
                this.sessionStatusDelegate.set({
                    connectionState: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.DISCONNECTED,
                    disconnectReason: (_d = DISCONNECT_REASON_MAP.get(sessionStatus.disconnectReason || '')) !== null && _d !== void 0 ? _d : _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetDisconnectReason.SESSION_UNHEALTHY,
                });
            }
        }
    }
    onSessionControlClosed() {
        var _a, _b;
        // If the channel is closed, we should resolve the leave session promise.
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Session control channel: closed');
        (_b = this.leaveSessionPromise) === null || _b === void 0 ? void 0 : _b.call(this);
        if (this.sessionStatusDelegate.get().connectionState !==
            _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.DISCONNECTED) {
            this.sessionStatusDelegate.set({
                connectionState: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.DISCONNECTED,
                disconnectReason: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetDisconnectReason.UNKNOWN,
            });
        }
    }
    leaveSession() {
        var _a, _b;
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Session control channel: leave session request sent');
        try {
            this.channel.send(JSON.stringify({
                request: {
                    requestId: this.requestId++,
                    leave: {},
                },
            }));
        }
        catch (e) {
            (_b = this.channelLogger) === null || _b === void 0 ? void 0 : _b.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Session control channel: Failed to send leave request with error', e);
            throw e;
        }
        return new Promise((resolve) => {
            this.leaveSessionPromise = resolve;
        });
    }
}


/***/ }),

/***/ "./sdk/internal/channel_handlers/video_assignment_channel_handler.ts":
/*!***************************************************************************!*\
  !*** ./sdk/internal/channel_handlers/video_assignment_channel_handler.ts ***!
  \***************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   VideoAssignmentChannelHandler: () => (/* binding */ VideoAssignmentChannelHandler)
/* harmony export */ });
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../types/enums */ "./sdk/types/enums.ts");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils */ "./sdk/internal/utils.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


// We request the highest possible resolution by default.
const MAX_RESOLUTION = {
    height: 1080,
    width: 1920,
    frameRate: 30,
};
/**
 * Helper class to handle the video assignment channel.
 */
class VideoAssignmentChannelHandler {
    constructor(channel, idMediaEntryMap, internalMediaEntryMap = new Map(), idMediaLayoutMap = new Map(), internalMediaLayoutMap = new Map(), mediaEntriesDelegate, internalMeetStreamTrackMap = new Map(), channelLogger) {
        this.channel = channel;
        this.idMediaEntryMap = idMediaEntryMap;
        this.internalMediaEntryMap = internalMediaEntryMap;
        this.idMediaLayoutMap = idMediaLayoutMap;
        this.internalMediaLayoutMap = internalMediaLayoutMap;
        this.mediaEntriesDelegate = mediaEntriesDelegate;
        this.internalMeetStreamTrackMap = internalMeetStreamTrackMap;
        this.channelLogger = channelLogger;
        this.requestId = 1;
        this.mediaLayoutLabelMap = new Map();
        this.pendingRequestResolveMap = new Map();
        this.channel.onmessage = (event) => {
            this.onVideoAssignmentMessage(event);
        };
        this.channel.onclose = () => {
            var _a;
            // Resolve all pending requests with an error.
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Video assignment channel: closed');
            for (const [, resolve] of this.pendingRequestResolveMap) {
                resolve({ code: 400, message: 'Channel closed', details: [] });
            }
            this.pendingRequestResolveMap.clear();
        };
        this.channel.onopen = () => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Video assignment channel: opened');
        };
    }
    onVideoAssignmentMessage(message) {
        const data = JSON.parse(message.data);
        if (data.response) {
            this.onVideoAssignmentResponse(data.response);
        }
        if (data.resources) {
            this.onVideoAssignmentResources(data.resources);
        }
    }
    onVideoAssignmentResponse(response) {
        var _a, _b;
        // Users should listen on the video assignment channel for actual video
        // assignments. These responses signify that the request was expected.
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Video assignment channel: recieved response', response);
        (_b = this.pendingRequestResolveMap.get(response.requestId)) === null || _b === void 0 ? void 0 : _b(response.status);
    }
    onVideoAssignmentResources(resources) {
        resources.forEach((resource) => {
            var _a;
            (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.RESOURCES, 'Video assignment channel: resource added', resource);
            if (resource.videoAssignment.canvases) {
                this.onVideoAssignment(resource);
            }
        });
    }
    onVideoAssignment(videoAssignment) {
        const canvases = videoAssignment.videoAssignment.canvases;
        canvases.forEach((canvas) => {
            var _a, _b, _c, _d, _e, _f;
            const mediaLayout = this.idMediaLayoutMap.get(canvas.canvasId);
            // We expect that the media layout is already created.
            let internalMediaEntry;
            if (mediaLayout) {
                const assignedMediaEntry = mediaLayout.mediaEntry.get();
                let mediaEntry;
                // if association already exists, we need to either update the video
                // ssrc or remove the association if the ids don't match.
                if (assignedMediaEntry &&
                    ((_a = this.internalMediaEntryMap.get(assignedMediaEntry)) === null || _a === void 0 ? void 0 : _a.id) ===
                        canvas.mediaEntryId) {
                    // We expect the internal media entry to be already created if the media entry exists.
                    internalMediaEntry =
                        this.internalMediaEntryMap.get(assignedMediaEntry);
                    // If the media canvas is already associated with a media entry, we
                    // need to update the video ssrc.
                    // Expect the media entry to be created, without assertion, TS
                    // complains it can be undefined.
                    // tslint:disable:no-unnecessary-type-assertion
                    internalMediaEntry.videoSsrc = canvas.ssrc;
                    mediaEntry = assignedMediaEntry;
                }
                else {
                    // If asssocation does not exist, we will attempt to retreive the
                    // media entry from the map.
                    const existingMediaEntry = this.idMediaEntryMap.get(canvas.mediaEntryId);
                    // Clear existing association if it exists.
                    if (assignedMediaEntry) {
                        (_b = this.internalMediaEntryMap
                            .get(assignedMediaEntry)) === null || _b === void 0 ? void 0 : _b.mediaLayout.set(undefined);
                        (_c = this.internalMediaLayoutMap
                            .get(mediaLayout)) === null || _c === void 0 ? void 0 : _c.mediaEntry.set(undefined);
                    }
                    if (existingMediaEntry) {
                        // If the media entry exists, need to create the media canvas association.
                        internalMediaEntry =
                            this.internalMediaEntryMap.get(existingMediaEntry);
                        internalMediaEntry.videoSsrc = canvas.ssrc;
                        internalMediaEntry.mediaLayout.set(mediaLayout);
                        mediaEntry = existingMediaEntry;
                    }
                    else {
                        // If the media entry doewsn't exist, we need to create it and
                        // then create the media canvas association.
                        // We don't expect to hit this expression, but since data channels
                        // don't guarantee order, we do this to be safe.
                        const mediaEntryElement = (0,_utils__WEBPACK_IMPORTED_MODULE_1__.createMediaEntry)({
                            id: canvas.mediaEntryId,
                            mediaLayout,
                            videoSsrc: canvas.ssrc,
                        });
                        this.internalMediaEntryMap.set(mediaEntryElement.mediaEntry, mediaEntryElement.internalMediaEntry);
                        internalMediaEntry = mediaEntryElement.internalMediaEntry;
                        const newMediaEntry = mediaEntryElement.mediaEntry;
                        this.idMediaEntryMap.set(canvas.mediaEntryId, newMediaEntry);
                        const newMediaEntries = [
                            ...this.mediaEntriesDelegate.get(),
                            newMediaEntry,
                        ];
                        this.mediaEntriesDelegate.set(newMediaEntries);
                        mediaEntry = newMediaEntry;
                    }
                    (_d = this.internalMediaLayoutMap
                        .get(mediaLayout)) === null || _d === void 0 ? void 0 : _d.mediaEntry.set(mediaEntry);
                    (_e = this.internalMediaEntryMap
                        .get(mediaEntry)) === null || _e === void 0 ? void 0 : _e.mediaLayout.set(mediaLayout);
                }
                if (!this.isMediaEntryAssignedToMeetStreamTrack(mediaEntry, internalMediaEntry)) {
                    this.assignVideoMeetStreamTrack(mediaEntry);
                }
            }
            // tslint:enable:no-unnecessary-type-assertion
            (_f = this.channelLogger) === null || _f === void 0 ? void 0 : _f.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Video assignment channel: server sent a canvas that was not created by the client');
        });
    }
    sendRequests(mediaLayoutRequests) {
        var _a, _b;
        const label = Date.now().toString();
        const canvases = [];
        mediaLayoutRequests.forEach((request) => {
            this.mediaLayoutLabelMap.set(request.mediaLayout, label);
            canvases.push({
                id: this.internalMediaLayoutMap.get(request.mediaLayout).id,
                dimensions: request.mediaLayout.canvasDimensions,
                relevant: {},
            });
        });
        const request = {
            requestId: this.requestId++,
            setAssignment: {
                layoutModel: {
                    label,
                    canvases,
                },
                maxVideoResolution: MAX_RESOLUTION,
            },
        };
        (_a = this.channelLogger) === null || _a === void 0 ? void 0 : _a.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.MESSAGES, 'Video Assignment channel: Sending request', request);
        try {
            this.channel.send(JSON.stringify({
                request,
            }));
        }
        catch (e) {
            (_b = this.channelLogger) === null || _b === void 0 ? void 0 : _b.log(_types_enums__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERRORS, 'Video Assignment channel: Failed to send request with error', e);
            throw e;
        }
        const requestPromise = new Promise((resolve) => {
            this.pendingRequestResolveMap.set(request.requestId, resolve);
        });
        return requestPromise;
    }
    isMediaEntryAssignedToMeetStreamTrack(mediaEntry, internalMediaEntry) {
        const videoMeetStreamTrack = mediaEntry.videoMeetStreamTrack.get();
        if (!videoMeetStreamTrack)
            return false;
        const internalMeetStreamTrack = this.internalMeetStreamTrackMap.get(videoMeetStreamTrack);
        if (internalMeetStreamTrack.videoSsrc === internalMediaEntry.videoSsrc) {
            return true;
        }
        else {
            // ssrcs can change, if the video ssrc is not the same, we need to remove
            // the relationship between the media entry and the meet stream track.
            internalMediaEntry.videoMeetStreamTrack.set(undefined);
            internalMeetStreamTrack === null || internalMeetStreamTrack === void 0 ? void 0 : internalMeetStreamTrack.mediaEntry.set(undefined);
            return false;
        }
    }
    assignVideoMeetStreamTrack(mediaEntry) {
        for (const [meetStreamTrack, internalMeetStreamTrack] of this
            .internalMeetStreamTrackMap) {
            if (meetStreamTrack.mediaStreamTrack.kind === 'video') {
                internalMeetStreamTrack.maybeAssignMediaEntryOnFrame(mediaEntry, 'video');
            }
        }
    }
}


/***/ }),

/***/ "./sdk/internal/communication_protocols/default_communication_protocol_impl.ts":
/*!*************************************************************************************!*\
  !*** ./sdk/internal/communication_protocols/default_communication_protocol_impl.ts ***!
  \*************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DefaultCommunicationProtocolImpl: () => (/* binding */ DefaultCommunicationProtocolImpl)
/* harmony export */ });
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const MEET_API_URL = 'https://meet.googleapis.com/v2beta/';
/**
 * The HTTP communication protocol for communication with Meet API.
 */
class DefaultCommunicationProtocolImpl {
    constructor(requiredConfiguration, meetApiUrl = MEET_API_URL) {
        this.requiredConfiguration = requiredConfiguration;
        this.meetApiUrl = meetApiUrl;
    }
    connectActiveConference(sdpOffer) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Call to Meet API
            const connectUrl = `${this.meetApiUrl}${this.requiredConfiguration.meetingSpaceId}:connectActiveConference`;
            const response = yield fetch(connectUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.requiredConfiguration.accessToken}`,
                },
                body: JSON.stringify({
                    'offer': sdpOffer,
                }),
            });
            if (!response.ok) {
                const bodyReader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
                let error = '';
                if (bodyReader) {
                    const decoder = new TextDecoder();
                    let readingDone = false;
                    while (!readingDone) {
                        const { done, value } = yield (bodyReader === null || bodyReader === void 0 ? void 0 : bodyReader.read());
                        if (done) {
                            readingDone = true;
                            break;
                        }
                        error += decoder.decode(value);
                    }
                }
                const errorJson = JSON.parse(error);
                throw new Error(`${JSON.stringify(errorJson, null, 2)}`);
            }
            const payload = yield response.json();
            return { answer: payload['answer'] };
        });
    }
}


/***/ }),

/***/ "./sdk/internal/internal_meet_stream_track_impl.ts":
/*!*********************************************************!*\
  !*** ./sdk/internal/internal_meet_stream_track_impl.ts ***!
  \*********************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   InternalMeetStreamTrackImpl: () => (/* binding */ InternalMeetStreamTrackImpl)
/* harmony export */ });
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * Implementation of InternalMeetStreamTrack.
 */
class InternalMeetStreamTrackImpl {
    constructor(receiver, mediaEntry, meetStreamTrack, internalMediaEntryMap) {
        this.receiver = receiver;
        this.mediaEntry = mediaEntry;
        this.meetStreamTrack = meetStreamTrack;
        this.internalMediaEntryMap = internalMediaEntryMap;
        const mediaStreamTrack = meetStreamTrack.mediaStreamTrack;
        let mediaStreamTrackProcessor;
        if (mediaStreamTrack.kind === 'audio') {
            mediaStreamTrackProcessor = new MediaStreamTrackProcessor({
                track: mediaStreamTrack,
            });
        }
        else {
            mediaStreamTrackProcessor = new MediaStreamTrackProcessor({
                track: mediaStreamTrack,
            });
        }
        this.reader = mediaStreamTrackProcessor.readable.getReader();
    }
    maybeAssignMediaEntryOnFrame(mediaEntry, kind) {
        return __awaiter(this, void 0, void 0, function* () {
            // Only want to check the media entry if it has the correct csrc type
            // for this meet stream track.
            if (!this.mediaStreamTrackSrcPresent(mediaEntry) ||
                this.meetStreamTrack.mediaStreamTrack.kind !== kind) {
                return;
            }
            // Loop through the frames until media entry is assigned by either this
            // meet stream track or another meet stream track.
            while (!this.mediaEntryTrackAssigned(mediaEntry, kind)) {
                const frame = yield this.reader.read();
                if (frame.done)
                    break;
                if (kind === 'audio') {
                    yield this.onAudioFrame(mediaEntry);
                }
                else if (kind === 'video') {
                    this.onVideoFrame(mediaEntry);
                }
                frame.value.close();
            }
            return;
        });
    }
    onAudioFrame(mediaEntry) {
        return __awaiter(this, void 0, void 0, function* () {
            const internalMediaEntry = this.internalMediaEntryMap.get(mediaEntry);
            const contributingSources = this.receiver.getContributingSources();
            for (const contributingSource of contributingSources) {
                if (contributingSource.source === internalMediaEntry.audioCsrc) {
                    internalMediaEntry.audioMeetStreamTrack.set(this.meetStreamTrack);
                    this.mediaEntry.set(mediaEntry);
                }
            }
        });
    }
    onVideoFrame(mediaEntry) {
        const internalMediaEntry = this.internalMediaEntryMap.get(mediaEntry);
        const synchronizationSources = this.receiver.getSynchronizationSources();
        for (const syncSource of synchronizationSources) {
            if (syncSource.source === internalMediaEntry.videoSsrc) {
                this.videoSsrc = syncSource.source;
                internalMediaEntry.videoMeetStreamTrack.set(this.meetStreamTrack);
                this.mediaEntry.set(mediaEntry);
            }
        }
        return;
    }
    mediaEntryTrackAssigned(mediaEntry, kind) {
        if ((kind === 'audio' && mediaEntry.audioMeetStreamTrack.get()) ||
            (kind === 'video' && mediaEntry.videoMeetStreamTrack.get())) {
            return true;
        }
        return false;
    }
    mediaStreamTrackSrcPresent(mediaEntry) {
        const internalMediaEntry = this.internalMediaEntryMap.get(mediaEntry);
        if (this.meetStreamTrack.mediaStreamTrack.kind === 'audio') {
            return !!(internalMediaEntry === null || internalMediaEntry === void 0 ? void 0 : internalMediaEntry.audioCsrc);
        }
        else if (this.meetStreamTrack.mediaStreamTrack.kind === 'video') {
            return !!(internalMediaEntry === null || internalMediaEntry === void 0 ? void 0 : internalMediaEntry.videoSsrc);
        }
        return false;
    }
}


/***/ }),

/***/ "./sdk/internal/meet_stream_track_impl.ts":
/*!************************************************!*\
  !*** ./sdk/internal/meet_stream_track_impl.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MeetStreamTrackImpl: () => (/* binding */ MeetStreamTrackImpl)
/* harmony export */ });
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * The implementation of MeetStreamTrack.
 */
class MeetStreamTrackImpl {
    constructor(mediaStreamTrack, mediaEntryDelegate) {
        this.mediaStreamTrack = mediaStreamTrack;
        this.mediaEntryDelegate = mediaEntryDelegate;
        this.mediaEntry = this.mediaEntryDelegate.getSubscribable();
    }
}


/***/ }),

/***/ "./sdk/internal/meetmediaapiclient_impl.ts":
/*!*************************************************!*\
  !*** ./sdk/internal/meetmediaapiclient_impl.ts ***!
  \*************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MeetMediaApiClientImpl: () => (/* binding */ MeetMediaApiClientImpl)
/* harmony export */ });
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../types/enums */ "./sdk/types/enums.ts");
/* harmony import */ var _channel_handlers_channel_logger__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./channel_handlers/channel_logger */ "./sdk/internal/channel_handlers/channel_logger.ts");
/* harmony import */ var _channel_handlers_media_entries_channel_handler__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./channel_handlers/media_entries_channel_handler */ "./sdk/internal/channel_handlers/media_entries_channel_handler.ts");
/* harmony import */ var _channel_handlers_media_stats_channel_handler__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./channel_handlers/media_stats_channel_handler */ "./sdk/internal/channel_handlers/media_stats_channel_handler.ts");
/* harmony import */ var _channel_handlers_participants_channel_handler__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./channel_handlers/participants_channel_handler */ "./sdk/internal/channel_handlers/participants_channel_handler.ts");
/* harmony import */ var _channel_handlers_session_control_channel_handler__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./channel_handlers/session_control_channel_handler */ "./sdk/internal/channel_handlers/session_control_channel_handler.ts");
/* harmony import */ var _channel_handlers_video_assignment_channel_handler__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./channel_handlers/video_assignment_channel_handler */ "./sdk/internal/channel_handlers/video_assignment_channel_handler.ts");
/* harmony import */ var _communication_protocols_default_communication_protocol_impl__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./communication_protocols/default_communication_protocol_impl */ "./sdk/internal/communication_protocols/default_communication_protocol_impl.ts");
/* harmony import */ var _internal_meet_stream_track_impl__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./internal_meet_stream_track_impl */ "./sdk/internal/internal_meet_stream_track_impl.ts");
/* harmony import */ var _meet_stream_track_impl__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./meet_stream_track_impl */ "./sdk/internal/meet_stream_track_impl.ts");
/* harmony import */ var _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./subscribable_impl */ "./sdk/internal/subscribable_impl.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};











// Meet only supports 3 audio virtual ssrcs. If disabled, there will be no
// audio.
const NUMBER_OF_AUDIO_VIRTUAL_SSRC = 3;
const MINIMUM_VIDEO_STREAMS = 0;
const MAXIMUM_VIDEO_STREAMS = 3;
/**
 * Implementation of MeetMediaApiClient.
 */
class MeetMediaApiClientImpl {
    constructor(requiredConfiguration) {
        this.requiredConfiguration = requiredConfiguration;
        /* tslint:enable:no-unused-variable */
        this.mediaLayoutId = 1;
        // Media layout retrieval by id. Needed by the video assignment channel handler
        // to update the media layout.
        this.idMediaLayoutMap = new Map();
        // Used to update media layouts.
        this.internalMediaLayoutMap = new Map();
        // Media entry retrieval by id. Needed by the video assignment channel handler
        // to update the media entry.
        this.idMediaEntryMap = new Map();
        // Used to update media entries.
        this.internalMediaEntryMap = new Map();
        // Used to update meet stream tracks.
        this.internalMeetStreamTrackMap = new Map();
        this.idParticipantMap = new Map();
        this.nameParticipantMap = new Map();
        this.internalParticipantMap = new Map();
        this.validateConfiguration();
        this.sessionStatusDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate({
            connectionState: _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.UNKNOWN,
        });
        this.sessionStatus = this.sessionStatusDelegate.getSubscribable();
        this.meetStreamTracksDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate([]);
        this.meetStreamTracks = this.meetStreamTracksDelegate.getSubscribable();
        this.mediaEntriesDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate([]);
        this.mediaEntries = this.mediaEntriesDelegate.getSubscribable();
        this.participantsDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate([]);
        this.participants = this.participantsDelegate.getSubscribable();
        this.presenterDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate(undefined);
        this.presenter = this.presenterDelegate.getSubscribable();
        this.screenshareDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate(undefined);
        this.screenshare = this.screenshareDelegate.getSubscribable();
        const configuration = {
            sdpSemantics: 'unified-plan',
            bundlePolicy: 'max-bundle',
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        };
        // Create peer connection
        this.peerConnection = new RTCPeerConnection(configuration);
        this.peerConnection.ontrack = (e) => {
            if (e.track) {
                this.createMeetStreamTrack(e.track, e.receiver);
            }
        };
    }
    validateConfiguration() {
        if (this.requiredConfiguration.numberOfVideoStreams < MINIMUM_VIDEO_STREAMS ||
            this.requiredConfiguration.numberOfVideoStreams > MAXIMUM_VIDEO_STREAMS) {
            throw new Error(`Unsupported number of video streams, must be between ${MINIMUM_VIDEO_STREAMS} and ${MAXIMUM_VIDEO_STREAMS}`);
        }
    }
    createMeetStreamTrack(mediaStreamTrack, receiver) {
        const meetStreamTracks = this.meetStreamTracks.get();
        const mediaEntryDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate(undefined);
        const meetStreamTrack = new _meet_stream_track_impl__WEBPACK_IMPORTED_MODULE_9__.MeetStreamTrackImpl(mediaStreamTrack, mediaEntryDelegate);
        const internalMeetStreamTrack = new _internal_meet_stream_track_impl__WEBPACK_IMPORTED_MODULE_8__.InternalMeetStreamTrackImpl(receiver, mediaEntryDelegate, meetStreamTrack, this.internalMediaEntryMap);
        const newStreamTrackArray = [...meetStreamTracks, meetStreamTrack];
        this.internalMeetStreamTrackMap.set(meetStreamTrack, internalMeetStreamTrack);
        this.meetStreamTracksDelegate.set(newStreamTrackArray);
    }
    joinMeeting(communicationProtocol) {
        return __awaiter(this, void 0, void 0, function* () {
            // The offer must be in the order of audio, datachannels, video.
            var _a, _b, _c, _d, _e, _f;
            // Create audio transceivers based on initial config.
            if (this.requiredConfiguration.enableAudioStreams) {
                for (let i = 0; i < NUMBER_OF_AUDIO_VIRTUAL_SSRC; i++) {
                    // Integrating clients must support and negotiate the OPUS codec in
                    // the SDP offer.
                    // This is the default for WebRTC.
                    // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/WebRTC_codecs.
                    this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });
                }
            }
            // ---- UTILITY DATA CHANNELS -----
            // All data channels must be reliable and ordered.
            const dataChannelConfig = {
                ordered: true,
                reliable: true,
            };
            // Always create the session and media stats control channel.
            this.sessionControlChannel = this.peerConnection.createDataChannel('session-control', dataChannelConfig);
            let sessionControlchannelLogger;
            if ((_a = this.requiredConfiguration) === null || _a === void 0 ? void 0 : _a.logsCallback) {
                sessionControlchannelLogger = new _channel_handlers_channel_logger__WEBPACK_IMPORTED_MODULE_1__.ChannelLogger('session-control', this.requiredConfiguration.logsCallback);
            }
            this.sessionControlChannelHandler = new _channel_handlers_session_control_channel_handler__WEBPACK_IMPORTED_MODULE_5__.SessionControlChannelHandler(this.sessionControlChannel, this.sessionStatusDelegate, sessionControlchannelLogger);
            this.mediaStatsChannel = this.peerConnection.createDataChannel('media-stats', dataChannelConfig);
            let mediaStatsChannelLogger;
            if ((_b = this.requiredConfiguration) === null || _b === void 0 ? void 0 : _b.logsCallback) {
                mediaStatsChannelLogger = new _channel_handlers_channel_logger__WEBPACK_IMPORTED_MODULE_1__.ChannelLogger('media-stats', this.requiredConfiguration.logsCallback);
            }
            this.mediaStatsChannelHandler = new _channel_handlers_media_stats_channel_handler__WEBPACK_IMPORTED_MODULE_3__.MediaStatsChannelHandler(this.mediaStatsChannel, this.peerConnection, mediaStatsChannelLogger);
            // ---- CONDITIONAL DATA CHANNELS -----
            // We only need the video assignment channel if we are requesting video.
            if (this.requiredConfiguration.numberOfVideoStreams > 0) {
                this.videoAssignmentChannel = this.peerConnection.createDataChannel('video-assignment', dataChannelConfig);
                let videoAssignmentChannelLogger;
                if ((_c = this.requiredConfiguration) === null || _c === void 0 ? void 0 : _c.logsCallback) {
                    videoAssignmentChannelLogger = new _channel_handlers_channel_logger__WEBPACK_IMPORTED_MODULE_1__.ChannelLogger('video-assignment', this.requiredConfiguration.logsCallback);
                }
                this.videoAssignmentChannelHandler = new _channel_handlers_video_assignment_channel_handler__WEBPACK_IMPORTED_MODULE_6__.VideoAssignmentChannelHandler(this.videoAssignmentChannel, this.idMediaEntryMap, this.internalMediaEntryMap, this.idMediaLayoutMap, this.internalMediaLayoutMap, this.mediaEntriesDelegate, this.internalMeetStreamTrackMap, videoAssignmentChannelLogger);
            }
            if (this.requiredConfiguration.numberOfVideoStreams > 0 ||
                this.requiredConfiguration.enableAudioStreams) {
                this.mediaEntriesChannel = this.peerConnection.createDataChannel('media-entries', dataChannelConfig);
                let mediaEntriesChannelLogger;
                if ((_d = this.requiredConfiguration) === null || _d === void 0 ? void 0 : _d.logsCallback) {
                    mediaEntriesChannelLogger = new _channel_handlers_channel_logger__WEBPACK_IMPORTED_MODULE_1__.ChannelLogger('media-entries', this.requiredConfiguration.logsCallback);
                }
                this.mediaEntriesChannelHandler = new _channel_handlers_media_entries_channel_handler__WEBPACK_IMPORTED_MODULE_2__.MediaEntriesChannelHandler(this.mediaEntriesChannel, this.mediaEntriesDelegate, this.idMediaEntryMap, this.internalMediaEntryMap, this.internalMeetStreamTrackMap, this.internalMediaLayoutMap, this.participantsDelegate, this.nameParticipantMap, this.idParticipantMap, this.internalParticipantMap, this.presenterDelegate, this.screenshareDelegate, mediaEntriesChannelLogger);
                this.participantsChannel =
                    this.peerConnection.createDataChannel('participants');
                let participantsChannelLogger;
                if ((_e = this.requiredConfiguration) === null || _e === void 0 ? void 0 : _e.logsCallback) {
                    participantsChannelLogger = new _channel_handlers_channel_logger__WEBPACK_IMPORTED_MODULE_1__.ChannelLogger('participants', this.requiredConfiguration.logsCallback);
                }
                this.participantsChannelHandler = new _channel_handlers_participants_channel_handler__WEBPACK_IMPORTED_MODULE_4__.ParticipantsChannelHandler(this.participantsChannel, this.participantsDelegate, this.idParticipantMap, this.nameParticipantMap, this.internalParticipantMap, this.internalMediaEntryMap, participantsChannelLogger);
            }
            this.sessionStatusDelegate.subscribe((status) => {
                var _a, _b, _c;
                if (status.connectionState === _types_enums__WEBPACK_IMPORTED_MODULE_0__.MeetConnectionState.DISCONNECTED) {
                    (_a = this.mediaStatsChannel) === null || _a === void 0 ? void 0 : _a.close();
                    (_b = this.videoAssignmentChannel) === null || _b === void 0 ? void 0 : _b.close();
                    (_c = this.mediaEntriesChannel) === null || _c === void 0 ? void 0 : _c.close();
                }
            });
            // Local description has to be set before adding video transceivers to
            // preserve the order of audio, datachannels, video.
            let pcOffer = yield this.peerConnection.createOffer();
            yield this.peerConnection.setLocalDescription(pcOffer);
            for (let i = 0; i < this.requiredConfiguration.numberOfVideoStreams; i++) {
                // Integrating clients must support and negotiate AV1, VP9, and VP8 codecs
                // in the SDP offer.
                // The default for WebRTC is VP8.
                // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/WebRTC_codecs.
                this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
            }
            pcOffer = yield this.peerConnection.createOffer();
            yield this.peerConnection.setLocalDescription(pcOffer);
            const protocol = communicationProtocol !== null && communicationProtocol !== void 0 ? communicationProtocol : new _communication_protocols_default_communication_protocol_impl__WEBPACK_IMPORTED_MODULE_7__.DefaultCommunicationProtocolImpl(this.requiredConfiguration);
            const response = yield protocol.connectActiveConference((_f = pcOffer.sdp) !== null && _f !== void 0 ? _f : '');
            if (response === null || response === void 0 ? void 0 : response.answer) {
                yield this.peerConnection.setRemoteDescription({
                    type: 'answer',
                    sdp: response === null || response === void 0 ? void 0 : response.answer,
                });
            }
            else {
                // We do not expect this to happen and therefore it is an internal
                // error.
                throw new Error('Internal error, no answer in response');
            }
            return;
        });
    }
    leaveMeeting() {
        var _a;
        if (this.sessionControlChannelHandler) {
            return (_a = this.sessionControlChannelHandler) === null || _a === void 0 ? void 0 : _a.leaveSession();
        }
        else {
            throw new Error('You must connect to a meeting before leaving it');
        }
    }
    // The promise resolving on the request does not mean the layout has been
    // applied. It means that the request has been accepted and you may need to
    // wait a short amount of time for these layouts to be applied.
    applyLayout(requests) {
        if (!this.videoAssignmentChannelHandler) {
            throw new Error('You must connect to a meeting with video before applying a layout');
        }
        requests.forEach((request) => {
            if (!request.mediaLayout) {
                throw new Error('The request must include a media layout');
            }
            if (!this.internalMediaLayoutMap.has(request.mediaLayout)) {
                throw new Error('The media layout must be created using the client before it can be applied');
            }
        });
        return this.videoAssignmentChannelHandler.sendRequests(requests);
    }
    createMediaLayout(canvasDimensions) {
        const mediaEntryDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableDelegate(undefined);
        const mediaEntry = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_10__.SubscribableImpl(mediaEntryDelegate);
        const mediaLayout = { canvasDimensions, mediaEntry };
        this.internalMediaLayoutMap.set(mediaLayout, {
            id: this.mediaLayoutId,
            mediaEntry: mediaEntryDelegate,
        });
        this.idMediaLayoutMap.set(this.mediaLayoutId, mediaLayout);
        this.mediaLayoutId++;
        return mediaLayout;
    }
}


/***/ }),

/***/ "./sdk/internal/subscribable_impl.ts":
/*!*******************************************!*\
  !*** ./sdk/internal/subscribable_impl.ts ***!
  \*******************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SubscribableDelegate: () => (/* binding */ SubscribableDelegate),
/* harmony export */   SubscribableImpl: () => (/* binding */ SubscribableImpl)
/* harmony export */ });
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Implementation of the Subscribable interface.
 */
class SubscribableImpl {
    constructor(subscribableDelegate) {
        this.subscribableDelegate = subscribableDelegate;
    }
    get() {
        return this.subscribableDelegate.get();
    }
    subscribe(callback) {
        this.subscribableDelegate.subscribe(callback);
        return () => {
            this.subscribableDelegate.unsubscribe(callback);
        };
    }
    unsubscribe(callback) {
        return this.subscribableDelegate.unsubscribe(callback);
    }
}
/**
 * Helper class to update a subscribable value.
 */
class SubscribableDelegate {
    constructor(value) {
        this.value = value;
        this.subscribers = new Set();
        this.subscribable = new SubscribableImpl(this);
    }
    set(newValue) {
        if (this.value !== newValue) {
            this.value = newValue;
            for (const callback of this.subscribers) {
                callback(newValue);
            }
        }
    }
    get() {
        return this.value;
    }
    subscribe(callback) {
        this.subscribers.add(callback);
    }
    unsubscribe(callback) {
        return this.subscribers.delete(callback);
    }
    getSubscribable() {
        return this.subscribable;
    }
}


/***/ }),

/***/ "./sdk/internal/utils.ts":
/*!*******************************!*\
  !*** ./sdk/internal/utils.ts ***!
  \*******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createMediaEntry: () => (/* binding */ createMediaEntry)
/* harmony export */ });
/* harmony import */ var _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./subscribable_impl */ "./sdk/internal/subscribable_impl.ts");
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Creates a new media entry.
 * @return The new media entry and its internal representation.
 */
function createMediaEntry({ audioMuted = false, videoMuted = false, screenShare = false, isPresenter = false, participant, mediaLayout, videoMeetStreamTrack, audioMeetStreamTrack, audioCsrc, videoCsrc, videoSsrc, id, session = '', sessionName = '', }) {
    const participantDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(participant);
    const audioMutedDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(audioMuted);
    const videoMutedDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(videoMuted);
    const screenShareDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(screenShare);
    const isPresenterDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(isPresenter);
    const mediaLayoutDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(mediaLayout);
    const audioMeetStreamTrackDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(audioMeetStreamTrack);
    const videoMeetStreamTrackDelegate = new _subscribable_impl__WEBPACK_IMPORTED_MODULE_0__.SubscribableDelegate(videoMeetStreamTrack);
    const mediaEntry = {
        participant: participantDelegate.getSubscribable(),
        audioMuted: audioMutedDelegate.getSubscribable(),
        videoMuted: videoMutedDelegate.getSubscribable(),
        screenShare: screenShareDelegate.getSubscribable(),
        isPresenter: isPresenterDelegate.getSubscribable(),
        mediaLayout: mediaLayoutDelegate.getSubscribable(),
        audioMeetStreamTrack: audioMeetStreamTrackDelegate.getSubscribable(),
        videoMeetStreamTrack: videoMeetStreamTrackDelegate.getSubscribable(),
        sessionName,
        session,
    };
    const internalMediaEntry = {
        id,
        audioMuted: audioMutedDelegate,
        videoMuted: videoMutedDelegate,
        screenShare: screenShareDelegate,
        isPresenter: isPresenterDelegate,
        mediaLayout: mediaLayoutDelegate,
        audioMeetStreamTrack: audioMeetStreamTrackDelegate,
        videoMeetStreamTrack: videoMeetStreamTrackDelegate,
        participant: participantDelegate,
        videoSsrc,
        audioCsrc,
        videoCsrc,
    };
    return { mediaEntry, internalMediaEntry };
}


/***/ }),

/***/ "./sdk/types/enums.ts":
/*!****************************!*\
  !*** ./sdk/types/enums.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LogLevel: () => (/* binding */ LogLevel),
/* harmony export */   MeetConnectionState: () => (/* binding */ MeetConnectionState),
/* harmony export */   MeetDisconnectReason: () => (/* binding */ MeetDisconnectReason)
/* harmony export */ });
/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * @fileoverview Enums for the Media API Web Client. Since other files are
 * using the .d.ts file, we need to keep the enums in this file.
 */
/**
 * Log level for each data channel.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["UNKNOWN"] = 0] = "UNKNOWN";
    LogLevel[LogLevel["ERRORS"] = 1] = "ERRORS";
    LogLevel[LogLevel["RESOURCES"] = 2] = "RESOURCES";
    LogLevel[LogLevel["MESSAGES"] = 3] = "MESSAGES";
})(LogLevel || (LogLevel = {}));
/** Connection state of the Meet Media API session. */
var MeetConnectionState;
(function (MeetConnectionState) {
    MeetConnectionState[MeetConnectionState["UNKNOWN"] = 0] = "UNKNOWN";
    MeetConnectionState[MeetConnectionState["WAITING"] = 1] = "WAITING";
    MeetConnectionState[MeetConnectionState["JOINED"] = 2] = "JOINED";
    MeetConnectionState[MeetConnectionState["DISCONNECTED"] = 3] = "DISCONNECTED";
})(MeetConnectionState || (MeetConnectionState = {}));
/** Reasons for the Meet Media API session to disconnect. */
var MeetDisconnectReason;
(function (MeetDisconnectReason) {
    MeetDisconnectReason[MeetDisconnectReason["UNKNOWN"] = 0] = "UNKNOWN";
    MeetDisconnectReason[MeetDisconnectReason["CLIENT_LEFT"] = 1] = "CLIENT_LEFT";
    MeetDisconnectReason[MeetDisconnectReason["USER_STOPPED"] = 2] = "USER_STOPPED";
    MeetDisconnectReason[MeetDisconnectReason["CONFERENCE_ENDED"] = 3] = "CONFERENCE_ENDED";
    MeetDisconnectReason[MeetDisconnectReason["SESSION_UNHEALTHY"] = 4] = "SESSION_UNHEALTHY";
})(MeetDisconnectReason || (MeetDisconnectReason = {}));


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*****************************!*\
  !*** ./sdk/client-entry.ts ***!
  \*****************************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   MeetConnectionState: () => (/* reexport safe */ _types_enums__WEBPACK_IMPORTED_MODULE_1__.MeetConnectionState),
/* harmony export */   MeetMediaApiClientImpl: () => (/* reexport safe */ _internal_meetmediaapiclient_impl__WEBPACK_IMPORTED_MODULE_0__.MeetMediaApiClientImpl),
/* harmony export */   createClient: () => (/* binding */ createClient)
/* harmony export */ });
/* harmony import */ var _internal_meetmediaapiclient_impl__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./internal/meetmediaapiclient_impl */ "./sdk/internal/meetmediaapiclient_impl.ts");
/* harmony import */ var _types_enums__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./types/enums */ "./sdk/types/enums.ts");
/**
 * MGtranslate - Meet Media API Client Entry Point
 *
 * This file exports the Google Meet Media API SDK for browser use.
 * Built with webpack to create a bundled JS file.
 */


// Re-export main classes and types

function createClient(config) {
    return new _internal_meetmediaapiclient_impl__WEBPACK_IMPORTED_MODULE_0__.MeetMediaApiClientImpl({
        meetingSpaceId: config.meetingCode,
        numberOfVideoStreams: config.enableVideo ? 1 : 0,
        enableAudioStreams: true,
        accessToken: config.accessToken,
    });
}
// Expose to window for easy access from vanilla JS
if (typeof window !== 'undefined') {
    window.MeetMediaClient = {
        MeetMediaApiClientImpl: _internal_meetmediaapiclient_impl__WEBPACK_IMPORTED_MODULE_0__.MeetMediaApiClientImpl,
        MeetConnectionState: _types_enums__WEBPACK_IMPORTED_MODULE_1__.MeetConnectionState,
        createClient,
    };
}

})();

window.MeetMediaClient = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QUVELG1EQUFtRDtBQUNuRCxJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsRUFBRSxDQUFDO0lBQ2pDLE1BQWMsQ0FBQyxlQUFlLEdBQUc7UUFDaEMsc0JBQXNCO1FBQ3RCLG1CQUFtQjtRQUNuQixZQUFZO0tBQ2IsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvY2hhbm5lbF9oYW5kbGVycy9jaGFubmVsX2xvZ2dlci50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvY2hhbm5lbF9oYW5kbGVycy9tZWRpYV9lbnRyaWVzX2NoYW5uZWxfaGFuZGxlci50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvY2hhbm5lbF9oYW5kbGVycy9tZWRpYV9zdGF0c19jaGFubmVsX2hhbmRsZXIudHMiLCJ3ZWJwYWNrOi8vTWVldE1lZGlhQ2xpZW50Ly4vc2RrL2ludGVybmFsL2NoYW5uZWxfaGFuZGxlcnMvcGFydGljaXBhbnRzX2NoYW5uZWxfaGFuZGxlci50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvY2hhbm5lbF9oYW5kbGVycy9zZXNzaW9uX2NvbnRyb2xfY2hhbm5lbF9oYW5kbGVyLnRzIiwid2VicGFjazovL01lZXRNZWRpYUNsaWVudC8uL3Nkay9pbnRlcm5hbC9jaGFubmVsX2hhbmRsZXJzL3ZpZGVvX2Fzc2lnbm1lbnRfY2hhbm5lbF9oYW5kbGVyLnRzIiwid2VicGFjazovL01lZXRNZWRpYUNsaWVudC8uL3Nkay9pbnRlcm5hbC9jb21tdW5pY2F0aW9uX3Byb3RvY29scy9kZWZhdWx0X2NvbW11bmljYXRpb25fcHJvdG9jb2xfaW1wbC50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvaW50ZXJuYWxfbWVldF9zdHJlYW1fdHJhY2tfaW1wbC50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvbWVldF9zdHJlYW1fdHJhY2tfaW1wbC50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvaW50ZXJuYWwvbWVldG1lZGlhYXBpY2xpZW50X2ltcGwudHMiLCJ3ZWJwYWNrOi8vTWVldE1lZGlhQ2xpZW50Ly4vc2RrL2ludGVybmFsL3N1YnNjcmliYWJsZV9pbXBsLnRzIiwid2VicGFjazovL01lZXRNZWRpYUNsaWVudC8uL3Nkay9pbnRlcm5hbC91dGlscy50cyIsIndlYnBhY2s6Ly9NZWV0TWVkaWFDbGllbnQvLi9zZGsvdHlwZXMvZW51bXMudHMiLCJ3ZWJwYWNrOi8vTWVldE1lZGlhQ2xpZW50L3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL01lZXRNZWRpYUNsaWVudC93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vTWVldE1lZGlhQ2xpZW50L3dlYnBhY2svcnVudGltZS9oYXNPd25Qcm9wZXJ0eSBzaG9ydGhhbmQiLCJ3ZWJwYWNrOi8vTWVldE1lZGlhQ2xpZW50L3dlYnBhY2svcnVudGltZS9tYWtlIG5hbWVzcGFjZSBvYmplY3QiLCJ3ZWJwYWNrOi8vTWVldE1lZGlhQ2xpZW50Ly4vc2RrL2NsaWVudC1lbnRyeS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgQSBoZWxwZXIgY2xhc3MgdGhhdCBhbGxvd3MgdXNlciB0byBsb2dzIGV2ZW50cyB0byBhIHNwZWNpZmllZFxuICogZnVuY3Rpb24uXG4gKi9cblxuaW1wb3J0IHtcbiAgRGVsZXRlZFJlc291cmNlLFxuICBNZWRpYUFwaVJlcXVlc3QsXG4gIE1lZGlhQXBpUmVzcG9uc2UsXG4gIFJlc291cmNlU25hcHNob3QsXG59IGZyb20gJy4uLy4uL3R5cGVzL2RhdGFjaGFubmVscyc7XG5pbXBvcnQge0xvZ0xldmVsfSBmcm9tICcuLi8uLi90eXBlcy9lbnVtcyc7XG5pbXBvcnQge0xvZ0V2ZW50LCBMb2dTb3VyY2VUeXBlfSBmcm9tICcuLi8uLi90eXBlcy9tZWRpYXR5cGVzJztcblxuLyoqXG4gKiBIZWxwZXIgY2xhc3MgdGhhdCBoZWxwcyBsb2cgY2hhbm5lbCByZXNvdXJjZXMsIHVwZGF0ZXMgb3IgZXJyb3JzLlxuICovXG5leHBvcnQgY2xhc3MgQ2hhbm5lbExvZ2dlciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbG9nU291cmNlVHlwZTogTG9nU291cmNlVHlwZSxcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgcHJpdmF0ZSByZWFkb25seSBjYWxsYmFjayA9IChsb2dFdmVudDogTG9nRXZlbnQpID0+IHt9LFxuICApIHt9XG5cbiAgbG9nKFxuICAgIGxldmVsOiBMb2dMZXZlbCxcbiAgICBsb2dTdHJpbmc6IHN0cmluZyxcbiAgICByZWxldmFudE9iamVjdD86XG4gICAgICB8IEVycm9yXG4gICAgICB8IERlbGV0ZWRSZXNvdXJjZVxuICAgICAgfCBSZXNvdXJjZVNuYXBzaG90XG4gICAgICB8IE1lZGlhQXBpUmVzcG9uc2VcbiAgICAgIHwgTWVkaWFBcGlSZXF1ZXN0LFxuICApIHtcbiAgICB0aGlzLmNhbGxiYWNrKHtcbiAgICAgIHNvdXJjZVR5cGU6IHRoaXMubG9nU291cmNlVHlwZSxcbiAgICAgIGxldmVsLFxuICAgICAgbG9nU3RyaW5nLFxuICAgICAgcmVsZXZhbnRPYmplY3QsXG4gICAgfSk7XG4gIH1cbn1cbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAyNCBHb29nbGUgTExDXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbi8qKlxuICogQGZpbGVvdmVydmlldyBIYW5kbGVzIE1lZGlhIGVudHJpZXNcbiAqL1xuXG5pbXBvcnQge1xuICBEZWxldGVkTWVkaWFFbnRyeSxcbiAgTWVkaWFFbnRyaWVzQ2hhbm5lbFRvQ2xpZW50LFxuICBNZWRpYUVudHJ5UmVzb3VyY2UsXG59IGZyb20gJy4uLy4uL3R5cGVzL2RhdGFjaGFubmVscyc7XG5pbXBvcnQge0xvZ0xldmVsfSBmcm9tICcuLi8uLi90eXBlcy9lbnVtcyc7XG5pbXBvcnQge1xuICBNZWRpYUVudHJ5LFxuICBNZWRpYUxheW91dCxcbiAgTWVldFN0cmVhbVRyYWNrLFxuICBQYXJ0aWNpcGFudCxcbn0gZnJvbSAnLi4vLi4vdHlwZXMvbWVkaWF0eXBlcyc7XG5pbXBvcnQge1xuICBJbnRlcm5hbE1lZGlhRW50cnksXG4gIEludGVybmFsTWVkaWFMYXlvdXQsXG4gIEludGVybmFsTWVldFN0cmVhbVRyYWNrLFxuICBJbnRlcm5hbFBhcnRpY2lwYW50LFxufSBmcm9tICcuLi9pbnRlcm5hbF90eXBlcyc7XG5pbXBvcnQge1N1YnNjcmliYWJsZURlbGVnYXRlfSBmcm9tICcuLi9zdWJzY3JpYmFibGVfaW1wbCc7XG5pbXBvcnQge2NyZWF0ZU1lZGlhRW50cnl9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7Q2hhbm5lbExvZ2dlcn0gZnJvbSAnLi9jaGFubmVsX2xvZ2dlcic7XG5cbi8qKlxuICogSGVscGVyIGNsYXNzIHRvIGhhbmRsZSB0aGUgbWVkaWEgZW50cmllcyBjaGFubmVsLlxuICovXG5leHBvcnQgY2xhc3MgTWVkaWFFbnRyaWVzQ2hhbm5lbEhhbmRsZXIge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNoYW5uZWw6IFJUQ0RhdGFDaGFubmVsLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbWVkaWFFbnRyaWVzRGVsZWdhdGU6IFN1YnNjcmliYWJsZURlbGVnYXRlPE1lZGlhRW50cnlbXT4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBpZE1lZGlhRW50cnlNYXA6IE1hcDxudW1iZXIsIE1lZGlhRW50cnk+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgaW50ZXJuYWxNZWRpYUVudHJ5TWFwID0gbmV3IE1hcDxcbiAgICAgIE1lZGlhRW50cnksXG4gICAgICBJbnRlcm5hbE1lZGlhRW50cnlcbiAgICA+KCksXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbE1lZXRTdHJlYW1UcmFja01hcCA9IG5ldyBNYXA8XG4gICAgICBNZWV0U3RyZWFtVHJhY2ssXG4gICAgICBJbnRlcm5hbE1lZXRTdHJlYW1UcmFja1xuICAgID4oKSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGludGVybmFsTWVkaWFMYXlvdXRNYXAgPSBuZXcgTWFwPFxuICAgICAgTWVkaWFMYXlvdXQsXG4gICAgICBJbnRlcm5hbE1lZGlhTGF5b3V0XG4gICAgPigpLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcGFydGljaXBhbnRzRGVsZWdhdGU6IFN1YnNjcmliYWJsZURlbGVnYXRlPFBhcnRpY2lwYW50W10+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbmFtZVBhcnRpY2lwYW50TWFwOiBNYXA8c3RyaW5nLCBQYXJ0aWNpcGFudD4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBpZFBhcnRpY2lwYW50TWFwOiBNYXA8bnVtYmVyLCBQYXJ0aWNpcGFudD4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbFBhcnRpY2lwYW50TWFwOiBNYXA8XG4gICAgICBQYXJ0aWNpcGFudCxcbiAgICAgIEludGVybmFsUGFydGljaXBhbnRcbiAgICA+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgcHJlc2VudGVyRGVsZWdhdGU6IFN1YnNjcmliYWJsZURlbGVnYXRlPFxuICAgICAgTWVkaWFFbnRyeSB8IHVuZGVmaW5lZFxuICAgID4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBzY3JlZW5zaGFyZURlbGVnYXRlOiBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxcbiAgICAgIE1lZGlhRW50cnkgfCB1bmRlZmluZWRcbiAgICA+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2hhbm5lbExvZ2dlcj86IENoYW5uZWxMb2dnZXIsXG4gICkge1xuICAgIHRoaXMuY2hhbm5lbC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgIHRoaXMub25NZWRpYUVudHJpZXNNZXNzYWdlKGV2ZW50KTtcbiAgICB9O1xuICAgIHRoaXMuY2hhbm5lbC5vbm9wZW4gPSAoKSA9PiB7XG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAgICdNZWRpYSBlbnRyaWVzIGNoYW5uZWw6IG9wZW5lZCcsXG4gICAgICApO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAgICdNZWRpYSBlbnRyaWVzIGNoYW5uZWw6IGNsb3NlZCcsXG4gICAgICApO1xuICAgIH07XG4gIH1cblxuICBwcml2YXRlIG9uTWVkaWFFbnRyaWVzTWVzc2FnZShtZXNzYWdlOiBNZXNzYWdlRXZlbnQpIHtcbiAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShtZXNzYWdlLmRhdGEpIGFzIE1lZGlhRW50cmllc0NoYW5uZWxUb0NsaWVudDtcbiAgICBsZXQgbWVkaWFFbnRyeUFycmF5ID0gdGhpcy5tZWRpYUVudHJpZXNEZWxlZ2F0ZS5nZXQoKTtcblxuICAgIC8vIERlbGV0ZSBtZWRpYSBlbnRyaWVzLlxuICAgIGRhdGEuZGVsZXRlZFJlc291cmNlcz8uZm9yRWFjaCgoZGVsZXRlZFJlc291cmNlOiBEZWxldGVkTWVkaWFFbnRyeSkgPT4ge1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgIExvZ0xldmVsLlJFU09VUkNFUyxcbiAgICAgICAgJ01lZGlhIGVudHJpZXMgY2hhbm5lbDogcmVzb3VyY2UgZGVsZXRlZCcsXG4gICAgICAgIGRlbGV0ZWRSZXNvdXJjZSxcbiAgICAgICk7XG4gICAgICBjb25zdCBkZWxldGVkTWVkaWFFbnRyeSA9IHRoaXMuaWRNZWRpYUVudHJ5TWFwLmdldChkZWxldGVkUmVzb3VyY2UuaWQpO1xuICAgICAgaWYgKGRlbGV0ZWRNZWRpYUVudHJ5KSB7XG4gICAgICAgIG1lZGlhRW50cnlBcnJheSA9IG1lZGlhRW50cnlBcnJheS5maWx0ZXIoXG4gICAgICAgICAgKG1lZGlhRW50cnkpID0+IG1lZGlhRW50cnkgIT09IGRlbGV0ZWRNZWRpYUVudHJ5LFxuICAgICAgICApO1xuICAgICAgICAvLyBJZiB3ZSBmaW5kIHRoZSBtZWRpYSBlbnRyeSBpbiB0aGUgaWQgbWFwLCBpdCBzaG91bGQgZXhpc3QgaW4gdGhlXG4gICAgICAgIC8vIGludGVybmFsIG1hcC5cbiAgICAgICAgY29uc3QgaW50ZXJuYWxNZWRpYUVudHJ5ID1cbiAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5nZXQoZGVsZXRlZE1lZGlhRW50cnkpO1xuICAgICAgICAvLyBSZW1vdmUgcmVsYXRpb25zaGlwIGJldHdlZW4gbWVkaWEgZW50cnkgYW5kIG1lZGlhIGxheW91dC5cbiAgICAgICAgY29uc3QgbWVkaWFMYXlvdXQ6IE1lZGlhTGF5b3V0IHwgdW5kZWZpbmVkID1cbiAgICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLm1lZGlhTGF5b3V0LmdldCgpO1xuICAgICAgICBpZiAobWVkaWFMYXlvdXQpIHtcbiAgICAgICAgICBjb25zdCBpbnRlcm5hbE1lZGlhTGF5b3V0ID1cbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxNZWRpYUxheW91dE1hcC5nZXQobWVkaWFMYXlvdXQpO1xuICAgICAgICAgIGlmIChpbnRlcm5hbE1lZGlhTGF5b3V0KSB7XG4gICAgICAgICAgICBpbnRlcm5hbE1lZGlhTGF5b3V0Lm1lZGlhRW50cnkuc2V0KHVuZGVmaW5lZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIHJlbGF0aW9uc2hpcCBiZXR3ZWVuIG1lZGlhIGVudHJ5IGFuZCBtZWV0IHN0cmVhbSB0cmFja3MuXG4gICAgICAgIGNvbnN0IHZpZGVvTWVldFN0cmVhbVRyYWNrID1cbiAgICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLnZpZGVvTWVldFN0cmVhbVRyYWNrLmdldCgpO1xuICAgICAgICBpZiAodmlkZW9NZWV0U3RyZWFtVHJhY2spIHtcbiAgICAgICAgICBjb25zdCBpbnRlcm5hbFZpZGVvU3RyZWFtVHJhY2sgPVxuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbE1lZXRTdHJlYW1UcmFja01hcC5nZXQodmlkZW9NZWV0U3RyZWFtVHJhY2spO1xuICAgICAgICAgIGludGVybmFsVmlkZW9TdHJlYW1UcmFjayEubWVkaWFFbnRyeS5zZXQodW5kZWZpbmVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGF1ZGlvTWVldFN0cmVhbVRyYWNrID1cbiAgICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLmF1ZGlvTWVldFN0cmVhbVRyYWNrLmdldCgpO1xuICAgICAgICBpZiAoYXVkaW9NZWV0U3RyZWFtVHJhY2spIHtcbiAgICAgICAgICBjb25zdCBpbnRlcm5hbEF1ZGlvU3RyZWFtVHJhY2sgPVxuICAgICAgICAgICAgdGhpcy5pbnRlcm5hbE1lZXRTdHJlYW1UcmFja01hcC5nZXQoYXVkaW9NZWV0U3RyZWFtVHJhY2spO1xuICAgICAgICAgIGludGVybmFsQXVkaW9TdHJlYW1UcmFjayEubWVkaWFFbnRyeS5zZXQodW5kZWZpbmVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSByZWxhdGlvbnNoaXAgYmV0d2VlbiBtZWRpYSBlbnRyeSBhbmQgcGFydGljaXBhbnQuXG4gICAgICAgIGNvbnN0IHBhcnRpY2lwYW50ID0gaW50ZXJuYWxNZWRpYUVudHJ5IS5wYXJ0aWNpcGFudC5nZXQoKTtcbiAgICAgICAgaWYgKHBhcnRpY2lwYW50KSB7XG4gICAgICAgICAgY29uc3QgaW50ZXJuYWxQYXJ0aWNpcGFudCA9XG4gICAgICAgICAgICB0aGlzLmludGVybmFsUGFydGljaXBhbnRNYXAuZ2V0KHBhcnRpY2lwYW50KTtcbiAgICAgICAgICBjb25zdCBuZXdNZWRpYUVudHJpZXM6IE1lZGlhRW50cnlbXSA9XG4gICAgICAgICAgICBpbnRlcm5hbFBhcnRpY2lwYW50IS5tZWRpYUVudHJpZXNcbiAgICAgICAgICAgICAgLmdldCgpXG4gICAgICAgICAgICAgIC5maWx0ZXIoKG1lZGlhRW50cnkpID0+IG1lZGlhRW50cnkgIT09IGRlbGV0ZWRNZWRpYUVudHJ5KTtcbiAgICAgICAgICBpbnRlcm5hbFBhcnRpY2lwYW50IS5tZWRpYUVudHJpZXMuc2V0KG5ld01lZGlhRW50cmllcyk7XG4gICAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS5wYXJ0aWNpcGFudC5zZXQodW5kZWZpbmVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBmcm9tIG1hcHNcbiAgICAgICAgdGhpcy5pZE1lZGlhRW50cnlNYXAuZGVsZXRlKGRlbGV0ZWRSZXNvdXJjZS5pZCk7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwLmRlbGV0ZShkZWxldGVkTWVkaWFFbnRyeSk7XG5cbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuc2hhcmVEZWxlZ2F0ZS5nZXQoKSA9PT0gZGVsZXRlZE1lZGlhRW50cnkpIHtcbiAgICAgICAgICB0aGlzLnNjcmVlbnNoYXJlRGVsZWdhdGUuc2V0KHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMucHJlc2VudGVyRGVsZWdhdGUuZ2V0KCkgPT09IGRlbGV0ZWRNZWRpYUVudHJ5KSB7XG4gICAgICAgICAgdGhpcy5wcmVzZW50ZXJEZWxlZ2F0ZS5zZXQodW5kZWZpbmVkKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIG9yIGFkZCBtZWRpYSBlbnRyaWVzLlxuICAgIGNvbnN0IGFkZGVkTWVkaWFFbnRyaWVzOiBNZWRpYUVudHJ5W10gPSBbXTtcbiAgICBkYXRhLnJlc291cmNlcz8uZm9yRWFjaCgocmVzb3VyY2U6IE1lZGlhRW50cnlSZXNvdXJjZSkgPT4ge1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgIExvZ0xldmVsLlJFU09VUkNFUyxcbiAgICAgICAgJ01lZGlhIGVudHJpZXMgY2hhbm5lbDogcmVzb3VyY2UgYWRkZWQnLFxuICAgICAgICByZXNvdXJjZSxcbiAgICAgICk7XG5cbiAgICAgIGxldCBpbnRlcm5hbE1lZGlhRW50cnk6IEludGVybmFsTWVkaWFFbnRyeSB8IHVuZGVmaW5lZDtcbiAgICAgIGxldCBtZWRpYUVudHJ5OiBNZWRpYUVudHJ5IHwgdW5kZWZpbmVkO1xuICAgICAgbGV0IHZpZGVvQ3NyYyA9IDA7XG4gICAgICBpZiAoXG4gICAgICAgIHJlc291cmNlLm1lZGlhRW50cnkudmlkZW9Dc3JjcyAmJlxuICAgICAgICByZXNvdXJjZS5tZWRpYUVudHJ5LnZpZGVvQ3NyY3MubGVuZ3RoID4gMFxuICAgICAgKSB7XG4gICAgICAgIC8vIFdlIGV4cGVjdCB0aGVyZSB0byBvbmx5IGJlIG9uZSB2aWRlbyBDc3Jjcy4gVGhlcmUgaXMgcG9zc2liaWxpdHlcbiAgICAgICAgLy8gZm9yIHRoaXMgdG8gYmUgbW9yZSB0aGFuIHZhbHVlIGluIFdlYlJUQyBidXQgdW5saWtlbHkgaW4gTWVldC5cbiAgICAgICAgLy8gVE9ETyA6IEV4cGxvcmUgbWFraW5nIHZpZGVvIGNzcmNzIGZpZWxkIHNpbmdsdWFyLlxuICAgICAgICB2aWRlb0NzcmMgPSByZXNvdXJjZS5tZWRpYUVudHJ5LnZpZGVvQ3NyY3NbMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgICBMb2dMZXZlbC5FUlJPUlMsXG4gICAgICAgICAgJ01lZGlhIGVudHJpZXMgY2hhbm5lbDogbW9yZSB0aGFuIG9uZSB2aWRlbyBDc3JjIGluIG1lZGlhIGVudHJ5JyxcbiAgICAgICAgICByZXNvdXJjZSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuaWRNZWRpYUVudHJ5TWFwLmhhcyhyZXNvdXJjZS5pZCEpKSB7XG4gICAgICAgIC8vIFVwZGF0ZSBtZWRpYSBlbnRyeSBpZiBpdCBhbHJlYWR5IGV4aXN0cy5cbiAgICAgICAgbWVkaWFFbnRyeSA9IHRoaXMuaWRNZWRpYUVudHJ5TWFwLmdldChyZXNvdXJjZS5pZCEpO1xuICAgICAgICBtZWRpYUVudHJ5IS5zZXNzaW9uTmFtZSA9IHJlc291cmNlLm1lZGlhRW50cnkuc2Vzc2lvbk5hbWU7XG4gICAgICAgIG1lZGlhRW50cnkhLnNlc3Npb24gPSByZXNvdXJjZS5tZWRpYUVudHJ5LnNlc3Npb247XG4gICAgICAgIGludGVybmFsTWVkaWFFbnRyeSA9IHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwLmdldChtZWRpYUVudHJ5ISk7XG4gICAgICAgIGludGVybmFsTWVkaWFFbnRyeSEuYXVkaW9NdXRlZC5zZXQocmVzb3VyY2UubWVkaWFFbnRyeS5hdWRpb011dGVkKTtcbiAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS52aWRlb011dGVkLnNldChyZXNvdXJjZS5tZWRpYUVudHJ5LnZpZGVvTXV0ZWQpO1xuICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLnNjcmVlblNoYXJlLnNldChyZXNvdXJjZS5tZWRpYUVudHJ5LnNjcmVlbnNoYXJlKTtcbiAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS5pc1ByZXNlbnRlci5zZXQocmVzb3VyY2UubWVkaWFFbnRyeS5wcmVzZW50ZXIpO1xuICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLmF1ZGlvQ3NyYyA9IHJlc291cmNlLm1lZGlhRW50cnkuYXVkaW9Dc3JjO1xuICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLnZpZGVvQ3NyYyA9IHZpZGVvQ3NyYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENyZWF0ZSBuZXcgbWVkaWEgZW50cnkgaWYgaXQgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIGNvbnN0IG1lZGlhRW50cnlFbGVtZW50ID0gY3JlYXRlTWVkaWFFbnRyeSh7XG4gICAgICAgICAgYXVkaW9NdXRlZDogcmVzb3VyY2UubWVkaWFFbnRyeS5hdWRpb011dGVkLFxuICAgICAgICAgIHZpZGVvTXV0ZWQ6IHJlc291cmNlLm1lZGlhRW50cnkudmlkZW9NdXRlZCxcbiAgICAgICAgICBzY3JlZW5TaGFyZTogcmVzb3VyY2UubWVkaWFFbnRyeS5zY3JlZW5zaGFyZSxcbiAgICAgICAgICBpc1ByZXNlbnRlcjogcmVzb3VyY2UubWVkaWFFbnRyeS5wcmVzZW50ZXIsXG4gICAgICAgICAgaWQ6IHJlc291cmNlLmlkISxcbiAgICAgICAgICBhdWRpb0NzcmM6IHJlc291cmNlLm1lZGlhRW50cnkuYXVkaW9Dc3JjLFxuICAgICAgICAgIHZpZGVvQ3NyYyxcbiAgICAgICAgICBzZXNzaW9uTmFtZTogcmVzb3VyY2UubWVkaWFFbnRyeS5zZXNzaW9uTmFtZSxcbiAgICAgICAgICBzZXNzaW9uOiByZXNvdXJjZS5tZWRpYUVudHJ5LnNlc3Npb24sXG4gICAgICAgIH0pO1xuICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkgPSBtZWRpYUVudHJ5RWxlbWVudC5pbnRlcm5hbE1lZGlhRW50cnk7XG4gICAgICAgIG1lZGlhRW50cnkgPSBtZWRpYUVudHJ5RWxlbWVudC5tZWRpYUVudHJ5O1xuICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5zZXQobWVkaWFFbnRyeSwgaW50ZXJuYWxNZWRpYUVudHJ5KTtcbiAgICAgICAgdGhpcy5pZE1lZGlhRW50cnlNYXAuc2V0KGludGVybmFsTWVkaWFFbnRyeS5pZCwgbWVkaWFFbnRyeSk7XG4gICAgICAgIGFkZGVkTWVkaWFFbnRyaWVzLnB1c2gobWVkaWFFbnRyeSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFzc2lnbiBtZWV0IHN0cmVhbXMgdG8gbWVkaWEgZW50cnkgaWYgdGhleSBhcmUgbm90IGFscmVhZHkgYXNzaWduZWRcbiAgICAgIC8vIGNvcnJlY3RseS5cbiAgICAgIGlmIChcbiAgICAgICAgIW1lZGlhRW50cnkhLmF1ZGlvTXV0ZWQuZ2V0KCkgJiZcbiAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS5hdWRpb0NzcmMgJiZcbiAgICAgICAgIXRoaXMuaXNNZWRpYUVudHJ5QXNzaWduZWRUb01lZXRTdHJlYW1UcmFjayhpbnRlcm5hbE1lZGlhRW50cnkhKVxuICAgICAgKSB7XG4gICAgICAgIHRoaXMuYXNzaWduQXVkaW9NZWV0U3RyZWFtVHJhY2sobWVkaWFFbnRyeSEsIGludGVybmFsTWVkaWFFbnRyeSEpO1xuICAgICAgfVxuXG4gICAgICAvLyBBc3NpZ24gcGFydGljaXBhbnQgdG8gbWVkaWEgZW50cnlcbiAgICAgIGxldCBleGlzdGluZ1BhcnRpY2lwYW50OiBQYXJ0aWNpcGFudCB8IHVuZGVmaW5lZDtcbiAgICAgIGlmIChyZXNvdXJjZS5tZWRpYUVudHJ5LnBhcnRpY2lwYW50KSB7XG4gICAgICAgIGV4aXN0aW5nUGFydGljaXBhbnQgPSB0aGlzLm5hbWVQYXJ0aWNpcGFudE1hcC5nZXQoXG4gICAgICAgICAgcmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudCxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAocmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudEtleSkge1xuICAgICAgICBleGlzdGluZ1BhcnRpY2lwYW50ID0gQXJyYXkuZnJvbShcbiAgICAgICAgICB0aGlzLmludGVybmFsUGFydGljaXBhbnRNYXAuZW50cmllcygpLFxuICAgICAgICApLmZpbmQoXG4gICAgICAgICAgKFtwYXJ0aWNpcGFudCwgX10pID0+XG4gICAgICAgICAgICBwYXJ0aWNpcGFudC5wYXJ0aWNpcGFudC5wYXJ0aWNpcGFudEtleSA9PT1cbiAgICAgICAgICAgIHJlc291cmNlLm1lZGlhRW50cnkucGFydGljaXBhbnRLZXksXG4gICAgICAgICk/LlswXTtcbiAgICAgIH1cblxuICAgICAgaWYgKGV4aXN0aW5nUGFydGljaXBhbnQpIHtcbiAgICAgICAgY29uc3QgaW50ZXJuYWxQYXJ0aWNpcGFudCA9XG4gICAgICAgICAgdGhpcy5pbnRlcm5hbFBhcnRpY2lwYW50TWFwLmdldChleGlzdGluZ1BhcnRpY2lwYW50KTtcbiAgICAgICAgaWYgKGludGVybmFsUGFydGljaXBhbnQpIHtcbiAgICAgICAgICBjb25zdCBuZXdNZWRpYUVudHJpZXM6IE1lZGlhRW50cnlbXSA9IFtcbiAgICAgICAgICAgIC4uLmludGVybmFsUGFydGljaXBhbnQubWVkaWFFbnRyaWVzLmdldCgpLFxuICAgICAgICAgICAgbWVkaWFFbnRyeSEsXG4gICAgICAgICAgXTtcbiAgICAgICAgICBpbnRlcm5hbFBhcnRpY2lwYW50Lm1lZGlhRW50cmllcy5zZXQobmV3TWVkaWFFbnRyaWVzKTtcbiAgICAgICAgfVxuICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkhLnBhcnRpY2lwYW50LnNldChleGlzdGluZ1BhcnRpY2lwYW50KTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHJlc291cmNlLm1lZGlhRW50cnkucGFydGljaXBhbnQgfHxcbiAgICAgICAgcmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudEtleVxuICAgICAgKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgdW5leHBlY3RlZCBiZWhhdmlvciwgYnV0IHRlY2huaWNhbGx5IHBvc3NpYmxlLiBXZSBleHBlY3RcbiAgICAgICAgLy8gdGhhdCB0aGUgcGFydGljaXBhbnRzIGFyZSByZWNlaXZlZCBmcm9tIHRoZSBwYXJ0aWNpcGFudHMgY2hhbm5lbFxuICAgICAgICAvLyBiZWZvcmUgdGhlIG1lZGlhIGVudHJpZXMgY2hhbm5lbCBidXQgdGhpcyBpcyBub3QgZ3VhcmFudGVlZC5cbiAgICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgICAgTG9nTGV2ZWwuUkVTT1VSQ0VTLFxuICAgICAgICAgICdNZWRpYSBlbnRyaWVzIGNoYW5uZWw6IHBhcnRpY2lwYW50IG5vdCBmb3VuZCBpbiBuYW1lIHBhcnRpY2lwYW50IG1hcCcgK1xuICAgICAgICAgICAgJyBjcmVhdGluZyBwYXJ0aWNpcGFudCcsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHN1YnNjcmliYWJsZURlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPE1lZGlhRW50cnlbXT4oW1xuICAgICAgICAgIG1lZGlhRW50cnkhLFxuICAgICAgICBdKTtcbiAgICAgICAgY29uc3QgbmV3UGFydGljaXBhbnQ6IFBhcnRpY2lwYW50ID0ge1xuICAgICAgICAgIHBhcnRpY2lwYW50OiB7XG4gICAgICAgICAgICBuYW1lOiByZXNvdXJjZS5tZWRpYUVudHJ5LnBhcnRpY2lwYW50LFxuICAgICAgICAgICAgYW5vbnltb3VzVXNlcjoge30sXG4gICAgICAgICAgICBwYXJ0aWNpcGFudEtleTogcmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudEtleSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIG1lZGlhRW50cmllczogc3Vic2NyaWJhYmxlRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgICAgIH07XG4gICAgICAgIC8vIFRPRE86IFVzZSBwYXJ0aWNpcGFudCByZXNvdXJjZSBuYW1lIGluc3RlYWQgb2YgaWQuXG4gICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpkZXByZWNhdGlvblxuICAgICAgICBjb25zdCBpZHM6IFNldDxudW1iZXI+ID0gcmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudElkXG4gICAgICAgICAgPyAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6ZGVwcmVjYXRpb25cbiAgICAgICAgICAgIG5ldyBTZXQoW3Jlc291cmNlLm1lZGlhRW50cnkucGFydGljaXBhbnRJZF0pXG4gICAgICAgICAgOiBuZXcgU2V0KCk7XG4gICAgICAgIGNvbnN0IGludGVybmFsUGFydGljaXBhbnQ6IEludGVybmFsUGFydGljaXBhbnQgPSB7XG4gICAgICAgICAgbmFtZTogcmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudCA/PyAnJyxcbiAgICAgICAgICBpZHMsXG4gICAgICAgICAgbWVkaWFFbnRyaWVzOiBzdWJzY3JpYmFibGVEZWxlZ2F0ZSxcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHJlc291cmNlLm1lZGlhRW50cnkucGFydGljaXBhbnQpIHtcbiAgICAgICAgICB0aGlzLm5hbWVQYXJ0aWNpcGFudE1hcC5zZXQoXG4gICAgICAgICAgICByZXNvdXJjZS5tZWRpYUVudHJ5LnBhcnRpY2lwYW50LFxuICAgICAgICAgICAgbmV3UGFydGljaXBhbnQsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmludGVybmFsUGFydGljaXBhbnRNYXAuc2V0KG5ld1BhcnRpY2lwYW50LCBpbnRlcm5hbFBhcnRpY2lwYW50KTtcbiAgICAgICAgLy8gVE9ETzogVXNlIHBhcnRpY2lwYW50IHJlc291cmNlIG5hbWUgaW5zdGVhZCBvZiBpZC5cbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOmRlcHJlY2F0aW9uXG4gICAgICAgIGlmIChyZXNvdXJjZS5tZWRpYUVudHJ5LnBhcnRpY2lwYW50SWQpIHtcbiAgICAgICAgICB0aGlzLmlkUGFydGljaXBhbnRNYXAuc2V0KFxuICAgICAgICAgICAgLy8gVE9ETzogVXNlIHBhcnRpY2lwYW50IHJlc291cmNlIG5hbWUgaW5zdGVhZCBvZiBpZC5cbiAgICAgICAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpkZXByZWNhdGlvblxuICAgICAgICAgICAgcmVzb3VyY2UubWVkaWFFbnRyeS5wYXJ0aWNpcGFudElkLFxuICAgICAgICAgICAgbmV3UGFydGljaXBhbnQsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJ0aWNpcGFudEFycmF5ID0gdGhpcy5wYXJ0aWNpcGFudHNEZWxlZ2F0ZS5nZXQoKTtcbiAgICAgICAgdGhpcy5wYXJ0aWNpcGFudHNEZWxlZ2F0ZS5zZXQoWy4uLnBhcnRpY2lwYW50QXJyYXksIG5ld1BhcnRpY2lwYW50XSk7XG4gICAgICAgIGludGVybmFsTWVkaWFFbnRyeSEucGFydGljaXBhbnQuc2V0KG5ld1BhcnRpY2lwYW50KTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNvdXJjZS5tZWRpYUVudHJ5LnByZXNlbnRlcikge1xuICAgICAgICB0aGlzLnByZXNlbnRlckRlbGVnYXRlLnNldChtZWRpYUVudHJ5KTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICFyZXNvdXJjZS5tZWRpYUVudHJ5LnByZXNlbnRlciAmJlxuICAgICAgICB0aGlzLnByZXNlbnRlckRlbGVnYXRlLmdldCgpID09PSBtZWRpYUVudHJ5XG4gICAgICApIHtcbiAgICAgICAgdGhpcy5wcmVzZW50ZXJEZWxlZ2F0ZS5zZXQodW5kZWZpbmVkKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNvdXJjZS5tZWRpYUVudHJ5LnNjcmVlbnNoYXJlKSB7XG4gICAgICAgIHRoaXMuc2NyZWVuc2hhcmVEZWxlZ2F0ZS5zZXQobWVkaWFFbnRyeSk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAhcmVzb3VyY2UubWVkaWFFbnRyeS5zY3JlZW5zaGFyZSAmJlxuICAgICAgICB0aGlzLnNjcmVlbnNoYXJlRGVsZWdhdGUuZ2V0KCkgPT09IG1lZGlhRW50cnlcbiAgICAgICkge1xuICAgICAgICB0aGlzLnNjcmVlbnNoYXJlRGVsZWdhdGUuc2V0KHVuZGVmaW5lZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBVcGRhdGUgbWVkaWEgZW50cnkgY29sbGVjdGlvbi5cbiAgICBpZiAoXG4gICAgICAoZGF0YS5yZXNvdXJjZXMgJiYgZGF0YS5yZXNvdXJjZXMubGVuZ3RoID4gMCkgfHxcbiAgICAgIChkYXRhLmRlbGV0ZWRSZXNvdXJjZXMgJiYgZGF0YS5kZWxldGVkUmVzb3VyY2VzLmxlbmd0aCA+IDApXG4gICAgKSB7XG4gICAgICBjb25zdCBuZXdNZWRpYUVudHJ5QXJyYXkgPSBbLi4ubWVkaWFFbnRyeUFycmF5LCAuLi5hZGRlZE1lZGlhRW50cmllc107XG4gICAgICB0aGlzLm1lZGlhRW50cmllc0RlbGVnYXRlLnNldChuZXdNZWRpYUVudHJ5QXJyYXkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgaXNNZWRpYUVudHJ5QXNzaWduZWRUb01lZXRTdHJlYW1UcmFjayhcbiAgICBpbnRlcm5hbE1lZGlhRW50cnk6IEludGVybmFsTWVkaWFFbnRyeSxcbiAgKTogYm9vbGVhbiB7XG4gICAgY29uc3QgYXVkaW9TdHJlYW1UcmFjayA9IGludGVybmFsTWVkaWFFbnRyeS5hdWRpb01lZXRTdHJlYW1UcmFjay5nZXQoKTtcbiAgICBpZiAoIWF1ZGlvU3RyZWFtVHJhY2spIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBpbnRlcm5hbEF1ZGlvTWVldFN0cmVhbVRyYWNrID1cbiAgICAgIHRoaXMuaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2tNYXAuZ2V0KGF1ZGlvU3RyZWFtVHJhY2spO1xuICAgIC8vIFRoaXMgaXMgbm90IGV4cGVjdGVkLiBNYXAgc2hvdWxkIGJlIGNvbXByZWhlbnNpdmUgb2YgYWxsIG1lZXQgc3RyZWFtXG4gICAgLy8gdHJhY2tzLlxuICAgIGlmICghaW50ZXJuYWxBdWRpb01lZXRTdHJlYW1UcmFjaykgcmV0dXJuIGZhbHNlO1xuICAgIC8vIFRoZSBBdWRpbyBDUlNDcyBjaGFuZ2VkIGFuZCB0aGVyZWZvcmUgbmVlZCB0byBiZSBjaGVja2VkIGlmIHRoZSBjdXJyZW50XG4gICAgLy8gYXVkaW8gY3NyYyBpcyBpbiB0aGUgY29udHJpYnV0aW5nIHNvdXJjZXMuXG4gICAgY29uc3QgY29udHJpYnV0aW5nU291cmNlczogUlRDUnRwQ29udHJpYnV0aW5nU291cmNlW10gPVxuICAgICAgaW50ZXJuYWxBdWRpb01lZXRTdHJlYW1UcmFjay5yZWNlaXZlci5nZXRDb250cmlidXRpbmdTb3VyY2VzKCk7XG5cbiAgICBmb3IgKGNvbnN0IGNvbnRyaWJ1dGluZ1NvdXJjZSBvZiBjb250cmlidXRpbmdTb3VyY2VzKSB7XG4gICAgICBpZiAoY29udHJpYnV0aW5nU291cmNlLnNvdXJjZSA9PT0gaW50ZXJuYWxNZWRpYUVudHJ5LmF1ZGlvQ3NyYykge1xuICAgICAgICAvLyBBdWRpbyBDc3JjIGZvdW5kIGluIGNvbnRyaWJ1dGluZyBzb3VyY2VzLlxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gQXVkaW8gQ3NyYyBub3QgZm91bmQgaW4gY29udHJpYnV0aW5nIHNvdXJjZXMsIHVuYXNzaWduIGF1ZGlvIG1lZXQgc3RyZWFtXG4gICAgLy8gdHJhY2suXG4gICAgaW50ZXJuYWxNZWRpYUVudHJ5LmF1ZGlvTWVldFN0cmVhbVRyYWNrLnNldCh1bmRlZmluZWQpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgYXNzaWduQXVkaW9NZWV0U3RyZWFtVHJhY2soXG4gICAgbWVkaWFFbnRyeTogTWVkaWFFbnRyeSxcbiAgICBpbnRlcm5hbE1lZGlhRW50cnk6IEludGVybmFsTWVkaWFFbnRyeSxcbiAgKSB7XG4gICAgZm9yIChjb25zdCBbXG4gICAgICBtZWV0U3RyZWFtVHJhY2ssXG4gICAgICBpbnRlcm5hbE1lZXRTdHJlYW1UcmFjayxcbiAgICBdIG9mIHRoaXMuaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2tNYXAuZW50cmllcygpKSB7XG4gICAgICAvLyBPbmx5IGF1ZGlvIHRyYWNrcyBhcmUgYXNzaWduZWQgaGVyZS5cbiAgICAgIGlmIChtZWV0U3RyZWFtVHJhY2subWVkaWFTdHJlYW1UcmFjay5raW5kICE9PSAnYXVkaW8nKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2sucmVjZWl2ZXI7XG4gICAgICBjb25zdCBjb250cmlidXRpbmdTb3VyY2VzOiBSVENSdHBDb250cmlidXRpbmdTb3VyY2VbXSA9XG4gICAgICAgIHJlY2VpdmVyLmdldENvbnRyaWJ1dGluZ1NvdXJjZXMoKTtcbiAgICAgIGZvciAoY29uc3QgY29udHJpYnV0aW5nU291cmNlIG9mIGNvbnRyaWJ1dGluZ1NvdXJjZXMpIHtcbiAgICAgICAgaWYgKGNvbnRyaWJ1dGluZ1NvdXJjZS5zb3VyY2UgPT09IGludGVybmFsTWVkaWFFbnRyeS5hdWRpb0NzcmMpIHtcbiAgICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkuYXVkaW9NZWV0U3RyZWFtVHJhY2suc2V0KG1lZXRTdHJlYW1UcmFjayk7XG4gICAgICAgICAgaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2subWVkaWFFbnRyeS5zZXQobWVkaWFFbnRyeSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBJZiBBdWRpbyBDc3JjIGlzIG5vdCBmb3VuZCBpbiBjb250cmlidXRpbmcgc291cmNlcywgZmFsbCBiYWNrIHRvXG4gICAgICAvLyBwb2xsaW5nIGZyYW1lcyBmb3IgYXNzaWdubWVudC5cbiAgICAgIGludGVybmFsTWVldFN0cmVhbVRyYWNrLm1heWJlQXNzaWduTWVkaWFFbnRyeU9uRnJhbWUobWVkaWFFbnRyeSwgJ2F1ZGlvJyk7XG4gICAgfVxuICB9XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgQSBjbGFzcyB0byBoYW5kbGUgdGhlIG1lZGlhIHN0YXRzIGNoYW5uZWwuXG4gKi9cblxuaW1wb3J0IHtcbiAgTWVkaWFBcGlSZXNwb25zZVN0YXR1cyxcbiAgTWVkaWFTdGF0c0NoYW5uZWxGcm9tQ2xpZW50LFxuICBNZWRpYVN0YXRzQ2hhbm5lbFRvQ2xpZW50LFxuICBNZWRpYVN0YXRzUmVzb3VyY2UsXG4gIFN0YXRzU2VjdGlvbkRhdGEsXG4gIFVwbG9hZE1lZGlhU3RhdHNSZXF1ZXN0LFxuICBVcGxvYWRNZWRpYVN0YXRzUmVzcG9uc2UsXG59IGZyb20gJy4uLy4uL3R5cGVzL2RhdGFjaGFubmVscyc7XG5pbXBvcnQge0xvZ0xldmVsfSBmcm9tICcuLi8uLi90eXBlcy9lbnVtcyc7XG5pbXBvcnQge0NoYW5uZWxMb2dnZXJ9IGZyb20gJy4vY2hhbm5lbF9sb2dnZXInO1xuXG50eXBlIFN1cHBvcnRlZE1lZGlhU3RhdHNUeXBlcyA9XG4gIHwgJ2NvZGVjJ1xuICB8ICdjYW5kaWRhdGUtcGFpcidcbiAgfCAnbWVkaWEtcGxheW91dCdcbiAgfCAndHJhbnNwb3J0J1xuICB8ICdsb2NhbC1jYW5kaWRhdGUnXG4gIHwgJ3JlbW90ZS1jYW5kaWRhdGUnXG4gIHwgJ2luYm91bmQtcnRwJztcblxuY29uc3QgU1RBVFNfVFlQRV9DT05WRVJURVI6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge1xuICAnY29kZWMnOiAnY29kZWMnLFxuICAnY2FuZGlkYXRlLXBhaXInOiAnY2FuZGlkYXRlX3BhaXInLFxuICAnbWVkaWEtcGxheW91dCc6ICdtZWRpYV9wbGF5b3V0JyxcbiAgJ3RyYW5zcG9ydCc6ICd0cmFuc3BvcnQnLFxuICAnbG9jYWwtY2FuZGlkYXRlJzogJ2xvY2FsX2NhbmRpZGF0ZScsXG4gICdyZW1vdGUtY2FuZGlkYXRlJzogJ3JlbW90ZV9jYW5kaWRhdGUnLFxuICAnaW5ib3VuZC1ydHAnOiAnaW5ib3VuZF9ydHAnLFxufTtcblxuLyoqXG4gKiBIZWxwZXIgY2xhc3MgdG8gaGFuZGxlIHRoZSBtZWRpYSBzdGF0cyBjaGFubmVsLiBUaGlzIGNsYXNzIGlzIHJlc3BvbnNpYmxlXG4gKiBmb3Igc2VuZGluZyBtZWRpYSBzdGF0cyB0byB0aGUgYmFja2VuZCBhbmQgcmVjZWl2aW5nIGNvbmZpZ3VyYXRpb24gdXBkYXRlc1xuICogZnJvbSB0aGUgYmFja2VuZC4gRm9yIHJlYWx0aW1lIG1ldHJpY3Mgd2hlbiBkZWJ1Z2dpbmcgbWFudWFsbHksIHVzZVxuICogY2hyb21lOi8vd2VicnRjLWludGVybmFscy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1lZGlhU3RhdHNDaGFubmVsSGFuZGxlciB7XG4gIC8qKlxuICAgKiBBIG1hcCBvZiBhbGxvd2xpc3RlZCBzZWN0aW9ucy4gVGhlIGtleSBpcyB0aGUgc2VjdGlvbiB0eXBlLCBhbmQgdGhlIHZhbHVlXG4gICAqIGlzIHRoZSBrZXlzIHRoYXQgYXJlIGFsbG93bGlzdGVkIGZvciB0aGF0IHNlY3Rpb24uXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IGFsbG93bGlzdCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmdbXT4oKTtcbiAgcHJpdmF0ZSByZXF1ZXN0SWQgPSAxO1xuICBwcml2YXRlIHJlYWRvbmx5IHBlbmRpbmdSZXF1ZXN0UmVzb2x2ZU1hcCA9IG5ldyBNYXA8XG4gICAgbnVtYmVyLFxuICAgICh2YWx1ZTogTWVkaWFBcGlSZXNwb25zZVN0YXR1cykgPT4gdm9pZFxuICA+KCk7XG4gIC8qKiBJZCBmb3IgdGhlIGludGVydmFsIHRvIHNlbmQgbWVkaWEgc3RhdHMuICovXG4gIHByaXZhdGUgaW50ZXJ2YWxJZCA9IDA7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBjaGFubmVsOiBSVENEYXRhQ2hhbm5lbCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHBlZXJDb25uZWN0aW9uOiBSVENQZWVyQ29ubmVjdGlvbixcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNoYW5uZWxMb2dnZXI/OiBDaGFubmVsTG9nZ2VyLFxuICApIHtcbiAgICB0aGlzLmNoYW5uZWwub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICB0aGlzLm9uTWVkaWFTdGF0c01lc3NhZ2UoZXZlbnQpO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWxJZCk7XG4gICAgICB0aGlzLmludGVydmFsSWQgPSAwO1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coTG9nTGV2ZWwuTUVTU0FHRVMsICdNZWRpYSBzdGF0cyBjaGFubmVsOiBjbG9zZWQnKTtcbiAgICAgIC8vIFJlc29sdmUgYWxsIHBlbmRpbmcgcmVxdWVzdHMgd2l0aCBhbiBlcnJvci5cbiAgICAgIGZvciAoY29uc3QgWywgcmVzb2x2ZV0gb2YgdGhpcy5wZW5kaW5nUmVxdWVzdFJlc29sdmVNYXApIHtcbiAgICAgICAgcmVzb2x2ZSh7Y29kZTogNDAwLCBtZXNzYWdlOiAnQ2hhbm5lbCBjbG9zZWQnLCBkZXRhaWxzOiBbXX0pO1xuICAgICAgfVxuICAgICAgdGhpcy5wZW5kaW5nUmVxdWVzdFJlc29sdmVNYXAuY2xlYXIoKTtcbiAgICB9O1xuICAgIHRoaXMuY2hhbm5lbC5vbm9wZW4gPSAoKSA9PiB7XG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhMb2dMZXZlbC5NRVNTQUdFUywgJ01lZGlhIHN0YXRzIGNoYW5uZWw6IG9wZW5lZCcpO1xuICAgIH07XG4gIH1cblxuICBwcml2YXRlIG9uTWVkaWFTdGF0c01lc3NhZ2UobWVzc2FnZTogTWVzc2FnZUV2ZW50KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UobWVzc2FnZS5kYXRhKSBhcyBNZWRpYVN0YXRzQ2hhbm5lbFRvQ2xpZW50O1xuICAgIGlmIChkYXRhLnJlc3BvbnNlKSB7XG4gICAgICB0aGlzLm9uTWVkaWFTdGF0c1Jlc3BvbnNlKGRhdGEucmVzcG9uc2UpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5yZXNvdXJjZXMpIHtcbiAgICAgIHRoaXMub25NZWRpYVN0YXRzUmVzb3VyY2VzKGRhdGEucmVzb3VyY2VzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9uTWVkaWFTdGF0c1Jlc3BvbnNlKHJlc3BvbnNlOiBVcGxvYWRNZWRpYVN0YXRzUmVzcG9uc2UpIHtcbiAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgIExvZ0xldmVsLk1FU1NBR0VTLFxuICAgICAgJ01lZGlhIHN0YXRzIGNoYW5uZWw6IHJlc3BvbnNlIHJlY2VpdmVkJyxcbiAgICAgIHJlc3BvbnNlLFxuICAgICk7XG4gICAgY29uc3QgcmVzb2x2ZSA9IHRoaXMucGVuZGluZ1JlcXVlc3RSZXNvbHZlTWFwLmdldChyZXNwb25zZS5yZXF1ZXN0SWQpO1xuICAgIGlmIChyZXNvbHZlKSB7XG4gICAgICByZXNvbHZlKHJlc3BvbnNlLnN0YXR1cyk7XG4gICAgICB0aGlzLnBlbmRpbmdSZXF1ZXN0UmVzb2x2ZU1hcC5kZWxldGUocmVzcG9uc2UucmVxdWVzdElkKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9uTWVkaWFTdGF0c1Jlc291cmNlcyhyZXNvdXJjZXM6IE1lZGlhU3RhdHNSZXNvdXJjZVtdKSB7XG4gICAgLy8gV2UgZXhwZWN0IG9ubHkgb25lIHJlc291cmNlIHRvIGJlIHNlbnQuXG4gICAgaWYgKHJlc291cmNlcy5sZW5ndGggPiAxKSB7XG4gICAgICByZXNvdXJjZXMuZm9yRWFjaCgocmVzb3VyY2UpID0+IHtcbiAgICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgICAgTG9nTGV2ZWwuRVJST1JTLFxuICAgICAgICAgICdNZWRpYSBzdGF0cyBjaGFubmVsOiBtb3JlIHRoYW4gb25lIHJlc291cmNlIHJlY2VpdmVkJyxcbiAgICAgICAgICByZXNvdXJjZSxcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCByZXNvdXJjZSA9IHJlc291cmNlc1swXTtcbiAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgIExvZ0xldmVsLk1FU1NBR0VTLFxuICAgICAgJ01lZGlhIHN0YXRzIGNoYW5uZWw6IHJlc291cmNlIHJlY2VpdmVkJyxcbiAgICAgIHJlc291cmNlLFxuICAgICk7XG4gICAgaWYgKHJlc291cmNlLmNvbmZpZ3VyYXRpb24pIHtcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKFxuICAgICAgICByZXNvdXJjZS5jb25maWd1cmF0aW9uLmFsbG93bGlzdCxcbiAgICAgICkpIHtcbiAgICAgICAgdGhpcy5hbGxvd2xpc3Quc2V0KGtleSwgdmFsdWUua2V5cyk7XG4gICAgICB9XG4gICAgICAvLyBXZSB3YW50IHRvIHN0b3AgdGhlIGludGVydmFsIGlmIHRoZSB1cGxvYWQgaW50ZXJ2YWwgaXMgemVyb1xuICAgICAgaWYgKFxuICAgICAgICB0aGlzLmludGVydmFsSWQgJiZcbiAgICAgICAgcmVzb3VyY2UuY29uZmlndXJhdGlvbi51cGxvYWRJbnRlcnZhbFNlY29uZHMgPT09IDBcbiAgICAgICkge1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWxJZCk7XG4gICAgICAgIHRoaXMuaW50ZXJ2YWxJZCA9IDA7XG4gICAgICB9XG4gICAgICAvLyBXZSB3YW50IHRvIHN0YXJ0IHRoZSBpbnRlcnZhbCBpZiB0aGUgdXBsb2FkIGludGVydmFsIGlzIG5vdCB6ZXJvLlxuICAgICAgaWYgKHJlc291cmNlLmNvbmZpZ3VyYXRpb24udXBsb2FkSW50ZXJ2YWxTZWNvbmRzKSB7XG4gICAgICAgIC8vIFdlIHdhbnQgdG8gcmVzZXQgdGhlIGludGVydmFsIGlmIHRoZSB1cGxvYWQgaW50ZXJ2YWwgaGFzIGNoYW5nZWQuXG4gICAgICAgIGlmICh0aGlzLmludGVydmFsSWQpIHtcbiAgICAgICAgICBjbGVhckludGVydmFsKHRoaXMuaW50ZXJ2YWxJZCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pbnRlcnZhbElkID0gc2V0SW50ZXJ2YWwoXG4gICAgICAgICAgdGhpcy5zZW5kTWVkaWFTdGF0cy5iaW5kKHRoaXMpLFxuICAgICAgICAgIHJlc291cmNlLmNvbmZpZ3VyYXRpb24udXBsb2FkSW50ZXJ2YWxTZWNvbmRzICogMTAwMCxcbiAgICAgICAgKSBhcyB1bmtub3duIGFzIG51bWJlcjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgIExvZ0xldmVsLkVSUk9SUyxcbiAgICAgICAgJ01lZGlhIHN0YXRzIGNoYW5uZWw6IHJlc291cmNlIHJlY2VpdmVkIHdpdGhvdXQgY29uZmlndXJhdGlvbicsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIHNlbmRNZWRpYVN0YXRzKCk6IFByb21pc2U8TWVkaWFBcGlSZXNwb25zZVN0YXR1cz4ge1xuICAgIGNvbnN0IHN0YXRzOiBSVENTdGF0c1JlcG9ydCA9IGF3YWl0IHRoaXMucGVlckNvbm5lY3Rpb24uZ2V0U3RhdHMoKTtcbiAgICBjb25zdCByZXF1ZXN0U3RhdHM6IFN0YXRzU2VjdGlvbkRhdGFbXSA9IFtdO1xuXG4gICAgc3RhdHMuZm9yRWFjaChcbiAgICAgIChcbiAgICAgICAgcmVwb3J0OlxuICAgICAgICAgIHwgUlRDVHJhbnNwb3J0U3RhdHNcbiAgICAgICAgICB8IFJUQ0ljZUNhbmRpZGF0ZVBhaXJTdGF0c1xuICAgICAgICAgIHwgUlRDT3V0Ym91bmRSdHBTdHJlYW1TdGF0c1xuICAgICAgICAgIHwgUlRDSW5ib3VuZFJ0cFN0cmVhbVN0YXRzLFxuICAgICAgKSA9PiB7XG4gICAgICAgIGNvbnN0IHN0YXRzVHlwZSA9IHJlcG9ydC50eXBlIGFzIFN1cHBvcnRlZE1lZGlhU3RhdHNUeXBlcztcbiAgICAgICAgaWYgKHN0YXRzVHlwZSAmJiB0aGlzLmFsbG93bGlzdC5oYXMocmVwb3J0LnR5cGUpKSB7XG4gICAgICAgICAgY29uc3QgZmlsdGVyZWRNZWRpYVN0YXRzOiB7W2tleTogc3RyaW5nXTogc3RyaW5nIHwgbnVtYmVyfSA9IHt9O1xuICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHJlcG9ydCkuZm9yRWFjaCgoZW50cnkpID0+IHtcbiAgICAgICAgICAgIC8vIGlkIGlzIG5vdCBhY2NlcHRlZCB3aXRoIG90aGVyIHN0YXRzLiBJdCBpcyBwb3B1bGF0ZWQgaW4gdGhlIHRvcFxuICAgICAgICAgICAgLy8gbGV2ZWwgc2VjdGlvbi5cbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgdGhpcy5hbGxvd2xpc3QuZ2V0KHJlcG9ydC50eXBlKT8uaW5jbHVkZXMoZW50cnlbMF0pICYmXG4gICAgICAgICAgICAgIGVudHJ5WzBdICE9PSAnaWQnXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgLy8gV2Ugd2FudCB0byBjb252ZXJ0IHRoZSBjYW1lbCBjYXNlIHRvIHVuZGVyc2NvcmUuXG4gICAgICAgICAgICAgIGZpbHRlcmVkTWVkaWFTdGF0c1t0aGlzLmNhbWVsVG9VbmRlcnNjb3JlKGVudHJ5WzBdKV0gPSBlbnRyeVsxXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJlZE1lZGlhU3RhdHNEaWN0aW9uYXJ5ID0ge1xuICAgICAgICAgICAgJ2lkJzogcmVwb3J0LmlkLFxuICAgICAgICAgICAgW1NUQVRTX1RZUEVfQ09OVkVSVEVSW3JlcG9ydC50eXBlIGFzIHN0cmluZ11dOiBmaWx0ZXJlZE1lZGlhU3RhdHMsXG4gICAgICAgICAgfTtcbiAgICAgICAgICBjb25zdCBmaWx0ZXJlZFN0YXRzU2VjdGlvbkRhdGEgPVxuICAgICAgICAgICAgZmlsdGVyZWRNZWRpYVN0YXRzRGljdGlvbmFyeSBhcyBTdGF0c1NlY3Rpb25EYXRhO1xuXG4gICAgICAgICAgcmVxdWVzdFN0YXRzLnB1c2goZmlsdGVyZWRTdGF0c1NlY3Rpb25EYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICApO1xuXG4gICAgaWYgKCFyZXF1ZXN0U3RhdHMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgTG9nTGV2ZWwuRVJST1JTLFxuICAgICAgICAnTWVkaWEgc3RhdHMgY2hhbm5lbDogbm8gbWVkaWEgc3RhdHMgdG8gc2VuZCcsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHtjb2RlOiA0MDAsIG1lc3NhZ2U6ICdObyBtZWRpYSBzdGF0cyB0byBzZW5kJywgZGV0YWlsczogW119O1xuICAgIH1cblxuICAgIGlmICh0aGlzLmNoYW5uZWwucmVhZHlTdGF0ZSA9PT0gJ29wZW4nKSB7XG4gICAgICBjb25zdCBtZWRpYVN0YXRzUmVxdWVzdDogVXBsb2FkTWVkaWFTdGF0c1JlcXVlc3QgPSB7XG4gICAgICAgIHJlcXVlc3RJZDogdGhpcy5yZXF1ZXN0SWQsXG4gICAgICAgIHVwbG9hZE1lZGlhU3RhdHM6IHtzZWN0aW9uczogcmVxdWVzdFN0YXRzfSxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHJlcXVlc3Q6IE1lZGlhU3RhdHNDaGFubmVsRnJvbUNsaWVudCA9IHtcbiAgICAgICAgcmVxdWVzdDogbWVkaWFTdGF0c1JlcXVlc3QsXG4gICAgICB9O1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgIExvZ0xldmVsLk1FU1NBR0VTLFxuICAgICAgICAnTWVkaWEgc3RhdHMgY2hhbm5lbDogc2VuZGluZyByZXF1ZXN0JyxcbiAgICAgICAgbWVkaWFTdGF0c1JlcXVlc3QsXG4gICAgICApO1xuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy5jaGFubmVsLnNlbmQoSlNPTi5zdHJpbmdpZnkocmVxdWVzdCkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgICBMb2dMZXZlbC5FUlJPUlMsXG4gICAgICAgICAgJ01lZGlhIHN0YXRzIGNoYW5uZWw6IEZhaWxlZCB0byBzZW5kIHJlcXVlc3Qgd2l0aCBlcnJvcicsXG4gICAgICAgICAgZSBhcyBFcnJvcixcbiAgICAgICAgKTtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5yZXF1ZXN0SWQrKztcbiAgICAgIGNvbnN0IHJlcXVlc3RQcm9taXNlID0gbmV3IFByb21pc2U8TWVkaWFBcGlSZXNwb25zZVN0YXR1cz4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgdGhpcy5wZW5kaW5nUmVxdWVzdFJlc29sdmVNYXAuc2V0KG1lZGlhU3RhdHNSZXF1ZXN0LnJlcXVlc3RJZCwgcmVzb2x2ZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXF1ZXN0UHJvbWlzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmludGVydmFsSWQpO1xuICAgICAgdGhpcy5pbnRlcnZhbElkID0gMDtcbiAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICBMb2dMZXZlbC5FUlJPUlMsXG4gICAgICAgICdNZWRpYSBzdGF0cyBjaGFubmVsOiBoYW5kbGVyIHRyaWVkIHRvIHNlbmQgbWVzc2FnZSB3aGVuIGNoYW5uZWwgd2FzIGNsb3NlZCcsXG4gICAgICApO1xuICAgICAgcmV0dXJuIHtjb2RlOiA0MDAsIG1lc3NhZ2U6ICdDaGFubmVsIGlzIG5vdCBvcGVuJywgZGV0YWlsczogW119O1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2FtZWxUb1VuZGVyc2NvcmUodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKC8oW0EtWl0pL2csICdfJDEnKS50b0xvd2VyQ2FzZSgpO1xuICB9XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgSGFuZGxlcyBwYXJ0aWNpcGFudHMgZGF0YSBjaGFubmVsIHVwZGF0ZXNcbiAqL1xuXG5pbXBvcnQge1xuICBEZWxldGVkUGFydGljaXBhbnQsXG4gIFBhcnRpY2lwYW50UmVzb3VyY2UsXG4gIFBhcnRpY2lwYW50c0NoYW5uZWxUb0NsaWVudCxcbn0gZnJvbSAnLi4vLi4vdHlwZXMvZGF0YWNoYW5uZWxzJztcbmltcG9ydCB7TG9nTGV2ZWx9IGZyb20gJy4uLy4uL3R5cGVzL2VudW1zJztcbmltcG9ydCB7XG4gIFBhcnRpY2lwYW50IGFzIExvY2FsUGFydGljaXBhbnQsXG4gIE1lZGlhRW50cnksXG59IGZyb20gJy4uLy4uL3R5cGVzL21lZGlhdHlwZXMnO1xuaW1wb3J0IHtJbnRlcm5hbE1lZGlhRW50cnksIEludGVybmFsUGFydGljaXBhbnR9IGZyb20gJy4uL2ludGVybmFsX3R5cGVzJztcbmltcG9ydCB7U3Vic2NyaWJhYmxlRGVsZWdhdGV9IGZyb20gJy4uL3N1YnNjcmliYWJsZV9pbXBsJztcbmltcG9ydCB7Q2hhbm5lbExvZ2dlcn0gZnJvbSAnLi9jaGFubmVsX2xvZ2dlcic7XG5cbi8qKlxuICogSGFuZGxlciBmb3IgcGFydGljaXBhbnRzIGNoYW5uZWxcbiAqL1xuZXhwb3J0IGNsYXNzIFBhcnRpY2lwYW50c0NoYW5uZWxIYW5kbGVyIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBjaGFubmVsOiBSVENEYXRhQ2hhbm5lbCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHBhcnRpY2lwYW50c0RlbGVnYXRlOiBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxcbiAgICAgIExvY2FsUGFydGljaXBhbnRbXVxuICAgID4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBpZFBhcnRpY2lwYW50TWFwID0gbmV3IE1hcDxudW1iZXIsIExvY2FsUGFydGljaXBhbnQ+KCksXG4gICAgcHJpdmF0ZSByZWFkb25seSBuYW1lUGFydGljaXBhbnRNYXAgPSBuZXcgTWFwPHN0cmluZywgTG9jYWxQYXJ0aWNpcGFudD4oKSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGludGVybmFsUGFydGljaXBhbnRNYXAgPSBuZXcgTWFwPFxuICAgICAgTG9jYWxQYXJ0aWNpcGFudCxcbiAgICAgIEludGVybmFsUGFydGljaXBhbnRcbiAgICA+KCksXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbE1lZGlhRW50cnlNYXAgPSBuZXcgTWFwPFxuICAgICAgTWVkaWFFbnRyeSxcbiAgICAgIEludGVybmFsTWVkaWFFbnRyeVxuICAgID4oKSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNoYW5uZWxMb2dnZXI/OiBDaGFubmVsTG9nZ2VyLFxuICApIHtcbiAgICB0aGlzLmNoYW5uZWwub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICB0aGlzLm9uUGFydGljaXBhbnRzTWVzc2FnZShldmVudCk7XG4gICAgfTtcbiAgICB0aGlzLmNoYW5uZWwub25vcGVuID0gKCkgPT4ge1xuICAgICAgdGhpcy5vblBhcnRpY2lwYW50c09wZW5lZCgpO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICB0aGlzLm9uUGFydGljaXBhbnRzQ2xvc2VkKCk7XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgb25QYXJ0aWNpcGFudHNPcGVuZWQoKSB7XG4gICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coTG9nTGV2ZWwuTUVTU0FHRVMsICdQYXJ0aWNpcGFudHMgY2hhbm5lbDogb3BlbmVkJyk7XG4gIH1cblxuICBwcml2YXRlIG9uUGFydGljaXBhbnRzTWVzc2FnZShldmVudDogTWVzc2FnZUV2ZW50KSB7XG4gICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQuZGF0YSkgYXMgUGFydGljaXBhbnRzQ2hhbm5lbFRvQ2xpZW50O1xuICAgIGxldCBwYXJ0aWNpcGFudHMgPSB0aGlzLnBhcnRpY2lwYW50c0RlbGVnYXRlLmdldCgpO1xuICAgIGRhdGEuZGVsZXRlZFJlc291cmNlcz8uZm9yRWFjaCgoZGVsZXRlZFJlc291cmNlOiBEZWxldGVkUGFydGljaXBhbnQpID0+IHtcbiAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICBMb2dMZXZlbC5SRVNPVVJDRVMsXG4gICAgICAgICdQYXJ0aWNpcGFudHMgY2hhbm5lbDogZGVsZXRlZCByZXNvdXJjZScsXG4gICAgICAgIGRlbGV0ZWRSZXNvdXJjZSxcbiAgICAgICk7XG4gICAgICBjb25zdCBwYXJ0aWNpcGFudCA9IHRoaXMuaWRQYXJ0aWNpcGFudE1hcC5nZXQoZGVsZXRlZFJlc291cmNlLmlkKTtcbiAgICAgIGlmICghcGFydGljaXBhbnQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5pZFBhcnRpY2lwYW50TWFwLmRlbGV0ZShkZWxldGVkUmVzb3VyY2UuaWQpO1xuICAgICAgY29uc3QgZGVsZXRlZFBhcnRpY2lwYW50ID0gdGhpcy5pbnRlcm5hbFBhcnRpY2lwYW50TWFwLmdldChwYXJ0aWNpcGFudCk7XG4gICAgICBpZiAoIWRlbGV0ZWRQYXJ0aWNpcGFudCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBkZWxldGVkUGFydGljaXBhbnQuaWRzLmRlbGV0ZShkZWxldGVkUmVzb3VyY2UuaWQpO1xuICAgICAgaWYgKGRlbGV0ZWRQYXJ0aWNpcGFudC5pZHMuc2l6ZSAhPT0gMCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAocGFydGljaXBhbnQucGFydGljaXBhbnQubmFtZSkge1xuICAgICAgICB0aGlzLm5hbWVQYXJ0aWNpcGFudE1hcC5kZWxldGUocGFydGljaXBhbnQucGFydGljaXBhbnQubmFtZSk7XG4gICAgICB9XG4gICAgICBwYXJ0aWNpcGFudHMgPSBwYXJ0aWNpcGFudHMuZmlsdGVyKChwKSA9PiBwICE9PSBwYXJ0aWNpcGFudCk7XG4gICAgICB0aGlzLmludGVybmFsUGFydGljaXBhbnRNYXAuZGVsZXRlKHBhcnRpY2lwYW50KTtcbiAgICAgIGRlbGV0ZWRQYXJ0aWNpcGFudC5tZWRpYUVudHJpZXMuZ2V0KCkuZm9yRWFjaCgobWVkaWFFbnRyeSkgPT4ge1xuICAgICAgICBjb25zdCBpbnRlcm5hbE1lZGlhRW50cnkgPSB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5nZXQobWVkaWFFbnRyeSk7XG4gICAgICAgIGlmIChpbnRlcm5hbE1lZGlhRW50cnkpIHtcbiAgICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkucGFydGljaXBhbnQuc2V0KHVuZGVmaW5lZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgYWRkZWRQYXJ0aWNpcGFudHM6IExvY2FsUGFydGljaXBhbnRbXSA9IFtdO1xuICAgIGRhdGEucmVzb3VyY2VzPy5mb3JFYWNoKChyZXNvdXJjZTogUGFydGljaXBhbnRSZXNvdXJjZSkgPT4ge1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgIExvZ0xldmVsLlJFU09VUkNFUyxcbiAgICAgICAgJ1BhcnRpY2lwYW50cyBjaGFubmVsOiBhZGRlZCByZXNvdXJjZScsXG4gICAgICAgIHJlc291cmNlLFxuICAgICAgKTtcbiAgICAgIGlmICghcmVzb3VyY2UuaWQpIHtcbiAgICAgICAgLy8gV2UgZXhwZWN0IGFsbCBwYXJ0aWNpcGFudHMgdG8gaGF2ZSBhbiBpZC4gSWYgbm90LCB3ZSBsb2cgYW4gZXJyb3JcbiAgICAgICAgLy8gYW5kIGlnbm9yZSB0aGUgcGFydGljaXBhbnQuXG4gICAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICAgIExvZ0xldmVsLkVSUk9SUyxcbiAgICAgICAgICAnUGFydGljaXBhbnRzIGNoYW5uZWw6IHBhcnRpY2lwYW50IHJlc291cmNlIGhhcyBubyBpZCcsXG4gICAgICAgICAgcmVzb3VyY2UsXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIFdlIGRvIG5vdCBleHBlY3QgdGhhdCB0aGUgcGFydGljaXBhbnQgcmVzb3VyY2UgYWxyZWFkeSBleGlzdHMuXG4gICAgICAvLyBIb3dldmVyLCBpdCBpcyBwb3NzaWJsZSB0aGF0IHRoZSBtZWRpYSBlbnRyaWVzIGNoYW5uZWwgcmVmZXJlbmNlcyBpdFxuICAgICAgLy8gYmVmb3JlIHdlIHJlY2VpdmUgdGhlIHBhcnRpY2lwYW50IHJlc291cmNlLiBJbiB0aGlzIGNhc2UsIHdlIHVwZGF0ZVxuICAgICAgLy8gdGhlIHBhcnRpY2lwYW50IHJlc291cmNlIHdpdGggdGhlIHR5cGUgYW5kIG1haW50YWluIHRoZSBtZWRpYSBlbnRyeVxuICAgICAgLy8gcmVsYXRpb25zaGlwLlxuICAgICAgbGV0IGV4aXN0aW5nTWVkaWFFbnRyaWVzRGVsZWdhdGU6XG4gICAgICAgIHwgU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVkaWFFbnRyeVtdPlxuICAgICAgICB8IHVuZGVmaW5lZDtcbiAgICAgIGxldCBleGlzdGluZ1BhcnRpY2lwYW50OiBMb2NhbFBhcnRpY2lwYW50IHwgdW5kZWZpbmVkO1xuICAgICAgbGV0IGV4aXN0aW5nSWRzOiBTZXQ8bnVtYmVyPiB8IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0aGlzLmlkUGFydGljaXBhbnRNYXAuaGFzKHJlc291cmNlLmlkKSkge1xuICAgICAgICBleGlzdGluZ1BhcnRpY2lwYW50ID0gdGhpcy5pZFBhcnRpY2lwYW50TWFwLmdldChyZXNvdXJjZS5pZCk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICByZXNvdXJjZS5wYXJ0aWNpcGFudC5uYW1lICYmXG4gICAgICAgIHRoaXMubmFtZVBhcnRpY2lwYW50TWFwLmhhcyhyZXNvdXJjZS5wYXJ0aWNpcGFudC5uYW1lKVxuICAgICAgKSB7XG4gICAgICAgIGV4aXN0aW5nUGFydGljaXBhbnQgPSB0aGlzLm5hbWVQYXJ0aWNpcGFudE1hcC5nZXQoXG4gICAgICAgICAgcmVzb3VyY2UucGFydGljaXBhbnQubmFtZSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAocmVzb3VyY2UucGFydGljaXBhbnQucGFydGljaXBhbnRLZXkpIHtcbiAgICAgICAgZXhpc3RpbmdQYXJ0aWNpcGFudCA9IEFycmF5LmZyb20oXG4gICAgICAgICAgdGhpcy5pbnRlcm5hbFBhcnRpY2lwYW50TWFwLmVudHJpZXMoKSxcbiAgICAgICAgKS5maW5kKFxuICAgICAgICAgIChbcGFydGljaXBhbnQsIF9dKSA9PlxuICAgICAgICAgICAgcGFydGljaXBhbnQucGFydGljaXBhbnQucGFydGljaXBhbnRLZXkgPT09XG4gICAgICAgICAgICByZXNvdXJjZS5wYXJ0aWNpcGFudC5wYXJ0aWNpcGFudEtleSxcbiAgICAgICAgKT8uWzBdO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhpc3RpbmdQYXJ0aWNpcGFudCkge1xuICAgICAgICBjb25zdCBpbnRlcm5hbFBhcnRpY2lwYW50ID1cbiAgICAgICAgICB0aGlzLmludGVybmFsUGFydGljaXBhbnRNYXAuZ2V0KGV4aXN0aW5nUGFydGljaXBhbnQpO1xuICAgICAgICBpZiAoaW50ZXJuYWxQYXJ0aWNpcGFudCkge1xuICAgICAgICAgIGV4aXN0aW5nTWVkaWFFbnRyaWVzRGVsZWdhdGUgPSBpbnRlcm5hbFBhcnRpY2lwYW50Lm1lZGlhRW50cmllcztcbiAgICAgICAgICAvLyAoVE9ETzogUmVtb3ZlIHRoaXMgb25jZSB3ZSBhcmUgdXNpbmcgcGFydGljaXBhbnRcbiAgICAgICAgICAvLyBuYW1lcyBhcyBpZGVudGlmaWVycy4gUmlnaHQgbm93LCBpdCBpcyBwb3NzaWJsZSBmb3IgYSBwYXJ0aWNpcGFudCB0b1xuICAgICAgICAgIC8vIGhhdmUgbXVsdGlwbGUgaWRzIGR1ZSB0byB1cGRhdGVzIGJlaW5nIHRyZWF0ZWQgYXMgbmV3IHJlc291cmNlcy5cbiAgICAgICAgICBleGlzdGluZ0lkcyA9IGludGVybmFsUGFydGljaXBhbnQuaWRzO1xuICAgICAgICAgIGV4aXN0aW5nSWRzLmZvckVhY2goKGlkKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmlkUGFydGljaXBhbnRNYXAuZGVsZXRlKGlkKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXhpc3RpbmdQYXJ0aWNpcGFudC5wYXJ0aWNpcGFudC5uYW1lKSB7XG4gICAgICAgICAgdGhpcy5uYW1lUGFydGljaXBhbnRNYXAuZGVsZXRlKGV4aXN0aW5nUGFydGljaXBhbnQucGFydGljaXBhbnQubmFtZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5pbnRlcm5hbFBhcnRpY2lwYW50TWFwLmRlbGV0ZShleGlzdGluZ1BhcnRpY2lwYW50KTtcbiAgICAgICAgcGFydGljaXBhbnRzID0gcGFydGljaXBhbnRzLmZpbHRlcigocCkgPT4gcCAhPT0gZXhpc3RpbmdQYXJ0aWNpcGFudCk7XG4gICAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICAgIExvZ0xldmVsLkVSUk9SUyxcbiAgICAgICAgICAnUGFydGljaXBhbnRzIGNoYW5uZWw6IHBhcnRpY2lwYW50IHJlc291cmNlIGFscmVhZHkgZXhpc3RzJyxcbiAgICAgICAgICByZXNvdXJjZSxcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFydGljaXBhbnRFbGVtZW50ID0gY3JlYXRlUGFydGljaXBhbnQoXG4gICAgICAgIHJlc291cmNlLFxuICAgICAgICBleGlzdGluZ01lZGlhRW50cmllc0RlbGVnYXRlLFxuICAgICAgICBleGlzdGluZ0lkcyxcbiAgICAgICk7XG4gICAgICBjb25zdCBwYXJ0aWNpcGFudCA9IHBhcnRpY2lwYW50RWxlbWVudC5wYXJ0aWNpcGFudDtcbiAgICAgIGNvbnN0IGludGVybmFsUGFydGljaXBhbnQgPSBwYXJ0aWNpcGFudEVsZW1lbnQuaW50ZXJuYWxQYXJ0aWNpcGFudDtcbiAgICAgIHBhcnRpY2lwYW50RWxlbWVudC5pbnRlcm5hbFBhcnRpY2lwYW50Lmlkcy5mb3JFYWNoKChpZCkgPT4ge1xuICAgICAgICB0aGlzLmlkUGFydGljaXBhbnRNYXAuc2V0KGlkLCBwYXJ0aWNpcGFudCk7XG4gICAgICB9KTtcbiAgICAgIGlmIChyZXNvdXJjZS5wYXJ0aWNpcGFudC5uYW1lKSB7XG4gICAgICAgIHRoaXMubmFtZVBhcnRpY2lwYW50TWFwLnNldChyZXNvdXJjZS5wYXJ0aWNpcGFudC5uYW1lLCBwYXJ0aWNpcGFudCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuaW50ZXJuYWxQYXJ0aWNpcGFudE1hcC5zZXQocGFydGljaXBhbnQsIGludGVybmFsUGFydGljaXBhbnQpO1xuICAgICAgYWRkZWRQYXJ0aWNpcGFudHMucHVzaChwYXJ0aWNpcGFudCk7XG4gICAgfSk7XG5cbiAgICAvLyBVcGRhdGUgcGFydGljaXBhbnQgY29sbGVjdGlvbi5cbiAgICBpZiAoZGF0YS5yZXNvdXJjZXM/Lmxlbmd0aCB8fCBkYXRhLmRlbGV0ZWRSZXNvdXJjZXM/Lmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV3UGFydGljaXBhbnRzID0gWy4uLnBhcnRpY2lwYW50cywgLi4uYWRkZWRQYXJ0aWNpcGFudHNdO1xuICAgICAgdGhpcy5wYXJ0aWNpcGFudHNEZWxlZ2F0ZS5zZXQobmV3UGFydGljaXBhbnRzKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIG9uUGFydGljaXBhbnRzQ2xvc2VkKCkge1xuICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKExvZ0xldmVsLk1FU1NBR0VTLCAnUGFydGljaXBhbnRzIGNoYW5uZWw6IGNsb3NlZCcpO1xuICB9XG59XG5cbmludGVyZmFjZSBJbnRlcm5hbFBhcnRpY2lwYW50RWxlbWVudCB7XG4gIHBhcnRpY2lwYW50OiBMb2NhbFBhcnRpY2lwYW50O1xuICBpbnRlcm5hbFBhcnRpY2lwYW50OiBJbnRlcm5hbFBhcnRpY2lwYW50O1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgcGFydGljaXBhbnQuXG4gKiBAcmV0dXJuIFRoZSBuZXcgcGFydGljaXBhbnQgYW5kIGl0cyBpbnRlcm5hbCByZXByZXNlbnRhdGlvbi5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUGFydGljaXBhbnQoXG4gIHJlc291cmNlOiBQYXJ0aWNpcGFudFJlc291cmNlLFxuICBtZWRpYUVudHJpZXNEZWxlZ2F0ZSA9IG5ldyBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxNZWRpYUVudHJ5W10+KFtdKSxcbiAgZXhpc3RpbmdJZHMgPSBuZXcgU2V0PG51bWJlcj4oKSxcbik6IEludGVybmFsUGFydGljaXBhbnRFbGVtZW50IHtcbiAgaWYgKCFyZXNvdXJjZS5pZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGFydGljaXBhbnQgcmVzb3VyY2UgbXVzdCBoYXZlIGFuIGlkJyk7XG4gIH1cblxuICBjb25zdCBwYXJ0aWNpcGFudDogTG9jYWxQYXJ0aWNpcGFudCA9IHtcbiAgICBwYXJ0aWNpcGFudDogcmVzb3VyY2UucGFydGljaXBhbnQsXG4gICAgbWVkaWFFbnRyaWVzOiBtZWRpYUVudHJpZXNEZWxlZ2F0ZS5nZXRTdWJzY3JpYmFibGUoKSxcbiAgfTtcblxuICBleGlzdGluZ0lkcy5hZGQocmVzb3VyY2UuaWQpO1xuXG4gIGNvbnN0IGludGVybmFsUGFydGljaXBhbnQ6IEludGVybmFsUGFydGljaXBhbnQgPSB7XG4gICAgbmFtZTogcmVzb3VyY2UucGFydGljaXBhbnQubmFtZSA/PyAnJyxcbiAgICBpZHM6IGV4aXN0aW5nSWRzLFxuICAgIG1lZGlhRW50cmllczogbWVkaWFFbnRyaWVzRGVsZWdhdGUsXG4gIH07XG4gIHJldHVybiB7XG4gICAgcGFydGljaXBhbnQsXG4gICAgaW50ZXJuYWxQYXJ0aWNpcGFudCxcbiAgfTtcbn1cbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAyNCBHb29nbGUgTExDXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbi8qKlxuICogQGZpbGVvdmVydmlldyBIYW5kbGVzIHRoZSBzZXNzaW9uIGNvbnRyb2wgY2hhbm5lbC5cbiAqL1xuXG5pbXBvcnQge1xuICBMZWF2ZVJlcXVlc3QsXG4gIFNlc3Npb25Db250cm9sQ2hhbm5lbEZyb21DbGllbnQsXG4gIFNlc3Npb25Db250cm9sQ2hhbm5lbFRvQ2xpZW50LFxufSBmcm9tICcuLi8uLi90eXBlcy9kYXRhY2hhbm5lbHMnO1xuaW1wb3J0IHtcbiAgTG9nTGV2ZWwsXG4gIE1lZXRDb25uZWN0aW9uU3RhdGUsXG4gIE1lZXREaXNjb25uZWN0UmVhc29uLFxufSBmcm9tICcuLi8uLi90eXBlcy9lbnVtcyc7XG5pbXBvcnQge01lZXRTZXNzaW9uU3RhdHVzfSBmcm9tICcuLi8uLi90eXBlcy9tZWV0bWVkaWFhcGljbGllbnQnO1xuaW1wb3J0IHtTdWJzY3JpYmFibGVEZWxlZ2F0ZX0gZnJvbSAnLi4vc3Vic2NyaWJhYmxlX2ltcGwnO1xuaW1wb3J0IHtDaGFubmVsTG9nZ2VyfSBmcm9tICcuL2NoYW5uZWxfbG9nZ2VyJztcblxuY29uc3QgRElTQ09OTkVDVF9SRUFTT05fTUFQID0gbmV3IE1hcDxzdHJpbmcsIE1lZXREaXNjb25uZWN0UmVhc29uPihbXG4gIFsnUkVBU09OX0NMSUVOVF9MRUZUJywgTWVldERpc2Nvbm5lY3RSZWFzb24uQ0xJRU5UX0xFRlRdLFxuICBbJ1JFQVNPTl9VU0VSX1NUT1BQRUQnLCBNZWV0RGlzY29ubmVjdFJlYXNvbi5VU0VSX1NUT1BQRURdLFxuICBbJ1JFQVNPTl9DT05GRVJFTkNFX0VOREVEJywgTWVldERpc2Nvbm5lY3RSZWFzb24uQ09ORkVSRU5DRV9FTkRFRF0sXG4gIFsnUkVBU09OX1NFU1NJT05fVU5IRUFMVEhZJywgTWVldERpc2Nvbm5lY3RSZWFzb24uU0VTU0lPTl9VTkhFQUxUSFldLFxuXSk7XG5cbi8qKlxuICogSGVscGVyIGNsYXNzIHRvIGhhbmRsZXMgdGhlIHNlc3Npb24gY29udHJvbCBjaGFubmVsLlxuICovXG5leHBvcnQgY2xhc3MgU2Vzc2lvbkNvbnRyb2xDaGFubmVsSGFuZGxlciB7XG4gIHByaXZhdGUgcmVxdWVzdElkID0gMTtcbiAgcHJpdmF0ZSBsZWF2ZVNlc3Npb25Qcm9taXNlOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBjaGFubmVsOiBSVENEYXRhQ2hhbm5lbCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25TdGF0dXNEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVldFNlc3Npb25TdGF0dXM+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgY2hhbm5lbExvZ2dlcj86IENoYW5uZWxMb2dnZXIsXG4gICkge1xuICAgIHRoaXMuY2hhbm5lbC5vbm1lc3NhZ2UgPSAoZXZlbnQpID0+IHtcbiAgICAgIHRoaXMub25TZXNzaW9uQ29udHJvbE1lc3NhZ2UoZXZlbnQpO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9ub3BlbiA9ICgpID0+IHtcbiAgICAgIHRoaXMub25TZXNzaW9uQ29udHJvbE9wZW5lZCgpO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICB0aGlzLm9uU2Vzc2lvbkNvbnRyb2xDbG9zZWQoKTtcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBvblNlc3Npb25Db250cm9sT3BlbmVkKCkge1xuICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAnU2Vzc2lvbiBjb250cm9sIGNoYW5uZWw6IG9wZW5lZCcsXG4gICAgKTtcbiAgICB0aGlzLnNlc3Npb25TdGF0dXNEZWxlZ2F0ZS5zZXQoe1xuICAgICAgY29ubmVjdGlvblN0YXRlOiBNZWV0Q29ubmVjdGlvblN0YXRlLldBSVRJTkcsXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG9uU2Vzc2lvbkNvbnRyb2xNZXNzYWdlKGV2ZW50OiBNZXNzYWdlRXZlbnQpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gZXZlbnQuZGF0YTtcbiAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShtZXNzYWdlKSBhcyBTZXNzaW9uQ29udHJvbENoYW5uZWxUb0NsaWVudDtcbiAgICBpZiAoanNvbj8ucmVzcG9uc2UpIHtcbiAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICBMb2dMZXZlbC5NRVNTQUdFUyxcbiAgICAgICAgJ1Nlc3Npb24gY29udHJvbCBjaGFubmVsOiByZXNwb25zZSByZWNpZXZlZCcsXG4gICAgICAgIGpzb24ucmVzcG9uc2UsXG4gICAgICApO1xuICAgICAgdGhpcy5sZWF2ZVNlc3Npb25Qcm9taXNlPy4oKTtcbiAgICB9XG4gICAgaWYgKGpzb24/LnJlc291cmNlcyAmJiBqc29uLnJlc291cmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBzZXNzaW9uU3RhdHVzID0ganNvbi5yZXNvdXJjZXNbMF0uc2Vzc2lvblN0YXR1cztcbiAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICBMb2dMZXZlbC5SRVNPVVJDRVMsXG4gICAgICAgICdTZXNzaW9uIGNvbnRyb2wgY2hhbm5lbDogcmVzb3VyY2UgcmVjaWV2ZWQnLFxuICAgICAgICBqc29uLnJlc291cmNlc1swXSxcbiAgICAgICk7XG4gICAgICBpZiAoc2Vzc2lvblN0YXR1cy5jb25uZWN0aW9uU3RhdGUgPT09ICdTVEFURV9XQUlUSU5HJykge1xuICAgICAgICB0aGlzLnNlc3Npb25TdGF0dXNEZWxlZ2F0ZS5zZXQoe1xuICAgICAgICAgIGNvbm5lY3Rpb25TdGF0ZTogTWVldENvbm5lY3Rpb25TdGF0ZS5XQUlUSU5HLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoc2Vzc2lvblN0YXR1cy5jb25uZWN0aW9uU3RhdGUgPT09ICdTVEFURV9KT0lORUQnKSB7XG4gICAgICAgIHRoaXMuc2Vzc2lvblN0YXR1c0RlbGVnYXRlLnNldCh7XG4gICAgICAgICAgY29ubmVjdGlvblN0YXRlOiBNZWV0Q29ubmVjdGlvblN0YXRlLkpPSU5FRCxcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHNlc3Npb25TdGF0dXMuY29ubmVjdGlvblN0YXRlID09PSAnU1RBVEVfRElTQ09OTkVDVEVEJykge1xuICAgICAgICB0aGlzLnNlc3Npb25TdGF0dXNEZWxlZ2F0ZS5zZXQoe1xuICAgICAgICAgIGNvbm5lY3Rpb25TdGF0ZTogTWVldENvbm5lY3Rpb25TdGF0ZS5ESVNDT05ORUNURUQsXG4gICAgICAgICAgZGlzY29ubmVjdFJlYXNvbjpcbiAgICAgICAgICAgIERJU0NPTk5FQ1RfUkVBU09OX01BUC5nZXQoc2Vzc2lvblN0YXR1cy5kaXNjb25uZWN0UmVhc29uIHx8ICcnKSA/P1xuICAgICAgICAgICAgTWVldERpc2Nvbm5lY3RSZWFzb24uU0VTU0lPTl9VTkhFQUxUSFksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwcml2YXRlIG9uU2Vzc2lvbkNvbnRyb2xDbG9zZWQoKSB7XG4gICAgLy8gSWYgdGhlIGNoYW5uZWwgaXMgY2xvc2VkLCB3ZSBzaG91bGQgcmVzb2x2ZSB0aGUgbGVhdmUgc2Vzc2lvbiBwcm9taXNlLlxuICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAnU2Vzc2lvbiBjb250cm9sIGNoYW5uZWw6IGNsb3NlZCcsXG4gICAgKTtcbiAgICB0aGlzLmxlYXZlU2Vzc2lvblByb21pc2U/LigpO1xuICAgIGlmIChcbiAgICAgIHRoaXMuc2Vzc2lvblN0YXR1c0RlbGVnYXRlLmdldCgpLmNvbm5lY3Rpb25TdGF0ZSAhPT1cbiAgICAgIE1lZXRDb25uZWN0aW9uU3RhdGUuRElTQ09OTkVDVEVEXG4gICAgKSB7XG4gICAgICB0aGlzLnNlc3Npb25TdGF0dXNEZWxlZ2F0ZS5zZXQoe1xuICAgICAgICBjb25uZWN0aW9uU3RhdGU6IE1lZXRDb25uZWN0aW9uU3RhdGUuRElTQ09OTkVDVEVELFxuICAgICAgICBkaXNjb25uZWN0UmVhc29uOiBNZWV0RGlzY29ubmVjdFJlYXNvbi5VTktOT1dOLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgbGVhdmVTZXNzaW9uKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAnU2Vzc2lvbiBjb250cm9sIGNoYW5uZWw6IGxlYXZlIHNlc3Npb24gcmVxdWVzdCBzZW50JyxcbiAgICApO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmNoYW5uZWwuc2VuZChcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHJlcXVlc3Q6IHtcbiAgICAgICAgICAgIHJlcXVlc3RJZDogdGhpcy5yZXF1ZXN0SWQrKyxcbiAgICAgICAgICAgIGxlYXZlOiB7fSxcbiAgICAgICAgICB9IGFzIExlYXZlUmVxdWVzdCxcbiAgICAgICAgfSBhcyBTZXNzaW9uQ29udHJvbENoYW5uZWxGcm9tQ2xpZW50KSxcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5jaGFubmVsTG9nZ2VyPy5sb2coXG4gICAgICAgIExvZ0xldmVsLkVSUk9SUyxcbiAgICAgICAgJ1Nlc3Npb24gY29udHJvbCBjaGFubmVsOiBGYWlsZWQgdG8gc2VuZCBsZWF2ZSByZXF1ZXN0IHdpdGggZXJyb3InLFxuICAgICAgICBlIGFzIEVycm9yLFxuICAgICAgKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5sZWF2ZVNlc3Npb25Qcm9taXNlID0gcmVzb2x2ZTtcbiAgICB9KTtcbiAgfVxufVxuIiwiLypcbiAqIENvcHlyaWdodCAyMDI0IEdvb2dsZSBMTENcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IFZpZGVvIGFzc2lnbm1lbnQgY2hhbm5lbCBoYW5kbGVyLlxuICovXG5cbmltcG9ydCB7XG4gIE1lZGlhQXBpQ2FudmFzLFxuICBNZWRpYUFwaVJlc3BvbnNlU3RhdHVzLFxuICBTZXRWaWRlb0Fzc2lnbm1lbnRSZXF1ZXN0LFxuICBTZXRWaWRlb0Fzc2lnbm1lbnRSZXNwb25zZSxcbiAgVmlkZW9Bc3NpZ25tZW50Q2hhbm5lbEZyb21DbGllbnQsXG4gIFZpZGVvQXNzaWdubWVudENoYW5uZWxUb0NsaWVudCxcbiAgVmlkZW9Bc3NpZ25tZW50UmVzb3VyY2UsXG59IGZyb20gJy4uLy4uL3R5cGVzL2RhdGFjaGFubmVscyc7XG5pbXBvcnQge0xvZ0xldmVsfSBmcm9tICcuLi8uLi90eXBlcy9lbnVtcyc7XG5pbXBvcnQge1xuICBNZWRpYUVudHJ5LFxuICBNZWRpYUxheW91dCxcbiAgTWVkaWFMYXlvdXRSZXF1ZXN0LFxuICBNZWV0U3RyZWFtVHJhY2ssXG59IGZyb20gJy4uLy4uL3R5cGVzL21lZGlhdHlwZXMnO1xuaW1wb3J0IHtcbiAgSW50ZXJuYWxNZWRpYUVudHJ5LFxuICBJbnRlcm5hbE1lZGlhTGF5b3V0LFxuICBJbnRlcm5hbE1lZXRTdHJlYW1UcmFjayxcbn0gZnJvbSAnLi4vaW50ZXJuYWxfdHlwZXMnO1xuaW1wb3J0IHtTdWJzY3JpYmFibGVEZWxlZ2F0ZX0gZnJvbSAnLi4vc3Vic2NyaWJhYmxlX2ltcGwnO1xuaW1wb3J0IHtjcmVhdGVNZWRpYUVudHJ5fSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQge0NoYW5uZWxMb2dnZXJ9IGZyb20gJy4vY2hhbm5lbF9sb2dnZXInO1xuXG4vLyBXZSByZXF1ZXN0IHRoZSBoaWdoZXN0IHBvc3NpYmxlIHJlc29sdXRpb24gYnkgZGVmYXVsdC5cbmNvbnN0IE1BWF9SRVNPTFVUSU9OID0ge1xuICBoZWlnaHQ6IDEwODAsXG4gIHdpZHRoOiAxOTIwLFxuICBmcmFtZVJhdGU6IDMwLFxufTtcblxuLyoqXG4gKiBIZWxwZXIgY2xhc3MgdG8gaGFuZGxlIHRoZSB2aWRlbyBhc3NpZ25tZW50IGNoYW5uZWwuXG4gKi9cbmV4cG9ydCBjbGFzcyBWaWRlb0Fzc2lnbm1lbnRDaGFubmVsSGFuZGxlciB7XG4gIHByaXZhdGUgcmVxdWVzdElkID0gMTtcbiAgcHJpdmF0ZSByZWFkb25seSBtZWRpYUxheW91dExhYmVsTWFwID0gbmV3IE1hcDxNZWRpYUxheW91dCwgc3RyaW5nPigpO1xuICBwcml2YXRlIHJlYWRvbmx5IHBlbmRpbmdSZXF1ZXN0UmVzb2x2ZU1hcCA9IG5ldyBNYXA8XG4gICAgbnVtYmVyLFxuICAgICh2YWx1ZTogTWVkaWFBcGlSZXNwb25zZVN0YXR1cykgPT4gdm9pZFxuICA+KCk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBjaGFubmVsOiBSVENEYXRhQ2hhbm5lbCxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGlkTWVkaWFFbnRyeU1hcDogTWFwPG51bWJlciwgTWVkaWFFbnRyeT4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbE1lZGlhRW50cnlNYXAgPSBuZXcgTWFwPFxuICAgICAgTWVkaWFFbnRyeSxcbiAgICAgIEludGVybmFsTWVkaWFFbnRyeVxuICAgID4oKSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGlkTWVkaWFMYXlvdXRNYXAgPSBuZXcgTWFwPG51bWJlciwgTWVkaWFMYXlvdXQ+KCksXG4gICAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbE1lZGlhTGF5b3V0TWFwID0gbmV3IE1hcDxcbiAgICAgIE1lZGlhTGF5b3V0LFxuICAgICAgSW50ZXJuYWxNZWRpYUxheW91dFxuICAgID4oKSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IG1lZGlhRW50cmllc0RlbGVnYXRlOiBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxNZWRpYUVudHJ5W10+LFxuICAgIHByaXZhdGUgcmVhZG9ubHkgaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2tNYXAgPSBuZXcgTWFwPFxuICAgICAgTWVldFN0cmVhbVRyYWNrLFxuICAgICAgSW50ZXJuYWxNZWV0U3RyZWFtVHJhY2tcbiAgICA+KCksXG4gICAgcHJpdmF0ZSByZWFkb25seSBjaGFubmVsTG9nZ2VyPzogQ2hhbm5lbExvZ2dlcixcbiAgKSB7XG4gICAgdGhpcy5jaGFubmVsLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgdGhpcy5vblZpZGVvQXNzaWdubWVudE1lc3NhZ2UoZXZlbnQpO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9uY2xvc2UgPSAoKSA9PiB7XG4gICAgICAvLyBSZXNvbHZlIGFsbCBwZW5kaW5nIHJlcXVlc3RzIHdpdGggYW4gZXJyb3IuXG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAgICdWaWRlbyBhc3NpZ25tZW50IGNoYW5uZWw6IGNsb3NlZCcsXG4gICAgICApO1xuICAgICAgZm9yIChjb25zdCBbLCByZXNvbHZlXSBvZiB0aGlzLnBlbmRpbmdSZXF1ZXN0UmVzb2x2ZU1hcCkge1xuICAgICAgICByZXNvbHZlKHtjb2RlOiA0MDAsIG1lc3NhZ2U6ICdDaGFubmVsIGNsb3NlZCcsIGRldGFpbHM6IFtdfSk7XG4gICAgICB9XG4gICAgICB0aGlzLnBlbmRpbmdSZXF1ZXN0UmVzb2x2ZU1hcC5jbGVhcigpO1xuICAgIH07XG4gICAgdGhpcy5jaGFubmVsLm9ub3BlbiA9ICgpID0+IHtcbiAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICBMb2dMZXZlbC5NRVNTQUdFUyxcbiAgICAgICAgJ1ZpZGVvIGFzc2lnbm1lbnQgY2hhbm5lbDogb3BlbmVkJyxcbiAgICAgICk7XG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgb25WaWRlb0Fzc2lnbm1lbnRNZXNzYWdlKG1lc3NhZ2U6IE1lc3NhZ2VFdmVudCkge1xuICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKG1lc3NhZ2UuZGF0YSkgYXMgVmlkZW9Bc3NpZ25tZW50Q2hhbm5lbFRvQ2xpZW50O1xuICAgIGlmIChkYXRhLnJlc3BvbnNlKSB7XG4gICAgICB0aGlzLm9uVmlkZW9Bc3NpZ25tZW50UmVzcG9uc2UoZGF0YS5yZXNwb25zZSk7XG4gICAgfVxuICAgIGlmIChkYXRhLnJlc291cmNlcykge1xuICAgICAgdGhpcy5vblZpZGVvQXNzaWdubWVudFJlc291cmNlcyhkYXRhLnJlc291cmNlcyk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBvblZpZGVvQXNzaWdubWVudFJlc3BvbnNlKHJlc3BvbnNlOiBTZXRWaWRlb0Fzc2lnbm1lbnRSZXNwb25zZSkge1xuICAgIC8vIFVzZXJzIHNob3VsZCBsaXN0ZW4gb24gdGhlIHZpZGVvIGFzc2lnbm1lbnQgY2hhbm5lbCBmb3IgYWN0dWFsIHZpZGVvXG4gICAgLy8gYXNzaWdubWVudHMuIFRoZXNlIHJlc3BvbnNlcyBzaWduaWZ5IHRoYXQgdGhlIHJlcXVlc3Qgd2FzIGV4cGVjdGVkLlxuICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAnVmlkZW8gYXNzaWdubWVudCBjaGFubmVsOiByZWNpZXZlZCByZXNwb25zZScsXG4gICAgICByZXNwb25zZSxcbiAgICApO1xuICAgIHRoaXMucGVuZGluZ1JlcXVlc3RSZXNvbHZlTWFwLmdldChyZXNwb25zZS5yZXF1ZXN0SWQpPy4ocmVzcG9uc2Uuc3RhdHVzKTtcbiAgfVxuXG4gIHByaXZhdGUgb25WaWRlb0Fzc2lnbm1lbnRSZXNvdXJjZXMocmVzb3VyY2VzOiBWaWRlb0Fzc2lnbm1lbnRSZXNvdXJjZVtdKSB7XG4gICAgcmVzb3VyY2VzLmZvckVhY2goKHJlc291cmNlKSA9PiB7XG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgTG9nTGV2ZWwuUkVTT1VSQ0VTLFxuICAgICAgICAnVmlkZW8gYXNzaWdubWVudCBjaGFubmVsOiByZXNvdXJjZSBhZGRlZCcsXG4gICAgICAgIHJlc291cmNlLFxuICAgICAgKTtcbiAgICAgIGlmIChyZXNvdXJjZS52aWRlb0Fzc2lnbm1lbnQuY2FudmFzZXMpIHtcbiAgICAgICAgdGhpcy5vblZpZGVvQXNzaWdubWVudChyZXNvdXJjZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG9uVmlkZW9Bc3NpZ25tZW50KHZpZGVvQXNzaWdubWVudDogVmlkZW9Bc3NpZ25tZW50UmVzb3VyY2UpIHtcbiAgICBjb25zdCBjYW52YXNlcyA9IHZpZGVvQXNzaWdubWVudC52aWRlb0Fzc2lnbm1lbnQuY2FudmFzZXM7XG4gICAgY2FudmFzZXMuZm9yRWFjaChcbiAgICAgIChjYW52YXM6IHtjYW52YXNJZDogbnVtYmVyOyBzc3JjPzogbnVtYmVyOyBtZWRpYUVudHJ5SWQ6IG51bWJlcn0pID0+IHtcbiAgICAgICAgY29uc3QgbWVkaWFMYXlvdXQgPSB0aGlzLmlkTWVkaWFMYXlvdXRNYXAuZ2V0KGNhbnZhcy5jYW52YXNJZCk7XG4gICAgICAgIC8vIFdlIGV4cGVjdCB0aGF0IHRoZSBtZWRpYSBsYXlvdXQgaXMgYWxyZWFkeSBjcmVhdGVkLlxuICAgICAgICBsZXQgaW50ZXJuYWxNZWRpYUVudHJ5O1xuICAgICAgICBpZiAobWVkaWFMYXlvdXQpIHtcbiAgICAgICAgICBjb25zdCBhc3NpZ25lZE1lZGlhRW50cnkgPSBtZWRpYUxheW91dC5tZWRpYUVudHJ5LmdldCgpO1xuICAgICAgICAgIGxldCBtZWRpYUVudHJ5O1xuICAgICAgICAgIC8vIGlmIGFzc29jaWF0aW9uIGFscmVhZHkgZXhpc3RzLCB3ZSBuZWVkIHRvIGVpdGhlciB1cGRhdGUgdGhlIHZpZGVvXG4gICAgICAgICAgLy8gc3NyYyBvciByZW1vdmUgdGhlIGFzc29jaWF0aW9uIGlmIHRoZSBpZHMgZG9uJ3QgbWF0Y2guXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgYXNzaWduZWRNZWRpYUVudHJ5ICYmXG4gICAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5nZXQoYXNzaWduZWRNZWRpYUVudHJ5KT8uaWQgPT09XG4gICAgICAgICAgICAgIGNhbnZhcy5tZWRpYUVudHJ5SWRcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIC8vIFdlIGV4cGVjdCB0aGUgaW50ZXJuYWwgbWVkaWEgZW50cnkgdG8gYmUgYWxyZWFkeSBjcmVhdGVkIGlmIHRoZSBtZWRpYSBlbnRyeSBleGlzdHMuXG4gICAgICAgICAgICBpbnRlcm5hbE1lZGlhRW50cnkgPVxuICAgICAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5nZXQoYXNzaWduZWRNZWRpYUVudHJ5KTtcbiAgICAgICAgICAgIC8vIElmIHRoZSBtZWRpYSBjYW52YXMgaXMgYWxyZWFkeSBhc3NvY2lhdGVkIHdpdGggYSBtZWRpYSBlbnRyeSwgd2VcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gdXBkYXRlIHRoZSB2aWRlbyBzc3JjLlxuICAgICAgICAgICAgLy8gRXhwZWN0IHRoZSBtZWRpYSBlbnRyeSB0byBiZSBjcmVhdGVkLCB3aXRob3V0IGFzc2VydGlvbiwgVFNcbiAgICAgICAgICAgIC8vIGNvbXBsYWlucyBpdCBjYW4gYmUgdW5kZWZpbmVkLlxuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGU6bm8tdW5uZWNlc3NhcnktdHlwZS1hc3NlcnRpb25cbiAgICAgICAgICAgIGludGVybmFsTWVkaWFFbnRyeSEudmlkZW9Tc3JjID0gY2FudmFzLnNzcmM7XG4gICAgICAgICAgICBtZWRpYUVudHJ5ID0gYXNzaWduZWRNZWRpYUVudHJ5O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJZiBhc3Nzb2NhdGlvbiBkb2VzIG5vdCBleGlzdCwgd2Ugd2lsbCBhdHRlbXB0IHRvIHJldHJlaXZlIHRoZVxuICAgICAgICAgICAgLy8gbWVkaWEgZW50cnkgZnJvbSB0aGUgbWFwLlxuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdNZWRpYUVudHJ5ID0gdGhpcy5pZE1lZGlhRW50cnlNYXAuZ2V0KFxuICAgICAgICAgICAgICBjYW52YXMubWVkaWFFbnRyeUlkLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIC8vIENsZWFyIGV4aXN0aW5nIGFzc29jaWF0aW9uIGlmIGl0IGV4aXN0cy5cbiAgICAgICAgICAgIGlmIChhc3NpZ25lZE1lZGlhRW50cnkpIHtcbiAgICAgICAgICAgICAgdGhpcy5pbnRlcm5hbE1lZGlhRW50cnlNYXBcbiAgICAgICAgICAgICAgICAuZ2V0KGFzc2lnbmVkTWVkaWFFbnRyeSlcbiAgICAgICAgICAgICAgICA/Lm1lZGlhTGF5b3V0LnNldCh1bmRlZmluZWQpO1xuICAgICAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFMYXlvdXRNYXBcbiAgICAgICAgICAgICAgICAuZ2V0KG1lZGlhTGF5b3V0KVxuICAgICAgICAgICAgICAgID8ubWVkaWFFbnRyeS5zZXQodW5kZWZpbmVkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChleGlzdGluZ01lZGlhRW50cnkpIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIG1lZGlhIGVudHJ5IGV4aXN0cywgbmVlZCB0byBjcmVhdGUgdGhlIG1lZGlhIGNhbnZhcyBhc3NvY2lhdGlvbi5cbiAgICAgICAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5ID1cbiAgICAgICAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5nZXQoZXhpc3RpbmdNZWRpYUVudHJ5KTtcbiAgICAgICAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS52aWRlb1NzcmMgPSBjYW52YXMuc3NyYztcbiAgICAgICAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS5tZWRpYUxheW91dC5zZXQobWVkaWFMYXlvdXQpO1xuICAgICAgICAgICAgICBtZWRpYUVudHJ5ID0gZXhpc3RpbmdNZWRpYUVudHJ5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgLy8gSWYgdGhlIG1lZGlhIGVudHJ5IGRvZXdzbid0IGV4aXN0LCB3ZSBuZWVkIHRvIGNyZWF0ZSBpdCBhbmRcbiAgICAgICAgICAgICAgLy8gdGhlbiBjcmVhdGUgdGhlIG1lZGlhIGNhbnZhcyBhc3NvY2lhdGlvbi5cbiAgICAgICAgICAgICAgLy8gV2UgZG9uJ3QgZXhwZWN0IHRvIGhpdCB0aGlzIGV4cHJlc3Npb24sIGJ1dCBzaW5jZSBkYXRhIGNoYW5uZWxzXG4gICAgICAgICAgICAgIC8vIGRvbid0IGd1YXJhbnRlZSBvcmRlciwgd2UgZG8gdGhpcyB0byBiZSBzYWZlLlxuICAgICAgICAgICAgICBjb25zdCBtZWRpYUVudHJ5RWxlbWVudCA9IGNyZWF0ZU1lZGlhRW50cnkoe1xuICAgICAgICAgICAgICAgIGlkOiBjYW52YXMubWVkaWFFbnRyeUlkLFxuICAgICAgICAgICAgICAgIG1lZGlhTGF5b3V0LFxuICAgICAgICAgICAgICAgIHZpZGVvU3NyYzogY2FudmFzLnNzcmMsXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5zZXQoXG4gICAgICAgICAgICAgICAgbWVkaWFFbnRyeUVsZW1lbnQubWVkaWFFbnRyeSxcbiAgICAgICAgICAgICAgICBtZWRpYUVudHJ5RWxlbWVudC5pbnRlcm5hbE1lZGlhRW50cnksXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGludGVybmFsTWVkaWFFbnRyeSA9IG1lZGlhRW50cnlFbGVtZW50LmludGVybmFsTWVkaWFFbnRyeTtcbiAgICAgICAgICAgICAgY29uc3QgbmV3TWVkaWFFbnRyeSA9IG1lZGlhRW50cnlFbGVtZW50Lm1lZGlhRW50cnk7XG4gICAgICAgICAgICAgIHRoaXMuaWRNZWRpYUVudHJ5TWFwLnNldChjYW52YXMubWVkaWFFbnRyeUlkLCBuZXdNZWRpYUVudHJ5KTtcbiAgICAgICAgICAgICAgY29uc3QgbmV3TWVkaWFFbnRyaWVzID0gW1xuICAgICAgICAgICAgICAgIC4uLnRoaXMubWVkaWFFbnRyaWVzRGVsZWdhdGUuZ2V0KCksXG4gICAgICAgICAgICAgICAgbmV3TWVkaWFFbnRyeSxcbiAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgdGhpcy5tZWRpYUVudHJpZXNEZWxlZ2F0ZS5zZXQobmV3TWVkaWFFbnRyaWVzKTtcbiAgICAgICAgICAgICAgbWVkaWFFbnRyeSA9IG5ld01lZGlhRW50cnk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmludGVybmFsTWVkaWFMYXlvdXRNYXBcbiAgICAgICAgICAgICAgLmdldChtZWRpYUxheW91dClcbiAgICAgICAgICAgICAgPy5tZWRpYUVudHJ5LnNldChtZWRpYUVudHJ5KTtcbiAgICAgICAgICAgIHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwXG5cbiAgICAgICAgICAgICAgLmdldChtZWRpYUVudHJ5ISlcbiAgICAgICAgICAgICAgPy5tZWRpYUxheW91dC5zZXQobWVkaWFMYXlvdXQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAhdGhpcy5pc01lZGlhRW50cnlBc3NpZ25lZFRvTWVldFN0cmVhbVRyYWNrKFxuICAgICAgICAgICAgICBtZWRpYUVudHJ5ISxcbiAgICAgICAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5ISxcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMuYXNzaWduVmlkZW9NZWV0U3RyZWFtVHJhY2sobWVkaWFFbnRyeSEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyB0c2xpbnQ6ZW5hYmxlOm5vLXVubmVjZXNzYXJ5LXR5cGUtYXNzZXJ0aW9uXG4gICAgICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgICAgIExvZ0xldmVsLkVSUk9SUyxcbiAgICAgICAgICAnVmlkZW8gYXNzaWdubWVudCBjaGFubmVsOiBzZXJ2ZXIgc2VudCBhIGNhbnZhcyB0aGF0IHdhcyBub3QgY3JlYXRlZCBieSB0aGUgY2xpZW50JyxcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIHNlbmRSZXF1ZXN0cyhcbiAgICBtZWRpYUxheW91dFJlcXVlc3RzOiBNZWRpYUxheW91dFJlcXVlc3RbXSxcbiAgKTogUHJvbWlzZTxNZWRpYUFwaVJlc3BvbnNlU3RhdHVzPiB7XG4gICAgY29uc3QgbGFiZWwgPSBEYXRlLm5vdygpLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgY2FudmFzZXM6IE1lZGlhQXBpQ2FudmFzW10gPSBbXTtcbiAgICBtZWRpYUxheW91dFJlcXVlc3RzLmZvckVhY2goKHJlcXVlc3QpID0+IHtcbiAgICAgIHRoaXMubWVkaWFMYXlvdXRMYWJlbE1hcC5zZXQocmVxdWVzdC5tZWRpYUxheW91dCwgbGFiZWwpO1xuICAgICAgY2FudmFzZXMucHVzaCh7XG4gICAgICAgIGlkOiB0aGlzLmludGVybmFsTWVkaWFMYXlvdXRNYXAuZ2V0KHJlcXVlc3QubWVkaWFMYXlvdXQpIS5pZCxcbiAgICAgICAgZGltZW5zaW9uczogcmVxdWVzdC5tZWRpYUxheW91dC5jYW52YXNEaW1lbnNpb25zLFxuICAgICAgICByZWxldmFudDoge30sXG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCByZXF1ZXN0OiBTZXRWaWRlb0Fzc2lnbm1lbnRSZXF1ZXN0ID0ge1xuICAgICAgcmVxdWVzdElkOiB0aGlzLnJlcXVlc3RJZCsrLFxuICAgICAgc2V0QXNzaWdubWVudDoge1xuICAgICAgICBsYXlvdXRNb2RlbDoge1xuICAgICAgICAgIGxhYmVsLFxuICAgICAgICAgIGNhbnZhc2VzLFxuICAgICAgICB9LFxuICAgICAgICBtYXhWaWRlb1Jlc29sdXRpb246IE1BWF9SRVNPTFVUSU9OLFxuICAgICAgfSxcbiAgICB9O1xuICAgIHRoaXMuY2hhbm5lbExvZ2dlcj8ubG9nKFxuICAgICAgTG9nTGV2ZWwuTUVTU0FHRVMsXG4gICAgICAnVmlkZW8gQXNzaWdubWVudCBjaGFubmVsOiBTZW5kaW5nIHJlcXVlc3QnLFxuICAgICAgcmVxdWVzdCxcbiAgICApO1xuICAgIHRyeSB7XG4gICAgICB0aGlzLmNoYW5uZWwuc2VuZChcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHJlcXVlc3QsXG4gICAgICAgIH0gYXMgVmlkZW9Bc3NpZ25tZW50Q2hhbm5lbEZyb21DbGllbnQpLFxuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmNoYW5uZWxMb2dnZXI/LmxvZyhcbiAgICAgICAgTG9nTGV2ZWwuRVJST1JTLFxuICAgICAgICAnVmlkZW8gQXNzaWdubWVudCBjaGFubmVsOiBGYWlsZWQgdG8gc2VuZCByZXF1ZXN0IHdpdGggZXJyb3InLFxuICAgICAgICBlIGFzIEVycm9yLFxuICAgICAgKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgY29uc3QgcmVxdWVzdFByb21pc2UgPSBuZXcgUHJvbWlzZTxNZWRpYUFwaVJlc3BvbnNlU3RhdHVzPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5wZW5kaW5nUmVxdWVzdFJlc29sdmVNYXAuc2V0KHJlcXVlc3QucmVxdWVzdElkLCByZXNvbHZlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVxdWVzdFByb21pc2U7XG4gIH1cblxuICBwcml2YXRlIGlzTWVkaWFFbnRyeUFzc2lnbmVkVG9NZWV0U3RyZWFtVHJhY2soXG4gICAgbWVkaWFFbnRyeTogTWVkaWFFbnRyeSxcbiAgICBpbnRlcm5hbE1lZGlhRW50cnk6IEludGVybmFsTWVkaWFFbnRyeSxcbiAgKTogYm9vbGVhbiB7XG4gICAgY29uc3QgdmlkZW9NZWV0U3RyZWFtVHJhY2sgPSBtZWRpYUVudHJ5LnZpZGVvTWVldFN0cmVhbVRyYWNrLmdldCgpO1xuICAgIGlmICghdmlkZW9NZWV0U3RyZWFtVHJhY2spIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBpbnRlcm5hbE1lZXRTdHJlYW1UcmFjayA9XG4gICAgICB0aGlzLmludGVybmFsTWVldFN0cmVhbVRyYWNrTWFwLmdldCh2aWRlb01lZXRTdHJlYW1UcmFjayk7XG5cbiAgICBpZiAoaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2shLnZpZGVvU3NyYyA9PT0gaW50ZXJuYWxNZWRpYUVudHJ5LnZpZGVvU3NyYykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHNzcmNzIGNhbiBjaGFuZ2UsIGlmIHRoZSB2aWRlbyBzc3JjIGlzIG5vdCB0aGUgc2FtZSwgd2UgbmVlZCB0byByZW1vdmVcbiAgICAgIC8vIHRoZSByZWxhdGlvbnNoaXAgYmV0d2VlbiB0aGUgbWVkaWEgZW50cnkgYW5kIHRoZSBtZWV0IHN0cmVhbSB0cmFjay5cbiAgICAgIGludGVybmFsTWVkaWFFbnRyeS52aWRlb01lZXRTdHJlYW1UcmFjay5zZXQodW5kZWZpbmVkKTtcbiAgICAgIGludGVybmFsTWVldFN0cmVhbVRyYWNrPy5tZWRpYUVudHJ5LnNldCh1bmRlZmluZWQpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYXNzaWduVmlkZW9NZWV0U3RyZWFtVHJhY2sobWVkaWFFbnRyeTogTWVkaWFFbnRyeSkge1xuICAgIGZvciAoY29uc3QgW21lZXRTdHJlYW1UcmFjaywgaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2tdIG9mIHRoaXNcbiAgICAgIC5pbnRlcm5hbE1lZXRTdHJlYW1UcmFja01hcCkge1xuICAgICAgaWYgKG1lZXRTdHJlYW1UcmFjay5tZWRpYVN0cmVhbVRyYWNrLmtpbmQgPT09ICd2aWRlbycpIHtcbiAgICAgICAgaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2subWF5YmVBc3NpZ25NZWRpYUVudHJ5T25GcmFtZShcbiAgICAgICAgICBtZWRpYUVudHJ5LFxuICAgICAgICAgICd2aWRlbycsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgVGhlIGRlZmF1bHQgY29tbXVuaWNhdGlvbiBwcm90b2NvbCBmb3IgdGhlIE1lZGlhIEFQSSBjbGllbnRcbiAqIHdpdGggTWVldCBBUEkuXG4gKi9cblxuaW1wb3J0IHtNZWV0TWVkaWFDbGllbnRSZXF1aXJlZENvbmZpZ3VyYXRpb259IGZyb20gJy4uLy4uL3R5cGVzL21lZGlhdHlwZXMnO1xuXG5pbXBvcnQge1xuICBNZWRpYUFwaUNvbW11bmljYXRpb25Qcm90b2NvbCxcbiAgTWVkaWFBcGlDb21tdW5pY2F0aW9uUmVzcG9uc2UsXG59IGZyb20gJy4uLy4uL3R5cGVzL2NvbW11bmljYXRpb25fcHJvdG9jb2wnO1xuXG5jb25zdCBNRUVUX0FQSV9VUkwgPSAnaHR0cHM6Ly9tZWV0Lmdvb2dsZWFwaXMuY29tL3YyYmV0YS8nO1xuXG4vKipcbiAqIFRoZSBIVFRQIGNvbW11bmljYXRpb24gcHJvdG9jb2wgZm9yIGNvbW11bmljYXRpb24gd2l0aCBNZWV0IEFQSS5cbiAqL1xuZXhwb3J0IGNsYXNzIERlZmF1bHRDb21tdW5pY2F0aW9uUHJvdG9jb2xJbXBsXG4gIGltcGxlbWVudHMgTWVkaWFBcGlDb21tdW5pY2F0aW9uUHJvdG9jb2xcbntcbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSByZXF1aXJlZENvbmZpZ3VyYXRpb246IE1lZXRNZWRpYUNsaWVudFJlcXVpcmVkQ29uZmlndXJhdGlvbixcbiAgICBwcml2YXRlIHJlYWRvbmx5IG1lZXRBcGlVcmw6IHN0cmluZyA9IE1FRVRfQVBJX1VSTCxcbiAgKSB7fVxuXG4gIGFzeW5jIGNvbm5lY3RBY3RpdmVDb25mZXJlbmNlKFxuICAgIHNkcE9mZmVyOiBzdHJpbmcsXG4gICk6IFByb21pc2U8TWVkaWFBcGlDb21tdW5pY2F0aW9uUmVzcG9uc2U+IHtcbiAgICAvLyBDYWxsIHRvIE1lZXQgQVBJXG4gICAgY29uc3QgY29ubmVjdFVybCA9IGAke3RoaXMubWVldEFwaVVybH0ke3RoaXMucmVxdWlyZWRDb25maWd1cmF0aW9uLm1lZXRpbmdTcGFjZUlkfTpjb25uZWN0QWN0aXZlQ29uZmVyZW5jZWA7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChjb25uZWN0VXJsLCB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7dGhpcy5yZXF1aXJlZENvbmZpZ3VyYXRpb24uYWNjZXNzVG9rZW59YCxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICdvZmZlcic6IHNkcE9mZmVyLFxuICAgICAgfSksXG4gICAgfSk7XG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgY29uc3QgYm9keVJlYWRlciA9IHJlc3BvbnNlLmJvZHk/LmdldFJlYWRlcigpO1xuICAgICAgbGV0IGVycm9yID0gJyc7XG4gICAgICBpZiAoYm9keVJlYWRlcikge1xuICAgICAgICBjb25zdCBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKCk7XG4gICAgICAgIGxldCByZWFkaW5nRG9uZSA9IGZhbHNlO1xuICAgICAgICB3aGlsZSAoIXJlYWRpbmdEb25lKSB7XG4gICAgICAgICAgY29uc3Qge2RvbmUsIHZhbHVlfSA9IGF3YWl0IGJvZHlSZWFkZXI/LnJlYWQoKTtcbiAgICAgICAgICBpZiAoZG9uZSkge1xuICAgICAgICAgICAgcmVhZGluZ0RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVycm9yICs9IGRlY29kZXIuZGVjb2RlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3QgZXJyb3JKc29uID0gSlNPTi5wYXJzZShlcnJvcik7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7SlNPTi5zdHJpbmdpZnkoZXJyb3JKc29uLCBudWxsLCAyKX1gKTtcbiAgICB9XG4gICAgY29uc3QgcGF5bG9hZCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICByZXR1cm4ge2Fuc3dlcjogcGF5bG9hZFsnYW5zd2VyJ119IGFzIE1lZGlhQXBpQ29tbXVuaWNhdGlvblJlc3BvbnNlO1xuICB9XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgSW1wbGVtZW50YXRpb24gb2YgSW50ZXJuYWxNZWV0U3RyZWFtVHJhY2suXG4gKi9cblxuaW1wb3J0IHtNZWRpYUVudHJ5LCBNZWV0U3RyZWFtVHJhY2t9IGZyb20gJy4uL3R5cGVzL21lZGlhdHlwZXMnO1xuaW1wb3J0IHtTdWJzY3JpYmFibGVEZWxlZ2F0ZX0gZnJvbSAnLi9zdWJzY3JpYmFibGVfaW1wbCc7XG5cbmltcG9ydCB7SW50ZXJuYWxNZWRpYUVudHJ5LCBJbnRlcm5hbE1lZXRTdHJlYW1UcmFja30gZnJvbSAnLi9pbnRlcm5hbF90eXBlcyc7XG5cbi8qKlxuICogSW1wbGVtZW50YXRpb24gb2YgSW50ZXJuYWxNZWV0U3RyZWFtVHJhY2suXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnRlcm5hbE1lZXRTdHJlYW1UcmFja0ltcGwgaW1wbGVtZW50cyBJbnRlcm5hbE1lZXRTdHJlYW1UcmFjayB7XG4gIHByaXZhdGUgcmVhZG9ubHkgcmVhZGVyOiBSZWFkYWJsZVN0cmVhbURlZmF1bHRSZWFkZXI7XG4gIHZpZGVvU3NyYz86IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihcbiAgICByZWFkb25seSByZWNlaXZlcjogUlRDUnRwUmVjZWl2ZXIsXG4gICAgcmVhZG9ubHkgbWVkaWFFbnRyeTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVkaWFFbnRyeSB8IHVuZGVmaW5lZD4sXG4gICAgcHJpdmF0ZSByZWFkb25seSBtZWV0U3RyZWFtVHJhY2s6IE1lZXRTdHJlYW1UcmFjayxcbiAgICBwcml2YXRlIHJlYWRvbmx5IGludGVybmFsTWVkaWFFbnRyeU1hcDogTWFwPE1lZGlhRW50cnksIEludGVybmFsTWVkaWFFbnRyeT4sXG4gICkge1xuICAgIGNvbnN0IG1lZGlhU3RyZWFtVHJhY2sgPSBtZWV0U3RyZWFtVHJhY2subWVkaWFTdHJlYW1UcmFjaztcbiAgICBsZXQgbWVkaWFTdHJlYW1UcmFja1Byb2Nlc3NvcjtcbiAgICBpZiAobWVkaWFTdHJlYW1UcmFjay5raW5kID09PSAnYXVkaW8nKSB7XG4gICAgICBtZWRpYVN0cmVhbVRyYWNrUHJvY2Vzc29yID0gbmV3IE1lZGlhU3RyZWFtVHJhY2tQcm9jZXNzb3Ioe1xuICAgICAgICB0cmFjazogbWVkaWFTdHJlYW1UcmFjayBhcyBNZWRpYVN0cmVhbUF1ZGlvVHJhY2ssXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWVkaWFTdHJlYW1UcmFja1Byb2Nlc3NvciA9IG5ldyBNZWRpYVN0cmVhbVRyYWNrUHJvY2Vzc29yKHtcbiAgICAgICAgdHJhY2s6IG1lZGlhU3RyZWFtVHJhY2sgYXMgTWVkaWFTdHJlYW1WaWRlb1RyYWNrLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHRoaXMucmVhZGVyID0gbWVkaWFTdHJlYW1UcmFja1Byb2Nlc3Nvci5yZWFkYWJsZS5nZXRSZWFkZXIoKTtcbiAgfVxuXG4gIGFzeW5jIG1heWJlQXNzaWduTWVkaWFFbnRyeU9uRnJhbWUoXG4gICAgbWVkaWFFbnRyeTogTWVkaWFFbnRyeSxcbiAgICBraW5kOiAnYXVkaW8nIHwgJ3ZpZGVvJyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gT25seSB3YW50IHRvIGNoZWNrIHRoZSBtZWRpYSBlbnRyeSBpZiBpdCBoYXMgdGhlIGNvcnJlY3QgY3NyYyB0eXBlXG4gICAgLy8gZm9yIHRoaXMgbWVldCBzdHJlYW0gdHJhY2suXG4gICAgaWYgKFxuICAgICAgIXRoaXMubWVkaWFTdHJlYW1UcmFja1NyY1ByZXNlbnQobWVkaWFFbnRyeSkgfHxcbiAgICAgIHRoaXMubWVldFN0cmVhbVRyYWNrLm1lZGlhU3RyZWFtVHJhY2sua2luZCAhPT0ga2luZFxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBMb29wIHRocm91Z2ggdGhlIGZyYW1lcyB1bnRpbCBtZWRpYSBlbnRyeSBpcyBhc3NpZ25lZCBieSBlaXRoZXIgdGhpc1xuICAgIC8vIG1lZXQgc3RyZWFtIHRyYWNrIG9yIGFub3RoZXIgbWVldCBzdHJlYW0gdHJhY2suXG4gICAgd2hpbGUgKCF0aGlzLm1lZGlhRW50cnlUcmFja0Fzc2lnbmVkKG1lZGlhRW50cnksIGtpbmQpKSB7XG4gICAgICBjb25zdCBmcmFtZSA9IGF3YWl0IHRoaXMucmVhZGVyLnJlYWQoKTtcbiAgICAgIGlmIChmcmFtZS5kb25lKSBicmVhaztcbiAgICAgIGlmIChraW5kID09PSAnYXVkaW8nKSB7XG4gICAgICAgIGF3YWl0IHRoaXMub25BdWRpb0ZyYW1lKG1lZGlhRW50cnkpO1xuICAgICAgfSBlbHNlIGlmIChraW5kID09PSAndmlkZW8nKSB7XG4gICAgICAgIHRoaXMub25WaWRlb0ZyYW1lKG1lZGlhRW50cnkpO1xuICAgICAgfVxuICAgICAgZnJhbWUudmFsdWUuY2xvc2UoKTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBvbkF1ZGlvRnJhbWUobWVkaWFFbnRyeTogTWVkaWFFbnRyeSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGludGVybmFsTWVkaWFFbnRyeSA9IHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwLmdldChtZWRpYUVudHJ5KTtcbiAgICBjb25zdCBjb250cmlidXRpbmdTb3VyY2VzOiBSVENSdHBDb250cmlidXRpbmdTb3VyY2VbXSA9XG4gICAgICB0aGlzLnJlY2VpdmVyLmdldENvbnRyaWJ1dGluZ1NvdXJjZXMoKTtcbiAgICBmb3IgKGNvbnN0IGNvbnRyaWJ1dGluZ1NvdXJjZSBvZiBjb250cmlidXRpbmdTb3VyY2VzKSB7XG4gICAgICBpZiAoY29udHJpYnV0aW5nU291cmNlLnNvdXJjZSA9PT0gaW50ZXJuYWxNZWRpYUVudHJ5IS5hdWRpb0NzcmMpIHtcbiAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS5hdWRpb01lZXRTdHJlYW1UcmFjay5zZXQodGhpcy5tZWV0U3RyZWFtVHJhY2spO1xuICAgICAgICB0aGlzLm1lZGlhRW50cnkuc2V0KG1lZGlhRW50cnkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgb25WaWRlb0ZyYW1lKG1lZGlhRW50cnk6IE1lZGlhRW50cnkpOiB2b2lkIHtcbiAgICBjb25zdCBpbnRlcm5hbE1lZGlhRW50cnkgPSB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcC5nZXQobWVkaWFFbnRyeSk7XG4gICAgY29uc3Qgc3luY2hyb25pemF0aW9uU291cmNlczogUlRDUnRwU3luY2hyb25pemF0aW9uU291cmNlW10gPVxuICAgICAgdGhpcy5yZWNlaXZlci5nZXRTeW5jaHJvbml6YXRpb25Tb3VyY2VzKCk7XG4gICAgZm9yIChjb25zdCBzeW5jU291cmNlIG9mIHN5bmNocm9uaXphdGlvblNvdXJjZXMpIHtcbiAgICAgIGlmIChzeW5jU291cmNlLnNvdXJjZSA9PT0gaW50ZXJuYWxNZWRpYUVudHJ5IS52aWRlb1NzcmMpIHtcbiAgICAgICAgdGhpcy52aWRlb1NzcmMgPSBzeW5jU291cmNlLnNvdXJjZTtcbiAgICAgICAgaW50ZXJuYWxNZWRpYUVudHJ5IS52aWRlb01lZXRTdHJlYW1UcmFjay5zZXQodGhpcy5tZWV0U3RyZWFtVHJhY2spO1xuICAgICAgICB0aGlzLm1lZGlhRW50cnkuc2V0KG1lZGlhRW50cnkpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm47XG4gIH1cblxuICBwcml2YXRlIG1lZGlhRW50cnlUcmFja0Fzc2lnbmVkKFxuICAgIG1lZGlhRW50cnk6IE1lZGlhRW50cnksXG4gICAga2luZDogJ2F1ZGlvJyB8ICd2aWRlbycsXG4gICk6IGJvb2xlYW4ge1xuICAgIGlmIChcbiAgICAgIChraW5kID09PSAnYXVkaW8nICYmIG1lZGlhRW50cnkuYXVkaW9NZWV0U3RyZWFtVHJhY2suZ2V0KCkpIHx8XG4gICAgICAoa2luZCA9PT0gJ3ZpZGVvJyAmJiBtZWRpYUVudHJ5LnZpZGVvTWVldFN0cmVhbVRyYWNrLmdldCgpKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgbWVkaWFTdHJlYW1UcmFja1NyY1ByZXNlbnQobWVkaWFFbnRyeTogTWVkaWFFbnRyeSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGludGVybmFsTWVkaWFFbnRyeSA9IHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwLmdldChtZWRpYUVudHJ5KTtcbiAgICBpZiAodGhpcy5tZWV0U3RyZWFtVHJhY2subWVkaWFTdHJlYW1UcmFjay5raW5kID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gISFpbnRlcm5hbE1lZGlhRW50cnk/LmF1ZGlvQ3NyYztcbiAgICB9IGVsc2UgaWYgKHRoaXMubWVldFN0cmVhbVRyYWNrLm1lZGlhU3RyZWFtVHJhY2sua2luZCA9PT0gJ3ZpZGVvJykge1xuICAgICAgcmV0dXJuICEhaW50ZXJuYWxNZWRpYUVudHJ5Py52aWRlb1NzcmM7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIiwiLypcbiAqIENvcHlyaWdodCAyMDI0IEdvb2dsZSBMTENcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IEltcGxlbWVudGF0aW9uIG9mIE1lZXRTdHJlYW1UcmFjay5cbiAqL1xuXG5pbXBvcnQge01lZGlhRW50cnksIE1lZXRTdHJlYW1UcmFja30gZnJvbSAnLi4vdHlwZXMvbWVkaWF0eXBlcyc7XG5pbXBvcnQge1N1YnNjcmliYWJsZX0gZnJvbSAnLi4vdHlwZXMvc3Vic2NyaWJhYmxlJztcblxuaW1wb3J0IHtTdWJzY3JpYmFibGVEZWxlZ2F0ZX0gZnJvbSAnLi9zdWJzY3JpYmFibGVfaW1wbCc7XG5cbi8qKlxuICogVGhlIGltcGxlbWVudGF0aW9uIG9mIE1lZXRTdHJlYW1UcmFjay5cbiAqL1xuZXhwb3J0IGNsYXNzIE1lZXRTdHJlYW1UcmFja0ltcGwgaW1wbGVtZW50cyBNZWV0U3RyZWFtVHJhY2sge1xuICByZWFkb25seSBtZWRpYUVudHJ5OiBTdWJzY3JpYmFibGU8TWVkaWFFbnRyeSB8IHVuZGVmaW5lZD47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVhZG9ubHkgbWVkaWFTdHJlYW1UcmFjazogTWVkaWFTdHJlYW1UcmFjayxcbiAgICBwcml2YXRlIHJlYWRvbmx5IG1lZGlhRW50cnlEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8XG4gICAgICBNZWRpYUVudHJ5IHwgdW5kZWZpbmVkXG4gICAgPixcbiAgKSB7XG4gICAgdGhpcy5tZWRpYUVudHJ5ID0gdGhpcy5tZWRpYUVudHJ5RGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCk7XG4gIH1cbn1cbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAyNCBHb29nbGUgTExDXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCB7XG4gIE1lZGlhQXBpQ29tbXVuaWNhdGlvblByb3RvY29sLFxuICBNZWRpYUFwaUNvbW11bmljYXRpb25SZXNwb25zZSxcbn0gZnJvbSAnLi4vdHlwZXMvY29tbXVuaWNhdGlvbl9wcm90b2NvbCc7XG5pbXBvcnQge01lZGlhQXBpUmVzcG9uc2VTdGF0dXN9IGZyb20gJy4uL3R5cGVzL2RhdGFjaGFubmVscyc7XG5pbXBvcnQge01lZXRDb25uZWN0aW9uU3RhdGV9IGZyb20gJy4uL3R5cGVzL2VudW1zJztcbmltcG9ydCB7XG4gIENhbnZhc0RpbWVuc2lvbnMsXG4gIE1lZGlhRW50cnksXG4gIE1lZGlhTGF5b3V0LFxuICBNZWRpYUxheW91dFJlcXVlc3QsXG4gIE1lZXRNZWRpYUNsaWVudFJlcXVpcmVkQ29uZmlndXJhdGlvbixcbiAgTWVldFN0cmVhbVRyYWNrLFxuICBQYXJ0aWNpcGFudCxcbn0gZnJvbSAnLi4vdHlwZXMvbWVkaWF0eXBlcyc7XG5pbXBvcnQge1xuICBNZWV0TWVkaWFBcGlDbGllbnQsXG4gIE1lZXRTZXNzaW9uU3RhdHVzLFxufSBmcm9tICcuLi90eXBlcy9tZWV0bWVkaWFhcGljbGllbnQnO1xuaW1wb3J0IHtTdWJzY3JpYmFibGV9IGZyb20gJy4uL3R5cGVzL3N1YnNjcmliYWJsZSc7XG5pbXBvcnQge0NoYW5uZWxMb2dnZXJ9IGZyb20gJy4vY2hhbm5lbF9oYW5kbGVycy9jaGFubmVsX2xvZ2dlcic7XG5pbXBvcnQge01lZGlhRW50cmllc0NoYW5uZWxIYW5kbGVyfSBmcm9tICcuL2NoYW5uZWxfaGFuZGxlcnMvbWVkaWFfZW50cmllc19jaGFubmVsX2hhbmRsZXInO1xuaW1wb3J0IHtNZWRpYVN0YXRzQ2hhbm5lbEhhbmRsZXJ9IGZyb20gJy4vY2hhbm5lbF9oYW5kbGVycy9tZWRpYV9zdGF0c19jaGFubmVsX2hhbmRsZXInO1xuaW1wb3J0IHtQYXJ0aWNpcGFudHNDaGFubmVsSGFuZGxlcn0gZnJvbSAnLi9jaGFubmVsX2hhbmRsZXJzL3BhcnRpY2lwYW50c19jaGFubmVsX2hhbmRsZXInO1xuaW1wb3J0IHtTZXNzaW9uQ29udHJvbENoYW5uZWxIYW5kbGVyfSBmcm9tICcuL2NoYW5uZWxfaGFuZGxlcnMvc2Vzc2lvbl9jb250cm9sX2NoYW5uZWxfaGFuZGxlcic7XG5pbXBvcnQge1ZpZGVvQXNzaWdubWVudENoYW5uZWxIYW5kbGVyfSBmcm9tICcuL2NoYW5uZWxfaGFuZGxlcnMvdmlkZW9fYXNzaWdubWVudF9jaGFubmVsX2hhbmRsZXInO1xuaW1wb3J0IHtEZWZhdWx0Q29tbXVuaWNhdGlvblByb3RvY29sSW1wbH0gZnJvbSAnLi9jb21tdW5pY2F0aW9uX3Byb3RvY29scy9kZWZhdWx0X2NvbW11bmljYXRpb25fcHJvdG9jb2xfaW1wbCc7XG5pbXBvcnQge0ludGVybmFsTWVldFN0cmVhbVRyYWNrSW1wbH0gZnJvbSAnLi9pbnRlcm5hbF9tZWV0X3N0cmVhbV90cmFja19pbXBsJztcbmltcG9ydCB7XG4gIEludGVybmFsTWVkaWFFbnRyeSxcbiAgSW50ZXJuYWxNZWRpYUxheW91dCxcbiAgSW50ZXJuYWxNZWV0U3RyZWFtVHJhY2ssXG4gIEludGVybmFsUGFydGljaXBhbnQsXG59IGZyb20gJy4vaW50ZXJuYWxfdHlwZXMnO1xuaW1wb3J0IHtNZWV0U3RyZWFtVHJhY2tJbXBsfSBmcm9tICcuL21lZXRfc3RyZWFtX3RyYWNrX2ltcGwnO1xuaW1wb3J0IHtTdWJzY3JpYmFibGVEZWxlZ2F0ZSwgU3Vic2NyaWJhYmxlSW1wbH0gZnJvbSAnLi9zdWJzY3JpYmFibGVfaW1wbCc7XG5cbi8vIE1lZXQgb25seSBzdXBwb3J0cyAzIGF1ZGlvIHZpcnR1YWwgc3NyY3MuIElmIGRpc2FibGVkLCB0aGVyZSB3aWxsIGJlIG5vXG4vLyBhdWRpby5cbmNvbnN0IE5VTUJFUl9PRl9BVURJT19WSVJUVUFMX1NTUkMgPSAzO1xuXG5jb25zdCBNSU5JTVVNX1ZJREVPX1NUUkVBTVMgPSAwO1xuY29uc3QgTUFYSU1VTV9WSURFT19TVFJFQU1TID0gMztcblxuLyoqXG4gKiBJbXBsZW1lbnRhdGlvbiBvZiBNZWV0TWVkaWFBcGlDbGllbnQuXG4gKi9cbmV4cG9ydCBjbGFzcyBNZWV0TWVkaWFBcGlDbGllbnRJbXBsIGltcGxlbWVudHMgTWVldE1lZGlhQXBpQ2xpZW50IHtcbiAgLy8gUHVibGljIHByb3BlcnRpZXNcbiAgcmVhZG9ubHkgc2Vzc2lvblN0YXR1czogU3Vic2NyaWJhYmxlPE1lZXRTZXNzaW9uU3RhdHVzPjtcbiAgcmVhZG9ubHkgbWVldFN0cmVhbVRyYWNrczogU3Vic2NyaWJhYmxlPE1lZXRTdHJlYW1UcmFja1tdPjtcbiAgcmVhZG9ubHkgbWVkaWFFbnRyaWVzOiBTdWJzY3JpYmFibGU8TWVkaWFFbnRyeVtdPjtcbiAgcmVhZG9ubHkgcGFydGljaXBhbnRzOiBTdWJzY3JpYmFibGU8UGFydGljaXBhbnRbXT47XG4gIHJlYWRvbmx5IHByZXNlbnRlcjogU3Vic2NyaWJhYmxlPE1lZGlhRW50cnkgfCB1bmRlZmluZWQ+O1xuICByZWFkb25seSBzY3JlZW5zaGFyZTogU3Vic2NyaWJhYmxlPE1lZGlhRW50cnkgfCB1bmRlZmluZWQ+O1xuXG4gIC8vIFByaXZhdGUgcHJvcGVydGllc1xuICBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb25TdGF0dXNEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVldFNlc3Npb25TdGF0dXM+O1xuICBwcml2YXRlIHJlYWRvbmx5IG1lZXRTdHJlYW1UcmFja3NEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8XG4gICAgTWVldFN0cmVhbVRyYWNrW11cbiAgPjtcbiAgcHJpdmF0ZSByZWFkb25seSBtZWRpYUVudHJpZXNEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVkaWFFbnRyeVtdPjtcbiAgcHJpdmF0ZSByZWFkb25seSBwYXJ0aWNpcGFudHNEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8UGFydGljaXBhbnRbXT47XG4gIHByaXZhdGUgcmVhZG9ubHkgcHJlc2VudGVyRGVsZWdhdGU6IFN1YnNjcmliYWJsZURlbGVnYXRlPFxuICAgIE1lZGlhRW50cnkgfCB1bmRlZmluZWRcbiAgPjtcbiAgcHJpdmF0ZSByZWFkb25seSBzY3JlZW5zaGFyZURlbGVnYXRlOiBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxcbiAgICBNZWRpYUVudHJ5IHwgdW5kZWZpbmVkXG4gID47XG5cbiAgcHJpdmF0ZSByZWFkb25seSBwZWVyQ29ubmVjdGlvbjogUlRDUGVlckNvbm5lY3Rpb247XG5cbiAgcHJpdmF0ZSBzZXNzaW9uQ29udHJvbENoYW5uZWw6IFJUQ0RhdGFDaGFubmVsIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIHNlc3Npb25Db250cm9sQ2hhbm5lbEhhbmRsZXI6XG4gICAgfCBTZXNzaW9uQ29udHJvbENoYW5uZWxIYW5kbGVyXG4gICAgfCB1bmRlZmluZWQ7XG5cbiAgcHJpdmF0ZSB2aWRlb0Fzc2lnbm1lbnRDaGFubmVsOiBSVENEYXRhQ2hhbm5lbCB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSB2aWRlb0Fzc2lnbm1lbnRDaGFubmVsSGFuZGxlcjpcbiAgICB8IFZpZGVvQXNzaWdubWVudENoYW5uZWxIYW5kbGVyXG4gICAgfCB1bmRlZmluZWQ7XG5cbiAgcHJpdmF0ZSBtZWRpYUVudHJpZXNDaGFubmVsOiBSVENEYXRhQ2hhbm5lbCB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBtZWRpYVN0YXRzQ2hhbm5lbDogUlRDRGF0YUNoYW5uZWwgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgcGFydGljaXBhbnRzQ2hhbm5lbDogUlRDRGF0YUNoYW5uZWwgfCB1bmRlZmluZWQ7XG5cbiAgLyogdHNsaW50OmRpc2FibGU6bm8tdW51c2VkLXZhcmlhYmxlICovXG4gIC8vIFRoaXMgaXMgdW51c2VkIGJlY2F1c2UgaXQgaXMgcmVjZWl2ZSBvbmx5LlxuICAvLyBAdHMtaWdub3JlXG4gIHByaXZhdGUgbWVkaWFFbnRyaWVzQ2hhbm5lbEhhbmRsZXI6IE1lZGlhRW50cmllc0NoYW5uZWxIYW5kbGVyIHwgdW5kZWZpbmVkO1xuXG4gIC8vIEB0cy1pZ25vcmVcbiAgcHJpdmF0ZSBtZWRpYVN0YXRzQ2hhbm5lbEhhbmRsZXI6IE1lZGlhU3RhdHNDaGFubmVsSGFuZGxlciB8IHVuZGVmaW5lZDtcblxuICAvLyBAdHMtaWdub3JlXG4gIHByaXZhdGUgcGFydGljaXBhbnRzQ2hhbm5lbEhhbmRsZXI6IFBhcnRpY2lwYW50c0NoYW5uZWxIYW5kbGVyIHwgdW5kZWZpbmVkO1xuICAvKiB0c2xpbnQ6ZW5hYmxlOm5vLXVudXNlZC12YXJpYWJsZSAqL1xuXG4gIHByaXZhdGUgbWVkaWFMYXlvdXRJZCA9IDE7XG5cbiAgLy8gTWVkaWEgbGF5b3V0IHJldHJpZXZhbCBieSBpZC4gTmVlZGVkIGJ5IHRoZSB2aWRlbyBhc3NpZ25tZW50IGNoYW5uZWwgaGFuZGxlclxuICAvLyB0byB1cGRhdGUgdGhlIG1lZGlhIGxheW91dC5cbiAgcHJpdmF0ZSByZWFkb25seSBpZE1lZGlhTGF5b3V0TWFwID0gbmV3IE1hcDxudW1iZXIsIE1lZGlhTGF5b3V0PigpO1xuXG4gIC8vIFVzZWQgdG8gdXBkYXRlIG1lZGlhIGxheW91dHMuXG4gIHByaXZhdGUgcmVhZG9ubHkgaW50ZXJuYWxNZWRpYUxheW91dE1hcCA9IG5ldyBNYXA8XG4gICAgTWVkaWFMYXlvdXQsXG4gICAgSW50ZXJuYWxNZWRpYUxheW91dFxuICA+KCk7XG5cbiAgLy8gTWVkaWEgZW50cnkgcmV0cmlldmFsIGJ5IGlkLiBOZWVkZWQgYnkgdGhlIHZpZGVvIGFzc2lnbm1lbnQgY2hhbm5lbCBoYW5kbGVyXG4gIC8vIHRvIHVwZGF0ZSB0aGUgbWVkaWEgZW50cnkuXG4gIHByaXZhdGUgcmVhZG9ubHkgaWRNZWRpYUVudHJ5TWFwID0gbmV3IE1hcDxudW1iZXIsIE1lZGlhRW50cnk+KCk7XG5cbiAgLy8gVXNlZCB0byB1cGRhdGUgbWVkaWEgZW50cmllcy5cbiAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbE1lZGlhRW50cnlNYXAgPSBuZXcgTWFwPFxuICAgIE1lZGlhRW50cnksXG4gICAgSW50ZXJuYWxNZWRpYUVudHJ5XG4gID4oKTtcblxuICAvLyBVc2VkIHRvIHVwZGF0ZSBtZWV0IHN0cmVhbSB0cmFja3MuXG4gIHByaXZhdGUgcmVhZG9ubHkgaW50ZXJuYWxNZWV0U3RyZWFtVHJhY2tNYXAgPSBuZXcgTWFwPFxuICAgIE1lZXRTdHJlYW1UcmFjayxcbiAgICBJbnRlcm5hbE1lZXRTdHJlYW1UcmFja1xuICA+KCk7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBpZFBhcnRpY2lwYW50TWFwID0gbmV3IE1hcDxudW1iZXIsIFBhcnRpY2lwYW50PigpO1xuICBwcml2YXRlIHJlYWRvbmx5IG5hbWVQYXJ0aWNpcGFudE1hcCA9IG5ldyBNYXA8c3RyaW5nLCBQYXJ0aWNpcGFudD4oKTtcbiAgcHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbFBhcnRpY2lwYW50TWFwID0gbmV3IE1hcDxcbiAgICBQYXJ0aWNpcGFudCxcbiAgICBJbnRlcm5hbFBhcnRpY2lwYW50XG4gID4oKTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IHJlcXVpcmVkQ29uZmlndXJhdGlvbjogTWVldE1lZGlhQ2xpZW50UmVxdWlyZWRDb25maWd1cmF0aW9uLFxuICApIHtcbiAgICB0aGlzLnZhbGlkYXRlQ29uZmlndXJhdGlvbigpO1xuXG4gICAgdGhpcy5zZXNzaW9uU3RhdHVzRGVsZWdhdGUgPSBuZXcgU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVldFNlc3Npb25TdGF0dXM+KHtcbiAgICAgIGNvbm5lY3Rpb25TdGF0ZTogTWVldENvbm5lY3Rpb25TdGF0ZS5VTktOT1dOLFxuICAgIH0pO1xuICAgIHRoaXMuc2Vzc2lvblN0YXR1cyA9IHRoaXMuc2Vzc2lvblN0YXR1c0RlbGVnYXRlLmdldFN1YnNjcmliYWJsZSgpO1xuICAgIHRoaXMubWVldFN0cmVhbVRyYWNrc0RlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPE1lZXRTdHJlYW1UcmFja1tdPihcbiAgICAgIFtdLFxuICAgICk7XG4gICAgdGhpcy5tZWV0U3RyZWFtVHJhY2tzID0gdGhpcy5tZWV0U3RyZWFtVHJhY2tzRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCk7XG4gICAgdGhpcy5tZWRpYUVudHJpZXNEZWxlZ2F0ZSA9IG5ldyBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxNZWRpYUVudHJ5W10+KFtdKTtcbiAgICB0aGlzLm1lZGlhRW50cmllcyA9IHRoaXMubWVkaWFFbnRyaWVzRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCk7XG4gICAgdGhpcy5wYXJ0aWNpcGFudHNEZWxlZ2F0ZSA9IG5ldyBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxQYXJ0aWNpcGFudFtdPihbXSk7XG4gICAgdGhpcy5wYXJ0aWNpcGFudHMgPSB0aGlzLnBhcnRpY2lwYW50c0RlbGVnYXRlLmdldFN1YnNjcmliYWJsZSgpO1xuICAgIHRoaXMucHJlc2VudGVyRGVsZWdhdGUgPSBuZXcgU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVkaWFFbnRyeSB8IHVuZGVmaW5lZD4oXG4gICAgICB1bmRlZmluZWQsXG4gICAgKTtcbiAgICB0aGlzLnByZXNlbnRlciA9IHRoaXMucHJlc2VudGVyRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCk7XG4gICAgdGhpcy5zY3JlZW5zaGFyZURlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPE1lZGlhRW50cnkgfCB1bmRlZmluZWQ+KFxuICAgICAgdW5kZWZpbmVkLFxuICAgICk7XG4gICAgdGhpcy5zY3JlZW5zaGFyZSA9IHRoaXMuc2NyZWVuc2hhcmVEZWxlZ2F0ZS5nZXRTdWJzY3JpYmFibGUoKTtcblxuICAgIGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB7XG4gICAgICBzZHBTZW1hbnRpY3M6ICd1bmlmaWVkLXBsYW4nLFxuICAgICAgYnVuZGxlUG9saWN5OiAnbWF4LWJ1bmRsZScgYXMgUlRDQnVuZGxlUG9saWN5LFxuICAgICAgaWNlU2VydmVyczogW3t1cmxzOiAnc3R1bjpzdHVuLmwuZ29vZ2xlLmNvbToxOTMwMid9XSxcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIHBlZXIgY29ubmVjdGlvblxuICAgIHRoaXMucGVlckNvbm5lY3Rpb24gPSBuZXcgUlRDUGVlckNvbm5lY3Rpb24oY29uZmlndXJhdGlvbik7XG4gICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5vbnRyYWNrID0gKGUpID0+IHtcbiAgICAgIGlmIChlLnRyYWNrKSB7XG4gICAgICAgIHRoaXMuY3JlYXRlTWVldFN0cmVhbVRyYWNrKGUudHJhY2ssIGUucmVjZWl2ZXIpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIHZhbGlkYXRlQ29uZmlndXJhdGlvbigpOiB2b2lkIHtcbiAgICBpZiAoXG4gICAgICB0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5udW1iZXJPZlZpZGVvU3RyZWFtcyA8IE1JTklNVU1fVklERU9fU1RSRUFNUyB8fFxuICAgICAgdGhpcy5yZXF1aXJlZENvbmZpZ3VyYXRpb24ubnVtYmVyT2ZWaWRlb1N0cmVhbXMgPiBNQVhJTVVNX1ZJREVPX1NUUkVBTVNcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFVuc3VwcG9ydGVkIG51bWJlciBvZiB2aWRlbyBzdHJlYW1zLCBtdXN0IGJlIGJldHdlZW4gJHtNSU5JTVVNX1ZJREVPX1NUUkVBTVN9IGFuZCAke01BWElNVU1fVklERU9fU1RSRUFNU31gLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZU1lZXRTdHJlYW1UcmFjayhcbiAgICBtZWRpYVN0cmVhbVRyYWNrOiBNZWRpYVN0cmVhbVRyYWNrLFxuICAgIHJlY2VpdmVyOiBSVENSdHBSZWNlaXZlcixcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgbWVldFN0cmVhbVRyYWNrcyA9IHRoaXMubWVldFN0cmVhbVRyYWNrcy5nZXQoKTtcbiAgICBjb25zdCBtZWRpYUVudHJ5RGVsZWdhdGUgPSBuZXcgU3Vic2NyaWJhYmxlRGVsZWdhdGU8TWVkaWFFbnRyeSB8IHVuZGVmaW5lZD4oXG4gICAgICB1bmRlZmluZWQsXG4gICAgKTtcbiAgICBjb25zdCBtZWV0U3RyZWFtVHJhY2sgPSBuZXcgTWVldFN0cmVhbVRyYWNrSW1wbChcbiAgICAgIG1lZGlhU3RyZWFtVHJhY2ssXG4gICAgICBtZWRpYUVudHJ5RGVsZWdhdGUsXG4gICAgKTtcblxuICAgIGNvbnN0IGludGVybmFsTWVldFN0cmVhbVRyYWNrID0gbmV3IEludGVybmFsTWVldFN0cmVhbVRyYWNrSW1wbChcbiAgICAgIHJlY2VpdmVyLFxuICAgICAgbWVkaWFFbnRyeURlbGVnYXRlLFxuICAgICAgbWVldFN0cmVhbVRyYWNrLFxuICAgICAgdGhpcy5pbnRlcm5hbE1lZGlhRW50cnlNYXAsXG4gICAgKTtcblxuICAgIGNvbnN0IG5ld1N0cmVhbVRyYWNrQXJyYXkgPSBbLi4ubWVldFN0cmVhbVRyYWNrcywgbWVldFN0cmVhbVRyYWNrXTtcbiAgICB0aGlzLmludGVybmFsTWVldFN0cmVhbVRyYWNrTWFwLnNldChcbiAgICAgIG1lZXRTdHJlYW1UcmFjayxcbiAgICAgIGludGVybmFsTWVldFN0cmVhbVRyYWNrLFxuICAgICk7XG4gICAgdGhpcy5tZWV0U3RyZWFtVHJhY2tzRGVsZWdhdGUuc2V0KG5ld1N0cmVhbVRyYWNrQXJyYXkpO1xuICB9XG5cbiAgYXN5bmMgam9pbk1lZXRpbmcoXG4gICAgY29tbXVuaWNhdGlvblByb3RvY29sPzogTWVkaWFBcGlDb21tdW5pY2F0aW9uUHJvdG9jb2wsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIC8vIFRoZSBvZmZlciBtdXN0IGJlIGluIHRoZSBvcmRlciBvZiBhdWRpbywgZGF0YWNoYW5uZWxzLCB2aWRlby5cblxuICAgIC8vIENyZWF0ZSBhdWRpbyB0cmFuc2NlaXZlcnMgYmFzZWQgb24gaW5pdGlhbCBjb25maWcuXG4gICAgaWYgKHRoaXMucmVxdWlyZWRDb25maWd1cmF0aW9uLmVuYWJsZUF1ZGlvU3RyZWFtcykge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBOVU1CRVJfT0ZfQVVESU9fVklSVFVBTF9TU1JDOyBpKyspIHtcbiAgICAgICAgLy8gSW50ZWdyYXRpbmcgY2xpZW50cyBtdXN0IHN1cHBvcnQgYW5kIG5lZ290aWF0ZSB0aGUgT1BVUyBjb2RlYyBpblxuICAgICAgICAvLyB0aGUgU0RQIG9mZmVyLlxuICAgICAgICAvLyBUaGlzIGlzIHRoZSBkZWZhdWx0IGZvciBXZWJSVEMuXG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL01lZGlhL0Zvcm1hdHMvV2ViUlRDX2NvZGVjcy5cbiAgICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5hZGRUcmFuc2NlaXZlcignYXVkaW8nLCB7ZGlyZWN0aW9uOiAncmVjdm9ubHknfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gLS0tLSBVVElMSVRZIERBVEEgQ0hBTk5FTFMgLS0tLS1cblxuICAgIC8vIEFsbCBkYXRhIGNoYW5uZWxzIG11c3QgYmUgcmVsaWFibGUgYW5kIG9yZGVyZWQuXG4gICAgY29uc3QgZGF0YUNoYW5uZWxDb25maWcgPSB7XG4gICAgICBvcmRlcmVkOiB0cnVlLFxuICAgICAgcmVsaWFibGU6IHRydWUsXG4gICAgfTtcblxuICAgIC8vIEFsd2F5cyBjcmVhdGUgdGhlIHNlc3Npb24gYW5kIG1lZGlhIHN0YXRzIGNvbnRyb2wgY2hhbm5lbC5cbiAgICB0aGlzLnNlc3Npb25Db250cm9sQ2hhbm5lbCA9IHRoaXMucGVlckNvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoXG4gICAgICAnc2Vzc2lvbi1jb250cm9sJyxcbiAgICAgIGRhdGFDaGFubmVsQ29uZmlnLFxuICAgICk7XG4gICAgbGV0IHNlc3Npb25Db250cm9sY2hhbm5lbExvZ2dlcjtcbiAgICBpZiAodGhpcy5yZXF1aXJlZENvbmZpZ3VyYXRpb24/LmxvZ3NDYWxsYmFjaykge1xuICAgICAgc2Vzc2lvbkNvbnRyb2xjaGFubmVsTG9nZ2VyID0gbmV3IENoYW5uZWxMb2dnZXIoXG4gICAgICAgICdzZXNzaW9uLWNvbnRyb2wnLFxuICAgICAgICB0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5sb2dzQ2FsbGJhY2ssXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLnNlc3Npb25Db250cm9sQ2hhbm5lbEhhbmRsZXIgPSBuZXcgU2Vzc2lvbkNvbnRyb2xDaGFubmVsSGFuZGxlcihcbiAgICAgIHRoaXMuc2Vzc2lvbkNvbnRyb2xDaGFubmVsLFxuICAgICAgdGhpcy5zZXNzaW9uU3RhdHVzRGVsZWdhdGUsXG4gICAgICBzZXNzaW9uQ29udHJvbGNoYW5uZWxMb2dnZXIsXG4gICAgKTtcblxuICAgIHRoaXMubWVkaWFTdGF0c0NoYW5uZWwgPSB0aGlzLnBlZXJDb25uZWN0aW9uLmNyZWF0ZURhdGFDaGFubmVsKFxuICAgICAgJ21lZGlhLXN0YXRzJyxcbiAgICAgIGRhdGFDaGFubmVsQ29uZmlnLFxuICAgICk7XG4gICAgbGV0IG1lZGlhU3RhdHNDaGFubmVsTG9nZ2VyO1xuICAgIGlmICh0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbj8ubG9nc0NhbGxiYWNrKSB7XG4gICAgICBtZWRpYVN0YXRzQ2hhbm5lbExvZ2dlciA9IG5ldyBDaGFubmVsTG9nZ2VyKFxuICAgICAgICAnbWVkaWEtc3RhdHMnLFxuICAgICAgICB0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5sb2dzQ2FsbGJhY2ssXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLm1lZGlhU3RhdHNDaGFubmVsSGFuZGxlciA9IG5ldyBNZWRpYVN0YXRzQ2hhbm5lbEhhbmRsZXIoXG4gICAgICB0aGlzLm1lZGlhU3RhdHNDaGFubmVsLFxuICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbixcbiAgICAgIG1lZGlhU3RhdHNDaGFubmVsTG9nZ2VyLFxuICAgICk7XG5cbiAgICAvLyAtLS0tIENPTkRJVElPTkFMIERBVEEgQ0hBTk5FTFMgLS0tLS1cblxuICAgIC8vIFdlIG9ubHkgbmVlZCB0aGUgdmlkZW8gYXNzaWdubWVudCBjaGFubmVsIGlmIHdlIGFyZSByZXF1ZXN0aW5nIHZpZGVvLlxuICAgIGlmICh0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5udW1iZXJPZlZpZGVvU3RyZWFtcyA+IDApIHtcbiAgICAgIHRoaXMudmlkZW9Bc3NpZ25tZW50Q2hhbm5lbCA9IHRoaXMucGVlckNvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoXG4gICAgICAgICd2aWRlby1hc3NpZ25tZW50JyxcbiAgICAgICAgZGF0YUNoYW5uZWxDb25maWcsXG4gICAgICApO1xuICAgICAgbGV0IHZpZGVvQXNzaWdubWVudENoYW5uZWxMb2dnZXI7XG4gICAgICBpZiAodGhpcy5yZXF1aXJlZENvbmZpZ3VyYXRpb24/LmxvZ3NDYWxsYmFjaykge1xuICAgICAgICB2aWRlb0Fzc2lnbm1lbnRDaGFubmVsTG9nZ2VyID0gbmV3IENoYW5uZWxMb2dnZXIoXG4gICAgICAgICAgJ3ZpZGVvLWFzc2lnbm1lbnQnLFxuICAgICAgICAgIHRoaXMucmVxdWlyZWRDb25maWd1cmF0aW9uLmxvZ3NDYWxsYmFjayxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRoaXMudmlkZW9Bc3NpZ25tZW50Q2hhbm5lbEhhbmRsZXIgPSBuZXcgVmlkZW9Bc3NpZ25tZW50Q2hhbm5lbEhhbmRsZXIoXG4gICAgICAgIHRoaXMudmlkZW9Bc3NpZ25tZW50Q2hhbm5lbCxcbiAgICAgICAgdGhpcy5pZE1lZGlhRW50cnlNYXAsXG4gICAgICAgIHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwLFxuICAgICAgICB0aGlzLmlkTWVkaWFMYXlvdXRNYXAsXG4gICAgICAgIHRoaXMuaW50ZXJuYWxNZWRpYUxheW91dE1hcCxcbiAgICAgICAgdGhpcy5tZWRpYUVudHJpZXNEZWxlZ2F0ZSxcbiAgICAgICAgdGhpcy5pbnRlcm5hbE1lZXRTdHJlYW1UcmFja01hcCxcbiAgICAgICAgdmlkZW9Bc3NpZ25tZW50Q2hhbm5lbExvZ2dlcixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdGhpcy5yZXF1aXJlZENvbmZpZ3VyYXRpb24ubnVtYmVyT2ZWaWRlb1N0cmVhbXMgPiAwIHx8XG4gICAgICB0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5lbmFibGVBdWRpb1N0cmVhbXNcbiAgICApIHtcbiAgICAgIHRoaXMubWVkaWFFbnRyaWVzQ2hhbm5lbCA9IHRoaXMucGVlckNvbm5lY3Rpb24uY3JlYXRlRGF0YUNoYW5uZWwoXG4gICAgICAgICdtZWRpYS1lbnRyaWVzJyxcbiAgICAgICAgZGF0YUNoYW5uZWxDb25maWcsXG4gICAgICApO1xuICAgICAgbGV0IG1lZGlhRW50cmllc0NoYW5uZWxMb2dnZXI7XG4gICAgICBpZiAodGhpcy5yZXF1aXJlZENvbmZpZ3VyYXRpb24/LmxvZ3NDYWxsYmFjaykge1xuICAgICAgICBtZWRpYUVudHJpZXNDaGFubmVsTG9nZ2VyID0gbmV3IENoYW5uZWxMb2dnZXIoXG4gICAgICAgICAgJ21lZGlhLWVudHJpZXMnLFxuICAgICAgICAgIHRoaXMucmVxdWlyZWRDb25maWd1cmF0aW9uLmxvZ3NDYWxsYmFjayxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubWVkaWFFbnRyaWVzQ2hhbm5lbEhhbmRsZXIgPSBuZXcgTWVkaWFFbnRyaWVzQ2hhbm5lbEhhbmRsZXIoXG4gICAgICAgIHRoaXMubWVkaWFFbnRyaWVzQ2hhbm5lbCxcbiAgICAgICAgdGhpcy5tZWRpYUVudHJpZXNEZWxlZ2F0ZSxcbiAgICAgICAgdGhpcy5pZE1lZGlhRW50cnlNYXAsXG4gICAgICAgIHRoaXMuaW50ZXJuYWxNZWRpYUVudHJ5TWFwLFxuICAgICAgICB0aGlzLmludGVybmFsTWVldFN0cmVhbVRyYWNrTWFwLFxuICAgICAgICB0aGlzLmludGVybmFsTWVkaWFMYXlvdXRNYXAsXG4gICAgICAgIHRoaXMucGFydGljaXBhbnRzRGVsZWdhdGUsXG4gICAgICAgIHRoaXMubmFtZVBhcnRpY2lwYW50TWFwLFxuICAgICAgICB0aGlzLmlkUGFydGljaXBhbnRNYXAsXG4gICAgICAgIHRoaXMuaW50ZXJuYWxQYXJ0aWNpcGFudE1hcCxcbiAgICAgICAgdGhpcy5wcmVzZW50ZXJEZWxlZ2F0ZSxcbiAgICAgICAgdGhpcy5zY3JlZW5zaGFyZURlbGVnYXRlLFxuICAgICAgICBtZWRpYUVudHJpZXNDaGFubmVsTG9nZ2VyLFxuICAgICAgKTtcblxuICAgICAgdGhpcy5wYXJ0aWNpcGFudHNDaGFubmVsID1cbiAgICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5jcmVhdGVEYXRhQ2hhbm5lbCgncGFydGljaXBhbnRzJyk7XG4gICAgICBsZXQgcGFydGljaXBhbnRzQ2hhbm5lbExvZ2dlcjtcbiAgICAgIGlmICh0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbj8ubG9nc0NhbGxiYWNrKSB7XG4gICAgICAgIHBhcnRpY2lwYW50c0NoYW5uZWxMb2dnZXIgPSBuZXcgQ2hhbm5lbExvZ2dlcihcbiAgICAgICAgICAncGFydGljaXBhbnRzJyxcbiAgICAgICAgICB0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5sb2dzQ2FsbGJhY2ssXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMucGFydGljaXBhbnRzQ2hhbm5lbEhhbmRsZXIgPSBuZXcgUGFydGljaXBhbnRzQ2hhbm5lbEhhbmRsZXIoXG4gICAgICAgIHRoaXMucGFydGljaXBhbnRzQ2hhbm5lbCxcbiAgICAgICAgdGhpcy5wYXJ0aWNpcGFudHNEZWxlZ2F0ZSxcbiAgICAgICAgdGhpcy5pZFBhcnRpY2lwYW50TWFwLFxuICAgICAgICB0aGlzLm5hbWVQYXJ0aWNpcGFudE1hcCxcbiAgICAgICAgdGhpcy5pbnRlcm5hbFBhcnRpY2lwYW50TWFwLFxuICAgICAgICB0aGlzLmludGVybmFsTWVkaWFFbnRyeU1hcCxcbiAgICAgICAgcGFydGljaXBhbnRzQ2hhbm5lbExvZ2dlcixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5zZXNzaW9uU3RhdHVzRGVsZWdhdGUuc3Vic2NyaWJlKChzdGF0dXMpID0+IHtcbiAgICAgIGlmIChzdGF0dXMuY29ubmVjdGlvblN0YXRlID09PSBNZWV0Q29ubmVjdGlvblN0YXRlLkRJU0NPTk5FQ1RFRCkge1xuICAgICAgICB0aGlzLm1lZGlhU3RhdHNDaGFubmVsPy5jbG9zZSgpO1xuICAgICAgICB0aGlzLnZpZGVvQXNzaWdubWVudENoYW5uZWw/LmNsb3NlKCk7XG4gICAgICAgIHRoaXMubWVkaWFFbnRyaWVzQ2hhbm5lbD8uY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExvY2FsIGRlc2NyaXB0aW9uIGhhcyB0byBiZSBzZXQgYmVmb3JlIGFkZGluZyB2aWRlbyB0cmFuc2NlaXZlcnMgdG9cbiAgICAvLyBwcmVzZXJ2ZSB0aGUgb3JkZXIgb2YgYXVkaW8sIGRhdGFjaGFubmVscywgdmlkZW8uXG4gICAgbGV0IHBjT2ZmZXIgPSBhd2FpdCB0aGlzLnBlZXJDb25uZWN0aW9uLmNyZWF0ZU9mZmVyKCk7XG4gICAgYXdhaXQgdGhpcy5wZWVyQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKHBjT2ZmZXIpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnJlcXVpcmVkQ29uZmlndXJhdGlvbi5udW1iZXJPZlZpZGVvU3RyZWFtczsgaSsrKSB7XG4gICAgICAvLyBJbnRlZ3JhdGluZyBjbGllbnRzIG11c3Qgc3VwcG9ydCBhbmQgbmVnb3RpYXRlIEFWMSwgVlA5LCBhbmQgVlA4IGNvZGVjc1xuICAgICAgLy8gaW4gdGhlIFNEUCBvZmZlci5cbiAgICAgIC8vIFRoZSBkZWZhdWx0IGZvciBXZWJSVEMgaXMgVlA4LlxuICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvTWVkaWEvRm9ybWF0cy9XZWJSVENfY29kZWNzLlxuICAgICAgdGhpcy5wZWVyQ29ubmVjdGlvbi5hZGRUcmFuc2NlaXZlcigndmlkZW8nLCB7ZGlyZWN0aW9uOiAncmVjdm9ubHknfSk7XG4gICAgfVxuXG4gICAgcGNPZmZlciA9IGF3YWl0IHRoaXMucGVlckNvbm5lY3Rpb24uY3JlYXRlT2ZmZXIoKTtcbiAgICBhd2FpdCB0aGlzLnBlZXJDb25uZWN0aW9uLnNldExvY2FsRGVzY3JpcHRpb24ocGNPZmZlcik7XG4gICAgY29uc3QgcHJvdG9jb2w6IE1lZGlhQXBpQ29tbXVuaWNhdGlvblByb3RvY29sID1cbiAgICAgIGNvbW11bmljYXRpb25Qcm90b2NvbCA/P1xuICAgICAgbmV3IERlZmF1bHRDb21tdW5pY2F0aW9uUHJvdG9jb2xJbXBsKHRoaXMucmVxdWlyZWRDb25maWd1cmF0aW9uKTtcbiAgICBjb25zdCByZXNwb25zZTogTWVkaWFBcGlDb21tdW5pY2F0aW9uUmVzcG9uc2UgPVxuICAgICAgYXdhaXQgcHJvdG9jb2wuY29ubmVjdEFjdGl2ZUNvbmZlcmVuY2UocGNPZmZlci5zZHAgPz8gJycpO1xuICAgIGlmIChyZXNwb25zZT8uYW5zd2VyKSB7XG4gICAgICBhd2FpdCB0aGlzLnBlZXJDb25uZWN0aW9uLnNldFJlbW90ZURlc2NyaXB0aW9uKHtcbiAgICAgICAgdHlwZTogJ2Fuc3dlcicsXG4gICAgICAgIHNkcDogcmVzcG9uc2U/LmFuc3dlcixcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSBkbyBub3QgZXhwZWN0IHRoaXMgdG8gaGFwcGVuIGFuZCB0aGVyZWZvcmUgaXQgaXMgYW4gaW50ZXJuYWxcbiAgICAgIC8vIGVycm9yLlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcm5hbCBlcnJvciwgbm8gYW5zd2VyIGluIHJlc3BvbnNlJyk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGxlYXZlTWVldGluZygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5zZXNzaW9uQ29udHJvbENoYW5uZWxIYW5kbGVyKSB7XG4gICAgICByZXR1cm4gdGhpcy5zZXNzaW9uQ29udHJvbENoYW5uZWxIYW5kbGVyPy5sZWF2ZVNlc3Npb24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBjb25uZWN0IHRvIGEgbWVldGluZyBiZWZvcmUgbGVhdmluZyBpdCcpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRoZSBwcm9taXNlIHJlc29sdmluZyBvbiB0aGUgcmVxdWVzdCBkb2VzIG5vdCBtZWFuIHRoZSBsYXlvdXQgaGFzIGJlZW5cbiAgLy8gYXBwbGllZC4gSXQgbWVhbnMgdGhhdCB0aGUgcmVxdWVzdCBoYXMgYmVlbiBhY2NlcHRlZCBhbmQgeW91IG1heSBuZWVkIHRvXG4gIC8vIHdhaXQgYSBzaG9ydCBhbW91bnQgb2YgdGltZSBmb3IgdGhlc2UgbGF5b3V0cyB0byBiZSBhcHBsaWVkLlxuICBhcHBseUxheW91dChyZXF1ZXN0czogTWVkaWFMYXlvdXRSZXF1ZXN0W10pOiBQcm9taXNlPE1lZGlhQXBpUmVzcG9uc2VTdGF0dXM+IHtcbiAgICBpZiAoIXRoaXMudmlkZW9Bc3NpZ25tZW50Q2hhbm5lbEhhbmRsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1lvdSBtdXN0IGNvbm5lY3QgdG8gYSBtZWV0aW5nIHdpdGggdmlkZW8gYmVmb3JlIGFwcGx5aW5nIGEgbGF5b3V0JyxcbiAgICAgICk7XG4gICAgfVxuICAgIHJlcXVlc3RzLmZvckVhY2goKHJlcXVlc3QpID0+IHtcbiAgICAgIGlmICghcmVxdWVzdC5tZWRpYUxheW91dCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSByZXF1ZXN0IG11c3QgaW5jbHVkZSBhIG1lZGlhIGxheW91dCcpO1xuICAgICAgfVxuICAgICAgaWYgKCF0aGlzLmludGVybmFsTWVkaWFMYXlvdXRNYXAuaGFzKHJlcXVlc3QubWVkaWFMYXlvdXQpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnVGhlIG1lZGlhIGxheW91dCBtdXN0IGJlIGNyZWF0ZWQgdXNpbmcgdGhlIGNsaWVudCBiZWZvcmUgaXQgY2FuIGJlIGFwcGxpZWQnLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0aGlzLnZpZGVvQXNzaWdubWVudENoYW5uZWxIYW5kbGVyLnNlbmRSZXF1ZXN0cyhyZXF1ZXN0cyk7XG4gIH1cblxuICBjcmVhdGVNZWRpYUxheW91dChjYW52YXNEaW1lbnNpb25zOiBDYW52YXNEaW1lbnNpb25zKTogTWVkaWFMYXlvdXQge1xuICAgIGNvbnN0IG1lZGlhRW50cnlEZWxlZ2F0ZSA9IG5ldyBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxNZWRpYUVudHJ5IHwgdW5kZWZpbmVkPihcbiAgICAgIHVuZGVmaW5lZCxcbiAgICApO1xuICAgIGNvbnN0IG1lZGlhRW50cnkgPSBuZXcgU3Vic2NyaWJhYmxlSW1wbDxNZWRpYUVudHJ5IHwgdW5kZWZpbmVkPihcbiAgICAgIG1lZGlhRW50cnlEZWxlZ2F0ZSxcbiAgICApO1xuICAgIGNvbnN0IG1lZGlhTGF5b3V0OiBNZWRpYUxheW91dCA9IHtjYW52YXNEaW1lbnNpb25zLCBtZWRpYUVudHJ5fTtcbiAgICB0aGlzLmludGVybmFsTWVkaWFMYXlvdXRNYXAuc2V0KG1lZGlhTGF5b3V0LCB7XG4gICAgICBpZDogdGhpcy5tZWRpYUxheW91dElkLFxuICAgICAgbWVkaWFFbnRyeTogbWVkaWFFbnRyeURlbGVnYXRlLFxuICAgIH0pO1xuICAgIHRoaXMuaWRNZWRpYUxheW91dE1hcC5zZXQodGhpcy5tZWRpYUxheW91dElkLCBtZWRpYUxheW91dCk7XG4gICAgdGhpcy5tZWRpYUxheW91dElkKys7XG4gICAgcmV0dXJuIG1lZGlhTGF5b3V0O1xuICB9XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgSW1wbGVtZW50YXRpb24gb2YgdGhlIFN1YnNjcmliYWJsZSBpbnRlcmZhY2UuXG4gKi9cblxuaW1wb3J0IHtTdWJzY3JpYmFibGV9IGZyb20gJy4uL3R5cGVzL3N1YnNjcmliYWJsZSc7XG5cbi8qKlxuICogSW1wbGVtZW50YXRpb24gb2YgdGhlIFN1YnNjcmliYWJsZSBpbnRlcmZhY2UuXG4gKi9cbmV4cG9ydCBjbGFzcyBTdWJzY3JpYmFibGVJbXBsPFQ+IGltcGxlbWVudHMgU3Vic2NyaWJhYmxlPFQ+IHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBzdWJzY3JpYmFibGVEZWxlZ2F0ZTogU3Vic2NyaWJhYmxlRGVsZWdhdGU8VD4pIHt9XG5cbiAgZ2V0KCk6IFQge1xuICAgIHJldHVybiB0aGlzLnN1YnNjcmliYWJsZURlbGVnYXRlLmdldCgpO1xuICB9XG5cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiAodmFsdWU6IFQpID0+IHZvaWQpOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmliYWJsZURlbGVnYXRlLnN1YnNjcmliZShjYWxsYmFjayk7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJhYmxlRGVsZWdhdGUudW5zdWJzY3JpYmUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cblxuICB1bnN1YnNjcmliZShjYWxsYmFjazogKHZhbHVlOiBUKSA9PiB2b2lkKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc3Vic2NyaWJhYmxlRGVsZWdhdGUudW5zdWJzY3JpYmUoY2FsbGJhY2spO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIGNsYXNzIHRvIHVwZGF0ZSBhIHN1YnNjcmliYWJsZSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFN1YnNjcmliYWJsZURlbGVnYXRlPFQ+IHtcbiAgcHJpdmF0ZSByZWFkb25seSBzdWJzY3JpYmVycyA9IG5ldyBTZXQ8KHZhbHVlOiBUKSA9PiB2b2lkPigpO1xuICBwcml2YXRlIHJlYWRvbmx5IHN1YnNjcmliYWJsZTogU3Vic2NyaWJhYmxlPFQ+ID0gbmV3IFN1YnNjcmliYWJsZUltcGw8VD4oXG4gICAgdGhpcyxcbiAgKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHZhbHVlOiBUKSB7fVxuXG4gIHNldChuZXdWYWx1ZTogVCkge1xuICAgIGlmICh0aGlzLnZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgdGhpcy52YWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmliZXJzKSB7XG4gICAgICAgIGNhbGxiYWNrKG5ld1ZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQoKTogVCB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gIH1cblxuICBzdWJzY3JpYmUoY2FsbGJhY2s6ICh2YWx1ZTogVCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaWJlcnMuYWRkKGNhbGxiYWNrKTtcbiAgfVxuXG4gIHVuc3Vic2NyaWJlKGNhbGxiYWNrOiAodmFsdWU6IFQpID0+IHZvaWQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zdWJzY3JpYmVycy5kZWxldGUoY2FsbGJhY2spO1xuICB9XG5cbiAgZ2V0U3Vic2NyaWJhYmxlKCk6IFN1YnNjcmliYWJsZTxUPiB7XG4gICAgcmV0dXJuIHRoaXMuc3Vic2NyaWJhYmxlO1xuICB9XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMjQgR29vZ2xlIExMQ1xuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vKipcbiAqIEBmaWxlb3ZlcnZpZXcgVXRpbGl0eSBmdW5jdGlvbnMgZm9yIHRoZSBNZWV0TWVkaWFBcGlDbGllbnQuXG4gKi9cblxuaW1wb3J0IHtcbiAgTWVkaWFFbnRyeSxcbiAgTWVkaWFMYXlvdXQsXG4gIE1lZXRTdHJlYW1UcmFjayxcbiAgUGFydGljaXBhbnQsXG59IGZyb20gJy4uL3R5cGVzL21lZGlhdHlwZXMnO1xuXG5pbXBvcnQge0ludGVybmFsTWVkaWFFbnRyeX0gZnJvbSAnLi9pbnRlcm5hbF90eXBlcyc7XG5pbXBvcnQge1N1YnNjcmliYWJsZURlbGVnYXRlfSBmcm9tICcuL3N1YnNjcmliYWJsZV9pbXBsJztcblxuaW50ZXJmYWNlIEludGVybmFsTWVkaWFFbnRyeUVsZW1lbnQge1xuICBtZWRpYUVudHJ5OiBNZWRpYUVudHJ5O1xuICBpbnRlcm5hbE1lZGlhRW50cnk6IEludGVybmFsTWVkaWFFbnRyeTtcbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IG1lZGlhIGVudHJ5LlxuICogQHJldHVybiBUaGUgbmV3IG1lZGlhIGVudHJ5IGFuZCBpdHMgaW50ZXJuYWwgcmVwcmVzZW50YXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVNZWRpYUVudHJ5KHtcbiAgYXVkaW9NdXRlZCA9IGZhbHNlLFxuICB2aWRlb011dGVkID0gZmFsc2UsXG4gIHNjcmVlblNoYXJlID0gZmFsc2UsXG4gIGlzUHJlc2VudGVyID0gZmFsc2UsXG4gIHBhcnRpY2lwYW50LFxuICBtZWRpYUxheW91dCxcbiAgdmlkZW9NZWV0U3RyZWFtVHJhY2ssXG4gIGF1ZGlvTWVldFN0cmVhbVRyYWNrLFxuICBhdWRpb0NzcmMsXG4gIHZpZGVvQ3NyYyxcbiAgdmlkZW9Tc3JjLFxuICBpZCxcbiAgc2Vzc2lvbiA9ICcnLFxuICBzZXNzaW9uTmFtZSA9ICcnLFxufToge1xuICBpZDogbnVtYmVyO1xuICBhdWRpb011dGVkPzogYm9vbGVhbjtcbiAgdmlkZW9NdXRlZD86IGJvb2xlYW47XG4gIHNjcmVlblNoYXJlPzogYm9vbGVhbjtcbiAgaXNQcmVzZW50ZXI/OiBib29sZWFuO1xuICBwYXJ0aWNpcGFudD86IFBhcnRpY2lwYW50O1xuICBtZWRpYUxheW91dD86IE1lZGlhTGF5b3V0O1xuICBhdWRpb01lZXRTdHJlYW1UcmFjaz86IE1lZXRTdHJlYW1UcmFjaztcbiAgdmlkZW9NZWV0U3RyZWFtVHJhY2s/OiBNZWV0U3RyZWFtVHJhY2s7XG4gIHZpZGVvQ3NyYz86IG51bWJlcjtcbiAgYXVkaW9Dc3JjPzogbnVtYmVyO1xuICB2aWRlb1NzcmM/OiBudW1iZXI7XG4gIHNlc3Npb24/OiBzdHJpbmc7XG4gIHNlc3Npb25OYW1lPzogc3RyaW5nO1xufSk6IEludGVybmFsTWVkaWFFbnRyeUVsZW1lbnQge1xuICBjb25zdCBwYXJ0aWNpcGFudERlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPFBhcnRpY2lwYW50IHwgdW5kZWZpbmVkPihcbiAgICBwYXJ0aWNpcGFudCxcbiAgKTtcbiAgY29uc3QgYXVkaW9NdXRlZERlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPGJvb2xlYW4+KGF1ZGlvTXV0ZWQpO1xuICBjb25zdCB2aWRlb011dGVkRGVsZWdhdGUgPSBuZXcgU3Vic2NyaWJhYmxlRGVsZWdhdGU8Ym9vbGVhbj4odmlkZW9NdXRlZCk7XG4gIGNvbnN0IHNjcmVlblNoYXJlRGVsZWdhdGUgPSBuZXcgU3Vic2NyaWJhYmxlRGVsZWdhdGU8Ym9vbGVhbj4oc2NyZWVuU2hhcmUpO1xuICBjb25zdCBpc1ByZXNlbnRlckRlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPGJvb2xlYW4+KGlzUHJlc2VudGVyKTtcbiAgY29uc3QgbWVkaWFMYXlvdXREZWxlZ2F0ZSA9IG5ldyBTdWJzY3JpYmFibGVEZWxlZ2F0ZTxNZWRpYUxheW91dCB8IHVuZGVmaW5lZD4oXG4gICAgbWVkaWFMYXlvdXQsXG4gICk7XG4gIGNvbnN0IGF1ZGlvTWVldFN0cmVhbVRyYWNrRGVsZWdhdGUgPSBuZXcgU3Vic2NyaWJhYmxlRGVsZWdhdGU8XG4gICAgTWVldFN0cmVhbVRyYWNrIHwgdW5kZWZpbmVkXG4gID4oYXVkaW9NZWV0U3RyZWFtVHJhY2spO1xuICBjb25zdCB2aWRlb01lZXRTdHJlYW1UcmFja0RlbGVnYXRlID0gbmV3IFN1YnNjcmliYWJsZURlbGVnYXRlPFxuICAgIE1lZXRTdHJlYW1UcmFjayB8IHVuZGVmaW5lZFxuICA+KHZpZGVvTWVldFN0cmVhbVRyYWNrKTtcblxuICBjb25zdCBtZWRpYUVudHJ5OiBNZWRpYUVudHJ5ID0ge1xuICAgIHBhcnRpY2lwYW50OiBwYXJ0aWNpcGFudERlbGVnYXRlLmdldFN1YnNjcmliYWJsZSgpLFxuICAgIGF1ZGlvTXV0ZWQ6IGF1ZGlvTXV0ZWREZWxlZ2F0ZS5nZXRTdWJzY3JpYmFibGUoKSxcbiAgICB2aWRlb011dGVkOiB2aWRlb011dGVkRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgc2NyZWVuU2hhcmU6IHNjcmVlblNoYXJlRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgaXNQcmVzZW50ZXI6IGlzUHJlc2VudGVyRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgbWVkaWFMYXlvdXQ6IG1lZGlhTGF5b3V0RGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgYXVkaW9NZWV0U3RyZWFtVHJhY2s6IGF1ZGlvTWVldFN0cmVhbVRyYWNrRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgdmlkZW9NZWV0U3RyZWFtVHJhY2s6IHZpZGVvTWVldFN0cmVhbVRyYWNrRGVsZWdhdGUuZ2V0U3Vic2NyaWJhYmxlKCksXG4gICAgc2Vzc2lvbk5hbWUsXG4gICAgc2Vzc2lvbixcbiAgfTtcbiAgY29uc3QgaW50ZXJuYWxNZWRpYUVudHJ5OiBJbnRlcm5hbE1lZGlhRW50cnkgPSB7XG4gICAgaWQsXG4gICAgYXVkaW9NdXRlZDogYXVkaW9NdXRlZERlbGVnYXRlLFxuICAgIHZpZGVvTXV0ZWQ6IHZpZGVvTXV0ZWREZWxlZ2F0ZSxcbiAgICBzY3JlZW5TaGFyZTogc2NyZWVuU2hhcmVEZWxlZ2F0ZSxcbiAgICBpc1ByZXNlbnRlcjogaXNQcmVzZW50ZXJEZWxlZ2F0ZSxcbiAgICBtZWRpYUxheW91dDogbWVkaWFMYXlvdXREZWxlZ2F0ZSxcbiAgICBhdWRpb01lZXRTdHJlYW1UcmFjazogYXVkaW9NZWV0U3RyZWFtVHJhY2tEZWxlZ2F0ZSxcbiAgICB2aWRlb01lZXRTdHJlYW1UcmFjazogdmlkZW9NZWV0U3RyZWFtVHJhY2tEZWxlZ2F0ZSxcbiAgICBwYXJ0aWNpcGFudDogcGFydGljaXBhbnREZWxlZ2F0ZSxcbiAgICB2aWRlb1NzcmMsXG4gICAgYXVkaW9Dc3JjLFxuICAgIHZpZGVvQ3NyYyxcbiAgfTtcbiAgcmV0dXJuIHttZWRpYUVudHJ5LCBpbnRlcm5hbE1lZGlhRW50cnl9O1xufVxuIiwiLypcbiAqIENvcHlyaWdodCAyMDI0IEdvb2dsZSBMTENcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLyoqXG4gKiBAZmlsZW92ZXJ2aWV3IEVudW1zIGZvciB0aGUgTWVkaWEgQVBJIFdlYiBDbGllbnQuIFNpbmNlIG90aGVyIGZpbGVzIGFyZVxuICogdXNpbmcgdGhlIC5kLnRzIGZpbGUsIHdlIG5lZWQgdG8ga2VlcCB0aGUgZW51bXMgaW4gdGhpcyBmaWxlLlxuICovXG5cbi8qKlxuICogTG9nIGxldmVsIGZvciBlYWNoIGRhdGEgY2hhbm5lbC5cbiAqL1xuZXhwb3J0IGVudW0gTG9nTGV2ZWwge1xuICBVTktOT1dOID0gMCxcbiAgRVJST1JTID0gMSxcbiAgUkVTT1VSQ0VTID0gMixcbiAgTUVTU0FHRVMgPSAzLFxufVxuXG4vKiogQ29ubmVjdGlvbiBzdGF0ZSBvZiB0aGUgTWVldCBNZWRpYSBBUEkgc2Vzc2lvbi4gKi9cbmV4cG9ydCBlbnVtIE1lZXRDb25uZWN0aW9uU3RhdGUge1xuICBVTktOT1dOID0gMCxcbiAgV0FJVElORyA9IDEsXG4gIEpPSU5FRCA9IDIsXG4gIERJU0NPTk5FQ1RFRCA9IDMsXG59XG5cbi8qKiBSZWFzb25zIGZvciB0aGUgTWVldCBNZWRpYSBBUEkgc2Vzc2lvbiB0byBkaXNjb25uZWN0LiAqL1xuZXhwb3J0IGVudW0gTWVldERpc2Nvbm5lY3RSZWFzb24ge1xuICBVTktOT1dOID0gMCxcbiAgQ0xJRU5UX0xFRlQgPSAxLFxuICBVU0VSX1NUT1BQRUQgPSAyLFxuICBDT05GRVJFTkNFX0VOREVEID0gMyxcbiAgU0VTU0lPTl9VTkhFQUxUSFkgPSA0LFxufVxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCIvKipcbiAqIE1HdHJhbnNsYXRlIC0gTWVldCBNZWRpYSBBUEkgQ2xpZW50IEVudHJ5IFBvaW50XG4gKlxuICogVGhpcyBmaWxlIGV4cG9ydHMgdGhlIEdvb2dsZSBNZWV0IE1lZGlhIEFQSSBTREsgZm9yIGJyb3dzZXIgdXNlLlxuICogQnVpbHQgd2l0aCB3ZWJwYWNrIHRvIGNyZWF0ZSBhIGJ1bmRsZWQgSlMgZmlsZS5cbiAqL1xuXG5pbXBvcnQgeyBNZWV0TWVkaWFBcGlDbGllbnRJbXBsIH0gZnJvbSAnLi9pbnRlcm5hbC9tZWV0bWVkaWFhcGljbGllbnRfaW1wbCc7XG5pbXBvcnQgeyBNZWV0Q29ubmVjdGlvblN0YXRlIH0gZnJvbSAnLi90eXBlcy9lbnVtcyc7XG5pbXBvcnQgdHlwZSB7IE1lZXRTdHJlYW1UcmFjaywgTWVkaWFFbnRyeSwgUGFydGljaXBhbnQgfSBmcm9tICcuL3R5cGVzL21lZGlhdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBNZWV0U2Vzc2lvblN0YXR1cyB9IGZyb20gJy4vdHlwZXMvbWVldG1lZGlhYXBpY2xpZW50JztcblxuLy8gUmUtZXhwb3J0IG1haW4gY2xhc3NlcyBhbmQgdHlwZXNcbmV4cG9ydCB7XG4gIE1lZXRNZWRpYUFwaUNsaWVudEltcGwsXG4gIE1lZXRDb25uZWN0aW9uU3RhdGUsXG59O1xuXG5leHBvcnQgdHlwZSB7XG4gIE1lZXRTdHJlYW1UcmFjayxcbiAgTWVkaWFFbnRyeSxcbiAgUGFydGljaXBhbnQsXG4gIE1lZXRTZXNzaW9uU3RhdHVzLFxufTtcblxuLy8gSGVscGVyIHRvIGNyZWF0ZSBhIGNsaWVudCB3aXRoIHNpbXBsZXIgY29uZmlndXJhdGlvblxuZXhwb3J0IGludGVyZmFjZSBNR3RyYW5zbGF0ZUNsaWVudENvbmZpZyB7XG4gIG1lZXRpbmdDb2RlOiBzdHJpbmc7XG4gIGFjY2Vzc1Rva2VuOiBzdHJpbmc7XG4gIGVuYWJsZVZpZGVvPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUNsaWVudChjb25maWc6IE1HdHJhbnNsYXRlQ2xpZW50Q29uZmlnKSB7XG4gIHJldHVybiBuZXcgTWVldE1lZGlhQXBpQ2xpZW50SW1wbCh7XG4gICAgbWVldGluZ1NwYWNlSWQ6IGNvbmZpZy5tZWV0aW5nQ29kZSxcbiAgICBudW1iZXJPZlZpZGVvU3RyZWFtczogY29uZmlnLmVuYWJsZVZpZGVvID8gMSA6IDAsXG4gICAgZW5hYmxlQXVkaW9TdHJlYW1zOiB0cnVlLFxuICAgIGFjY2Vzc1Rva2VuOiBjb25maWcuYWNjZXNzVG9rZW4sXG4gIH0pO1xufVxuXG4vLyBFeHBvc2UgdG8gd2luZG93IGZvciBlYXN5IGFjY2VzcyBmcm9tIHZhbmlsbGEgSlNcbmlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAod2luZG93IGFzIGFueSkuTWVldE1lZGlhQ2xpZW50ID0ge1xuICAgIE1lZXRNZWRpYUFwaUNsaWVudEltcGwsXG4gICAgTWVldENvbm5lY3Rpb25TdGF0ZSxcbiAgICBjcmVhdGVDbGllbnQsXG4gIH07XG59XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9