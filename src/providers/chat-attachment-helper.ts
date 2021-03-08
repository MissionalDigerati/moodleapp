// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { Injectable } from '@angular/core';
import { CoreSitesProvider } from './sites';
import { Sanitizer } from '@classes/sanitizer';

/**
 * Provider that helps with the chat attachments developed for The Well project.
 */
@Injectable()
export class ChatAttachmentHelperProvider {
    /**
     * Set up the provider
     *
     * @param sitesProvider Our sites provider
     */
    constructor(sitesProvider: CoreSitesProvider) {
        sitesProvider.getSite().then((site) => this.siteDomain = site.siteUrl);
    }

    /**
     * The domain of the site
     */
    private siteDomain = '';
    /**
     * The path to the chat attachments on the server
     */
    private resourcePath = '/pluginfile.php/1/local_chat_attachments/chat_attachment/';

    /**
     * prepare the message for displaying.
     *
     * @param  message The message
     * @return         The converted message
     */
    prepareMessage(message: string): string {
        const actual = Sanitizer.decodeHTML(message);
        if (actual.indexOf('<attachment') === -1) {
            // No conversion needed

            return message;
        }
        const mediaType = /type="(.*?)"/g.exec(actual);
        const mediaId = /id="(.*?)"/g.exec(actual);
        const mediaFilePath = /filepath="(.*?)"/g.exec(actual);
        const mediaFileName = /filename="(.*?)"/g.exec(actual);
        if (mediaType && mediaId && mediaFilePath && mediaFileName) {
            const url = `${this.siteDomain}${this.resourcePath}`;
            const mediaUrl = `${url}${mediaId[1]}${mediaFilePath[1]}${mediaFileName[1]}`;
            if (mediaType[1] === 'photo' || mediaType[1] === 'album') {

                return `<p>
                    <img src="${mediaUrl}" />
                </p>`;
            }
            if (mediaType[1] === 'video') {
                const extension = mediaFileName[1].split('.').pop();
                let mimeType = '';
                switch (extension) {
                    case 'ogg': {
                        mimeType = 'video/ogg';
                        break;
                    }
                    case 'mp4': {
                        mimeType = 'video/mp4';
                        break;
                    }
                    case 'webm': {
                        mimeType = 'video/webm';
                        break;
                    }
                    default: {
                        mimeType = 'video/mp4';
                        break;
                    }

                }

                return `<video controls="true" class="video-attachment">
                    <source src="${mediaUrl}" type="${mimeType}">
                </video>`;
            }
        }

        return '<p>Unavailable Media</p>';
    }
}
