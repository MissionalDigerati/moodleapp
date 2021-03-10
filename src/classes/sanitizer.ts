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
/**
 * Various sanitizing functions.
 */
export class Sanitizer {

    /**
     * Sanitize the HTML tags.
     *
     * @param  content The HTML content
     * @return         The sanitized content
     * @access private
     */
    static encodeHTML(content: string): string {
        return String(content)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Sanitize the HTML tags.
     *
     * @param  content The HTML content
     * @return         The sanitized content
     * @access private
     */
    static decodeHTML(content: string): string {
        return String(content)
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
    }

}
