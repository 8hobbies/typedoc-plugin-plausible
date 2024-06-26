/** @license Apache-2.0
 *
 * Copyright 2024 8 Hobbies, LLC <hong@8hobbies.com>
 *
 * Licensed under the Apache License, Version 2.0(the "License");
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

import { Application, JSX, ParameterType } from "typedoc";

const optionSiteName = "plausibleSiteDomain" as const;
const optionSiteOrigin = "plausibleSiteOrigin" as const;

/** @ignore */
export function load(application: Application): void {
  application.options.addDeclaration({
    name: optionSiteName,
    type: ParameterType.String,
    help: `Domain name used by Plausible Analytics.`,
  });
  application.options.addDeclaration({
    name: optionSiteOrigin,
    type: ParameterType.String,
    help: `Base URL to get Plausible Analytics script from and report to. Should be everything but 'script.js'`,
    defaultValue: "plausible.io/js/",
  });
  application.renderer.hooks.on("head.end", (ctx) => {
    const plausibleSiteDomain = ctx.options.getValue(optionSiteName);
    if (typeof plausibleSiteDomain !== "string") {
      throw TypeError(
        `Unexpected ${optionSiteName} type: ${JSON.stringify(plausibleSiteDomain)}`,
      );
    }
    const plausibleSiteOrigin = ctx.options.getValue(optionSiteOrigin);
    if (typeof plausibleSiteOrigin !== "string") {
      throw TypeError(
        `Unexpected ${optionSiteOrigin} type: ${JSON.stringify(plausibleSiteOrigin)}`,
      );
    }
    const plausibleSrc = !plausibleSiteOrigin.endsWith("/")
      ? `${plausibleSiteOrigin}/`
      : plausibleSiteOrigin;
    if (plausibleSiteDomain === "") {
      // No site specified.
      return JSX.createElement(JSX.Fragment, {});
    }

    return JSX.createElement("script", {
      defer: true,
      "data-domain": plausibleSiteDomain,
      src: `https://${plausibleSrc}script.js`,
    });
  });
}
