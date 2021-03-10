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
            const extension = mediaFileName[1].split('.').pop();
            if (mediaType[1] === 'audio') {

                return this.displayAudio(mediaUrl, mediaFileName[1], extension);
            }
            if (mediaType[1] === 'photo' || mediaType[1] === 'album') {

                return this.displayImage(mediaUrl);
            }
            if (mediaType[1] === 'video') {

                return this.displayVideo(mediaUrl, mediaFileName[1], extension);
            }
            if (mediaType[1] === 'document') {
                let content = '';
                switch (extension) {
                    case '3gp':
                    case '3gp2':
                    case 'aac':
                    case 'aiff':
                    case 'amr':
                    case 'mp3':
                    case 'm4a':
                    case 'm4b':
                    case 'm4p':
                    case 'wav':
                        content = this.displayAudio(mediaUrl, mediaFileName[1], extension);
                        break;
                    case 'webm':
                    case 'ogg':
                    case 'mp4':
                        content = this.displayVideo(mediaUrl, mediaFileName[1], extension);
                        break;
                    case 'jpg':
                    case 'jpeg':
                    case 'png':
                    case 'gif':
                        content = this.displayImage(mediaUrl);
                        break;

                    default:
                        content = this.displayLink(mediaUrl, mediaFileName[1]);
                        break;
                }

                return content;
            }
        }

        return '<p>Unavailable Media</p>';
    }

    /**
     * Get the HTML to display an audio tag
     *
     * @param   url         The URL for the media file
     * @param   fileName    The file's name
     * @param   extension   The extension of the file
     *
     * @return     The HTML markup
     */
    private displayAudio(url: string, fileName: string, extension: string): string {
        let mimeType = '';
        switch (extension) {
            case '3gp':
                mimeType = 'audio/3gpp';
                break;
            case '3gp2':
                mimeType = 'audio/3gpp2';
                break;
            case 'aac':
                mimeType = 'audio/aac';
                break;
            case 'aiff':
                mimeType = 'audio/aiff';
                break;
            case 'amr':
                mimeType = 'audio/amr';
                break;
            case 'mp3':
                mimeType = 'audio/mp3';
                break;
            case 'mp4':
                mimeType = 'audio/mp4';
                break;
            case 'm4a':
                mimeType = 'audio/x-m4a';
                break;
            case 'm4b':
                mimeType = 'audio/x-m4b';
                break;
            case 'm4p':
                mimeType = 'audio/x-m4p';
                break;
            case 'wav':
                mimeType = 'audio/wav';
                break;
            default:
                return this.displayLink(url, fileName);
        }

        return `<audio controls="true" class="audio-attachment video-js" title="${fileName}">
            <source src="${url}" type="${mimeType}">
            <a href="${url}" target="_blank"><i class="icomoon-attachment"></i> ${fileName}</a>
        </audio>`;
    }

    /**
     * Get the HTML to display an image
     *
     * @param  url The URL for the media file
     *
     * @return     The HTML markup
     */
    private displayImage(url: string): string {
        return `<p>
            <img src="${url}" />
        </p>`;
    }

    /**
     * Get the HTML to display a link
     *
     * @param  url          The URL for the media file
     * @param   fileName    The file's name
     *
     * @return     The HTML markup
     */
    private displayLink(url: string, fileName: string): string {
        return `<p class="attachment-message">
            <a href="${url}" target="_blank"><i class="icomoon-attachment"></i> ${fileName}</a>
        </p>`;
    }

    /**
     * Get the HTML to display a video
     *
     * @param   url         The URL for the media file
     * @param   fileName    The file's name
     * @param   extension   The extension of the file
     *
     * @return     The HTML markup
     */
    private displayVideo(url: string, fileName: string, extension: string): string {
        let mimeType = '';
        switch (extension) {
            case 'ogg':
                mimeType = 'video/ogg';
                break;
            case 'mp4':
                mimeType = 'video/mp4';
                break;
            case 'webm':
                mimeType = 'video/webm';
                break;
            default:
                return this.displayLink(url, fileName);
        }

        return `<video controls="true" class="video-attachment" poster="assets/img/video-poster.png">
            <source src="${url}" type="${mimeType}">
        </video>`;
    }
}
